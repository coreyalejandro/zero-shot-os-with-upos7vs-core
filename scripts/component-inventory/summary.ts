import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'components.json');
const baseRef = process.env.BASE_REF;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((key) => `"${key}":${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readBaseRegistry(ref: string) {
  const relativePath = REGISTRY_PATH.replace(ROOT + path.sep, '');
  const command = `git show ${ref}:${relativePath}`;
  const raw = execSync(command, { encoding: 'utf-8' });
  return JSON.parse(raw);
}

const headRegistry = readJson<{ components: Array<{ id: string }> }>(REGISTRY_PATH);
let baseRegistry: { components: Array<{ id: string }> } | null = null;
if (baseRef) {
  try {
    baseRegistry = readBaseRegistry(baseRef);
  } catch {
    console.error(`WARN: Unable to read base registry from ${baseRef}`);
  }
}

const headMap = new Map(headRegistry.components.map((component) => [component.id, component]));
const baseMap = new Map(baseRegistry ? baseRegistry.components.map((component) => [component.id, component]) : []);

const added: string[] = [];
const removed: string[] = [];
const changed: string[] = [];

for (const [id, component] of headMap.entries()) {
  if (!baseMap.has(id)) {
    added.push(id);
    continue;
  }
  const baseComponent = baseMap.get(id);
  if (stableStringify(baseComponent) !== stableStringify(component)) {
    changed.push(id);
  }
}

for (const id of baseMap.keys()) {
  if (!headMap.has(id)) {
    removed.push(id);
  }
}

const maxList = 20;
const renderList = (items: string[]) => {
  if (items.length === 0) return 'none';
  const slice = items.slice(0, maxList);
  const suffix = items.length > maxList ? ` (+${items.length - maxList} more)` : '';
  return `${slice.join(', ')}${suffix}`;
};

const lines: string[] = [];
lines.push('### Component Inventory Summary');
lines.push('');
lines.push(`- Added: ${added.length}`);
lines.push(`- Removed: ${removed.length}`);
lines.push(`- Changed: ${changed.length}`);
lines.push('');
lines.push(`- Added IDs: ${renderList(added)}`);
lines.push(`- Removed IDs: ${renderList(removed)}`);
lines.push(`- Changed IDs: ${renderList(changed)}`);

process.stdout.write(lines.join('\n'));

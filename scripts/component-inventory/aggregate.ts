import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type ComponentEntry = {
  id: string;
  name: string;
  type: string;
  description: string;
  ownerName: string;
  ownerId?: string;
  status: string;
  version: string;
  standalone: boolean;
  location: string[];
  interfaces: {
    inputs: string[];
    outputs: string[];
  };
  dependencies: string[];
};

type ComponentsRegistry = {
  schemaVersion: string;
  repo: {
    name: string;
    root: string;
    lastUpdated: string;
  };
  components: ComponentEntry[];
};

type ComponentsIndex = {
  updated: string;
  components: Array<ComponentEntry & { repo: string }>;
};

type ComponentsGraph = {
  updated: string;
  nodes: Array<{ id: string; name: string; type: string; repo: string }>;
  edges: Array<{ from: string; to: string }>;
};

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'COMPONENTS.schema.json');
const REGISTRY_FILENAME = 'components.json';

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function validateRegistry(registry: ComponentsRegistry, schema: object) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(registry);
  if (!ok) {
    const details = (validate.errors ?? [])
      .map((err) => `- ${err.instancePath || '(root)'} ${err.message ?? 'invalid'}`)
      .join('\n');
    throw new Error(`components.json failed schema validation.\n${details}`);
  }
}

function ensureUniqueId(existing: Set<string>, proposed: string) {
  if (!existing.has(proposed)) {
    existing.add(proposed);
    return proposed;
  }
  let counter = 2;
  let next = `${proposed}-${counter}`;
  while (existing.has(next)) {
    counter += 1;
    next = `${proposed}-${counter}`;
  }
  existing.add(next);
  return next;
}

const args = process.argv.slice(2);
const repoPaths = args.filter((arg) => !arg.startsWith('--'));
const outDirIndex = args.findIndex((arg) => arg === '--out-dir');
const outDir = outDirIndex >= 0 ? args[outDirIndex + 1] : path.join(ROOT, 'component-inventory');

if (repoPaths.length === 0) {
  console.error('ERROR: Provide one or more repo paths.');
  process.exit(1);
}

if (!outDir || outDir.startsWith('--')) {
  console.error('ERROR: --out-dir requires a value.');
  process.exit(1);
}

const schema = readJson<object>(SCHEMA_PATH);
const aggregated: ComponentsIndex['components'] = [];
const edges: ComponentsGraph['edges'] = [];
const nodes: ComponentsGraph['nodes'] = [];
const seenIds = new Set<string>();

for (const repoPath of repoPaths) {
  const resolvedRepoPath = path.resolve(repoPath);
  const registryPath = path.join(resolvedRepoPath, REGISTRY_FILENAME);
  if (!fs.existsSync(registryPath)) {
    console.warn(`WARN: Missing ${REGISTRY_FILENAME} in ${repoPath}`);
    continue;
  }

  const registry = readJson<ComponentsRegistry>(registryPath);
  try {
    validateRegistry(registry, schema);
  } catch (error) {
    console.error(`ERROR: ${repoPath} ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  for (const component of registry.components) {
    const baseId = component.id || `${registry.repo.name}/${component.name}`;
    const id = ensureUniqueId(seenIds, baseId);
    aggregated.push({ ...component, id, repo: registry.repo.name });
    nodes.push({ id, name: component.name, type: component.type, repo: registry.repo.name });
    for (const dependency of component.dependencies ?? []) {
      edges.push({ from: dependency, to: id });
    }
  }
}

const updated = new Date().toISOString();
const indexPayload: ComponentsIndex = {
  updated,
  components: aggregated,
};
const graphPayload: ComponentsGraph = {
  updated,
  nodes,
  edges,
};

fs.mkdirSync(outDir, { recursive: true });
const outIndexPath = path.join(outDir, 'components.index.json');
const outGraphPath = path.join(outDir, 'components.graph.json');

fs.writeFileSync(outIndexPath, JSON.stringify(indexPayload, null, 2) + '\n');
fs.writeFileSync(outGraphPath, JSON.stringify(graphPayload, null, 2) + '\n');

console.log(`Wrote ${path.relative(ROOT, outIndexPath).replace(/\\/g, '/')}`);
console.log(`Wrote ${path.relative(ROOT, outGraphPath).replace(/\\/g, '/')}`);

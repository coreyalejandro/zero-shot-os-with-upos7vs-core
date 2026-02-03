import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type ComponentInterfaces = {
  inputs: string[];
  outputs: string[];
};

type ComponentEntry = {
  id: string;
  name: string;
  type: 'service' | 'package' | 'ui' | 'prompt' | 'doc' | 'workflow' | 'other';
  description: string;
  ownerName: string;
  ownerId?: string;
  status: 'active' | 'beta' | 'deprecated';
  version: string;
  standalone: boolean;
  location: string[];
  interfaces: ComponentInterfaces;
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

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, 'components.json');
const SCHEMA_PATH = path.join(ROOT, 'COMPONENTS.schema.json');
const OUTPUT_DIR = path.join(ROOT, 'component-inventory');
const OUTPUT_MD_PATH = path.join(OUTPUT_DIR, 'COMPONENTS.md');
const COMPONENTS_DIR = path.join(ROOT, 'components');

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const strict = args.has('--strict');
const checkGenerated = args.has('--check-generated');

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

function validateSchema(registry: ComponentsRegistry) {
  const schema = readJson<object>(SCHEMA_PATH);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(registry);
  if (!ok) {
    console.error('ERROR: components.json failed schema validation.');
    for (const err of validate.errors ?? []) {
      console.error(`- ${err.instancePath || '(root)'} ${err.message ?? 'invalid'}`);
    }
    process.exit(1);
  }
}

function buildComponentsReadme(registry: ComponentsRegistry): string {
  const lines: string[] = [];
  lines.push('# Components');
  lines.push('');
  lines.push('This file is generated from `components.json`.');
  lines.push('Run `npm run components:build` after updating the registry.');
  lines.push('');
  lines.push('## Repo');
  lines.push('');
  lines.push(`- Name: ${registry.repo.name}`);
  lines.push(`- Root: ${registry.repo.root}`);
  lines.push(`- Last Updated: ${registry.repo.lastUpdated}`);
  lines.push('');

  const total = registry.components.length;
  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byStandalone = new Map<string, number>();
  for (const component of registry.components) {
    byType.set(component.type, (byType.get(component.type) ?? 0) + 1);
    byStatus.set(component.status, (byStatus.get(component.status) ?? 0) + 1);
    byStandalone.set(component.standalone ? 'standalone' : 'non-standalone', (byStandalone.get(component.standalone ? 'standalone' : 'non-standalone') ?? 0) + 1);
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total components: ${total}`);
  lines.push(`- By type: ${Array.from(byType.entries()).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  lines.push(`- By status: ${Array.from(byStatus.entries()).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  lines.push(`- By standalone: ${Array.from(byStandalone.entries()).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  lines.push('');

  lines.push('## Components');
  lines.push('');
  for (const component of registry.components) {
    lines.push(`### ${component.name}`);
    lines.push('');
    lines.push(`- ID: ${component.id}`);
    lines.push(`- Type: ${component.type}`);
    lines.push(`- Status: ${component.status}`);
    lines.push(`- Version: ${component.version}`);
    lines.push(`- Standalone: ${component.standalone ? 'true' : 'false'}`);
    lines.push(`- Owner: ${component.ownerName}`);
    if (component.ownerId) {
      lines.push(`- Owner ID: ${component.ownerId}`);
    }
    lines.push(`- Location: ${component.location.join(', ')}`);
    lines.push(`- Description: ${component.description}`);
    lines.push('- Interfaces:');
    lines.push(`  - Inputs: ${component.interfaces.inputs.join(', ') || 'none'}`);
    lines.push(`  - Outputs: ${component.interfaces.outputs.join(', ') || 'none'}`);
    lines.push(`- Dependencies: ${component.dependencies.length > 0 ? component.dependencies.join(', ') : 'none'}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function validateRegistry(registry: ComponentsRegistry) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const fileLocations = new Set<string>();

  for (const component of registry.components) {
    if (ids.has(component.id)) {
      errors.push(`ERROR: Duplicate component id ${component.id}`);
    }
    ids.add(component.id);

    for (const location of component.location) {
      const fullPath = path.join(ROOT, location);
      if (!fs.existsSync(fullPath)) {
        warnings.push(`WARN: Missing component location ${location}`);
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        fileLocations.add(location.replace(/\\/g, '/'));
      }
    }

    if (component.standalone) {
      const primaryLocation = component.location[0];
      const primaryPath = path.join(ROOT, primaryLocation);
      let docsDir = primaryPath;
      if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).isFile()) {
        docsDir = path.dirname(primaryPath);
      }
      const readmePath = path.join(docsDir, 'README.md');
      if (!fs.existsSync(readmePath)) {
        warnings.push(`WARN: Standalone component missing README.md in ${path.relative(ROOT, docsDir).replace(/\\/g, '/')}`);
      }
    }
  }

  if (fs.existsSync(COMPONENTS_DIR)) {
    const componentFiles: string[] = [];
    const stack = [COMPONENTS_DIR];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) break;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        if (entry.name.endsWith('.d.ts')) {
          continue;
        }
        if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
          continue;
        }
        componentFiles.push(fullPath);
      }
    }

    for (const fullPath of componentFiles) {
      const repoPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
      if (!fileLocations.has(repoPath)) {
        warnings.push(`WARN: Unregistered component file ${repoPath}`);
      }
    }
  }

  return { errors, warnings };
}

if (!fs.existsSync(REGISTRY_PATH)) {
  console.error('ERROR: components.json not found.');
  process.exit(1);
}

const registry = readJson<ComponentsRegistry>(REGISTRY_PATH);
validateSchema(registry);

const { errors, warnings } = validateRegistry(registry);
for (const warning of warnings) {
  console.warn(warning);
}
if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

if (shouldWrite) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_MD_PATH, buildComponentsReadme(registry));
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_MD_PATH).replace(/\\/g, '/')}`);
}

if (checkGenerated) {
  if (!fs.existsSync(OUTPUT_MD_PATH)) {
    console.error('ERROR: component-inventory/COMPONENTS.md is missing. Run `npm run components:build`.');
    process.exit(1);
  }
  const expected = buildComponentsReadme(registry);
  const actual = fs.readFileSync(OUTPUT_MD_PATH, 'utf-8');
  if (expected !== actual) {
    console.error('ERROR: component-inventory/COMPONENTS.md is out of date. Run `npm run components:build`.');
    process.exit(1);
  }
}

if (strict && warnings.length > 0) {
  process.exit(1);
}

import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ModeRulesManager } from '../services/mode-rules-manager.js';

const makeRuleContent = (label: string) => `# ${label}

## Activation
UPOS7VS-CORE:

## Body
${label} content`;

describe('ModeRulesManager trust integrations', () => {
  const testRoot = join(process.cwd(), '.mode-rules-manager');
  const rulesDir = join(testRoot, 'cursor', 'rules');
  const coreRulePath = join(rulesDir, 'upos-7-vs-core.mdc');
  const devRulePath = join(rulesDir, 'upos-7-vs-dev.mdc');
  let manager: ModeRulesManager;

  const seedRules = async () => {
    await writeFile(coreRulePath, makeRuleContent('Core'), 'utf-8');
    await writeFile(devRulePath, makeRuleContent('Dev'), 'utf-8');
  };

  beforeEach(async () => {
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
    await mkdir(rulesDir, { recursive: true });
    await seedRules();

    manager = new ModeRulesManager(rulesDir);
  });

  afterEach(async () => {
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it('supports undo/redo for mode rule updates and persists files', async () => {
    manager.enableUndoRedo(5);
    const updated = await manager.update('core', {
      content: makeRuleContent('Core Updated'),
    });

    expect(updated.content).toContain('Core Updated');
    expect(await readFile(coreRulePath, 'utf-8')).toContain('Core Updated');

    await manager.undo();
    expect(await readFile(coreRulePath, 'utf-8')).toContain('Core content');

    await manager.redo();
    expect(await readFile(coreRulePath, 'utf-8')).toContain('Core Updated');
  });

  it('creates and restores mode rule snapshots', async () => {
    manager.enableUndoRedo();
    manager.enableSnapshots(3);

    await manager.load('core');
    await manager.load('dev');

    const snap1 = manager.createSnapshot('initial');
    expect(snap1.label).toBe('initial');

    await manager.update('dev', { content: makeRuleContent('Dev Updated') });
    const snap2 = manager.createSnapshot('after-dev-update');
    expect(manager.listSnapshots()).toHaveLength(2);
    expect(snap2.label).toBe('after-dev-update');

    await manager.restoreSnapshot(snap1.id);
    expect(await readFile(devRulePath, 'utf-8')).toContain('Dev content');
  });
});

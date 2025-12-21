import { rm, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigManager, DEFAULT_CONFIG } from '../config.js';

describe('ConfigManager trust integrations', () => {
  const testRoot = join(process.cwd(), '.upos7vs-config-trust');
  const configPath = join(testRoot, '.upos7vs', 'config', 'config.json');
  let manager: ConfigManager;

  beforeEach(async () => {
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
    await mkdir(testRoot, { recursive: true });
    manager = new ConfigManager(testRoot);
    await manager.load();
  });

  afterEach(async () => {
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it('supports undo/redo around config updates and persists changes', async () => {
    manager.enableUndoRedo(5);

    const updated = await manager.update({
      features: {
        ...DEFAULT_CONFIG.features,
        analytics: {
          ...DEFAULT_CONFIG.features.analytics,
          enabled: false,
        },
      },
    });

    expect(updated.features.analytics.enabled).toBe(false);

    await manager.undo();
    const afterUndo = manager.get();
    expect(afterUndo.features.analytics.enabled).toBe(true);

    const saved = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(saved.features.analytics.enabled).toBe(true);

    await manager.redo();
    const afterRedo = manager.get();
    expect(afterRedo.features.analytics.enabled).toBe(false);
  });

  it('creates and restores snapshots for config states', async () => {
    manager.enableUndoRedo();
    manager.enableSnapshots(3);

    const snap1 = manager.createSnapshot('default');
    expect(snap1.label).toBe('default');

    await manager.update({
      platform: {
        ...DEFAULT_CONFIG.platform,
        primary: 'notion',
      },
    });

    const snap2 = manager.createSnapshot('notion-primary');
    expect(manager.listSnapshots()).toHaveLength(2);
    expect(snap2.label).toBe('notion-primary');

    const restored = await manager.restoreSnapshot(snap1.id);
    expect(restored?.platform.primary).toBe(DEFAULT_CONFIG.platform.primary);
  });
});

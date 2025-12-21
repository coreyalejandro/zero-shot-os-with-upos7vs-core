import { NextResponse } from 'next/server';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Mode } from '../../../packages/core/config.js';
import { ModeRulesManager } from '../../../packages/core/services/mode-rules-manager.js';

const modes: Mode[] = ['core', 'uxui', 'dev', 'next', 'agent', 'long', 'handoff'];

function buildManager() {
  const dashboardCwd = process.cwd();
  const rulesPath = join(dashboardCwd, '..', 'cursor', 'rules');
  if (!existsSync(rulesPath)) {
    throw new Error(`Rules path not found: ${rulesPath}`);
  }
  const manager = new ModeRulesManager(rulesPath);
  manager.enableUndoRedo();
  manager.enableSnapshots();
  manager.enableSoftDelete();
  return manager;
}

async function loadAllRules(manager: ModeRulesManager) {
  const loaded = [];
  for (const mode of modes) {
    try {
      loaded.push(await manager.load(mode));
    } catch (err) {
      // Ignore missing rule files
    }
  }
  return loaded;
}

export async function GET() {
  try {
    const manager = buildManager();
    const rules = await loadAllRules(manager);
    const snapshots = manager.listSnapshots();
    return NextResponse.json({
      rules: rules.map((rule) => ({
        mode: rule.mode,
        triggers: rule.triggers,
        keywords: rule.keywords,
        length: rule.content.length,
      })),
      snapshots: snapshots.map((snap) => ({
        id: snap.id,
        label: snap.label,
        createdAt: snap.createdAt,
      })),
    });
  } catch (error) {
    console.error('[mode-rules] GET error', error);
    return NextResponse.json({ error: 'Failed to load mode rules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action as string;
    const manager = buildManager();
    await loadAllRules(manager);

    if (action === 'delete') {
      const mode = body.mode as Mode | undefined;
      const ttlMs = typeof body.ttlMs === 'number' ? body.ttlMs : 5000;
      if (!mode) {
        return NextResponse.json({ error: 'mode is required' }, { status: 400 });
      }
      const token = await manager.softDelete(mode, ttlMs);
      const rules = manager.getAllRules();
      return NextResponse.json({
        token,
        rules: rules.map((rule) => ({
          mode: rule.mode,
          triggers: rule.triggers,
          keywords: rule.keywords,
          length: rule.content.length,
        })),
      });
    }

    if (action === 'undo') {
      const tokenId = body.tokenId as string | undefined;
      if (!tokenId) {
        return NextResponse.json({ error: 'tokenId is required' }, { status: 400 });
      }
      const ok = await manager.undoSoftDelete(tokenId);
      const rules = manager.getAllRules();
      return NextResponse.json({
        ok,
        rules: rules.map((rule) => ({
          mode: rule.mode,
          triggers: rule.triggers,
          keywords: rule.keywords,
          length: rule.content.length,
        })),
        snapshots: manager.listSnapshots().map((snap) => ({
          id: snap.id,
          label: snap.label,
          createdAt: snap.createdAt,
        })),
      });
    }

    if (action === 'restoreSnapshot') {
      const id = body.id as string | undefined;
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
      }
      const ok = await manager.restoreSnapshot(id);
      const rules = manager.getAllRules();
      const snapshots = manager.listSnapshots();
      return NextResponse.json({
        ok,
        rules: rules.map((rule) => ({
          mode: rule.mode,
          triggers: rule.triggers,
          keywords: rule.keywords,
          length: rule.content.length,
        })),
        snapshots: snapshots.map((snap) => ({
          id: snap.id,
          label: snap.label,
          createdAt: snap.createdAt,
        })),
      });
    }

    if (action === 'createSnapshot') {
      const label = body.label as string | undefined;
      const snap = manager.createSnapshot(label);
      const snapshots = manager.listSnapshots();
      return NextResponse.json({
        snapshot: {
          id: snap.id,
          label: snap.label,
          createdAt: snap.createdAt,
        },
        snapshots: snapshots.map((s) => ({
          id: s.id,
          label: s.label,
          createdAt: s.createdAt,
        })),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[mode-rules] POST error', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

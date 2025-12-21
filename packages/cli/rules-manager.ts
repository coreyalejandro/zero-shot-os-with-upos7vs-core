#!/usr/bin/env node
/**
 * Mode Rules Management CLI
 *
 * Allows listing, soft-deleting, undoing deletions, and snapshotting mode rules.
 * Usage:
 *   tsx packages/cli/rules-manager.ts list
 *   tsx packages/cli/rules-manager.ts delete <mode> [ttlMs]
 *   tsx packages/cli/rules-manager.ts undo <tokenId>
 *   tsx packages/cli/rules-manager.ts snapshots
 *   tsx packages/cli/rules-manager.ts snapshot:create [label]
 *   tsx packages/cli/rules-manager.ts snapshot:restore <id>
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Mode } from '../core/config.js';
import { ModeRulesManager } from '../core/services/mode-rules-manager.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

function color(text: string, tone: keyof typeof COLORS): string {
  return `${COLORS[tone]}${text}${COLORS.reset}`;
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const repoRoot = process.cwd();
  const rulesPath = join(repoRoot, 'cursor', 'rules');

  if (!existsSync(rulesPath)) {
    console.error(color(`Rules path not found: ${rulesPath}`, 'red'));
    process.exit(1);
  }

  const manager = new ModeRulesManager(rulesPath);
  manager.enableUndoRedo();
  manager.enableSnapshots();
  manager.enableSoftDelete();

  switch (command) {
    case 'list':
      await handleList(manager);
      break;
    case 'snapshots':
      await handleSnapshots(manager);
      break;
    case 'snapshot:create':
      await handleSnapshotCreate(manager, rest);
      break;
    case 'snapshot:restore':
      await handleSnapshotRestore(manager, rest);
      break;
    case 'delete':
      await handleDelete(manager, rest);
      break;
    case 'undo':
      await handleUndo(manager, rest);
      break;
    default:
      printHelp();
  }
}

async function handleList(manager: ModeRulesManager) {
  const rules = manager.getAllRules();
  if (!rules.length) {
    console.log(color('No rules loaded.', 'yellow'));
    return;
  }

  console.log(color('Mode rules:', 'blue'));
  for (const rule of rules) {
    console.log(`- ${rule.mode} (${rule.content.length} chars, ${rule.triggers.length} triggers)`);
  }
}

async function handleDelete(manager: ModeRulesManager, args: string[]) {
  const [modeArg, ttlArg] = args;
  if (!modeArg) {
    console.error(color('Usage: delete <mode> [ttlMs]', 'red'));
    process.exit(1);
  }
  const mode = modeArg as Mode;
  const ttlMs = ttlArg ? Number(ttlArg) : 5000;

  try {
    await manager.load(mode);
  } catch (error) {
    console.error(color(`Failed to load mode ${mode}: ${error}`, 'red'));
    process.exit(1);
  }

  const token = await manager.softDelete(mode, ttlMs);
  console.log(color(`Soft-deleted ${mode}. Undo token: ${token.id} (expires ${new Date(token.expiresAt).toISOString()})`, 'green'));
}

async function handleUndo(manager: ModeRulesManager, args: string[]) {
  const [tokenId] = args;
  if (!tokenId) {
    console.error(color('Usage: undo <tokenId>', 'red'));
    process.exit(1);
  }

  const ok = await manager.undoSoftDelete(tokenId);
  if (ok) {
    console.log(color(`Undo successful for token ${tokenId}`, 'green'));
  } else {
    console.error(color(`Undo failed or token expired: ${tokenId}`, 'red'));
    process.exit(1);
  }
}

function printHelp() {
  console.log(`Mode Rules Manager
Commands:
  list                 List loaded mode rules
  delete <mode> [ttl]  Soft-delete a mode rule with optional TTL (ms)
  undo <token>         Undo a soft delete using the provided token
  snapshots            List snapshots
  snapshot:create [label]  Create a snapshot (optional label)
  snapshot:restore <id>    Restore a snapshot by id`);
}

async function handleSnapshots(manager: ModeRulesManager) {
  const snaps = manager.listSnapshots();
  if (!snaps.length) {
    console.log(color('No snapshots available.', 'yellow'));
    return;
  }
  console.log(color('Snapshots:', 'blue'));
  snaps.forEach((snap) => {
    console.log(`- ${snap.id} ${snap.label ? `(${snap.label})` : ''} @ ${new Date(snap.createdAt).toISOString()}`);
  });
}

async function handleSnapshotCreate(manager: ModeRulesManager, args: string[]) {
  const label = args[0];
  const snap = manager.createSnapshot(label);
  console.log(color(`Snapshot created: ${snap.id} ${label ? `(${label})` : ''}`, 'green'));
}

async function handleSnapshotRestore(manager: ModeRulesManager, args: string[]) {
  const [id] = args;
  if (!id) {
    console.error(color('Usage: snapshot:restore <id>', 'red'));
    process.exit(1);
  }
  const ok = await manager.restoreSnapshot(id);
  if (!ok) {
    console.error(color(`Restore failed for snapshot ${id}`, 'red'));
    process.exit(1);
  }
  console.log(color(`Snapshot restored: ${id}`, 'green'));
}

main().catch((err) => {
  console.error(color(`Error: ${err}`, 'red'));
  process.exit(1);
});

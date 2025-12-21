import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Mode } from '../config.js';
import { UndoRedoStack, UndoableCommand } from '../trust/undo-stack.js';
import { SnapshotManager } from '../trust/snapshot-manager.js';
import { SoftDeleteBin } from '../trust/drafts-and-soft-delete.js';
import { GuardrailNotifier, UndoToken } from '../trust/guardrail-notifier.js';

export type ModeRule = {
  mode: Mode;
  content: string;
  triggers: string[];
  keywords: string[];
};

export class ModeRulesManager {
  private rules = new Map<Mode, ModeRule>();
  private undoStack: UndoRedoStack<ModeRulesManager> | null = null;
  private snapshots: SnapshotManager<ModeRule[]> | null = null;
  private softDeleteBin: SoftDeleteBin<ModeRule> | null = null;
  private guardrails: GuardrailNotifier | null = null;

  constructor(private readonly rulesPath: string) {}

  async load(mode: Mode): Promise<ModeRule> {
    const existing = this.rules.get(mode);
    if (existing) return this.clone(existing);

    const rule = await this.readRuleFromDisk(mode);
    this.rules.set(mode, rule);
    return this.clone(rule);
  }

  async update(mode: Mode, update: Partial<Omit<ModeRule, 'mode'>>): Promise<ModeRule> {
    const current = await this.load(mode);
    const before = this.clone(current);
    const next: ModeRule = {
      ...current,
      ...update,
      mode,
    };

    this.rules.set(mode, next);
    await this.writeRuleToDisk(mode, next.content);
    this.recordHistory(`mode-rule-${mode}-update`, before, this.clone(next));
    return this.clone(next);
  }

  enableUndoRedo(maxDepth = 20): void {
    if (!this.undoStack) {
      this.undoStack = new UndoRedoStack<ModeRulesManager>(this, maxDepth);
    }
  }

  async undo(): Promise<boolean> {
    if (!this.undoStack) return false;
    return Boolean(await this.undoStack.undo());
  }

  async redo(): Promise<boolean> {
    if (!this.undoStack) return false;
    return Boolean(await this.undoStack.redo());
  }

  enableSnapshots(maxSnapshots = 5): void {
    if (!this.snapshots) {
      this.snapshots = new SnapshotManager<ModeRule[]>(maxSnapshots);
    }
  }

  getAllRules(): ModeRule[] {
    return this.getSnapshot();
  }

  enableSoftDelete(): void {
    if (!this.softDeleteBin) {
      this.softDeleteBin = new SoftDeleteBin<ModeRule>();
    }
    if (!this.guardrails) {
      this.guardrails = new GuardrailNotifier();
    }
  }

  async softDelete(mode: Mode, ttlMs = 5000): Promise<UndoToken> {
    if (!this.softDeleteBin || !this.guardrails) {
      throw new Error('Soft delete not enabled. Call enableSoftDelete() first.');
    }

    const rule = await this.load(mode);
    this.rules.delete(mode);
    await this.removeRuleFromDisk(mode);

    const entry = this.softDeleteBin.softDelete(mode, rule, ttlMs);
    return this.guardrails.notify(`Deleted mode rule: ${mode}`, async () => {
      const restored = this.softDeleteBin?.restore(mode);
      if (restored) {
        this.rules.set(mode, this.clone(restored));
        await this.writeRuleToDisk(mode, restored.content);
      }
    }, ttlMs);
  }

  async undoSoftDelete(tokenId: string): Promise<boolean> {
    if (!this.guardrails) return false;
    return this.guardrails.tryUndo(tokenId);
  }

  createSnapshot(label?: string) {
    if (!this.snapshots) {
      throw new Error('Snapshots not enabled. Call enableSnapshots() first.');
    }
    return this.snapshots.createSnapshot(this.getSnapshot(), label);
  }

  listSnapshots() {
    if (!this.snapshots) return [];
    return this.snapshots.listSnapshots();
  }

  async restoreSnapshot(id: string): Promise<boolean> {
    if (!this.snapshots) return false;
    const snap = this.snapshots.restoreSnapshot(id);
    if (!snap) return false;

    const before = this.getSnapshot();
    this.applySnapshot(snap);
    await this.persistAll();
    this.recordHistory('mode-rules-restore', before, this.cloneRulesArray(snap));
    return true;
  }

  private async readRuleFromDisk(mode: Mode): Promise<ModeRule> {
    const filename = mode === 'core' ? 'upos-7-vs-core.mdc' : `upos-7-vs-${mode}.mdc`;
    const filepath = join(this.rulesPath, filename);
    const content = await readFile(filepath, 'utf-8');

    const triggers: string[] = [];
    const keywords: string[] = [];

    const triggerMatch = content.match(/##\s*Activation[^#]*([\s\S]*?)(?=##|$)/i);
    if (triggerMatch) {
      const activationSection = triggerMatch[1];
      const words = activationSection.match(/[A-Z][A-Z_-]+/g) || [];
      triggers.push(...words);
    }

    keywords.push(mode, `${mode} mode`);

    return { mode, content, triggers, keywords };
  }

  private async writeRuleToDisk(mode: Mode, content: string): Promise<void> {
    const filename = mode === 'core' ? 'upos-7-vs-core.mdc' : `upos-7-vs-${mode}.mdc`;
    const filepath = join(this.rulesPath, filename);
    await writeFile(filepath, content, 'utf-8');
  }

  private async removeRuleFromDisk(mode: Mode): Promise<void> {
    const filename = mode === 'core' ? 'upos-7-vs-core.mdc' : `upos-7-vs-${mode}.mdc`;
    const filepath = join(this.rulesPath, filename);
    await rm(filepath, { force: true });
  }

  private recordHistory(label: string, before: ModeRule | ModeRule[], after: ModeRule | ModeRule[]): void {
    if (!this.undoStack) return;
    const command: UndoableCommand<ModeRulesManager> = {
      id: `${label}-${Date.now()}`,
      label,
      execute: async (manager) => {
        if (Array.isArray(after)) {
          manager.applySnapshot(after as ModeRule[]);
          await manager.persistAll();
        } else {
          const rule = after as ModeRule;
          manager.rules.set(rule.mode, manager.clone(rule));
          await manager.writeRuleToDisk(rule.mode, rule.content);
        }
      },
      undo: async (manager) => {
        if (Array.isArray(before)) {
          manager.applySnapshot(before as ModeRule[]);
          await manager.persistAll();
        } else {
          const rule = before as ModeRule;
          manager.rules.set(rule.mode, manager.clone(rule));
          await manager.writeRuleToDisk(rule.mode, rule.content);
        }
      },
    };
    this.undoStack.recordExecuted(command);
  }

  private getSnapshot(): ModeRule[] {
    return Array.from(this.rules.values()).map((rule) => this.clone(rule));
  }

  private applySnapshot(snapshot: ModeRule[]): void {
    this.rules.clear();
    for (const rule of snapshot) {
      this.rules.set(rule.mode, this.clone(rule));
    }
  }

  private async persistAll(): Promise<void> {
    await Promise.all(
      Array.from(this.rules.values()).map((rule) => this.writeRuleToDisk(rule.mode, rule.content))
    );
  }

  private clone(rule: ModeRule): ModeRule {
    return {
      mode: rule.mode,
      content: rule.content,
      triggers: [...(rule.triggers || [])],
      keywords: [...(rule.keywords || [])],
    };
  }

  private cloneRulesArray(rules: ModeRule[]): ModeRule[] {
    return rules.map((rule) => this.clone(rule));
  }
}

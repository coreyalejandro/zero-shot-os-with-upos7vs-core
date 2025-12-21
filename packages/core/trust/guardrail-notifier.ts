type UndoHandler = () => Promise<void> | void;

export type UndoToken = {
  id: string;
  description: string;
  expiresAt: number;
};

type UndoEntry = {
  description: string;
  expiresAt: number;
  handler: UndoHandler;
};

export class GuardrailNotifier {
  private pendingUndo = new Map<string, UndoEntry>();

  notify(description: string, handler: UndoHandler, ttlMs: number = 5000): UndoToken {
    const token: UndoToken = {
      id: `undo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description,
      expiresAt: Date.now() + ttlMs,
    };

    this.pendingUndo.set(token.id, {
      description,
      expiresAt: token.expiresAt,
      handler,
    });

    return token;
  }

  async tryUndo(tokenId: string): Promise<boolean> {
    const entry = this.pendingUndo.get(tokenId);
    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      this.pendingUndo.delete(tokenId);
      return false;
    }

    await entry.handler();
    this.pendingUndo.delete(tokenId);
    return true;
  }

  pruneExpired(now: number = Date.now()): number {
    let removed = 0;
    for (const [id, entry] of this.pendingUndo.entries()) {
      if (entry.expiresAt < now) {
        this.pendingUndo.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  pendingCount(): number {
    return this.pendingUndo.size;
  }
}

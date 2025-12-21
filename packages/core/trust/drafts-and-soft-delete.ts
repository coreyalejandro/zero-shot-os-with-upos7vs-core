type DraftEntry<TDraft> = {
  id: string;
  updatedAt: number;
  data: TDraft;
};

type SoftDeleteEntry<TPayload> = {
  id: string;
  deletedAt: number;
  expiresAt?: number;
  payload: TPayload;
};

export class DraftManager<TDraft> {
  private drafts = new Map<string, DraftEntry<TDraft>>();

  stageDraft(id: string, data: TDraft): DraftEntry<TDraft> {
    const draft: DraftEntry<TDraft> = {
      id,
      updatedAt: Date.now(),
      data: this.clone(data),
    };

    this.drafts.set(id, draft);
    return draft;
  }

  readDraft(id: string): DraftEntry<TDraft> | null {
    const draft = this.drafts.get(id);
    return draft
      ? {
          ...draft,
          data: this.clone(draft.data),
        }
      : null;
  }

  async publishDraft(
    id: string,
    publisher: (draft: TDraft) => Promise<void> | void
  ): Promise<boolean> {
    const draft = this.drafts.get(id);
    if (!draft) {
      return false;
    }

    await publisher(this.clone(draft.data));
    this.drafts.delete(id);
    return true;
  }

  discardDraft(id: string): boolean {
    return this.drafts.delete(id);
  }

  listDrafts(): DraftEntry<TDraft>[] {
    return Array.from(this.drafts.values()).map((draft) => ({
      ...draft,
      data: this.clone(draft.data),
    }));
  }

  private clone(value: TDraft): TDraft {
    return JSON.parse(JSON.stringify(value));
  }
}

export class SoftDeleteBin<TPayload> {
  private bin = new Map<string, SoftDeleteEntry<TPayload>>();

  softDelete(id: string, payload: TPayload, ttlMs?: number): SoftDeleteEntry<TPayload> {
    const entry: SoftDeleteEntry<TPayload> = {
      id,
      payload: this.clone(payload),
      deletedAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    this.bin.set(id, entry);
    return entry;
  }

  restore(id: string): TPayload | null {
    const entry = this.bin.get(id);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.bin.delete(id);
      return null;
    }

    this.bin.delete(id);
    return this.clone(entry.payload);
  }

  collectGarbage(now: number = Date.now()): number {
    let purged = 0;
    for (const [id, entry] of this.bin.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.bin.delete(id);
        purged += 1;
      }
    }
    return purged;
  }

  listDeleted(): SoftDeleteEntry<TPayload>[] {
    return Array.from(this.bin.values()).map((entry) => ({
      ...entry,
      payload: this.clone(entry.payload),
    }));
  }

  private clone(value: TPayload): TPayload {
    return JSON.parse(JSON.stringify(value));
  }
}

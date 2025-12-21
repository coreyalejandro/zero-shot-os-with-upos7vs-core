type Snapshot<TState> = {
  id: string;
  createdAt: number;
  label?: string;
  state: TState;
};

export class SnapshotManager<TState> {
  private snapshots: Snapshot<TState>[] = [];

  constructor(private readonly maxSnapshots = 10) {}

  createSnapshot(state: TState, label?: string): Snapshot<TState> {
    const snapshot: Snapshot<TState> = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      label,
      state: this.clone(state),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  restoreSnapshot(id: string): TState | null {
    const snapshot = this.snapshots.find((snap) => snap.id === id);
    if (!snapshot) {
      return null;
    }

    return this.clone(snapshot.state);
  }

  listSnapshots(): Array<Omit<Snapshot<TState>, 'state'>> {
    return this.snapshots.map(({ id, createdAt, label }) => ({
      id,
      createdAt,
      label,
    }));
  }

  clear(): void {
    this.snapshots = [];
  }

  private clone(value: TState): TState {
    return JSON.parse(JSON.stringify(value));
  }
}

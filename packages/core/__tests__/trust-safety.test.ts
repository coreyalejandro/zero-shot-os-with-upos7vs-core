import {
  DraftManager,
  GuardrailNotifier,
  SnapshotManager,
  SoftDeleteBin,
  TransactionalStore,
  UndoRedoStack,
} from '../trust/index.js';

describe('Trust and safety scaffolds', () => {
  it('supports undo/redo for command history', async () => {
    const context = { value: 0 };
    const stack = new UndoRedoStack(context, 5);

    const increment = {
      id: 'increment',
      label: 'Increment value',
      execute: (ctx: typeof context) => {
        ctx.value += 1;
      },
      undo: (ctx: typeof context) => {
        ctx.value -= 1;
      },
    };

    await stack.run(increment);
    expect(context.value).toBe(1);

    await stack.undo();
    expect(context.value).toBe(0);

    await stack.redo();
    expect(context.value).toBe(1);
  });

  it('wraps state changes in transactions that can be undone', async () => {
    const store = new TransactionalStore({ count: 0 });
    const stack = new UndoRedoStack(store, 10);
    store.attachUndoStack(stack);

    await store.run('increment-count', (draft) => ({ ...draft, count: draft.count + 1 }));
    expect(store.value.count).toBe(1);

    await stack.undo();
    expect(store.value.count).toBe(0);

    await stack.redo();
    expect(store.value.count).toBe(1);
  });

  it('creates and restores snapshots with bounded history', () => {
    const manager = new SnapshotManager<{ text: string }>(2);
    const first = manager.createSnapshot({ text: 'first' }, 'initial');
    manager.createSnapshot({ text: 'second' }, 'update');

    const restored = manager.restoreSnapshot(first.id);
    expect(restored?.text).toBe('first');

    manager.clear();
    expect(manager.listSnapshots()).toHaveLength(0);
  });

  it('supports drafts and soft deletes with recovery window', async () => {
    const drafts = new DraftManager<{ body: string }>();
    drafts.stageDraft('doc-1', { body: 'draft content' });

    let publishedBody = '';
    const published = await drafts.publishDraft('doc-1', (draft) => {
      publishedBody = draft.body;
    });

    expect(published).toBe(true);
    expect(publishedBody).toBe('draft content');
    expect(drafts.readDraft('doc-1')).toBeNull();

    const bin = new SoftDeleteBin<string>();
    bin.softDelete('note-1', 'important', 50);

    const restored = bin.restore('note-1');
    expect(restored).toBe('important');

    bin.softDelete('note-2', 'short lived', 1);
    bin.collectGarbage(Date.now() + 10);
    expect(bin.restore('note-2')).toBeNull();
  });

  it('allows guardrail notifications with inline undo', async () => {
    const guardrails = new GuardrailNotifier();
    let undone = false;

    const token = guardrails.notify('Deleted a row', () => {
      undone = true;
    }, 25);

    const undoResult = await guardrails.tryUndo(token.id);
    expect(undoResult).toBe(true);
    expect(undone).toBe(true);

    const expired = guardrails.notify('Expire quickly', () => {
      undone = false;
    }, 1);

    guardrails.pruneExpired(Date.now() + 10);
    expect(await guardrails.tryUndo(expired.id)).toBe(false);
  });
});

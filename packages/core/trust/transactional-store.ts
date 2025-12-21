import { UndoRedoStack, UndoableCommand } from './undo-stack.js';

type Mutator<TState> = (draft: TState) => TState;

export class TransactionalStore<TState extends object> {
  private state: TState;
  private undoStack?: UndoRedoStack<TransactionalStore<TState>>;

  constructor(initialState: TState, undoStack?: UndoRedoStack<TransactionalStore<TState>>) {
    this.state = this.clone(initialState);
    this.undoStack = undoStack;
  }

  attachUndoStack(stack: UndoRedoStack<TransactionalStore<TState>>): void {
    this.undoStack = stack;
  }

  get value(): TState {
    return this.clone(this.state);
  }

  async run(label: string, mutate: Mutator<TState>): Promise<TState> {
    const before = this.clone(this.state);
    const after = mutate(this.clone(this.state));
    this.state = this.clone(after);

    if (this.undoStack) {
      const command: UndoableCommand<TransactionalStore<TState>> = {
        id: `txn-${label}-${Date.now()}`,
        label,
        execute: (store) => {
          store.state = store.clone(after);
        },
        undo: (store) => {
          store.state = store.clone(before);
        },
      };

      this.undoStack.recordExecuted(command);
    }

    return this.value;
  }

  private clone(value: TState): TState {
    return JSON.parse(JSON.stringify(value));
  }
}

export interface UndoableCommand<TContext> {
  id: string;
  label: string;
  execute(context: TContext): Promise<void> | void;
  undo(context: TContext): Promise<void> | void;
  timestamp?: number;
}

export class UndoRedoStack<TContext> {
  private history: UndoableCommand<TContext>[] = [];
  private redoStack: UndoableCommand<TContext>[] = [];

  constructor(private readonly context: TContext, private readonly maxDepth = 50) {}

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get depth(): number {
    return this.history.length;
  }

  async run(command: UndoableCommand<TContext>): Promise<void> {
    await command.execute(this.context);
    this.push(command);
    this.redoStack = [];
  }

  recordExecuted(command: UndoableCommand<TContext>): void {
    // Use when the caller already ran the command side effects.
    this.push(command);
    this.redoStack = [];
  }

  async undo(): Promise<UndoableCommand<TContext> | null> {
    const command = this.history.pop();
    if (!command) {
      return null;
    }

    await command.undo(this.context);
    this.redoStack.push(command);
    return command;
  }

  async redo(): Promise<UndoableCommand<TContext> | null> {
    const command = this.redoStack.pop();
    if (!command) {
      return null;
    }

    await command.execute(this.context);
    this.push(command);
    return command;
  }

  peek(): UndoableCommand<TContext> | null {
    return this.history[this.history.length - 1] ?? null;
  }

  clear(): void {
    this.history = [];
    this.redoStack = [];
  }

  private push(command: UndoableCommand<TContext>): void {
    const stamped = { ...command, timestamp: command.timestamp ?? Date.now() };
    this.history.push(stamped);
    if (this.history.length > this.maxDepth) {
      this.history.shift();
    }
  }
}

export type EvalInput = {
  id: string;
  intent: string;
  prompt: string;
  response: string;
  platform: string;
  mode: string;
  metadata?: Record<string, unknown>;
};

export type EvalResult = {
  score: number; // normalized 0-1
  label?: string;
  reasoning?: string;
  costCents?: number;
  latencyMs?: number;
  provider: string;
  version?: string;
  error?: string;
};

export interface EvalEngine {
  name: string;
  evaluate(input: EvalInput): Promise<EvalResult>;
  healthy?(): Promise<boolean>;
}

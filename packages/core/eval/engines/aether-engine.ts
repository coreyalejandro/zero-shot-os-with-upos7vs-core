import { EvalEngine, EvalInput, EvalResult } from '../types.js';

type AetherEngineOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  version?: string;
};

export class AetherEngine implements EvalEngine {
  name = 'aether';
  private apiKey?: string;
  private baseUrl: string;
  private timeoutMs: number;
  private version?: string;

  constructor(options: AetherEngineOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.aether.dev';
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.version = options.version;
  }

  async healthy(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async evaluate(input: EvalInput): Promise<EvalResult> {
    if (!this.apiKey) {
      return {
        score: 0,
        label: 'skipped',
        reasoning: 'missing_api_key',
        provider: this.name,
        error: 'missing_api_key',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/flow/eval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          id: input.id,
          intent: input.intent,
          prompt: input.prompt,
          response: input.response,
          platform: input.platform,
          mode: input.mode,
          metadata: input.metadata,
          version: this.version,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!res.ok) {
        const errorText = await res.text();
        return {
          score: 0,
          label: 'error',
          reasoning: errorText,
          provider: this.name,
          latencyMs,
          error: `http_${res.status}`,
        };
      }

      const data = await res.json();

      return {
        score: typeof data.score === 'number' ? data.score : 0,
        label: data.label || 'unknown',
        reasoning: data.reasoning,
        latencyMs,
        provider: this.name,
        version: this.version,
        costCents: data.costCents,
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        score: 0,
        label: 'error',
        reasoning: isAbort ? 'timeout' : 'exception',
        provider: this.name,
        latencyMs,
        error: isAbort ? 'timeout' : 'exception',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

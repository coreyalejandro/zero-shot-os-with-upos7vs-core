import { EvalEngine, EvalInput, EvalResult } from '../types.js';

type LlmGraderOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  version?: string;
};

const DEFAULT_RUBRIC = `You are a strict grader. Score the assistant response 0-1 based on how well it satisfies the intent.
Return ONLY a JSON object: {"score": <0-1 number>, "label": "pass|partial|fail", "reason": "<short reason>"}.`;

export class LlmGraderEngine implements EvalEngine {
  name = 'llm-grader';
  private apiKey?: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;
  private version?: string;

  constructor(options: LlmGraderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-4o-mini';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.timeoutMs = options.timeoutMs ?? 8_000;
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
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: DEFAULT_RUBRIC },
            {
              role: 'user',
              content: [
                `Intent: ${input.intent}`,
                `Mode: ${input.mode}`,
                `Platform: ${input.platform}`,
                `Prompt: ${input.prompt}`,
                `Response: ${input.response}`,
              ].join('\n'),
            },
          ],
          temperature: 0,
          stream: false,
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - started;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          score: 0,
          label: 'error',
          reasoning: errorText,
          provider: this.name,
          latencyMs,
          error: `http_${response.status}`,
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || '';
      const parsed = this.parseJsonFromMessage(message);

      const score = typeof parsed.score === 'number' ? clamp(parsed.score, 0, 1) : 0;
      const label = typeof parsed.label === 'string' ? parsed.label : this.labelFromScore(score);

      return {
        score,
        label,
        reasoning: parsed.reason || message,
        latencyMs,
        provider: this.name,
        version: this.version,
        costCents: data.usage ? estimateCostCents(data.usage) : undefined,
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

  private parseJsonFromMessage(message: string): { score?: number; label?: string; reason?: string } {
    try {
      const start = message.indexOf('{');
      const end = message.lastIndexOf('}');
      if (start === -1 || end === -1) return {};
      return JSON.parse(message.substring(start, end + 1));
    } catch {
      return {};
    }
  }

  private labelFromScore(score: number): string {
    if (score >= 0.7) return 'pass';
    if (score >= 0.4) return 'partial';
    return 'fail';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateCostCents(usage: { prompt_tokens?: number; completion_tokens?: number }): number | undefined {
  if (!usage.prompt_tokens && !usage.completion_tokens) return undefined;
  const promptCostPer1k = 0.15; // cents per 1k tokens (approx for mini models)
  const completionCostPer1k = 0.6; // cents per 1k tokens
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  return (
    (prompt / 1000) * promptCostPer1k +
    (completion / 1000) * completionCostPer1k
  );
}

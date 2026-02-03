import { PIIScrubber } from '../utils/pii-scrubber.js';
import { EvalEngine, EvalInput, EvalResult } from './types.js';
import { AetherEngine } from './engines/aether-engine.js';
import { LlmGraderEngine } from './engines/llm-grader-engine.js';
import { HeuristicEngine } from './engines/heuristic-engine.js';
import { ProactiveEngine } from './engines/proactive-engine.js';
import { UserConfig } from '../config.js';

export type EvalRunnerOptions = {
  sampleRate: number; // 0-1
};

export class EvalRunner {
  private engines: EvalEngine[];
  private sampleRate: number;
  private piiScrubber: PIIScrubber;

  constructor(engines: EvalEngine[], options: EvalRunnerOptions) {
    this.engines = engines;
    this.sampleRate = options.sampleRate;
    this.piiScrubber = new PIIScrubber({
      enabled: true,
      mode: 'mask',
      placeholder: '[REDACTED]',
      detect: {
        emails: true,
        phoneNumbers: true,
        creditCards: true,
        ssn: true,
        ipAddresses: true,
        apiKeys: true,
        urls: false,
      },
      logActivity: false,
    });
  }

  /**
   * Execute evaluation on a sample of traffic.
   * Fails open and tries the next engine in order.
   */
  async maybeEvaluate(input: EvalInput): Promise<EvalResult | null> {
    if (Math.random() > this.sampleRate) return null;

    const scrubbed = this.scrubInput(input);

    for (const engine of this.engines) {
      try {
        const healthy = (await engine.healthy?.()) ?? true;
        if (!healthy) continue;

        const result = await engine.evaluate(scrubbed);
        return result;
      } catch {
        continue;
      }
    }

    return null;
  }

  private scrubInput(input: EvalInput): EvalInput {
    const scrub = (text: string) => this.piiScrubber.scrub(text).scrubbed;
    return {
      ...input,
      intent: scrub(input.intent),
      prompt: scrub(input.prompt),
      response: scrub(input.response),
    };
  }
}

/**
 * Build the eval runner based on configuration.
 * The order is Aether -> LLM grader -> heuristic to provide graceful fallback.
 */
export function buildEvalRunner(config: UserConfig): EvalRunner | null {
  const evalConfig = config.features?.evaluation;
  if (!evalConfig || !evalConfig.enabled) {
    return null;
  }

  const engines: EvalEngine[] = [];

  if (evalConfig.engines?.aether?.enabled) {
    engines.push(
      new AetherEngine({
        apiKey: evalConfig.engines.aether.apiKey,
        baseUrl: evalConfig.engines.aether.baseUrl,
        timeoutMs: evalConfig.engines.aether.timeoutMs,
        version: evalConfig.engines.aether.version,
      })
    );
  }

  if (evalConfig.engines?.llmGrader?.enabled) {
    engines.push(
      new LlmGraderEngine({
        apiKey: evalConfig.engines.llmGrader.apiKey,
        baseUrl: evalConfig.engines.llmGrader.baseUrl,
        model: evalConfig.engines.llmGrader.model,
        timeoutMs: evalConfig.engines.llmGrader.timeoutMs,
        version: evalConfig.engines.llmGrader.version,
      })
    );
  }

  if (evalConfig.engines?.heuristic?.enabled !== false) {
    engines.push(new HeuristicEngine());
  }

  // PROACTIVE Constitutional AI validator - always enabled for epistemic safety
  // Uses type assertion since proactive config is optional extension
  const proactiveConfig = (evalConfig.engines as Record<string, unknown>)?.proactive as {
    enabled?: boolean;
    strictMode?: boolean;
    highRiskDomains?: string[];
    confidenceThreshold?: number;
  } | undefined;
  
  if (proactiveConfig?.enabled !== false) {
    engines.push(
      new ProactiveEngine({
        strictMode: proactiveConfig?.strictMode ?? false,
        highRiskDomains: proactiveConfig?.highRiskDomains,
        confidenceThreshold: proactiveConfig?.confidenceThreshold,
      })
    );
  }

  if (engines.length === 0) {
    return null;
  }

  return new EvalRunner(engines, {
    sampleRate: evalConfig.sampleRate ?? 0,
  });
}

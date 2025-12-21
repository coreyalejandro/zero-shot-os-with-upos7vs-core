/**
 * UPOS-7-VS Orchestrator
 *
 * Central coordinator that brings together all services
 * Provides the main API for prompt engineering operations
 */

import { UserConfig, ConfigManager, getConfig, Mode } from './config.js';
import { ModeRouterService, ModeDetectionResult } from './services/mode-router.service.js';
import { AnalyticsService, PromptMetrics } from './services/analytics.service.js';
import { TelemetryService } from './services/telemetry.service.js';
import { VerbalizedSamplingEngine, SamplingResult, SamplingConfig } from '../verbalized-sampling/index.js';
import { Span, SpanStatusCode } from '@opentelemetry/api';
import { EvalRunner, buildEvalRunner } from './eval/eval-runner.js';
import { EvalResult } from './eval/types.js';

export interface PromptRequest {
  message: string;
  platform?: string;
  mode?: string; // Optional override
  context?: any;
  options?: {
    verbalizedSampling?: boolean;
    samplingConfig?: Partial<SamplingConfig>;
  };
}

export interface PromptResponse {
  content: string;
  mode: string;
  modeDetection: ModeDetectionResult;
  sampling?: SamplingResult;
  evaluation?: EvalResult | null;
  metadata: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
  };
}

/**
 * UPOS Orchestrator
 *
 * Main entry point for all prompt engineering operations
 * Coordinates services based on user configuration
 */
export class UPOSOrchestrator {
  private config: ConfigManager;
  private modeRouter: ModeRouterService | null = null;
  private analytics: AnalyticsService | null = null;
  private telemetry: TelemetryService | null = null;
  private samplingEngine: VerbalizedSamplingEngine | null = null;
  private evalRunner: EvalRunner | null = null;
  private initialized: boolean = false;

  constructor(repoRoot?: string) {
    this.config = getConfig(repoRoot);
  }

  /**
   * Initialize the orchestrator and all services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load configuration
    const userConfig = await this.config.load();

    // Initialize services
    this.telemetry = new TelemetryService(userConfig);
    await this.telemetry.initialize();

    this.modeRouter = new ModeRouterService(userConfig);
    await this.modeRouter.initialize();

    this.analytics = new AnalyticsService(userConfig);
    await this.analytics.initialize();

    this.evalRunner = buildEvalRunner(userConfig);

    // Initialize verbalized sampling engine if enabled
    if (userConfig.features.verbalizedSampling.enabled) {
      this.samplingEngine = new VerbalizedSamplingEngine({
        numSamples: userConfig.features.verbalizedSampling.numSamples,
        strategy: userConfig.features.verbalizedSampling.strategy === 'off'
          ? 'balanced'
          : userConfig.features.verbalizedSampling.strategy,
      });
    }

    this.initialized = true;
    console.log('✓ UPOS-7-VS Orchestrator initialized');
  }

  /**
   * Shutdown orchestrator and all services
   */
  async shutdown(): Promise<void> {
    if (this.modeRouter) await this.modeRouter.shutdown();
    if (this.analytics) await this.analytics.shutdown();
    if (this.telemetry) await this.telemetry.shutdown();

    this.initialized = false;
    console.log('✓ UPOS-7-VS Orchestrator shutdown');
  }

  /**
   * Process a prompt request
   */
  async processPrompt(request: PromptRequest): Promise<PromptResponse> {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    let span: Span | null = null;

    if (this.telemetry) {
      span = this.telemetry.startSpan('process_prompt', {
        'upos.platform': request.platform,
        'upos.request_length': request.message.length,
      });
    }

    try {
      // 1. Detect mode (async)
      const modeDetection = (await this.modeRouter?.detectMode(request.message, request.context)) || {
        mode: 'core' as Mode,
        confidence: 1.0,
        reason: 'Default mode',
        method: 'fallback' as const,
      };

      const mode = (request.mode as Mode) || modeDetection.mode;

      if (span) {
        span.setAttribute('upos.mode', mode);
        span.setAttribute('upos.confidence', modeDetection.confidence);
        span.setAttribute('upos.detection_method', modeDetection.method);
        if (modeDetection.latency) {
          span.setAttribute('upos.router_latency', modeDetection.latency);
        }
      }

      // 2. Get mode rules
      const rules = this.modeRouter?.getRules(mode);
      if (!rules) {
        throw new Error(`Mode ${mode} not found`);
      }

      // 3. Check if verbalized sampling should be used
      const userConfig = this.config.get();
      const useSampling =
        request.options?.verbalizedSampling ??
        userConfig.features.verbalizedSampling.enabled;

    let samplingResult: SamplingResult | undefined;
    let finalContent: string;
    let evaluationResult: EvalResult | null = null;

      if (useSampling && this.samplingEngine) {
        // 4a. Generate verbalized sampling prompt
        const samplingPrompt = this.samplingEngine.generateSamplingPrompt(
          request.message,
          mode
        );

        // 4b. Here you would call the LLM with the sampling prompt
        // For now, we'll return the prompt itself as a placeholder
        finalContent = samplingPrompt;
      } else {
        // 4c. Regular single-response mode
        const prompt = this.buildPrompt(request.message, rules.content);
        finalContent = prompt;
      }

      const executionTime = Date.now() - startTime;

      // 5. Optional evaluation (shadow, fail-open)
      if (this.evalRunner) {
        evaluationResult = await this.evalRunner.maybeEvaluate({
          id: `trace_${Date.now()}`,
          intent: request.message,
          prompt: finalContent,
          response: finalContent,
          platform: request.platform || 'cursor',
          mode,
        });
      }

      // 6. Record analytics if enabled
      if (this.analytics?.getStatus().enabled) {
        // Use createMetric() which handles PII scrubbing and sanitization
        const metric = this.analytics.createMetric(
          (request.platform as PromptMetrics['platform']) || 'cursor',
          mode as PromptMetrics['mode'],
          request.message,
          finalContent.length,
          executionTime,
          useSampling,
          {
            quality: 'acceptable', // Default quality, can be enhanced later
            router: {
              method: modeDetection.method,
              confidence: modeDetection.confidence,
              latency: modeDetection.latency,
            },
            evaluation: evaluationResult
              ? {
                  provider: evaluationResult.provider,
                  score: evaluationResult.score,
                  label: evaluationResult.label,
                  latencyMs: evaluationResult.latencyMs,
                  costCents: evaluationResult.costCents,
                  version: evaluationResult.version,
                  error: evaluationResult.error,
                }
              : undefined,
          }
        );

        await this.analytics.record(metric);
      }

      if (span) {
        span.setAttribute('upos.execution_time', executionTime);
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // 6. Return response
      return {
        content: finalContent,
        mode,
        modeDetection,
        sampling: samplingResult,
        evaluation: evaluationResult,
        metadata: {
          executionTime,
        },
      };
    } catch (error) {
      if (span) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      }
      throw error;
    } finally {
      if (span) {
        span.end();
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): UserConfig {
    return this.config.get();
  }

  /**
   * Update configuration
   */
  async updateConfig(partial: Partial<UserConfig>): Promise<UserConfig> {
    const updated = await this.config.update(partial);

    if (this.modeRouter) await this.modeRouter.updateConfig(updated);
    if (this.analytics) await this.analytics.updateConfig(updated);
    if (this.telemetry) await this.telemetry.updateConfig(updated);

    // Reinitialize sampling engine if config changed
    if (partial.features?.verbalizedSampling) {
      const vsConfig = updated.features.verbalizedSampling;
      if (vsConfig.enabled && !this.samplingEngine) {
        this.samplingEngine = new VerbalizedSamplingEngine({
          numSamples: vsConfig.numSamples,
          strategy: vsConfig.strategy === 'off' ? 'balanced' : vsConfig.strategy,
        });
      } else if (!vsConfig.enabled && this.samplingEngine) {
        this.samplingEngine = null;
      } else if (this.samplingEngine) {
        this.samplingEngine.updateConfig({
          numSamples: vsConfig.numSamples,
          strategy: vsConfig.strategy === 'off' ? 'balanced' : vsConfig.strategy,
        });
      }
    }

    if (partial.features?.evaluation) {
      this.evalRunner = buildEvalRunner(updated);
    }

    return updated;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    if (this.modeRouter) results.set('ModeRouter', await this.modeRouter.healthCheck());
    if (this.analytics) results.set('Analytics', await this.analytics.healthCheck());
    if (this.telemetry) results.set('Telemetry', await this.telemetry.healthCheck());
    return results;
  }

  /**
   * Build prompt with mode rules
   */
  private buildPrompt(message: string, rules: string): string {
    return `${rules}\n\n---\n\nUser Request: ${message}`;
  }
}

/**
 * Create and initialize orchestrator
 */
export async function createOrchestrator(repoRoot?: string): Promise<UPOSOrchestrator> {
  const orchestrator = new UPOSOrchestrator(repoRoot);
  await orchestrator.initialize();
  return orchestrator;
}

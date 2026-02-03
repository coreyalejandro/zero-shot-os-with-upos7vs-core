/**
 * PROACTIVE AI Orchestrator
 *
 * Unified orchestrator combining:
 * - Zero-Shot OS multi-model routing
 * - PROACTIVE Constitutional AI safety framework
 * - COL (Cognitive Operating Layer) intent compilation
 * - Gemini API integration for hackathon
 *
 * This orchestrator demonstrates "robust systems using the Gemini API"
 * with multi-step orchestration, dynamic routing, and runtime safety.
 */

import { UserConfig, ConfigManager, getConfig, Mode } from './config.js';
import { ModeRouterService, ModeDetectionResult } from './services/mode-router.service.js';
import { AnalyticsService, PromptMetrics } from './services/analytics.service.js';
import { TelemetryService } from './services/telemetry.service.js';
import { COLService, IntentReceipt } from './services/col.service.js';
import { GeminiAdapter, GeminiConfig, GeminiRequest, GeminiResponse } from './adapters/gemini-adapter.js';
import { EvalRunner, buildEvalRunner } from './eval/eval-runner.js';
import { ProactiveEngine } from './eval/engines/proactive-engine.js';
import { EvalResult } from './eval/types.js';
import { Span, SpanStatusCode } from '@opentelemetry/api';

/**
 * PROACTIVE prompt request with intent compilation
 */
export interface ProactiveRequest {
  message: string;
  platform?: string;
  mode?: string;
  context?: Record<string, unknown>;
  options?: {
    skipCOL?: boolean;  // Skip intent compilation (not recommended)
    skipSafety?: boolean;  // Skip PROACTIVE validation (dangerous)
    systemInstruction?: string;
  };
}

/**
 * PROACTIVE response with full traceability
 */
export interface ProactiveResponse {
  content: string;
  mode: string;
  modeDetection: ModeDetectionResult;
  intentReceipt: IntentReceipt | null;
  safetyEval: EvalResult | null;
  geminiResponse: GeminiResponse | null;
  trace: {
    traceId: string;
    executionTime: number;
    stages: string[];
    tokensUsed?: number;
    cost?: number;
  };
  status: 'success' | 'warning' | 'blocked' | 'error';
  blockReason?: string;
}

/**
 * PROACTIVE AI Orchestrator
 *
 * Multi-stage orchestration pipeline:
 * 1. COL: Compile user intent into auditable receipt
 * 2. Route: Semantic mode detection with PROACTIVE principles
 * 3. Generate: Call Gemini with appropriate system instruction
 * 4. Validate: Run PROACTIVE safety evaluation
 * 5. Return: Traceable response or fail-closed rejection
 */
export class ProactiveOrchestrator {
  private config: ConfigManager;
  private modeRouter: ModeRouterService | null = null;
  private analytics: AnalyticsService | null = null;
  private telemetry: TelemetryService | null = null;
  private col: COLService | null = null;
  private gemini: GeminiAdapter | null = null;
  private evalRunner: EvalRunner | null = null;
  private proactiveValidator: ProactiveEngine | null = null;
  private initialized: boolean = false;

  constructor(repoRoot?: string) {
    this.config = getConfig(repoRoot);
  }

  /**
   * Initialize all services
   */
  async initialize(geminiConfig?: Partial<GeminiConfig>): Promise<void> {
    if (this.initialized) return;

    const userConfig = await this.config.load();

    // Initialize telemetry
    this.telemetry = new TelemetryService(userConfig);
    await this.telemetry.initialize();

    // Initialize mode router
    this.modeRouter = new ModeRouterService(userConfig);
    await this.modeRouter.initialize();

    // Initialize analytics
    this.analytics = new AnalyticsService(userConfig);
    await this.analytics.initialize();

    // Initialize COL (Cognitive Operating Layer)
    this.col = new COLService(userConfig);
    await this.col.initialize();

    // Initialize Gemini adapter
    const apiKey = geminiConfig?.apiKey ||
      userConfig.providers?.gemini?.apiKey ||
      process.env.GEMINI_API_KEY;

    if (apiKey) {
      this.gemini = new GeminiAdapter(
        { apiKey, ...geminiConfig },
        userConfig
      );
      await this.gemini.initialize();
    }

    // Initialize eval runner with PROACTIVE engine
    this.evalRunner = buildEvalRunner(userConfig);
    // Use type assertion for optional proactive config
    const proactiveFeatures = (userConfig.features as Record<string, unknown>)?.proactive as {
      strictMode?: boolean;
    } | undefined;
    
    this.proactiveValidator = new ProactiveEngine({
      strictMode: proactiveFeatures?.strictMode ?? false,
    });

    this.initialized = true;
    console.log('✓ PROACTIVE AI Orchestrator initialized');
    console.log('  - COL: Intent compilation enabled');
    console.log('  - Gemini: ' + (this.gemini ? 'Connected' : 'Not configured'));
    console.log('  - Safety: PROACTIVE validator active');
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    if (this.modeRouter) await this.modeRouter.shutdown();
    if (this.analytics) await this.analytics.shutdown();
    if (this.telemetry) await this.telemetry.shutdown();
    if (this.col) await this.col.shutdown();
    if (this.gemini) await this.gemini.shutdown();

    this.initialized = false;
    console.log('✓ PROACTIVE AI Orchestrator shutdown');
  }

  /**
   * Process a request through the full PROACTIVE pipeline
   */
  async process(request: ProactiveRequest): Promise<ProactiveResponse> {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    const stages: string[] = [];
    let span: Span | null = null;

    if (this.telemetry) {
      span = this.telemetry.startSpan('proactive_process', {
        'proactive.platform': request.platform,
        'proactive.request_length': request.message.length,
      });
    }

    try {
      // Stage 1: COL Intent Compilation
      stages.push('col_compile');
      let intentReceipt: IntentReceipt | null = null;

      if (!request.options?.skipCOL && this.col) {
        intentReceipt = await this.col.compile(request.message, request.context);

        // Check for rejected intents
        if (intentReceipt.validation_status === 'rejected') {
          return this.createBlockedResponse(
            intentReceipt,
            'Intent rejected by COL: ' + intentReceipt.rejection_reason,
            startTime,
            stages
          );
        }

        // Check for high-risk requiring confirmation
        if (intentReceipt.risk_assessment.requires_confirmation) {
          stages.push('risk_flagged');
        }
      }

      // Stage 2: Mode Detection
      stages.push('mode_detect');
      const modeDetection = (await this.modeRouter?.detectMode(
        request.message,
        request.context
      )) || {
        mode: 'core' as Mode,
        confidence: 1.0,
        reason: 'Default mode',
        method: 'fallback' as const,
      };

      const mode = (request.mode as Mode) || modeDetection.mode;

      if (span) {
        span.setAttribute('proactive.mode', mode);
        span.setAttribute('proactive.confidence', modeDetection.confidence);
      }

      // Stage 3: Build system instruction with PROACTIVE principles
      stages.push('build_prompt');
      const systemInstruction = this.buildProactiveSystemInstruction(
        mode,
        intentReceipt,
        request.options?.systemInstruction
      );

      // Stage 4: Call Gemini
      stages.push('gemini_call');
      let geminiResponse: GeminiResponse | null = null;
      let content = '';

      if (this.gemini) {
        geminiResponse = await this.gemini.processPrompt({
          contents: [{ role: 'user', parts: [{ text: request.message }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
        });
        content = this.gemini.extractText(geminiResponse);
      } else {
        // No Gemini - return system instruction as placeholder
        content = `[Gemini not configured]\n\nSystem would apply:\n${systemInstruction}\n\nTo user message:\n${request.message}`;
      }

      // Stage 5: PROACTIVE Safety Validation
      stages.push('safety_eval');
      let safetyEval: EvalResult | null = null;

      if (!request.options?.skipSafety && this.proactiveValidator) {
        safetyEval = await this.proactiveValidator.evaluate({
          id: intentReceipt?.trace_id || `trace_${Date.now()}`,
          intent: request.message,
          prompt: systemInstruction,
          response: content,
          platform: request.platform || 'proactive',
          mode,
        });

        // Check for FAIL_CLOSED
        if (safetyEval.label === 'FAIL_CLOSED') {
          return this.createBlockedResponse(
            intentReceipt,
            'Response blocked by PROACTIVE validator: Critical safety violation',
            startTime,
            stages,
            safetyEval
          );
        }
      }

      // Stage 6: Record analytics
      if (this.analytics?.getStatus().enabled) {
        stages.push('analytics');
        // Record metrics...
      }

      const executionTime = Date.now() - startTime;

      if (span) {
        span.setAttribute('proactive.execution_time', executionTime);
        span.setStatus({ code: SpanStatusCode.OK });
      }

      // Return successful response
      return {
        content,
        mode,
        modeDetection,
        intentReceipt,
        safetyEval,
        geminiResponse,
        trace: {
          traceId: intentReceipt?.trace_id || `trace_${Date.now()}`,
          executionTime,
          stages,
          tokensUsed: geminiResponse?.usageMetadata?.totalTokenCount,
          cost: geminiResponse?.usageMetadata
            ? this.gemini?.estimateCost(
                geminiResponse.usageMetadata.promptTokenCount,
                geminiResponse.usageMetadata.candidatesTokenCount
              )
            : undefined,
        },
        status: safetyEval?.label === 'WARNING' ? 'warning' : 'success',
      };
    } catch (error) {
      if (span) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      }

      return {
        content: '',
        mode: 'core',
        modeDetection: {
          mode: 'core' as Mode,
          confidence: 0,
          reason: 'Error occurred',
          method: 'fallback' as const,
        },
        intentReceipt: null,
        safetyEval: null,
        geminiResponse: null,
        trace: {
          traceId: `error_${Date.now()}`,
          executionTime: Date.now() - startTime,
          stages: [...stages, 'error'],
        },
        status: 'error',
        blockReason: String(error),
      };
    } finally {
      if (span) span.end();
    }
  }

  /**
   * Build PROACTIVE-aware system instruction
   */
  private buildProactiveSystemInstruction(
    mode: string,
    intentReceipt: IntentReceipt | null,
    customInstruction?: string
  ): string {
    const parts: string[] = [];

    // Base PROACTIVE constitution
    parts.push(`You are operating under the PROACTIVE AI Constitution.
Core thesis: "Epistemic reliability is a safety requirement, not a quality feature."

You MUST follow these invariants:
I1: Evidence-First - Every claim must carry epistemic evidence
I2: No Phantom Work - Never claim work that doesn't exist as artifact
I3: Confidence-Verification - High confidence requires verification
I4: Traceability - Link requirements to evidence
I5: Safety Over Fluency - Prefer bounded statements over fluent narrative
I6: Fail Closed - Surface failures, don't work around them

Use epistemic tags: [OBSERVED], [INFERRED], [SPECULATED], [UNKNOWN]
Acknowledge uncertainty with bounded unknowns.`);

    // Add intent context if available
    if (intentReceipt) {
      parts.push(`
Intent Context:
- Action: ${intentReceipt.parsed_intent.action}
- Target: ${intentReceipt.parsed_intent.target}
- Goal: ${intentReceipt.parsed_intent.goal}
- Risk Level: ${intentReceipt.risk_assessment.level}
${intentReceipt.constraints.length > 0 ?
  `- Constraints: ${intentReceipt.constraints.map(c => c.description).join('; ')}` : ''}`);
    }

    // Add mode-specific instructions
    const modeInstructions: Record<string, string> = {
      dev: 'Focus on production-ready code with proper error handling.',
      agent: 'Break down tasks into verifiable steps with clear artifacts.',
      uxui: 'Prioritize accessibility and user experience.',
      long: 'Provide detailed explanations with examples.',
      next: 'Use Next.js App Router conventions and React Server Components.',
    };

    if (modeInstructions[mode]) {
      parts.push(`\nMode (${mode}): ${modeInstructions[mode]}`);
    }

    // Add custom instruction
    if (customInstruction) {
      parts.push(`\nAdditional Instructions: ${customInstruction}`);
    }

    return parts.join('\n');
  }

  /**
   * Create a blocked response
   */
  private createBlockedResponse(
    intentReceipt: IntentReceipt | null,
    reason: string,
    startTime: number,
    stages: string[],
    safetyEval?: EvalResult | null
  ): ProactiveResponse {
    return {
      content: '',
      mode: 'core',
      modeDetection: {
        mode: 'core' as Mode,
        confidence: 0,
        reason: 'Blocked',
        method: 'fallback' as const,
      },
      intentReceipt,
      safetyEval: safetyEval || null,
      geminiResponse: null,
      trace: {
        traceId: intentReceipt?.trace_id || `blocked_${Date.now()}`,
        executionTime: Date.now() - startTime,
        stages: [...stages, 'blocked'],
      },
      status: 'blocked',
      blockReason: reason,
    };
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    if (this.modeRouter) results.set('ModeRouter', await this.modeRouter.healthCheck());
    if (this.analytics) results.set('Analytics', await this.analytics.healthCheck());
    if (this.telemetry) results.set('Telemetry', await this.telemetry.healthCheck());
    if (this.col) results.set('COL', await this.col.healthCheck());
    if (this.gemini) results.set('Gemini', await this.gemini.healthCheck());
    results.set('PROACTIVE', true);
    return results;
  }
}

/**
 * Create and initialize PROACTIVE orchestrator
 */
export async function createProactiveOrchestrator(
  geminiConfig?: Partial<GeminiConfig>,
  repoRoot?: string
): Promise<ProactiveOrchestrator> {
  const orchestrator = new ProactiveOrchestrator(repoRoot);
  await orchestrator.initialize(geminiConfig);
  return orchestrator;
}

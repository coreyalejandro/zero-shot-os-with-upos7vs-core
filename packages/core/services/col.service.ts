/**
 * Cognitive Operating Layer (COL) Service
 *
 * From the PROACTIVE AI Constitution framework:
 * "A boundary layer that compiles user intent, constraints, and risk posture
 * into a traceable representation before any action is taken."
 *
 * The COL sits between raw user input and the orchestrator, ensuring:
 * 1. Intent is clearly captured and validated
 * 2. Constraints are explicitly identified
 * 3. Risk posture is assessed
 * 4. An auditable Intent Receipt is generated
 */

import { BaseService, ServiceMetadata } from './base.js';
import { UserConfig } from '../config.js';
import { Logger } from '../utils/logger.js';

export interface IntentReceipt {
  id: string;
  timestamp: string;
  raw_input: string;
  parsed_intent: ParsedIntent;
  constraints: Constraint[];
  risk_assessment: RiskAssessment;
  trace_id: string;
  validation_status: 'valid' | 'ambiguous' | 'rejected';
  rejection_reason?: string;
}

export interface ParsedIntent {
  action: string;  // What the user wants to do
  target: string;  // What they want to do it to
  goal: string;    // Why they want to do it (inferred)
  confidence: number;
  ambiguities: string[];
}

export interface Constraint {
  type: 'explicit' | 'implicit' | 'derived';
  category: 'safety' | 'quality' | 'performance' | 'scope' | 'ethical';
  description: string;
  source: string;  // Where this constraint came from
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  domain: string;
  factors: string[];
  requires_confirmation: boolean;
  mitigations: string[];
}

export interface COLConfig {
  enabled: boolean;
  strictMode: boolean;  // Reject ambiguous intents
  highRiskDomains: string[];
  maxAmbiguityThreshold: number;  // 0-1
  requireConfirmationForHighRisk: boolean;
}

/**
 * Cognitive Operating Layer Service
 *
 * Compiles user intent into a traceable, validated representation
 * before any downstream processing occurs.
 */
export class COLService extends BaseService {
  private logger: Logger;
  private colConfig: COLConfig;
  private traceCounter: number = 0;

  constructor(userConfig: UserConfig) {
    const metadata: ServiceMetadata = {
      name: 'col-service',
      version: '1.0.0',
      description: 'Cognitive Operating Layer - Intent compilation and validation',
      dependencies: [],
      optional: false,
    };

    super(metadata, userConfig);
    this.logger = new Logger('COLService');

    this.colConfig = {
      enabled: true,
      strictMode: false,
      highRiskDomains: [
        'medical', 'legal', 'financial', 'safety', 'security',
        'infrastructure', 'compliance', 'regulatory', 'personal_data'
      ],
      maxAmbiguityThreshold: 0.3,
      requireConfirmationForHighRisk: true,
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing COL Service');
    this.status.initialized = true;
    this.status.enabled = this.colConfig.enabled;
    this.status.healthy = true;
    this.logger.info('COL Service initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down COL Service');
    this.status.initialized = false;
    this.status.enabled = false;
    this.logger.info('COL Service shut down');
  }

  async healthCheck(): Promise<boolean> {
    return this.status.healthy;
  }

  protected shouldEnable(): boolean {
    return this.colConfig.enabled;
  }

  /**
   * Compile user input into an Intent Receipt
   */
  async compile(input: string, context?: Record<string, unknown>): Promise<IntentReceipt> {
    const traceId = this.generateTraceId();
    const timestamp = new Date().toISOString();

    this.logger.debug(`Compiling intent: ${input.slice(0, 100)}...`);

    // Parse the intent
    const parsedIntent = this.parseIntent(input);

    // Extract constraints
    const constraints = this.extractConstraints(input, parsedIntent, context);

    // Assess risk
    const riskAssessment = this.assessRisk(parsedIntent, constraints);

    // Validate
    const validation = this.validate(parsedIntent, riskAssessment);

    const receipt: IntentReceipt = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      raw_input: input,
      parsed_intent: parsedIntent,
      constraints,
      risk_assessment: riskAssessment,
      trace_id: traceId,
      validation_status: validation.status,
      rejection_reason: validation.reason,
    };

    this.logger.info(`Intent compiled: ${receipt.validation_status} (trace: ${traceId})`);

    return receipt;
  }

  /**
   * Parse user input into structured intent
   */
  private parseIntent(input: string): ParsedIntent {
    const ambiguities: string[] = [];
    let confidence = 0.9;

    // Extract action (verb-based)
    const action = this.extractAction(input);
    if (!action) {
      ambiguities.push('No clear action detected');
      confidence -= 0.3;
    }

    // Extract target
    const target = this.extractTarget(input);
    if (!target) {
      ambiguities.push('Target unclear');
      confidence -= 0.2;
    }

    // Infer goal
    const goal = this.inferGoal(input, action);

    // Check for conflicting instructions
    if (this.hasConflictingInstructions(input)) {
      ambiguities.push('Potentially conflicting instructions detected');
      confidence -= 0.2;
    }

    // Check for incomplete specifications
    if (this.isIncomplete(input, action)) {
      ambiguities.push('Specification may be incomplete');
      confidence -= 0.1;
    }

    return {
      action: action || 'unknown',
      target: target || 'unspecified',
      goal,
      confidence: Math.max(0, confidence),
      ambiguities,
    };
  }

  /**
   * Extract action from input
   */
  private extractAction(input: string): string | null {
    const actionPatterns: Array<{ pattern: RegExp; action: string }> = [
      { pattern: /\b(create|make|build|generate|write)\b/i, action: 'create' },
      { pattern: /\b(update|modify|change|edit|fix)\b/i, action: 'modify' },
      { pattern: /\b(delete|remove|drop)\b/i, action: 'delete' },
      { pattern: /\b(read|get|fetch|retrieve|show|display)\b/i, action: 'read' },
      { pattern: /\b(analyze|examine|review|check)\b/i, action: 'analyze' },
      { pattern: /\b(explain|describe|clarify)\b/i, action: 'explain' },
      { pattern: /\b(run|execute|deploy|launch)\b/i, action: 'execute' },
      { pattern: /\b(test|verify|validate)\b/i, action: 'test' },
      { pattern: /\b(refactor|reorganize|restructure)\b/i, action: 'refactor' },
      { pattern: /\b(debug|troubleshoot|diagnose)\b/i, action: 'debug' },
    ];

    for (const { pattern, action } of actionPatterns) {
      if (pattern.test(input)) {
        return action;
      }
    }

    // Check for question patterns
    if (/^(what|how|why|when|where|who|can|could|would|should)\b/i.test(input)) {
      return 'query';
    }

    return null;
  }

  /**
   * Extract target from input
   */
  private extractTarget(input: string): string | null {
    // Look for file paths
    const filePath = input.match(/\b[\w./\\-]+\.(ts|js|py|tsx|jsx|json|yaml|yml|md|css|html)\b/);
    if (filePath) return filePath[0];

    // Look for quoted strings
    const quoted = input.match(/["'`]([^"'`]+)["'`]/);
    if (quoted) return quoted[1];

    // Look for specific patterns
    const patterns = [
      /\b(the|this|that)\s+(\w+(?:\s+\w+)?)\b/i,
      /\b(function|class|component|module|service|file|endpoint|api)\s+(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[2];
    }

    return null;
  }

  /**
   * Infer goal from input and action
   */
  private inferGoal(input: string, action: string | null): string {
    const goalIndicators = [
      { pattern: /\bso that\b(.+)/i, extract: 1 },
      { pattern: /\bin order to\b(.+)/i, extract: 1 },
      { pattern: /\bto\s+(achieve|accomplish|enable|allow|make)\b(.+)/i, extract: 2 },
      { pattern: /\bbecause\b(.+)/i, extract: 1 },
    ];

    for (const { pattern, extract } of goalIndicators) {
      const match = input.match(pattern);
      if (match && match[extract]) {
        return match[extract].trim().slice(0, 100);
      }
    }

    // Default goal based on action
    const defaultGoals: Record<string, string> = {
      create: 'Add new functionality',
      modify: 'Improve existing functionality',
      delete: 'Remove unnecessary elements',
      read: 'Understand current state',
      analyze: 'Gain insights',
      explain: 'Improve understanding',
      execute: 'Achieve operational state',
      test: 'Verify correctness',
      refactor: 'Improve code quality',
      debug: 'Resolve issues',
      query: 'Get information',
    };

    return action ? defaultGoals[action] || 'Fulfill user request' : 'Unclear goal';
  }

  /**
   * Check for conflicting instructions
   */
  private hasConflictingInstructions(input: string): boolean {
    const conflicts = [
      [/\bsimple\b/i, /\bcomprehensive\b/i],
      [/\bquick\b/i, /\bthorough\b/i],
      [/\bminimal\b/i, /\bcomplete\b/i],
      [/\bdon'?t\b.*\bdo\b/i, /\bdo\b/i],
    ];

    for (const [pattern1, pattern2] of conflicts) {
      if (pattern1.test(input) && pattern2.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if specification is incomplete
   */
  private isIncomplete(input: string, action: string | null): boolean {
    if (!action) return true;

    // Actions that typically need more specification
    const needsMore: Record<string, string[]> = {
      create: ['what', 'where'],
      modify: ['what', 'how'],
      delete: ['what', 'confirm'],
      execute: ['what', 'where'],
    };

    const requirements = needsMore[action];
    if (!requirements) return false;

    // Very short inputs for complex actions are likely incomplete
    if (input.split(/\s+/).length < 5 && ['create', 'modify', 'refactor'].includes(action)) {
      return true;
    }

    return false;
  }

  /**
   * Extract constraints from input and context
   */
  private extractConstraints(
    input: string,
    intent: ParsedIntent,
    context?: Record<string, unknown>
  ): Constraint[] {
    const constraints: Constraint[] = [];

    // Explicit constraints from input
    const explicitPatterns = [
      { pattern: /\bwithout\s+(.+?)(?:\.|,|$)/i, category: 'scope' as const },
      { pattern: /\bmust\s+(.+?)(?:\.|,|$)/i, category: 'quality' as const },
      { pattern: /\bdon'?t\s+(.+?)(?:\.|,|$)/i, category: 'safety' as const },
      { pattern: /\bonly\s+(.+?)(?:\.|,|$)/i, category: 'scope' as const },
      { pattern: /\bkeep\s+(.+?)(?:\.|,|$)/i, category: 'quality' as const },
    ];

    for (const { pattern, category } of explicitPatterns) {
      const match = input.match(pattern);
      if (match) {
        constraints.push({
          type: 'explicit',
          category,
          description: match[1].trim(),
          source: 'user_input',
        });
      }
    }

    // Implicit safety constraints
    if (intent.action === 'delete') {
      constraints.push({
        type: 'implicit',
        category: 'safety',
        description: 'Destructive operation requires confirmation',
        source: 'system_policy',
      });
    }

    // Derived constraints from context
    if (context?.production) {
      constraints.push({
        type: 'derived',
        category: 'safety',
        description: 'Production environment - extra caution required',
        source: 'context',
      });
    }

    return constraints;
  }

  /**
   * Assess risk level of the intent
   */
  private assessRisk(intent: ParsedIntent, constraints: Constraint[]): RiskAssessment {
    const factors: string[] = [];
    let level: RiskAssessment['level'] = 'low';
    const mitigations: string[] = [];

    // Check domain risk
    const domain = this.detectDomain(intent);
    const isHighRiskDomain = this.colConfig.highRiskDomains.some(
      (d) => domain.toLowerCase().includes(d)
    );

    if (isHighRiskDomain) {
      factors.push(`High-risk domain: ${domain}`);
      level = 'high';
      mitigations.push('Add professional consultation disclaimer');
    }

    // Check action risk
    const highRiskActions = ['delete', 'execute', 'modify'];
    if (highRiskActions.includes(intent.action)) {
      factors.push(`Potentially destructive action: ${intent.action}`);
      if (level === 'low') level = 'medium';
      mitigations.push('Request confirmation before execution');
    }

    // Check confidence risk
    if (intent.confidence < 0.5) {
      factors.push('Low confidence in intent parsing');
      if (level !== 'high') level = 'medium';
      mitigations.push('Clarify intent before proceeding');
    }

    // Check ambiguity risk
    if (intent.ambiguities.length > 2) {
      factors.push(`Multiple ambiguities: ${intent.ambiguities.length}`);
      if (level === 'low') level = 'medium';
      mitigations.push('Resolve ambiguities through clarification');
    }

    // Upgrade to critical if multiple high factors
    if (factors.length >= 3 && level === 'high') {
      level = 'critical';
    }

    return {
      level,
      domain,
      factors,
      requires_confirmation: level === 'high' || level === 'critical',
      mitigations,
    };
  }

  /**
   * Detect domain from intent
   */
  private detectDomain(intent: ParsedIntent): string {
    const domainKeywords: Record<string, string[]> = {
      medical: ['health', 'medical', 'diagnosis', 'treatment', 'symptom', 'patient'],
      legal: ['legal', 'law', 'contract', 'sue', 'court', 'liability'],
      financial: ['money', 'financial', 'investment', 'tax', 'payment', 'bank'],
      security: ['password', 'auth', 'security', 'encrypt', 'credential', 'token'],
      infrastructure: ['server', 'database', 'production', 'deploy', 'infrastructure'],
    };

    const combined = `${intent.action} ${intent.target} ${intent.goal}`.toLowerCase();

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((k) => combined.includes(k))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Validate the compiled intent
   */
  private validate(
    intent: ParsedIntent,
    risk: RiskAssessment
  ): { status: IntentReceipt['validation_status']; reason?: string } {
    // Reject if confidence too low in strict mode
    if (this.colConfig.strictMode && intent.confidence < 0.5) {
      return {
        status: 'rejected',
        reason: 'Intent confidence below threshold in strict mode',
      };
    }

    // Reject if too many ambiguities in strict mode
    if (this.colConfig.strictMode && intent.ambiguities.length > this.colConfig.maxAmbiguityThreshold * 10) {
      return {
        status: 'rejected',
        reason: 'Too many ambiguities in strict mode',
      };
    }

    // Mark as ambiguous if needs clarification
    if (intent.ambiguities.length > 0 || intent.confidence < 0.7) {
      return { status: 'ambiguous' };
    }

    return { status: 'valid' };
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    this.traceCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.traceCounter.toString(36).padStart(4, '0');
    return `trace-${timestamp}-${counter}`;
  }

  /**
   * Get current COL config
   */
  getCOLConfig(): COLConfig {
    return { ...this.colConfig };
  }

  /**
   * Update COL config
   */
  updateCOLConfig(partial: Partial<COLConfig>): void {
    this.colConfig = { ...this.colConfig, ...partial };
  }
}

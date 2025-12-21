/**
 * Mode Router Service
 *
 * Handles intelligent mode detection and routing
 * Extracts mode routing logic from prompt strings into a dedicated service
 */

import { BaseService, ServiceMetadata } from './base.js';
import { UserConfig, Mode } from '../config.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  EmbeddingsClient,
  OpenAIEmbeddingsProvider,
  LocalEmbeddingsProvider,
  MemoryEmbeddingCache,
} from '../utils/embeddings-client.js';
import { Logger } from '../utils/logger.js';
import { ModeRulesManager, ModeRule } from './mode-rules-manager.js';

export interface ModeDetectionResult {
  mode: Mode;
  confidence: number;
  reason: string;
  prefixDetected?: string;
  method: 'prefix' | 'semantic' | 'keyword' | 'fallback';
  latency?: number; // milliseconds
}

export interface ModeRules {
  mode: Mode;
  content: string;
  triggers: string[];
  keywords: string[];
}

/**
 * Mode Router Service
 *
 * Intelligent routing to different UPOS modes based on:
 * - Explicit prefix (UPOS7VS-DEV:)
 * - Message content analysis
 * - User configuration
 * - Context hints
 */
export class ModeRouterService extends BaseService {
  private modeRules: Map<Mode, ModeRules> = new Map();
  private rulesPath: string;
  private embeddingsClient: EmbeddingsClient | null = null;
  private modeEmbeddings: Map<Mode, number[]> = new Map();
  private logger: Logger;
  private rulesManager: ModeRulesManager;

  constructor(config: UserConfig, repoRoot: string = process.cwd()) {
    super(
      {
        name: 'ModeRouter',
        version: '2.0.0',
        description: 'Routes prompts to appropriate UPOS modes with semantic detection',
        dependencies: [],
        optional: false,
      },
      config
    );

    this.rulesPath = config.advanced.customRulesPath || join(repoRoot, 'cursor', 'rules');
    this.logger = new Logger('ModeRouter');
    this.rulesManager = new ModeRulesManager(this.rulesPath);
  }

  async initialize(): Promise<void> {
    if (!this.shouldEnable()) {
      return;
    }

    // Load all mode rules
    const modes: Mode[] = ['core', 'uxui', 'dev', 'next', 'agent', 'long', 'handoff'];

    for (const mode of modes) {
      try {
        const rules = await this.rulesManager.load(mode);
        this.modeRules.set(mode, rules);
      } catch (error) {
        this.logger.error(`Failed to load rules for mode ${mode}:`, error);
      }
    }

    // Initialize semantic router if enabled
    if (this.config.mode.semanticRouter?.enabled) {
      await this.initializeSemanticRouter();
    }

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;
  }

  /**
   * Initialize semantic router with embeddings provider
   */
  private async initializeSemanticRouter(): Promise<void> {
    const semanticConfig = this.config.mode.semanticRouter!;

    try {
      let provider;
      if (semanticConfig.provider === 'openai' && semanticConfig.apiKey) {
        provider = new OpenAIEmbeddingsProvider(semanticConfig.apiKey, {
          model: semanticConfig.model || 'text-embedding-3-small',
        });
        this.logger.info('Initialized OpenAI embeddings provider');
      } else {
        provider = new LocalEmbeddingsProvider();
        this.logger.info('Initialized local embeddings provider (fallback)');
      }

      const cache = semanticConfig.useCache
        ? new MemoryEmbeddingCache(semanticConfig.cacheTTL * 1000)
        : undefined;

      this.embeddingsClient = new EmbeddingsClient(provider, cache);

      // Pre-compute embeddings for mode descriptions
      await this.precomputeModeEmbeddings();

      this.logger.info('Semantic router initialized');
    } catch (error) {
      this.logger.error('Failed to initialize semantic router:', error);
      // Fall back to keyword-based detection
      this.embeddingsClient = null;
    }
  }

  /**
   * Pre-compute embeddings for each mode's description
   */
  private async precomputeModeEmbeddings(): Promise<void> {
    if (!this.embeddingsClient) {
      return;
    }

    const modeDescriptions: Record<Mode, string> = {
      core: 'general coding assistance, default behavior, always-on support',
      uxui: 'user interface design, accessibility, responsive layouts, components, CSS, Tailwind',
      dev: 'refactoring, debugging, architecture, performance, TypeScript, backend development',
      next: 'Next.js App Router, React Server Components, routing, layouts, server/client boundaries',
      agent: 'multi-agent systems, tool orchestration, workflows, Mermaid diagrams, architecture',
      long: 'teaching mode, detailed explanations, tutorials, step-by-step guides, learning',
      handoff: 'documentation, handoff protocols, session continuity, context preservation',
    };

    for (const [mode, description] of Object.entries(modeDescriptions)) {
      try {
        const embedding = await this.embeddingsClient!.embed(description, true);
        this.modeEmbeddings.set(mode as Mode, embedding);
        this.logger.debug(`Pre-computed embedding for mode: ${mode}`);
      } catch (error) {
        this.logger.warn(`Failed to compute embedding for mode ${mode}:`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.modeRules.clear();
    this.status.initialized = false;
    this.status.enabled = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.modeRules.size > 0;
  }

  protected shouldEnable(): boolean {
    return this.config.mode.autoDetect;
  }

  /**
   * Detect mode from user message
   */
  async detectMode(message: string, context?: any): Promise<ModeDetectionResult> {
    const startTime = Date.now();

    // 1. Check for explicit prefix (highest priority)
    const prefixResult = this.detectPrefix(message);
    if (prefixResult) {
      return {
        ...prefixResult,
        method: 'prefix',
        latency: Date.now() - startTime,
      };
    }

    // 2. If auto-detect disabled, use default
    if (!this.config.mode.autoDetect) {
      return {
        mode: this.config.mode.default,
        confidence: 1.0,
        reason: 'Using configured default mode',
        method: 'fallback',
        latency: Date.now() - startTime,
      };
    }

    // 3. Try semantic detection if enabled
    if (this.embeddingsClient && this.config.mode.semanticRouter?.enabled) {
      const semanticResult = await this.detectFromSemantics(message);
      if (semanticResult && semanticResult.confidence >= (this.config.mode.semanticRouter.similarityThreshold || 0.7)) {
        return {
          ...semanticResult,
          method: 'semantic',
          latency: Date.now() - startTime,
        };
      }
    }

    // 4. Content-based keyword detection
    const contentResult = this.detectFromContent(message);
    if (contentResult.confidence > 0.6) {
      return {
        ...contentResult,
        method: 'keyword',
        latency: Date.now() - startTime,
      };
    }

    // 5. Fallback to default
    return {
      mode: this.config.mode.fallbackToCore ? 'core' : this.config.mode.default,
      confidence: 0.5,
      reason: 'Fallback to default mode',
      method: 'fallback',
      latency: Date.now() - startTime,
    };
  }

  /**
   * Detect mode using semantic embeddings
   */
  private async detectFromSemantics(message: string): Promise<ModeDetectionResult | null> {
    if (!this.embeddingsClient || this.modeEmbeddings.size === 0) {
      return null;
    }

    try {
      // Generate embedding for user message
      const messageEmbedding = await this.embeddingsClient.embed(message, true);

      // Find most similar mode
      const candidates = Array.from(this.modeEmbeddings.entries()).map(([mode, embedding]) => ({
        embedding,
        label: mode,
      }));

      const match = this.embeddingsClient.findMostSimilar(messageEmbedding, candidates);

      if (match) {
        return {
          mode: match.label as Mode,
          confidence: match.similarity,
          reason: `Semantic similarity: ${(match.similarity * 100).toFixed(1)}%`,
          method: 'semantic' as const,
        };
      }
    } catch (error) {
      this.logger.warn('Semantic detection failed, falling back to keywords:', error);
    }

    return null;
  }

  /**
   * Get rules for a specific mode
   */
  getRules(mode: Mode): ModeRules | null {
    return this.modeRules.get(mode) || null;
  }

  /**
   * Update mode rule content with undo/redo and persistence.
   */
  async updateRuleContent(
    mode: Mode,
    update: Partial<Omit<ModeRules, 'mode'>>
  ): Promise<ModeRules> {
    const next = await this.rulesManager.update(mode, update as Partial<Omit<ModeRule, 'mode'>>);
    this.modeRules.set(mode, next);
    return next;
  }

  enableRuleUndoRedo(maxDepth = 20): void {
    this.rulesManager.enableUndoRedo(maxDepth);
  }

  async undoRuleChange(): Promise<boolean> {
    const result = await this.rulesManager.undo();
    if (result) {
      this.syncRulesFromManager();
    }
    return Boolean(result);
  }

  async redoRuleChange(): Promise<boolean> {
    const result = await this.rulesManager.redo();
    if (result) {
      this.syncRulesFromManager();
    }
    return Boolean(result);
  }

  enableRuleSnapshots(maxSnapshots = 5): void {
    this.rulesManager.enableSnapshots(maxSnapshots);
  }

  createRuleSnapshot(label?: string) {
    return this.rulesManager.createSnapshot(label);
  }

  listRuleSnapshots() {
    return this.rulesManager.listSnapshots();
  }

  async restoreRuleSnapshot(id: string): Promise<boolean> {
    const restored = await this.rulesManager.restoreSnapshot(id);
    if (restored) {
      this.syncRulesFromManager();
    }
    return restored;
  }

  enableRuleSoftDelete(): void {
    this.rulesManager.enableSoftDelete();
  }

  async softDeleteRule(mode: Mode, ttlMs = 5000) {
    const token = await this.rulesManager.softDelete(mode, ttlMs);
    this.modeRules.delete(mode);
    return token;
  }

  async undoSoftDelete(tokenId: string): Promise<boolean> {
    const undone = await this.rulesManager.undoSoftDelete(tokenId);
    if (undone) {
      this.syncRulesFromManager();
    }
    return undone;
  }

  /**
   * Load mode rules from file
   */
  private async loadModeRules(mode: Mode): Promise<ModeRules> {
    const filename = mode === 'core' ? 'upos-7-vs-core.mdc' : `upos-7-vs-${mode}.mdc`;
    const filepath = join(this.rulesPath, filename);

    const content = await readFile(filepath, 'utf-8');

    // Extract triggers and keywords from content
    const triggers: string[] = [];
    const keywords: string[] = [];

    // Look for trigger patterns
    const triggerMatch = content.match(/##\s*Activation[^#]*([\s\S]*?)(?=##|$)/i);
    if (triggerMatch) {
      const activationSection = triggerMatch[1];
      // Extract words that look like triggers
      const words = activationSection.match(/[A-Z][A-Z_-]+/g) || [];
      triggers.push(...words);
    }

    // Extract keywords from mode name and description
    keywords.push(mode, `${mode} mode`);

    return {
      mode,
      content,
      triggers,
      keywords,
    };
  }

  /**
   * Get embeddings client (for testing/monitoring)
   */
  getEmbeddingsClient(): EmbeddingsClient | null {
    return this.embeddingsClient;
  }

  /**
   * Detect mode from explicit prefix
   */
  private detectPrefix(message: string): Omit<ModeDetectionResult, 'method' | 'latency'> | null {
    const prefixPatterns = [
      { pattern: /^UPOS7VS-UXUI:/i, mode: 'uxui' as Mode },
      { pattern: /^UPOS7VS-DEV:/i, mode: 'dev' as Mode },
      { pattern: /^UPOS7VS-NEXT:/i, mode: 'next' as Mode },
      { pattern: /^UPOS7VS-AGENT:/i, mode: 'agent' as Mode },
      { pattern: /^UPOS7VS-LONG:/i, mode: 'long' as Mode },
      { pattern: /^UPOS7VS-HANDOFF:/i, mode: 'handoff' as Mode },
    ];

    for (const { pattern, mode } of prefixPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          mode,
          confidence: 1.0,
          reason: 'Explicit prefix detected',
          prefixDetected: match[0],
        };
      }
    }

    return null;
  }

  /**
   * Detect mode from message content
   */
  private detectFromContent(message: string): Omit<ModeDetectionResult, 'method' | 'latency'> {
    const lowerMessage = message.toLowerCase();

    // Define keyword patterns for each mode
    const patterns: Array<{ mode: Mode; keywords: string[]; weight: number }> = [
      {
        mode: 'uxui',
        keywords: ['component', 'ui', 'ux', 'design', 'layout', 'accessibility', 'a11y', 'responsive', 'tailwind', 'css'],
        weight: 1.0,
      },
      {
        mode: 'dev',
        keywords: ['refactor', 'debug', 'bug', 'error', 'typescript', 'type', 'architecture', 'performance', 'optimize'],
        weight: 1.0,
      },
      {
        mode: 'next',
        keywords: ['next.js', 'nextjs', 'app router', 'server component', 'client component', 'rsc', 'page.tsx', 'layout.tsx'],
        weight: 1.0,
      },
      {
        mode: 'agent',
        keywords: ['agent', 'multi-agent', 'workflow', 'tool', 'coordinator', 'mermaid', 'diagram', 'architecture'],
        weight: 1.0,
      },
      {
        mode: 'long',
        keywords: ['explain', 'teach', 'how does', 'why', 'tutorial', 'learn', 'understand', 'breakdown'],
        weight: 1.0,
      },
    ];

    let bestMatch: Omit<ModeDetectionResult, 'method' | 'latency'> = {
      mode: 'core',
      confidence: 0.0,
      reason: 'No strong pattern match',
    };

    for (const { mode, keywords, weight } of patterns) {
      let matches = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          matches++;
          matchedKeywords.push(keyword);
        }
      }

      const confidence = Math.min((matches / keywords.length) * weight, 1.0);

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          mode,
          confidence,
          reason: `Detected keywords: ${matchedKeywords.join(', ')}`,
        };
      }
    }

    return bestMatch;
  }

  /**
   * Strip prefix from message
   */
  stripPrefix(message: string): string {
    return message.replace(/^UPOS7VS-[A-Z]+:\s*/i, '');
  }

  private syncRulesFromManager(): void {
    this.modeRules.clear();
    for (const rule of this.rulesManager.getAllRules()) {
      this.modeRules.set(rule.mode, rule);
    }
  }
}

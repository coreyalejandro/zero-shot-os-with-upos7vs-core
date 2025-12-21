/**
 * Central Configuration System for UPOS-7-VS
 *
 * Provides runtime configuration for all services and features.
 * Users can customize behavior without modifying code.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { SnapshotManager } from './trust/snapshot-manager.js';
import { UndoRedoStack, UndoableCommand } from './trust/undo-stack.js';

export type Platform =
  | 'cursor'
  | 'chatgpt'
  | 'claude'
  | 'openai-api'
  | 'gemini'
  | 'deepseek'
  | 'grok'
  | 'kiro'
  | 'notion'
  | 'generic';

export type Mode = 'core' | 'uxui' | 'dev' | 'next' | 'agent' | 'long' | 'handoff';

export type ReasoningStyle = 'concise' | 'detailed' | 'teaching' | 'minimal';

export type OutputFormat = 'markdown' | 'json' | 'plain' | 'structured';

export type SamplingStrategy = 'creative' | 'balanced' | 'conservative' | 'off';

export interface EvaluationConfig {
  enabled: boolean;
  sampleRate: number; // 0-1
  engines: {
    aether?: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
      timeoutMs?: number;
      version?: string;
    };
    llmGrader?: {
      enabled: boolean;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      timeoutMs?: number;
      version?: string;
    };
    heuristic?: {
      enabled: boolean;
    };
  };
}

/**
 * User configuration for UPOS-7-VS
 */
export interface UserConfig {
  version: string; // Config schema version for migrations

  /** Platform configuration */
  platform: {
    primary: Platform;
    enabled: Platform[];
  };

  /** Mode configuration */
  mode: {
    default: Mode;
    autoDetect: boolean; // Auto-detect mode from message prefix
    fallbackToCore: boolean;
    semanticRouter?: {
      enabled: boolean;
      provider: 'openai' | 'local';
      apiKey?: string;
      model?: string;
      similarityThreshold: number; // 0-1, minimum similarity to match
      useCache: boolean;
      cacheTTL: number; // seconds
    };
  };

  /** Feature toggles */
  features: {
    verbalizedSampling: {
      enabled: boolean;
      strategy: SamplingStrategy;
      numSamples: number;
      autoRank: boolean;
      showProbabilities: boolean;
    };
    analytics: {
      enabled: boolean;
      trackQuality: boolean;
      trackCost: boolean;
      trackPerformance: boolean;
    };
    promptHistory: {
      enabled: boolean;
      autoLog: boolean;
      maxEntries: number;
    };
    autoSync: {
      enabled: boolean;
      backupBeforeSync: boolean;
      pruneOrphans: boolean;
    };
    enhancement: {
      autoApproval: boolean;
      workflowHooks: boolean;
    };
    evaluation?: EvaluationConfig;
  };

  /** Reasoning configuration */
  reasoning: {
    style: ReasoningStyle;
    layers: number; // 1-7, controls depth of REFLECT→NOTIFY workflow
    showChainOfThought: boolean;
    includeSummary: boolean;
  };

  /** Output configuration */
  output: {
    format: OutputFormat;
    includeMetadata: boolean;
    verbosity: 'minimal' | 'normal' | 'verbose';
    colorize: boolean;
  };

  /** Performance tuning */
  performance: {
    cacheEnabled: boolean;
    cacheTTL: number; // seconds
    maxConcurrentRequests: number;
    timeout: number; // ms
  };

  /** Advanced settings */
  advanced: {
    customRulesPath?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    experimentalFeatures: string[];
  };

  /** Offline mode and self-hosted configuration */
  offline?: {
    enabled: boolean; // Enable offline mode (no external API calls)
    embeddings: {
      provider: 'local' | 'ollama' | 'none';
      dimension?: number; // For local embeddings
      model?: string; // For Ollama
    };
    llm: {
      provider: 'ollama' | 'lmstudio' | 'custom' | 'none';
      endpoint?: string;
      model?: string;
      apiKey?: string; // For custom endpoints
    };
  };

  /** Provider-specific configurations */
  providers?: {
    openai?: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    anthropic?: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
    ollama?: {
      enabled: boolean;
      endpoint?: string;
      model?: string;
    };
    lmstudio?: {
      enabled: boolean;
      endpoint?: string;
      model?: string;
    };
    gemini?: {
      enabled: boolean;
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    };
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: UserConfig = {
  version: '1.0.0',

  platform: {
    primary: 'cursor',
    enabled: ['cursor', 'chatgpt', 'claude', 'openai-api'],
  },

  mode: {
    default: 'core',
    autoDetect: true,
    fallbackToCore: true,
    semanticRouter: {
      enabled: false, // Disabled by default, requires API key
      provider: 'local',
      similarityThreshold: 0.7,
      useCache: true,
      cacheTTL: 3600,
    },
  },

  features: {
    verbalizedSampling: {
      enabled: true,
      strategy: 'balanced',
      numSamples: 5,
      autoRank: true,
      showProbabilities: true,
    },
    analytics: {
      enabled: true,
      trackQuality: true,
      trackCost: true,
      trackPerformance: true,
    },
    promptHistory: {
      enabled: true,
      autoLog: true,
      maxEntries: 1000,
    },
    autoSync: {
      enabled: true,
      backupBeforeSync: true,
      pruneOrphans: false,
    },
    enhancement: {
      autoApproval: false,
      workflowHooks: true,
    },
    evaluation: {
      enabled: false,
      sampleRate: 0.25,
      engines: {
        aether: {
          enabled: false,
          baseUrl: 'https://api.aether.dev',
          timeoutMs: 5000,
          version: 'v1',
        },
        llmGrader: {
          enabled: false,
          model: 'gpt-4o-mini',
          baseUrl: 'https://api.openai.com/v1',
          timeoutMs: 8000,
          version: 'v1',
        },
        heuristic: {
          enabled: true,
        },
      },
    },
  },

  reasoning: {
    style: 'detailed',
    layers: 7,
    showChainOfThought: false,
    includeSummary: true,
  },

  output: {
    format: 'markdown',
    includeMetadata: true,
    verbosity: 'normal',
    colorize: true,
  },

  performance: {
    cacheEnabled: true,
    cacheTTL: 3600,
    maxConcurrentRequests: 5,
    timeout: 30000,
  },

  advanced: {
    logLevel: 'info',
    experimentalFeatures: [],
  },

  offline: {
    enabled: false,
    embeddings: {
      provider: 'local',
      dimension: 256,
    },
    llm: {
      provider: 'none',
    },
  },

  providers: {
    openai: {
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    },
    anthropic: {
      enabled: false,
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514', // Latest model per Anthropic docs
    },
    ollama: {
      enabled: false,
      endpoint: 'http://localhost:11434',
      model: 'llama2',
    },
    lmstudio: {
      enabled: false,
      endpoint: 'http://localhost:1234/v1',
      model: 'local-model',
    },
    gemini: {
      enabled: false,
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-1.5-pro',
    },
  },
};

/**
 * Configuration Manager
 *
 * Handles loading, saving, and validating user configuration
 */
export class ConfigManager {
  private config: UserConfig;
  private configPath: string;
  private loaded: boolean = false;
  private undoStack: UndoRedoStack<ConfigManager> | null = null;
  private snapshotManager: SnapshotManager<UserConfig> | null = null;

  constructor(repoRoot?: string) {
    // IMPORTANT: Default to a global, user-level config location so keys/settings
    // don't have to be re-entered per-repo.
    //
    // - Global default: ~/.upos7vs/config/config.json
    // - Repo-scoped (when repoRoot is provided): <repoRoot>/.upos7vs/config/config.json
    const base = repoRoot ?? os.homedir();
    const globalOrRepo = repoRoot ? base : join(base, '.upos7vs');
    this.configPath = repoRoot
      ? join(globalOrRepo, '.upos7vs', 'config', 'config.json')
      : join(globalOrRepo, 'config', 'config.json');
    this.config = DEFAULT_CONFIG;
  }

  /**
   * Load configuration from disk
   * Creates default config if doesn't exist
   */
  async load(): Promise<UserConfig> {
    if (this.loaded) {
      return this.config;
    }

    try {
      if (existsSync(this.configPath)) {
        const content = await readFile(this.configPath, 'utf-8');
        const userConfig = JSON.parse(content);

        // Merge with defaults (in case new fields added)
        this.config = this.mergeWithDefaults(userConfig);

        // Validate
        this.validate();

        this.loaded = true;
        return this.config;
      } else {
        // Create default config
        await this.save(DEFAULT_CONFIG);
        this.config = DEFAULT_CONFIG;
        this.loaded = true;
        return this.config;
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save configuration to disk
   */
  async save(config?: UserConfig): Promise<void> {
    const toSave = config || this.config;

    try {
      // Ensure directory exists
      const dir = join(this.configPath, '..');
      await mkdir(dir, { recursive: true });

      // Write config
      await writeFile(
        this.configPath,
        JSON.stringify(toSave, null, 2),
        'utf-8'
      );

      this.config = toSave;
      this.loaded = true;
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  get(): UserConfig {
    if (!this.loaded) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Update configuration (partial update)
   */
  async update(partial: Partial<UserConfig>): Promise<UserConfig> {
    const before = this.cloneConfig(this.config);
    this.config = this.mergeWithDefaults({
      ...this.config,
      ...partial,
    });

    this.validate();
    await this.save();
    this.recordHistory('config-update', before, this.cloneConfig(this.config));

    return this.config;
  }

  /**
   * Reset to defaults
   */
  async reset(): Promise<UserConfig> {
    const before = this.cloneConfig(this.config);
    this.config = DEFAULT_CONFIG;
    await this.save();
    this.recordHistory('config-reset', before, this.cloneConfig(this.config));
    return this.config;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof UserConfig['features']): boolean {
    const featureConfig = this.config.features?.[feature];
    if (!featureConfig) return false;
    // Some features don't have an 'enabled' property (like enhancement)
    return 'enabled' in featureConfig ? featureConfig.enabled : false;
  }

  /**
   * Get feature config
   */
  getFeatureConfig<K extends keyof UserConfig['features']>(
    feature: K
  ): UserConfig['features'][K] {
    return this.config.features[feature];
  }

  /**
   * Merge user config with defaults (deep merge)
   */
  private mergeWithDefaults(userConfig: any): UserConfig {
    return {
      version: userConfig.version || DEFAULT_CONFIG.version,
      platform: { ...DEFAULT_CONFIG.platform, ...userConfig.platform },
      mode: {
        ...DEFAULT_CONFIG.mode,
        ...userConfig.mode,
        semanticRouter: {
          ...DEFAULT_CONFIG.mode.semanticRouter,
          ...userConfig.mode?.semanticRouter,
        },
      },
      features: {
        verbalizedSampling: {
          ...DEFAULT_CONFIG.features.verbalizedSampling,
          ...userConfig.features?.verbalizedSampling,
        },
        analytics: {
          ...DEFAULT_CONFIG.features.analytics,
          ...userConfig.features?.analytics,
        },
        promptHistory: {
          ...DEFAULT_CONFIG.features.promptHistory,
          ...userConfig.features?.promptHistory,
        },
        autoSync: {
          ...DEFAULT_CONFIG.features.autoSync,
          ...userConfig.features?.autoSync,
        },
        enhancement: {
          ...DEFAULT_CONFIG.features.enhancement,
          ...userConfig.features?.enhancement,
        },
        evaluation: {
          ...DEFAULT_CONFIG.features.evaluation,
          ...userConfig.features?.evaluation,
          engines: {
            ...DEFAULT_CONFIG.features.evaluation?.engines,
            ...userConfig.features?.evaluation?.engines,
            aether: {
              ...DEFAULT_CONFIG.features.evaluation?.engines?.aether,
              ...userConfig.features?.evaluation?.engines?.aether,
            },
            llmGrader: {
              ...DEFAULT_CONFIG.features.evaluation?.engines?.llmGrader,
              ...userConfig.features?.evaluation?.engines?.llmGrader,
            },
            heuristic: {
              ...DEFAULT_CONFIG.features.evaluation?.engines?.heuristic,
              ...userConfig.features?.evaluation?.engines?.heuristic,
            },
          },
        },
      },
      reasoning: { ...DEFAULT_CONFIG.reasoning, ...userConfig.reasoning },
      output: { ...DEFAULT_CONFIG.output, ...userConfig.output },
      performance: { ...DEFAULT_CONFIG.performance, ...userConfig.performance },
      advanced: { ...DEFAULT_CONFIG.advanced, ...userConfig.advanced },
      offline: {
        ...DEFAULT_CONFIG.offline,
        ...userConfig.offline,
        embeddings: {
          ...DEFAULT_CONFIG.offline?.embeddings,
          ...userConfig.offline?.embeddings,
        },
        llm: {
          ...DEFAULT_CONFIG.offline?.llm,
          ...userConfig.offline?.llm,
        },
      },
      providers: {
        openai: {
          ...DEFAULT_CONFIG.providers?.openai,
          ...userConfig.providers?.openai,
        },
        anthropic: {
          ...DEFAULT_CONFIG.providers?.anthropic,
          ...userConfig.providers?.anthropic,
        },
        ollama: {
          ...DEFAULT_CONFIG.providers?.ollama,
          ...userConfig.providers?.ollama,
        },
        lmstudio: {
          ...DEFAULT_CONFIG.providers?.lmstudio,
          ...userConfig.providers?.lmstudio,
        },
        gemini: {
          ...DEFAULT_CONFIG.providers?.gemini,
          ...userConfig.providers?.gemini,
        },
      },
    };
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    const { config } = this;

    // Validate ranges
    if (config.reasoning.layers < 1 || config.reasoning.layers > 7) {
      throw new Error('reasoning.layers must be between 1 and 7');
    }

    if (config.features.verbalizedSampling.numSamples < 2 || config.features.verbalizedSampling.numSamples > 10) {
      throw new Error('verbalizedSampling.numSamples must be between 2 and 10');
    }

    if (config.features.promptHistory.maxEntries < 1) {
      throw new Error('promptHistory.maxEntries must be at least 1');
    }

    if (config.features?.evaluation) {
      const sampleRate = config.features.evaluation.sampleRate;
      if (sampleRate < 0 || sampleRate > 1) {
        throw new Error('evaluation.sampleRate must be between 0 and 1');
      }
    }

    // Add more validations as needed
  }

  /**
   * Enable undo/redo history for config edits
   */
  enableUndoRedo(maxDepth = 20): void {
    if (!this.undoStack) {
      this.undoStack = new UndoRedoStack<ConfigManager>(this, maxDepth);
    }
  }

  /**
   * Undo last config change (if history enabled)
   */
  async undo(): Promise<UserConfig | null> {
    if (!this.undoStack) return null;
    await this.undoStack.undo();
    return this.config;
  }

  /**
   * Redo last undone config change (if history enabled)
   */
  async redo(): Promise<UserConfig | null> {
    if (!this.undoStack) return null;
    await this.undoStack.redo();
    return this.config;
  }

  /**
   * Enable snapshotting for config states
   */
  enableSnapshots(maxSnapshots = 5): void {
    if (!this.snapshotManager) {
      this.snapshotManager = new SnapshotManager<UserConfig>(maxSnapshots);
    }
  }

  createSnapshot(label?: string) {
    if (!this.snapshotManager) {
      throw new Error('Snapshots not enabled. Call enableSnapshots() first.');
    }
    return this.snapshotManager.createSnapshot(this.cloneConfig(this.config), label);
  }

  listSnapshots() {
    if (!this.snapshotManager) return [];
    return this.snapshotManager.listSnapshots();
  }

  async restoreSnapshot(id: string): Promise<UserConfig | null> {
    if (!this.snapshotManager) return null;
    const snap = this.snapshotManager.restoreSnapshot(id);
    if (!snap) return null;
    const before = this.cloneConfig(this.config);
    this.config = this.cloneConfig(snap);
    await this.save();
    this.recordHistory('config-restore', before, this.cloneConfig(this.config));
    return this.config;
  }

  private recordHistory(label: string, before: UserConfig, after: UserConfig): void {
    if (!this.undoStack) return;
    const command: UndoableCommand<ConfigManager> = {
      id: `${label}-${Date.now()}`,
      label,
      execute: async (ctx) => {
        ctx.config = ctx.cloneConfig(after);
        await ctx.save();
      },
      undo: async (ctx) => {
        ctx.config = ctx.cloneConfig(before);
        await ctx.save();
      },
    };
    this.undoStack.recordExecuted(command);
  }

  private cloneConfig(config: UserConfig): UserConfig {
    return JSON.parse(JSON.stringify(config));
  }
}

/**
 * Global config instance (singleton)
 */
let globalConfig: ConfigManager | null = null;

/**
 * Get global config manager instance
 */
export function getConfig(repoRoot?: string): ConfigManager {
  if (!globalConfig) {
    globalConfig = new ConfigManager(repoRoot);
  }
  return globalConfig;
}

/**
 * Initialize config (convenience function)
 */
export async function initConfig(repoRoot?: string): Promise<UserConfig> {
  const config = getConfig(repoRoot);
  return await config.load();
}

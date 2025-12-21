/**
 * Unit tests for ConfigManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager, getConfig, initConfig, DEFAULT_CONFIG, UserConfig } from '../config.js';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

describe('ConfigManager', () => {
  const testRoot = join(process.cwd(), '.test-config');
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
    await mkdir(testRoot, { recursive: true });

    configManager = new ConfigManager(testRoot);
  });

  afterEach(async () => {
    // Clean up
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create a config manager instance', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });

    it('should use default config path when no repo root provided', () => {
      const manager = new ConfigManager();
      expect(manager).toBeInstanceOf(ConfigManager);
    });
  });

  describe('load', () => {
    it('should create default config if file does not exist', async () => {
      const config = await configManager.load();

      expect(config).toEqual(DEFAULT_CONFIG);
      expect(existsSync(join(testRoot, '.upos7vs', 'config', 'config.json'))).toBe(true);
    });

    it('should load existing config from disk', async () => {
      // First create a config
      await configManager.load();

      // Modify it
      await configManager.update({
        mode: { default: 'dev', autoDetect: false, fallbackToCore: false },
      });

      // Create new manager and load
      const newManager = new ConfigManager(testRoot);
      const loaded = await newManager.load();

      expect(loaded.mode.default).toBe('dev');
      expect(loaded.mode.autoDetect).toBe(false);
    });

    it('should only load once and cache result', async () => {
      const config1 = await configManager.load();
      const config2 = await configManager.load();
      const config3 = await configManager.load();

      expect(config1).toBe(config2);
      expect(config2).toBe(config3);
    });

    it('should merge user config with defaults', async () => {
      await configManager.load();

      // Update with partial config
      await configManager.update({
        mode: { default: 'dev', autoDetect: true, fallbackToCore: true },
      });

      // Reload with new manager
      const newManager = new ConfigManager(testRoot);
      const config = await newManager.load();

      expect(config.mode.default).toBe('dev');
      expect(config.platform).toBeDefined();
      expect(config.features).toBeDefined();
    });
  });

  describe('save', () => {
    it('should save config to disk', async () => {
      await configManager.save(DEFAULT_CONFIG);

      const configPath = join(testRoot, '.upos7vs', 'config', 'config.json');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should save current config if no parameter provided', async () => {
      await configManager.load();
      await configManager.save();

      const configPath = join(testRoot, '.upos7vs', 'config', 'config.json');
      expect(existsSync(configPath)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      await configManager.save(DEFAULT_CONFIG);

      const dirPath = join(testRoot, '.upos7vs');
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return current config after load', async () => {
      await configManager.load();

      const config = configManager.get();

      expect(config).toBeDefined();
      expect(config.version).toBe(DEFAULT_CONFIG.version);
    });

    it('should throw error if config not loaded', () => {
      expect(() => configManager.get()).toThrow('Config not loaded');
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should update config with partial values', async () => {
      const partial: Partial<UserConfig> = {
        mode: {
          default: 'dev',
          autoDetect: false,
          fallbackToCore: false,
        },
      };

      const updated = await configManager.update(partial);

      expect(updated.mode.default).toBe('dev');
      expect(updated.mode.autoDetect).toBe(false);
    });

    it('should preserve other config values on partial update', async () => {
      const partial: Partial<UserConfig> = {
        mode: { default: 'dev', autoDetect: true, fallbackToCore: true },
      };

      const updated = await configManager.update(partial);

      expect(updated.platform).toEqual(DEFAULT_CONFIG.platform);
      expect(updated.features).toBeDefined();
      expect(updated.reasoning).toBeDefined();
    });

    it('should validate config after update', async () => {
      const invalid: Partial<UserConfig> = {
        reasoning: {
          style: 'detailed',
          layers: 10, // Invalid: should be 1-7
          showChainOfThought: false,
          includeSummary: true,
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'reasoning.layers must be between 1 and 7'
      );
    });

    it('should save config after successful update', async () => {
      const partial: Partial<UserConfig> = {
        output: {
          format: 'json',
          includeMetadata: false,
          verbosity: 'minimal',
          colorize: false,
        },
      };

      await configManager.update(partial);

      // Verify saved by loading with new manager
      const newManager = new ConfigManager(testRoot);
      const loaded = await newManager.load();

      expect(loaded.output.format).toBe('json');
    });
  });

  describe('reset', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should reset config to defaults', async () => {
      // First, modify config
      await configManager.update({
        mode: { default: 'dev', autoDetect: false, fallbackToCore: false },
      });

      // Then reset
      const reset = await configManager.reset();

      expect(reset).toEqual(DEFAULT_CONFIG);
    });

    it('should save config after reset', async () => {
      await configManager.update({
        mode: { default: 'dev', autoDetect: false, fallbackToCore: false },
      });

      await configManager.reset();

      // Verify by loading with new manager
      const newManager = new ConfigManager(testRoot);
      const loaded = await newManager.load();

      expect(loaded.mode.default).toBe('core');
    });
  });

  describe('isFeatureEnabled', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should return true for enabled features', () => {
      expect(configManager.isFeatureEnabled('verbalizedSampling')).toBe(true);
      expect(configManager.isFeatureEnabled('analytics')).toBe(true);
    });

    it('should return false for disabled features', async () => {
      await configManager.update({
        features: {
          ...DEFAULT_CONFIG.features,
          verbalizedSampling: {
            ...DEFAULT_CONFIG.features.verbalizedSampling,
            enabled: false,
          },
        },
      });

      expect(configManager.isFeatureEnabled('verbalizedSampling')).toBe(false);
    });
  });

  describe('getFeatureConfig', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should return feature configuration', () => {
      const vsConfig = configManager.getFeatureConfig('verbalizedSampling');

      expect(vsConfig).toEqual(DEFAULT_CONFIG.features.verbalizedSampling);
      expect(vsConfig.enabled).toBe(true);
      expect(vsConfig.strategy).toBe('balanced');
      expect(vsConfig.numSamples).toBe(5);
    });

    it('should return updated feature config', async () => {
      await configManager.update({
        features: {
          ...DEFAULT_CONFIG.features,
          verbalizedSampling: {
            enabled: true,
            strategy: 'creative',
            numSamples: 7,
            autoRank: false,
            showProbabilities: false,
          },
        },
      });

      const vsConfig = configManager.getFeatureConfig('verbalizedSampling');

      expect(vsConfig.strategy).toBe('creative');
      expect(vsConfig.numSamples).toBe(7);
    });
  });

  describe('validation', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should reject reasoning.layers < 1', async () => {
      const invalid: Partial<UserConfig> = {
        reasoning: {
          style: 'detailed',
          layers: 0,
          showChainOfThought: false,
          includeSummary: true,
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'reasoning.layers must be between 1 and 7'
      );
    });

    it('should reject reasoning.layers > 7', async () => {
      const invalid: Partial<UserConfig> = {
        reasoning: {
          style: 'detailed',
          layers: 8,
          showChainOfThought: false,
          includeSummary: true,
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'reasoning.layers must be between 1 and 7'
      );
    });

    it('should reject numSamples < 2', async () => {
      const invalid: Partial<UserConfig> = {
        features: {
          ...DEFAULT_CONFIG.features,
          verbalizedSampling: {
            enabled: true,
            strategy: 'balanced',
            numSamples: 1,
            autoRank: true,
            showProbabilities: true,
          },
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'verbalizedSampling.numSamples must be between 2 and 10'
      );
    });

    it('should reject numSamples > 10', async () => {
      const invalid: Partial<UserConfig> = {
        features: {
          ...DEFAULT_CONFIG.features,
          verbalizedSampling: {
            enabled: true,
            strategy: 'balanced',
            numSamples: 11,
            autoRank: true,
            showProbabilities: true,
          },
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'verbalizedSampling.numSamples must be between 2 and 10'
      );
    });

    it('should reject maxEntries < 1', async () => {
      const invalid: Partial<UserConfig> = {
        features: {
          ...DEFAULT_CONFIG.features,
          promptHistory: {
            enabled: true,
            autoLog: true,
            maxEntries: 0,
          },
        },
      };

      await expect(configManager.update(invalid)).rejects.toThrow(
        'promptHistory.maxEntries must be at least 1'
      );
    });

    it('should accept valid reasoning.layers values', async () => {
      for (let layers = 1; layers <= 7; layers++) {
        const valid: Partial<UserConfig> = {
          reasoning: {
            style: 'detailed',
            layers,
            showChainOfThought: false,
            includeSummary: true,
          },
        };

        await expect(configManager.update(valid)).resolves.not.toThrow();
      }
    });

    it('should accept valid numSamples values', async () => {
      for (let numSamples = 2; numSamples <= 10; numSamples++) {
        const valid: Partial<UserConfig> = {
          features: {
            ...DEFAULT_CONFIG.features,
            verbalizedSampling: {
              enabled: true,
              strategy: 'balanced',
              numSamples,
              autoRank: true,
              showProbabilities: true,
            },
          },
        };

        await expect(configManager.update(valid)).resolves.not.toThrow();
      }
    });
  });

  describe('deep merge', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should deep merge nested feature objects', async () => {
      const partial: Partial<UserConfig> = {
        features: {
          verbalizedSampling: {
            enabled: false,
            strategy: 'creative',
            numSamples: 7,
            autoRank: true,
            showProbabilities: true,
          },
          analytics: DEFAULT_CONFIG.features.analytics,
          promptHistory: DEFAULT_CONFIG.features.promptHistory,
          autoSync: DEFAULT_CONFIG.features.autoSync,
          enhancement: DEFAULT_CONFIG.features.enhancement,
        },
      };

      const updated = await configManager.update(partial);

      expect(updated.features.verbalizedSampling.enabled).toBe(false);
      expect(updated.features.verbalizedSampling.strategy).toBe('creative');
      expect(updated.features.analytics).toEqual(DEFAULT_CONFIG.features.analytics);
    });

    it('should preserve unspecified nested fields', async () => {
      await configManager.update({
        features: {
          ...DEFAULT_CONFIG.features,
          verbalizedSampling: {
            ...DEFAULT_CONFIG.features.verbalizedSampling,
            enabled: false,
          },
        },
      });

      const config = configManager.get();

      expect(config.features.verbalizedSampling.enabled).toBe(false);
      expect(config.features.verbalizedSampling.strategy).toBe('balanced');
      expect(config.features.verbalizedSampling.numSamples).toBe(5);
    });
  });
});

describe('DEFAULT_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_CONFIG.version).toBeDefined();
    expect(DEFAULT_CONFIG.platform).toBeDefined();
    expect(DEFAULT_CONFIG.mode).toBeDefined();
    expect(DEFAULT_CONFIG.features).toBeDefined();
    expect(DEFAULT_CONFIG.reasoning).toBeDefined();
    expect(DEFAULT_CONFIG.output).toBeDefined();
    expect(DEFAULT_CONFIG.performance).toBeDefined();
    expect(DEFAULT_CONFIG.advanced).toBeDefined();
  });

  it('should have valid default values', () => {
    expect(DEFAULT_CONFIG.reasoning.layers).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_CONFIG.reasoning.layers).toBeLessThanOrEqual(7);
    expect(DEFAULT_CONFIG.features.verbalizedSampling.numSamples).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_CONFIG.features.verbalizedSampling.numSamples).toBeLessThanOrEqual(10);
    expect(DEFAULT_CONFIG.features.promptHistory.maxEntries).toBeGreaterThan(0);
  });

  it('should have correct type values', () => {
    expect(typeof DEFAULT_CONFIG.version).toBe('string');
    expect(typeof DEFAULT_CONFIG.mode.default).toBe('string');
    expect(typeof DEFAULT_CONFIG.features.verbalizedSampling.enabled).toBe('boolean');
    expect(typeof DEFAULT_CONFIG.reasoning.layers).toBe('number');
  });
});

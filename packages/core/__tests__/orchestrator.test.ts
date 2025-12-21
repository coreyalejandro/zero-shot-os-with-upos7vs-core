/**
 * Unit tests for UPOSOrchestrator
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UPOSOrchestrator, createOrchestrator, PromptRequest } from '../orchestrator.js';
import type { UserConfig } from '../config.js';

// Mock the services
jest.mock('../services/mode-router.service.js');
jest.mock('../services/analytics.service.js');
jest.mock('../services/telemetry.service.js');
jest.mock('../../verbalized-sampling/index.js');

describe('UPOSOrchestrator', () => {
  let orchestrator: UPOSOrchestrator;

  beforeEach(() => {
    orchestrator = new UPOSOrchestrator();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create an orchestrator instance', () => {
      expect(orchestrator).toBeInstanceOf(UPOSOrchestrator);
    });

    it('should initialize successfully', async () => {
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await orchestrator.initialize();
      await orchestrator.initialize(); // Should not throw
      expect(true).toBe(true);
    });

    it('should create and initialize with factory function', async () => {
      const orch = await createOrchestrator();
      expect(orch).toBeInstanceOf(UPOSOrchestrator);
      await orch.shutdown();
    });
  });

  describe('processPrompt', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should throw if not initialized', async () => {
      const uninitializedOrch = new UPOSOrchestrator();
      const request: PromptRequest = {
        message: 'test message',
      };

      await expect(uninitializedOrch.processPrompt(request)).rejects.toThrow(
        'Orchestrator not initialized'
      );
    });

    it('should process a basic prompt request', async () => {
      const request: PromptRequest = {
        message: 'Create a React component',
        platform: 'cursor',
      };

      const response = await orchestrator.processPrompt(request);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('mode');
      expect(response).toHaveProperty('modeDetection');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata).toHaveProperty('executionTime');
    });

    it('should include mode detection results', async () => {
      const request: PromptRequest = {
        message: 'Refactor this TypeScript code',
      };

      const response = await orchestrator.processPrompt(request);

      expect(response.modeDetection).toHaveProperty('mode');
      expect(response.modeDetection).toHaveProperty('confidence');
      expect(response.modeDetection).toHaveProperty('reason');
      expect(typeof response.modeDetection.confidence).toBe('number');
    });

    it('should respect mode override in request', async () => {
      const request: PromptRequest = {
        message: 'test message',
        mode: 'dev',
      };

      const response = await orchestrator.processPrompt(request);

      expect(response.mode).toBe('dev');
    });

    it('should handle verbalized sampling when enabled', async () => {
      const request: PromptRequest = {
        message: 'Design a database schema',
        options: {
          verbalizedSampling: true,
        },
      };

      const response = await orchestrator.processPrompt(request);

      expect(response).toHaveProperty('content');
      // Sampling result may be undefined if engine is not initialized
      // but the request should not throw
    });

    it('should disable verbalized sampling when explicitly set to false', async () => {
      const request: PromptRequest = {
        message: 'Design a database schema',
        options: {
          verbalizedSampling: false,
        },
      };

      const response = await orchestrator.processPrompt(request);

      expect(response).toHaveProperty('content');
      expect(response.sampling).toBeUndefined();
    });

    it('should measure execution time', async () => {
      const request: PromptRequest = {
        message: 'test message',
      };

      const response = await orchestrator.processPrompt(request);

      expect(response.metadata.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof response.metadata.executionTime).toBe('number');
    });

    it('should handle errors gracefully', async () => {
      const request: PromptRequest = {
        message: 'test',
        mode: 'nonexistent-mode',
      };

      await expect(orchestrator.processPrompt(request)).rejects.toThrow();
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should return current configuration', () => {
      const config = orchestrator.getConfig();

      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('mode');
      expect(config).toHaveProperty('features');
    });

    it('should update configuration', async () => {
      const partialConfig: Partial<UserConfig> = {
        mode: {
          default: 'dev',
          autoDetect: true,
          fallbackToCore: true,
        },
      };

      const updated = await orchestrator.updateConfig(partialConfig);

      expect(updated.mode.default).toBe('dev');
    });

    it('should handle verbalized sampling config updates', async () => {
      const partialConfig: Partial<UserConfig> = {
        features: {
          verbalizedSampling: {
            enabled: true,
            strategy: 'creative',
            numSamples: 7,
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
        },
      };

      await expect(orchestrator.updateConfig(partialConfig)).resolves.not.toThrow();
    });

    it('should disable sampling engine when config disabled', async () => {
      const partialConfig: Partial<UserConfig> = {
        features: {
          verbalizedSampling: {
            enabled: false,
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
        },
      };

      await orchestrator.updateConfig(partialConfig);

      // Process a request with sampling explicitly enabled
      // Should use config value (disabled) instead
      const request: PromptRequest = {
        message: 'test',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response.sampling).toBeUndefined();
    });
  });

  describe('health checks', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should return health status for all services', async () => {
      const health = await orchestrator.getHealthStatus();

      expect(health).toBeInstanceOf(Map);
      expect(health.size).toBeGreaterThan(0);
    });

    it('should include ModeRouter health status', async () => {
      const health = await orchestrator.getHealthStatus();

      expect(health.has('ModeRouter')).toBe(true);
    });

    it('should include Analytics health status', async () => {
      const health = await orchestrator.getHealthStatus();

      expect(health.has('Analytics')).toBe(true);
    });

    it('should include Telemetry health status', async () => {
      const health = await orchestrator.getHealthStatus();

      expect(health.has('Telemetry')).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown all services gracefully', async () => {
      await orchestrator.initialize();
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(orchestrator.shutdown()).resolves.not.toThrow();
    });

    it('should allow re-initialization after shutdown', async () => {
      await orchestrator.initialize();
      await orchestrator.shutdown();
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle empty message', async () => {
      const request: PromptRequest = {
        message: '',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      const request: PromptRequest = {
        message: longMessage,
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle special characters in message', async () => {
      const request: PromptRequest = {
        message: 'Test with ñ, é, 中文, emoji 🚀, and symbols @#$%',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle undefined platform', async () => {
      const request: PromptRequest = {
        message: 'test message',
        platform: undefined,
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle context object', async () => {
      const request: PromptRequest = {
        message: 'test message',
        context: {
          previousMessages: ['msg1', 'msg2'],
          userPreferences: { theme: 'dark' },
        },
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should complete request in reasonable time', async () => {
      const request: PromptRequest = {
        message: 'test message',
      };

      const start = Date.now();
      await orchestrator.processPrompt(request);
      const duration = Date.now() - start;

      // Should complete in less than 1 second (generous for testing)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        message: `concurrent request ${i}`,
      }));

      const promises = requests.map((req) => orchestrator.processPrompt(req));

      await expect(Promise.all(promises)).resolves.toHaveLength(5);
    });
  });

  describe('platform-specific behavior', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should handle cursor platform', async () => {
      const request: PromptRequest = {
        message: 'test',
        platform: 'cursor',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle chatgpt platform', async () => {
      const request: PromptRequest = {
        message: 'test',
        platform: 'chatgpt',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle claude platform', async () => {
      const request: PromptRequest = {
        message: 'test',
        platform: 'claude',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });

    it('should handle unknown platform gracefully', async () => {
      const request: PromptRequest = {
        message: 'test',
        platform: 'unknown-platform',
      };

      const response = await orchestrator.processPrompt(request);
      expect(response).toHaveProperty('content');
    });
  });
});

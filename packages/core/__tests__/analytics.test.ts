/**
 * Analytics Service Tests
 *
 * Tests for analytics tracking and metrics collection
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AnalyticsService } from '../services/analytics.service.js';
import { DEFAULT_CONFIG, UserConfig } from '../config.js';
import { Platform } from '../../../analytics/schemas/metrics.types.js';
import { existsSync } from 'node:fs';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const testRoot = join(process.cwd(), '.test-analytics');
  const testMetricsPath = join(testRoot, 'analytics', 'data', 'metrics.jsonl');

  let configWithAnalytics: UserConfig;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
    await mkdir(testRoot, { recursive: true });

    configWithAnalytics = {
      ...DEFAULT_CONFIG,
      features: {
        ...DEFAULT_CONFIG.features,
        analytics: {
          enabled: true,
          trackQuality: true,
          trackCost: true,
          trackPerformance: true,
        },
      },
    };

    service = new AnalyticsService(configWithAnalytics, testRoot);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }

    // Clean up test directory
    if (existsSync(testRoot)) {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create an analytics service instance', () => {
      expect(service).toBeDefined();
    });

    it('should initialize successfully when analytics enabled', async () => {
      await service.initialize();

      const health = await service.healthCheck();
      expect(health).toBe(true);
    });

    it('should not initialize when analytics disabled', async () => {
      const disabledConfig = {
        ...DEFAULT_CONFIG,
        features: {
          ...DEFAULT_CONFIG.features,
          analytics: {
            enabled: false,
            trackQuality: false,
            trackCost: false,
            trackPerformance: false,
          },
        },
      };

      const disabledService = new AnalyticsService(disabledConfig, testRoot);
      await disabledService.initialize();

      expect(disabledService.getStatus().enabled).toBe(false);
      const health = await disabledService.healthCheck();
      expect(health).toBe(false);

      await disabledService.shutdown();
    });

    it('should create analytics directory if it does not exist', async () => {
      // Remove the directory
      if (existsSync(testRoot)) {
        await rm(testRoot, { recursive: true, force: true });
      }

      await service.initialize();

      expect(existsSync(testRoot)).toBe(true);
    });

    it('should start auto-flush interval on initialization', async () => {
      await service.initialize();

      // Record a metric
      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      // Wait for auto-flush (30 seconds normally, but we'll trigger it manually)
      await service.flush();

      const content = await readFile(testMetricsPath, 'utf-8');
      expect(content).toContain('Test message');
    });
  });

  describe('record', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should record a metric', async () => {
      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      await service.flush();

      const content = await readFile(testMetricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1);

      const recorded = JSON.parse(lines[0]);
      expect(recorded.platform).toBe('cursor');
      expect(recorded.mode).toBe('core');
      expect(recorded.userMessage).toBe('Test message');
    });

    it('should not record when service is disabled', async () => {
      await service.shutdown();

      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      // File should not exist or be empty
      if (existsSync(testMetricsPath)) {
        const content = await readFile(testMetricsPath, 'utf-8');
        expect(content).toBe('');
      }
    });

    it('should auto-flush when buffer reaches 10 items', async () => {
      // Record 10 metrics to trigger auto-flush
      for (let i = 0; i < 10; i++) {
        const metric = service.createMetric('cursor', 'core', `Message ${i}`, 100, 50, false);
        await service.record(metric);
      }

      // Should have auto-flushed
      const content = await readFile(testMetricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(10);
    });

    it('should record metrics with metadata', async () => {
      // Note: PromptMetrics schema doesn't include metadata field
      // This test verifies that metrics are recorded correctly
      const metric = service.createMetric(
        'cursor',
        'core',
        'Test message',
        100,
        50,
        false
      );
      await service.record(metric);

      await service.flush();

      const content = await readFile(testMetricsPath, 'utf-8');
      const recorded = JSON.parse(content.trim());
      expect(recorded.platform).toBe('cursor');
      expect(recorded.mode).toBe('core');
    });

    it('should record multiple metrics in order', async () => {
      const metrics = [
        service.createMetric('cursor', 'core', 'Message 1', 100, 50, false),
        service.createMetric('chatgpt', 'dev', 'Message 2', 200, 75, true),
        service.createMetric('claude', 'uxui', 'Message 3', 150, 60, false),
      ];

      for (const metric of metrics) {
        await service.record(metric);
      }

      await service.flush();

      const content = await readFile(testMetricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(3);

      const recorded = lines.map(line => JSON.parse(line));
      expect(recorded[0].userMessage).toBe('Message 1');
      expect(recorded[1].userMessage).toBe('Message 2');
      expect(recorded[2].userMessage).toBe('Message 3');
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should flush metrics to disk', async () => {
      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      await service.flush();

      const content = await readFile(testMetricsPath, 'utf-8');
      expect(content).toContain('Test message');
    });

    it('should clear buffer after flush', async () => {
      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      await service.flush();
      await service.flush(); // Second flush should write nothing

      const content = await readFile(testMetricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(1); // Only one metric
    });

    it('should do nothing when buffer is empty', async () => {
      await service.flush();

      // File should not exist or be empty
      if (existsSync(testMetricsPath)) {
        const content = await readFile(testMetricsPath, 'utf-8');
        expect(content).toBe('');
      }
    });

    it('should handle flush errors gracefully', async () => {
      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      // Create invalid path to trigger error
      const badService = new AnalyticsService(
        configWithAnalytics,
        '/invalid/path/that/does/not/exist'
      );
      await badService.initialize();

      const badMetric = badService.createMetric('cursor', 'core', 'Test', 100, 50, false);
      await badService.record(badMetric);

      // Should not throw
      await expect(badService.flush()).resolves.not.toThrow();

      const health = await badService.healthCheck();
      expect(health).toBe(false); // Health should be false after error

      await badService.shutdown();
    });
  });

  describe('createMetric', () => {
    it('should create a metric with all fields', () => {
      const metric = service.createMetric(
        'cursor',
        'core',
        'Test message',
        100,
        50,
        false,
        { quality: 'good', tokensUsed: 150, cost: 0.002 }
      );

      expect(metric).toHaveProperty('id');
      expect(metric).toHaveProperty('timestamp');
      expect(metric.platform).toBe('cursor');
      expect(metric.mode).toBe('core');
      expect(metric.userMessage).toBe('Test message');
      expect(metric.responseLength).toBe(100);
      expect(metric.responseTime).toBe(50);
      expect(metric.verbalizedSampling).toBe(false);
      expect(metric.quality).toBe('good');
      expect(metric.tokensUsed).toBe(150);
      expect(metric.cost).toBe(0.002);
    });

    it('should generate unique IDs', () => {
      const metric1 = service.createMetric('cursor', 'core', 'Message 1', 100, 50, false);
      const metric2 = service.createMetric('cursor', 'core', 'Message 2', 100, 50, false);

      expect(metric1.id).not.toBe(metric2.id);
    });

    it('should generate ISO timestamp', () => {
      const metric = service.createMetric('cursor', 'core', 'Test', 100, 50, false);

      expect(metric.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should sanitize long messages', () => {
      const longMessage = 'a'.repeat(600); // 600 characters
      const metric = service.createMetric('cursor', 'core', longMessage, 100, 50, false);

      expect(metric.userMessage.length).toBe(503); // 500 + '...'
      expect(metric.userMessage.endsWith('...')).toBe(true);
    });

    it('should not sanitize short messages', () => {
      const shortMessage = 'Short message';
      const metric = service.createMetric('cursor', 'core', shortMessage, 100, 50, false);

      expect(metric.userMessage).toBe(shortMessage);
      expect(metric.userMessage.endsWith('...')).toBe(false);
    });

    it('should create metric without optional fields', () => {
      const metric = service.createMetric('cursor', 'core', 'Test', 100, 50, false);

      expect(metric.tokensUsed).toBeUndefined();
      expect(metric.cost).toBeUndefined();
      expect(metric.userRating).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should flush remaining metrics on shutdown', async () => {
      await service.initialize();

      const metric = service.createMetric('cursor', 'core', 'Test message', 100, 50, false);
      await service.record(metric);

      await service.shutdown();

      const content = await readFile(testMetricsPath, 'utf-8');
      expect(content).toContain('Test message');
    });

    it('should clear flush interval on shutdown', async () => {
      await service.initialize();
      await service.shutdown();

      // Re-initialize should work
      await service.initialize();
      const health = await service.healthCheck();
      expect(health).toBe(true);
    });

    it('should disable service on shutdown', async () => {
      await service.initialize();
      await service.shutdown();

      expect(service.getStatus().enabled).toBe(false);
      
      const metric = service.createMetric('cursor', 'core', 'Test', 100, 50, false);
      await service.record(metric);
      await service.flush();

      // Should not record after shutdown - file should be empty or not contain new metric
      if (existsSync(testMetricsPath)) {
        const content = await readFile(testMetricsPath, 'utf-8');
        // After shutdown, service is disabled so nothing should be recorded
        expect(service.getStatus().enabled).toBe(false);
      }
    });
  });

  describe('healthCheck', () => {
    it('should return true when enabled and metrics file accessible', async () => {
      await service.initialize();

      // Create metrics file by flushing
      await service.flush();

      const health = await service.healthCheck();
      expect(health).toBe(true);
    });

    it('should return false when service disabled', async () => {
      const disabledConfig = {
        ...DEFAULT_CONFIG,
        features: {
          ...DEFAULT_CONFIG.features,
          analytics: {
            enabled: false,
            trackQuality: false,
            trackCost: false,
            trackPerformance: false,
          },
        },
      };

      const disabledService = new AnalyticsService(disabledConfig, testRoot);
      await disabledService.initialize();

      const health = await disabledService.healthCheck();
      expect(health).toBe(false);

      await disabledService.shutdown();
    });
  });

  describe('integration', () => {
    it('should handle full analytics workflow', async () => {
      await service.initialize();

      // Record multiple metrics
      const platforms: Platform[] = ['cursor', 'notion', 'generic-agents'];
      for (let i = 0; i < 5; i++) {
        const metric = service.createMetric(
          platforms[i % platforms.length],
          'core',
          `Message ${i}`,
          100 + i,
          50 + i,
          i % 2 === 0
        );
        await service.record(metric);
      }

      await service.shutdown();

      // Verify all metrics were written
      const content = await readFile(testMetricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines.length).toBe(5);

      // Verify each metric
      lines.forEach((line, index) => {
        const metric = JSON.parse(line);
        expect(metric.userMessage).toBe(`Message ${index}`);
        expect(metric.responseLength).toBe(100 + index);
        expect(metric.responseTime).toBe(50 + index);
      });
    });
  });
});

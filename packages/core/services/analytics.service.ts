/**
 * Analytics Service
 *
 * Tracks prompt quality, performance, and usage metrics
 * Can be toggled on/off via user configuration
 */

import { BaseService } from './base.js';
import { UserConfig } from '../config.js';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { PromptMetrics, Platform, Mode, ResponseQuality } from '../../../analytics/schemas/metrics.types.js';
import { PIIScrubber } from '../utils/pii-scrubber.js';

// Re-export for convenience
export type { PromptMetrics, Platform, Mode, ResponseQuality };

export class AnalyticsService extends BaseService {
  private metricsPath: string;
  private buffer: PromptMetrics[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private piiScrubber: PIIScrubber;

  constructor(config: UserConfig, repoRoot: string = process.cwd()) {
    super(
      {
        name: 'Analytics',
        version: '1.0.0',
        description: 'Tracks prompt performance and quality metrics',
        dependencies: [],
        optional: true,
      },
      config
    );

    this.metricsPath = join(repoRoot, 'analytics', 'data', 'metrics.jsonl');

    // Initialize PII scrubber with config defaults
    // PII scrubbing is enabled by default for security
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

  async initialize(): Promise<void> {
    if (!this.shouldEnable()) {
      return;
    }

    // Ensure analytics directory exists
    const dir = join(this.metricsPath, '..');
    try {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    } catch (error) {
      // If directory creation fails, mark as unhealthy but don't throw
      this.status.healthy = false;
      this.status.lastError = String(error);
      return;
    }

    // Start auto-flush interval (every 30 seconds)
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, 30000);

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;
  }

  async shutdown(): Promise<void> {
    // Flush remaining metrics
    await this.flush();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.status.initialized = false;
    this.status.enabled = false;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.status.enabled) {
      return false;
    }
    // Check if directory exists (file may not exist yet if no metrics recorded)
    const dir = join(this.metricsPath, '..');
    return existsSync(dir);
  }

  protected shouldEnable(): boolean {
    return this.config.features.analytics.enabled;
  }

  /**
   * Record a metric
   */
  async record(metric: PromptMetrics): Promise<void> {
    if (!this.status.enabled) {
      return;
    }

    this.buffer.push(metric);

    // Auto-flush if buffer gets large
    if (this.buffer.length >= 10) {
      await this.flush();
    }
  }

  /**
   * Flush buffer to disk
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      const lines = this.buffer.map(m => JSON.stringify(m)).join('\n') + '\n';
      await appendFile(this.metricsPath, lines, 'utf-8');
      this.buffer = [];
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      this.status.healthy = false;
      this.status.lastError = String(error);
    }
  }

  /**
   * Create a metric from prompt execution
   */
  createMetric(
    platform: Platform,
    mode: Mode,
    userMessage: string,
    responseLength: number,
    responseTime: number,
    verbalizedSampling: boolean,
    options?: {
      quality?: ResponseQuality;
      tokensUsed?: number;
      cost?: number;
      userRating?: number;
      feedback?: string;
      router?: PromptMetrics['router'];
      evaluation?: PromptMetrics['evaluation'];
    }
  ): PromptMetrics {
    return {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      platform,
      mode,
      userMessage: this.sanitizeMessage(userMessage),
      responseLength,
      responseTime,
      quality: options?.quality || 'acceptable',
      verbalizedSampling,
      tokensUsed: options?.tokensUsed,
      cost: options?.cost,
      userRating: options?.userRating,
      feedback: options?.feedback,
      router: options?.router,
      evaluation: options?.evaluation,
    };
  }

  private generateId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeMessage(message: string): string {
    // First, scrub PII from the message
    let sanitized = this.piiScrubber.scrub(message).scrubbed;

    // Then truncate long messages for privacy/storage
    const maxLength = 500;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }
    return sanitized;
  }
}

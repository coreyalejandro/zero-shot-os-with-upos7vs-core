/**
 * Anthropic Claude Platform Adapter for UPOS-7-VS
 *
 * Integrates Anthropic Claude API with streaming, retries, and circuit breakers
 */

import { BaseService, ServiceMetadata } from '../services/base.js';
import { UserConfig } from '../config.js';
import { Logger } from '../utils/logger.js';
import { retryWithBackoff, CircuitBreaker } from '../utils/retry.js';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  enableStreaming?: boolean;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system?: string;
  stream?: boolean;
}

/**
 * Anthropic Claude Platform Adapter
 *
 * Handles integration with Anthropic Claude API including:
 * - Message completions with streaming support
 * - Automatic retries with exponential backoff
 * - Circuit breaker for failure protection
 * - Token usage tracking
 */
export class AnthropicAdapter extends BaseService {
  private anthropicConfig: AnthropicConfig;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;

  constructor(anthropicConfig: AnthropicConfig, userConfig: UserConfig) {
    const metadata: ServiceMetadata = {
      name: 'anthropic-adapter',
      version: '1.0.0',
      description: 'Anthropic Claude API integration',
      dependencies: [],
      optional: true,
    };

    super(metadata, userConfig);

    this.anthropicConfig = {
      // Allow model override via config or environment variable
      // Default: claude-sonnet-4-20250514 (latest) or fallback to claude-3-5-sonnet-20241022
      model: anthropicConfig.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      baseUrl: 'https://api.anthropic.com/v1',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      enableStreaming: false,
      ...anthropicConfig,
    };

    this.logger = new Logger('AnthropicAdapter');

    // Circuit breaker to prevent cascading failures
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Anthropic Adapter');

    // Validate configuration
    if (!this.anthropicConfig.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;

    this.logger.info('Anthropic Adapter initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Anthropic Adapter');
    this.status.initialized = false;
    this.status.enabled = false;
    this.logger.info('Anthropic Adapter shut down');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify API key format
      if (!this.anthropicConfig.apiKey.startsWith('sk-ant-')) {
        this.status.healthy = false;
        return false;
      }
      this.status.healthy = true;
      return true;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = String(error);
      return false;
    }
  }

  protected shouldEnable(): boolean {
    return !!this.anthropicConfig.apiKey;
  }

  /**
   * Process a prompt through Anthropic API
   */
  async processPrompt(
    request: AnthropicRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<AnthropicResponse> {
    this.logger.debug(`Processing prompt with model: ${this.anthropicConfig.model}`);

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            return await this.sendRequest(request, options);
          },
          {
            maxRetries: this.anthropicConfig.maxRetries,
            initialDelay: 1000,
            maxDelay: 10000,
            retryableErrors: ['429', '500', '502', '503', '504', 'timeout', 'ECONNRESET'],
            onRetry: (error, attempt) => {
              this.logger.warn(`Anthropic API request failed, retrying (attempt ${attempt}):`, error.message);
            },
          }
        );
      });

      this.logger.debug('Anthropic response received');
      return response;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = String(error);
      this.logger.error('Error processing prompt:', error);
      throw error;
    }
  }

  /**
   * Send request to Anthropic API
   */
  private async sendRequest(
    request: AnthropicRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<AnthropicResponse> {
    const url = `${this.anthropicConfig.baseUrl}/messages`;

    const body = {
      model: request.model || this.anthropicConfig.model,
      messages: request.messages,
      temperature: request.temperature ?? this.anthropicConfig.temperature,
      max_tokens: request.max_tokens ?? this.anthropicConfig.maxTokens,
      system: request.system,
      stream: options?.stream ?? this.anthropicConfig.enableStreaming ?? false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.anthropicConfig.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicConfig.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      if (body.stream && options?.onChunk) {
        // Handle streaming response
        return await this.handleStreamingResponse(response, options.onChunk);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Anthropic API request timeout after ${this.anthropicConfig.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle streaming response from Anthropic
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk: (chunk: string) => void
  ): Promise<AnthropicResponse> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Streaming response body is not available');
    }

    let fullContent = '';
    let usage = { input_tokens: 0, output_tokens: 0 };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim() && line.startsWith('data: '));

        for (const line of lines) {
          if (line === 'data: [DONE]') {
            continue;
          }

          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullContent += data.delta.text;
              onChunk(data.delta.text);
            }
            if (data.type === 'message_stop' && data.usage) {
              usage = data.usage;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Return a response-like object
    return {
      id: `stream-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: fullContent,
        },
      ],
      model: this.anthropicConfig.model || 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage,
    };
  }

  /**
   * Get token usage estimate for a message
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token (Claude uses similar tokenization)
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cost estimate for a request
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    // Pricing for claude-3-5-sonnet (as of 2024)
    const inputCostPer1k = 3.0 / 1000; // $3 per 1M tokens
    const outputCostPer1k = 15.0 / 1000; // $15 per 1M tokens

    return inputTokens * inputCostPer1k + outputTokens * outputCostPer1k;
  }
}

/**
 * Factory function to create Anthropic adapter
 */
export async function createAnthropicAdapter(
  anthropicConfig: AnthropicConfig,
  userConfig: UserConfig
): Promise<AnthropicAdapter> {
  const adapter = new AnthropicAdapter(anthropicConfig, userConfig);
  await adapter.initialize();
  return adapter;
}

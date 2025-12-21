/**
 * OpenAI Platform Adapter for UPOS-7-VS
 *
 * Integrates OpenAI API with streaming, retries, and circuit breakers
 */

import { BaseService, ServiceMetadata } from '../services/base.js';
import { UserConfig } from '../config.js';
import { Logger } from '../utils/logger.js';
import { retryWithBackoff, CircuitBreaker } from '../utils/retry.js';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  enableStreaming?: boolean;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * OpenAI Platform Adapter
 *
 * Handles integration with OpenAI API including:
 * - Chat completions with streaming support
 * - Automatic retries with exponential backoff
 * - Circuit breaker for failure protection
 * - Token usage tracking
 */
export class OpenAIAdapter extends BaseService {
  private openAIConfig: OpenAIConfig;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;

  constructor(openAIConfig: OpenAIConfig, userConfig: UserConfig) {
    const metadata: ServiceMetadata = {
      name: 'openai-adapter',
      version: '1.0.0',
      description: 'OpenAI API integration',
      dependencies: [],
      optional: true,
    };

    super(metadata, userConfig);

    this.openAIConfig = {
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      enableStreaming: false,
      ...openAIConfig,
    };

    this.logger = new Logger('OpenAIAdapter');

    // Circuit breaker to prevent cascading failures
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing OpenAI Adapter');

    // Validate configuration
    if (!this.openAIConfig.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;

    this.logger.info('OpenAI Adapter initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down OpenAI Adapter');
    this.status.initialized = false;
    this.status.enabled = false;
    this.logger.info('OpenAI Adapter shut down');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify API key format
      if (!this.openAIConfig.apiKey.startsWith('sk-')) {
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
    return !!this.openAIConfig.apiKey;
  }

  /**
   * Process a prompt through OpenAI API
   */
  async processPrompt(
    request: OpenAIRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<OpenAIResponse> {
    this.logger.debug(`Processing prompt with model: ${this.openAIConfig.model}`);

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            return await this.sendRequest(request, options);
          },
          {
            maxRetries: this.openAIConfig.maxRetries,
            initialDelay: 1000,
            maxDelay: 10000,
            retryableErrors: ['429', '500', '502', '503', '504', 'timeout', 'ECONNRESET'],
            onRetry: (error, attempt) => {
              this.logger.warn(`OpenAI API request failed, retrying (attempt ${attempt}):`, error.message);
            },
          }
        );
      });

      this.logger.debug('OpenAI response received');
      return response;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = String(error);
      this.logger.error('Error processing prompt:', error);
      throw error;
    }
  }

  /**
   * Send request to OpenAI API
   */
  private async sendRequest(
    request: OpenAIRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<OpenAIResponse> {
    const url = `${this.openAIConfig.baseUrl}/chat/completions`;

    const body = {
      model: request.model || this.openAIConfig.model,
      messages: request.messages,
      temperature: request.temperature ?? this.openAIConfig.temperature,
      max_tokens: request.max_tokens ?? this.openAIConfig.maxTokens,
      stream: options?.stream ?? this.openAIConfig.enableStreaming ?? false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.openAIConfig.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openAIConfig.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      if (body.stream && options?.onChunk) {
        // Handle streaming response
        return await this.handleStreamingResponse(response, options.onChunk);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenAI API request timeout after ${this.openAIConfig.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle streaming response from OpenAI
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk: (chunk: string) => void
  ): Promise<OpenAIResponse> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Streaming response body is not available');
    }

    let fullContent = '';
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

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
            const content = data.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk(content);
            }
            if (data.usage) {
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
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.openAIConfig.model || 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: fullContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage,
    };
  }

  /**
   * Get token usage estimate for a message
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cost estimate for a request
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    // Pricing for gpt-4o-mini (as of 2024)
    const promptCostPer1k = 0.15 / 1000; // $0.15 per 1M tokens
    const completionCostPer1k = 0.6 / 1000; // $0.60 per 1M tokens

    return promptTokens * promptCostPer1k + completionTokens * completionCostPer1k;
  }
}

/**
 * Factory function to create OpenAI adapter
 */
export async function createOpenAIAdapter(
  openAIConfig: OpenAIConfig,
  userConfig: UserConfig
): Promise<OpenAIAdapter> {
  const adapter = new OpenAIAdapter(openAIConfig, userConfig);
  await adapter.initialize();
  return adapter;
}

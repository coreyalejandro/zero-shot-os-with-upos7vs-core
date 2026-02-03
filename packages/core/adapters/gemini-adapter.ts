/**
 * Google Gemini Platform Adapter for UPOS-7-VS
 *
 * Integrates Google Gemini API with streaming, retries, and circuit breakers
 * Built for the Gemini API Hackathon - Action Era
 */

import { BaseService, ServiceMetadata } from '../services/base.js';
import { UserConfig } from '../config.js';
import { Logger } from '../utils/logger.js';
import { retryWithBackoff, CircuitBreaker } from '../utils/retry.js';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  temperature?: number;
  timeout?: number;
  maxRetries?: number;
  enableStreaming?: boolean;
  topP?: number;
  topK?: number;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion?: string;
}

export interface GeminiRequest {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Google Gemini Platform Adapter
 *
 * Handles integration with Google Gemini API including:
 * - Chat completions with streaming support
 * - Automatic retries with exponential backoff
 * - Circuit breaker for failure protection
 * - Token usage tracking
 * - Multi-turn conversations
 */
export class GeminiAdapter extends BaseService {
  private geminiConfig: GeminiConfig;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;

  constructor(geminiConfig: GeminiConfig, userConfig: UserConfig) {
    const metadata: ServiceMetadata = {
      name: 'gemini-adapter',
      version: '1.0.0',
      description: 'Google Gemini API integration',
      dependencies: [],
      optional: true,
    };

    super(metadata, userConfig);

    this.geminiConfig = {
      model: 'gemini-2.0-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      maxOutputTokens: 8192,
      temperature: 0.7,
      timeout: 60000,
      maxRetries: 3,
      enableStreaming: false,
      topP: 0.95,
      topK: 40,
      ...geminiConfig,
    };

    this.logger = new Logger('GeminiAdapter');

    // Circuit breaker to prevent cascading failures
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Gemini Adapter');

    // Validate configuration
    if (!this.geminiConfig.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;

    this.logger.info('Gemini Adapter initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Gemini Adapter');
    this.status.initialized = false;
    this.status.enabled = false;
    this.logger.info('Gemini Adapter shut down');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Verify API key format (Google API keys start with AIza)
      if (!this.geminiConfig.apiKey.startsWith('AIza')) {
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
    return !!this.geminiConfig.apiKey;
  }

  /**
   * Process a prompt through Gemini API
   */
  async processPrompt(
    request: GeminiRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<GeminiResponse> {
    this.logger.debug(`Processing prompt with model: ${this.geminiConfig.model}`);

    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await retryWithBackoff(
          async () => {
            return await this.sendRequest(request, options);
          },
          {
            maxRetries: this.geminiConfig.maxRetries,
            initialDelay: 1000,
            maxDelay: 30000,
            retryableErrors: ['429', '500', '502', '503', '504', 'timeout', 'ECONNRESET', 'RESOURCE_EXHAUSTED'],
            onRetry: (error, attempt) => {
              this.logger.warn(`Gemini API request failed, retrying (attempt ${attempt}):`, error.message);
            },
          }
        );
      });

      this.logger.debug('Gemini response received');
      return response;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = String(error);
      this.logger.error('Error processing prompt:', error);
      throw error;
    }
  }

  /**
   * Simple text completion (convenience method)
   */
  async complete(prompt: string, systemInstruction?: string): Promise<string> {
    const request: GeminiRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (systemInstruction) {
      request.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const response = await this.processPrompt(request);
    return this.extractText(response);
  }

  /**
   * Extract text content from Gemini response
   */
  extractText(response: GeminiResponse): string {
    const parts = response.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || '').join('');
  }

  /**
   * Send request to Gemini API
   */
  private async sendRequest(
    request: GeminiRequest,
    options?: { stream?: boolean; onChunk?: (chunk: string) => void }
  ): Promise<GeminiResponse> {
    const isStreaming = options?.stream ?? this.geminiConfig.enableStreaming ?? false;
    const endpoint = isStreaming ? 'streamGenerateContent' : 'generateContent';
    const url = `${this.geminiConfig.baseUrl}/models/${this.geminiConfig.model}:${endpoint}?key=${this.geminiConfig.apiKey}`;

    const body: GeminiRequest = {
      ...request,
      generationConfig: {
        temperature: this.geminiConfig.temperature,
        topP: this.geminiConfig.topP,
        topK: this.geminiConfig.topK,
        maxOutputTokens: this.geminiConfig.maxOutputTokens,
        ...request.generationConfig,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.geminiConfig.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error (${response.status}): ${errorText}`;
        
        // Parse error for better messaging
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = `Gemini API error (${response.status}): ${errorJson.error.message}`;
          }
        } catch {
          // Use original error text
        }
        
        throw new Error(errorMessage);
      }

      if (isStreaming && options?.onChunk) {
        return await this.handleStreamingResponse(response, options.onChunk);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gemini API request timeout after ${this.geminiConfig.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle streaming response from Gemini
   */
  private async handleStreamingResponse(
    response: Response,
    onChunk: (chunk: string) => void
  ): Promise<GeminiResponse> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Streaming response body is not available');
    }

    let fullContent = '';
    let usageMetadata = { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Gemini streams JSON objects, one per line (or as array elements)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === ',') continue;

          try {
            // Remove leading comma if present (array streaming)
            const jsonStr = trimmed.startsWith(',') ? trimmed.slice(1) : trimmed;
            const data = JSON.parse(jsonStr);
            
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullContent += text;
              onChunk(text);
            }
            
            if (data.usageMetadata) {
              usageMetadata = data.usageMetadata;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      candidates: [
        {
          content: {
            parts: [{ text: fullContent }],
            role: 'model',
          },
          finishReason: 'STOP',
          index: 0,
        },
      ],
      usageMetadata,
      modelVersion: this.geminiConfig.model,
    };
  }

  /**
   * Get token usage estimate for a message
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for Gemini
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cost estimate for a request (Gemini 2.0 Flash pricing)
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    // Gemini 2.0 Flash pricing (as of 2025)
    // Input: $0.10 per 1M tokens, Output: $0.40 per 1M tokens
    const promptCostPerToken = 0.10 / 1_000_000;
    const completionCostPerToken = 0.40 / 1_000_000;

    return promptTokens * promptCostPerToken + completionTokens * completionCostPerToken;
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    const url = `${this.geminiConfig.baseUrl}/models?key=${this.geminiConfig.apiKey}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }
      
      const data = await response.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch (error) {
      this.logger.error('Error listing models:', error);
      return [];
    }
  }
}

/**
 * Factory function to create Gemini adapter
 */
export async function createGeminiAdapter(
  geminiConfig: GeminiConfig,
  userConfig: UserConfig
): Promise<GeminiAdapter> {
  const adapter = new GeminiAdapter(geminiConfig, userConfig);
  await adapter.initialize();
  return adapter;
}

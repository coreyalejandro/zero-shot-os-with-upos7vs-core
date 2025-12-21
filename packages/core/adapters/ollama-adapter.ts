/**
 * Ollama Local LLM Adapter
 *
 * Supports self-hosted, offline LLM execution via Ollama.
 * No API keys required, all processing happens locally.
 */

import { CircuitBreaker } from '../utils/retry.js';

export interface OllamaConfig {
  endpoint: string; // e.g., "http://localhost:11434"
  model: string; // e.g., "llama2", "mistral", "codellama"
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  stream?: boolean;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaAdapter {
  private config: Required<OllamaConfig>;
  private circuitBreaker: CircuitBreaker;

  constructor(config: OllamaConfig) {
    this.config = {
      endpoint: config.endpoint,
      model: config.model,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      stream: config.stream ?? true,
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }

  /**
   * Check if Ollama is running and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(model: string): Promise<void> {
    console.log(`Pulling model ${model}...`);

    const response = await fetch(`${this.config.endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(300000), // 5 minutes for model download
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    // Stream progress updates
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              console.log(`  ${data.status}`);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    console.log(`✅ Model ${model} ready`);
  }

  /**
   * Generate a chat completion
   */
  async chat(
    messages: OllamaMessage[],
    options?: {
      model?: string;
      temperature?: number;
      stream?: boolean;
      maxTokens?: number;
    }
  ): Promise<OllamaResponse> {
    return this.circuitBreaker.execute(async () => {
      const request: OllamaRequest = {
        model: options?.model || this.config.model,
        messages,
        stream: options?.stream ?? false, // Non-streaming by default for this method
        options: {
          temperature: options?.temperature ?? this.config.temperature,
          num_predict: options?.maxTokens,
        },
      };

      const response = await this.makeRequest('/api/chat', request);

      return response as OllamaResponse;
    });
  }

  /**
   * Stream a chat completion
   */
  async *chatStream(
    messages: OllamaMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string, void, unknown> {
    const request: OllamaRequest = {
      model: options?.model || this.config.model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? this.config.temperature,
        num_predict: options?.maxTokens,
      },
    };

    const response = await fetch(`${this.config.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const chunk: OllamaStreamChunk = JSON.parse(line);

          if (chunk.message?.content) {
            yield chunk.message.content;
          }

          if (chunk.done) {
            return;
          }
        } catch (error) {
          console.warn('Failed to parse stream chunk:', error);
        }
      }
    }
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string, model?: string): Promise<number[]> {
    const request = {
      model: model || this.config.model,
      prompt: text,
    };

    const response = await fetch(`${this.config.endpoint}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding || [];
  }

  /**
   * Get model information
   */
  async modelInfo(model?: string): Promise<any> {
    const response = await fetch(`${this.config.endpoint}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model || this.config.model }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Failed to get model info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Estimate token usage (approximate for local models)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost (free for local models)
   */
  estimateCost(promptTokens: number, completionTokens: number): number {
    return 0; // Local models are free!
  }

  private async makeRequest(
    endpoint: string,
    body: any,
    retries = 0
  ): Promise<any> {
    try {
      const response = await fetch(`${this.config.endpoint}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (retries < this.config.maxRetries) {
        console.warn(`Ollama request failed, retrying (${retries + 1}/${this.config.maxRetries})...`);
        await this.sleep(1000 * (retries + 1)); // Exponential backoff
        return this.makeRequest(endpoint, body, retries + 1);
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create Ollama adapter
 */
export function createOllamaAdapter(config: OllamaConfig): OllamaAdapter {
  return new OllamaAdapter(config);
}

/**
 * Helper to check if Ollama is available on default port
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

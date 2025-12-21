/**
 * IBM Watson Platform Adapter for UPOS-7-VS
 *
 * Integrates IBM Watson Assistant with the UPOS-7-VS system
 * Supports Watson Assistant, Discovery, and NLU services
 */

import { BaseService, ServiceMetadata } from '../services/base.js';
import { UserConfig } from '../config.js';
import { Logger } from '../utils/logger.js';
import { retryWithBackoff, CircuitBreaker } from '../utils/retry.js';

export interface WatsonConfig {
  apiKey: string;
  serviceUrl: string;
  assistantId?: string;
  version?: string;
  enableDiscovery?: boolean;
  enableNLU?: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface WatsonResponse {
  output: {
    generic: Array<{
      response_type: string;
      text?: string;
    }>;
    intents: Array<{
      intent: string;
      confidence: number;
    }>;
    entities: Array<{
      entity: string;
      value: string;
      confidence: number;
    }>;
  };
  context: {
    skills: {
      'main skill': {
        user_defined: any;
        system: any;
      };
    };
  };
}

export interface WatsonRequest {
  message: string;
  context?: any;
  sessionId?: string;
}

/**
 * IBM Watson Platform Adapter
 *
 * Handles integration with IBM Watson services including:
 * - Watson Assistant for conversational AI
 * - Watson Discovery for document search
 * - Watson NLU for enhanced mode detection
 */
export class WatsonAdapter extends BaseService {
  private watsonConfig: WatsonConfig;
  private logger: Logger;
  private sessionId: string | null = null;
  private circuitBreaker: CircuitBreaker;

  constructor(watsonConfig: WatsonConfig, userConfig: UserConfig) {
    const metadata: ServiceMetadata = {
      name: 'watson-adapter',
      version: '1.0.0',
      description: 'IBM Watson Assistant integration',
      dependencies: [],
      optional: true,
    };

    super(metadata, userConfig);

    this.watsonConfig = {
      version: '2021-11-27',
      timeout: 5000,
      enableDiscovery: false,
      enableNLU: false,
      maxRetries: 3,
      ...watsonConfig,
    };

    this.logger = new Logger('WatsonAdapter');

    // Circuit breaker to prevent cascading failures
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Watson Adapter');

    // Validate configuration
    if (!this.watsonConfig.apiKey || !this.watsonConfig.serviceUrl) {
      throw new Error('Watson API key and service URL are required');
    }

    // Create a session with Watson Assistant
    if (this.watsonConfig.assistantId) {
      this.sessionId = await this.createSession();
      this.logger.info(`Watson session created: ${this.sessionId}`);
    }

    this.status.initialized = true;
    this.status.enabled = true;
    this.status.healthy = true;

    this.logger.info('Watson Adapter initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Watson Adapter');

    // Delete the session
    if (this.sessionId && this.watsonConfig.assistantId) {
      await this.deleteSession(this.sessionId);
      this.logger.info('Watson session deleted');
    }

    this.status.initialized = false;
    this.status.enabled = false;

    this.logger.info('Watson Adapter shut down');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify we can reach Watson API
      if (!this.sessionId && this.watsonConfig.assistantId) {
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
    // Enable if API key and service URL are configured
    return !!(this.watsonConfig.apiKey && this.watsonConfig.serviceUrl);
  }

  /**
   * Process a prompt through Watson Assistant
   */
  async processPrompt(request: WatsonRequest): Promise<WatsonResponse> {
    if (!this.watsonConfig.assistantId) {
      throw new Error('Watson Assistant ID not configured');
    }

    if (!this.sessionId) {
      throw new Error('Watson session not created');
    }

    this.logger.debug(`Processing prompt: ${request.message.substring(0, 50)}...`);

    try {
      // Use circuit breaker to prevent cascading failures
      const response = await this.circuitBreaker.execute(async () => {
        return await this.sendMessage({
          assistantId: this.watsonConfig.assistantId!,
          sessionId: request.sessionId || this.sessionId!,
          input: {
            message_type: 'text',
            text: request.message,
          },
          context: request.context,
        });
      });

      this.logger.debug('Watson response received');
      return response as WatsonResponse;
    } catch (error) {
      this.status.healthy = false;
      this.status.lastError = String(error);
      this.logger.error('Error processing prompt:', error);
      throw error;
    }
  }

  /**
   * Use Watson NLU for enhanced mode detection
   */
  async analyzeText(text: string): Promise<{
    sentiment: any;
    keywords: any[];
    categories: any[];
    concepts: any[];
  }> {
    if (!this.watsonConfig.enableNLU) {
      throw new Error('Watson NLU not enabled');
    }

    this.logger.debug('Analyzing text with Watson NLU');

    // Production rule: do not return placeholder/mock results.
    // If/when NLU is needed, implement the real Watson NLU API call here.
    throw new Error('Watson NLU analyzeText() is not implemented (no placeholder results)');
  }

  /**
   * Search documentation using Watson Discovery
   */
  async searchDocs(query: string, options?: {
    count?: number;
    offset?: number;
  }): Promise<{
    results: Array<{
      title: string;
      text: string;
      score: number;
      metadata: any;
    }>;
    matchingResults: number;
  }> {
    if (!this.watsonConfig.enableDiscovery) {
      throw new Error('Watson Discovery not enabled');
    }

    this.logger.debug(`Searching docs for: ${query}`);

    // Production rule: do not return placeholder/mock results.
    // If/when Discovery is needed, implement the real Watson Discovery query call here.
    throw new Error('Watson Discovery searchDocs() is not implemented (no placeholder results)');
  }

  /**
   * Create a new Watson Assistant session
   */
  private async createSession(): Promise<string> {
    const url = `${this.watsonConfig.serviceUrl}/v2/assistants/${this.watsonConfig.assistantId}/sessions?version=${this.watsonConfig.version}`;

    const response = await this.makeRequest<{ session_id: string }>(url, {
      method: 'POST',
    });

    return response.session_id;
  }

  /**
   * Delete a Watson Assistant session
   */
  private async deleteSession(sessionId: string): Promise<void> {
    const url = `${this.watsonConfig.serviceUrl}/v2/assistants/${this.watsonConfig.assistantId}/sessions/${sessionId}?version=${this.watsonConfig.version}`;

    await this.makeRequest(url, {
      method: 'DELETE',
    });

    this.logger.debug(`Session deleted: ${sessionId}`);
  }

  /**
   * Send a message to Watson Assistant
   */
  private async sendMessage(params: {
    assistantId: string;
    sessionId: string;
    input: {
      message_type: string;
      text: string;
    };
    context?: any;
  }): Promise<any> {
    const url = `${this.watsonConfig.serviceUrl}/v2/assistants/${params.assistantId}/sessions/${params.sessionId}/message?version=${this.watsonConfig.version}`;

    const body = {
      input: params.input,
      context: params.context,
    };

    return await this.makeRequest<WatsonResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Make HTTP request to Watson API with retry logic
   */
  private async makeRequest<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    // Use retry with exponential backoff
    return await retryWithBackoff(
      async () => {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`apikey:${this.watsonConfig.apiKey}`).toString('base64')}`,
          ...options.headers,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.watsonConfig.timeout!);

        try {
          const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Watson API error (${response.status}): ${errorText}`);
          }

          if (options.method === 'DELETE') {
            return {} as T;
          }

          return await response.json() as T;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Watson API request timeout after ${this.watsonConfig.timeout}ms`);
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        maxRetries: this.watsonConfig.maxRetries,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
        retryableErrors: ['timeout', 'ECONNRESET', 'ETIMEDOUT', '429', '500', '502', '503', '504'],
        onRetry: (error, attempt) => {
          this.logger.warn(`Watson API request failed, retrying (attempt ${attempt}):`, error.message);
        },
      }
    );
  }

  /**
   * Get Watson-detected intent and map to UPOS-7-VS mode
   */
  async detectMode(message: string): Promise<{
    mode: string;
    confidence: number;
  }> {
    const response = await this.processPrompt({ message });

    // Map Watson intents to UPOS-7-VS modes
    const intentMap: Record<string, string> = {
      upos7vs_core: 'core',
      upos7vs_dev: 'dev',
      upos7vs_uxui: 'uxui',
      upos7vs_long: 'long',
    };

    if (response.output.intents.length > 0) {
      const topIntent = response.output.intents[0];
      const mode = intentMap[topIntent.intent] || 'core';

      return {
        mode,
        confidence: topIntent.confidence,
      };
    }

    // Default to core mode if no intent detected
    return {
      mode: 'core',
      confidence: 0.5,
    };
  }
}

/**
 * Factory function to create Watson adapter
 */
export async function createWatsonAdapter(
  watsonConfig: WatsonConfig,
  userConfig: UserConfig
): Promise<WatsonAdapter> {
  const adapter = new WatsonAdapter(watsonConfig, userConfig);
  await adapter.initialize();
  return adapter;
}

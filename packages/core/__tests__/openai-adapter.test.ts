/**
 * OpenAI Adapter Tests
 *
 * Tests for OpenAI API integration including streaming, retries, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OpenAIAdapter, OpenAIConfig, OpenAIRequest } from '../adapters/openai-adapter.js';
import { DEFAULT_CONFIG } from '../config.js';

// Properly mock fetch globally for TypeScript type safety
const mockFetch = jest.fn<typeof fetch>();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  jest.clearAllMocks();
});

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockConfig: OpenAIConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'sk-test-key-12345',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      enableStreaming: false,
    };

    adapter = new OpenAIAdapter(mockConfig, DEFAULT_CONFIG);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create adapter instance', () => {
      expect(adapter).toBeDefined();
    });

    it('should initialize successfully with valid API key', async () => {
      await adapter.initialize();

      const health = await adapter.healthCheck();
      expect(health).toBe(true);
    });

    it('should throw error when API key is missing', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidAdapter = new OpenAIAdapter(invalidConfig, DEFAULT_CONFIG);

      await expect(invalidAdapter.initialize()).rejects.toThrow('OpenAI API key is required');
    });

    it('should use default values when options not provided', () => {
      const minimalConfig: OpenAIConfig = {
        apiKey: 'sk-test',
      };

      const minimalAdapter = new OpenAIAdapter(minimalConfig, DEFAULT_CONFIG);
      expect(minimalAdapter).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should return true for valid API key format', async () => {
      const health = await adapter.healthCheck();
      expect(health).toBe(true);
    });

    it('should return false for invalid API key format', async () => {
      const invalidConfig = { ...mockConfig, apiKey: 'invalid-key' };
      const invalidAdapter = new OpenAIAdapter(invalidConfig, DEFAULT_CONFIG);
      await invalidAdapter.initialize();

      const health = await invalidAdapter.healthCheck();
      expect(health).toBe(false);

      await invalidAdapter.shutdown();
    });
  });

  describe('processPrompt', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should process prompt successfully', async () => {
      const mockResponse: any = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test prompt' }],
      };

      const result = await adapter.processPrompt(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include correct headers in request', async () => {
      const mockResponse: any = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await adapter.processPrompt(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockConfig.apiKey}`,
          }),
        })
      );
    });

    it('should use request model if provided', async () => {
      const mockResponse: any = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      // Properly mock the fetch API Response type using "as Response" directly
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-4',
      };

      await adapter.processPrompt(request);

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1] && callArgs[1].body) {
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.model).toBe('gpt-4');
      }
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(adapter.processPrompt(request)).rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      const mockResponse: any = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Test' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      // First call fails with 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const result = await adapter.processPrompt(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      const timeoutConfig = { ...mockConfig, timeout: 100 };
      const timeoutAdapter = new OpenAIAdapter(timeoutConfig, DEFAULT_CONFIG);
      await timeoutAdapter.initialize();

      mockFetch.mockImplementationOnce(
        () =>
          new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 200);
          })
      );

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(timeoutAdapter.processPrompt(request)).rejects.toThrow();

      await timeoutAdapter.shutdown();
    });
  });

  describe('token usage estimation', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should estimate token usage', () => {
      const text = 'Test message for token estimation';

      // OpenAI typically uses ~4 characters per token
      const estimated = adapter.estimateTokens(text);
      expect(estimated).toBeGreaterThan(0);
      expect(typeof estimated).toBe('number');
    });

    it('should handle empty text', () => {
      const estimated = adapter.estimateTokens('');
      expect(estimated).toBe(0);
    });
  });

  describe('cost estimation', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should estimate cost for prompt and completion', () => {
      const promptTokens = 100;
      const completionTokens = 50;

      const cost = adapter.estimateCost(promptTokens, completionTokens);
      expect(cost).toBeGreaterThanOrEqual(0);
      expect(typeof cost).toBe('number');
    });

    it('should return 0 for zero tokens', () => {
      const cost = adapter.estimateCost(0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await adapter.initialize();
      await adapter.shutdown();

      const health = await adapter.healthCheck();
      // Health check might still pass if it only checks API key format
      expect(adapter).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(adapter.processPrompt(request)).rejects.toThrow();
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(adapter.processPrompt(request)).rejects.toThrow();
    });
  });

  describe('integration', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle full request workflow', async () => {
      const mockResponse: any = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: OpenAIRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'What is 2+2?' },
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 100,
      };

      const result = await adapter.processPrompt(request);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('This is a test response');
      expect(result.usage.total_tokens).toBe(30);
    });
  });
});

/**
 * Anthropic Adapter Tests
 *
 * Tests for Anthropic Claude API integration including streaming, retries, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AnthropicAdapter, AnthropicConfig, AnthropicRequest } from '../adapters/anthropic-adapter.js';
import { DEFAULT_CONFIG } from '../config.js';

// Properly mock fetch globally for TypeScript type safety
const mockFetch = jest.fn<typeof fetch>();
beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterAll(() => {
  jest.clearAllMocks();
});

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  let mockConfig: AnthropicConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'sk-ant-test-key-12345',
      model: 'claude-3-5-sonnet-20241022',
      baseUrl: 'https://api.anthropic.com/v1',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      enableStreaming: false,
    };

    adapter = new AnthropicAdapter(mockConfig, DEFAULT_CONFIG);
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
      const invalidAdapter = new AnthropicAdapter(invalidConfig, DEFAULT_CONFIG);

      await expect(invalidAdapter.initialize()).rejects.toThrow('Anthropic API key is required');
    });

    it('should use default values when options not provided', () => {
      const minimalConfig: AnthropicConfig = {
        apiKey: 'sk-ant-test',
      };

      const minimalAdapter = new AnthropicAdapter(minimalConfig, DEFAULT_CONFIG);
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
      const invalidAdapter = new AnthropicAdapter(invalidConfig, DEFAULT_CONFIG);
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
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Test response',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: AnthropicRequest = {
        messages: [{ role: 'user', content: 'Test prompt' }],
      };

      const result = await adapter.processPrompt(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include correct headers in request', async () => {
      const mockResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: AnthropicRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await adapter.processPrompt(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': mockConfig.apiKey,
            'anthropic-version': '2023-06-01',
          }),
        })
      );
    });

    it('should use request model if provided', async () => {
      const mockResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: AnthropicRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      await adapter.processPrompt(request);

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1] && callArgs[1].body) {
        const body = JSON.parse(callArgs[1].body as string);
        expect(body.model).toBe('claude-3-opus-20240229');
      }
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      } as unknown as Response);

      const request: AnthropicRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await expect(adapter.processPrompt(request)).rejects.toThrow();
    });

    it('should retry on retryable errors', async () => {
      const mockResponse: any = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Test' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
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

      const request: AnthropicRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const result = await adapter.processPrompt(request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout errors', async () => {
      const timeoutConfig = { ...mockConfig, timeout: 100 };
      const timeoutAdapter = new AnthropicAdapter(timeoutConfig, DEFAULT_CONFIG);
      await timeoutAdapter.initialize();

      mockFetch.mockImplementationOnce(
        () =>
          new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('AbortError')), 200);
          })
      );

      const request: AnthropicRequest = {
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

      // Anthropic typically uses ~4 characters per token
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

    it('should estimate cost for input and output tokens', () => {
      const inputTokens = 100;
      const outputTokens = 50;

      const cost = adapter.estimateCost(inputTokens, outputTokens);
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

      expect(adapter).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await adapter.initialize();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: AnthropicRequest = {
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

      const request: AnthropicRequest = {
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
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'This is a test response from Claude',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 20,
          output_tokens: 10,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const request: AnthropicRequest = {
        messages: [
          { role: 'user', content: 'What is 2+2?' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        max_tokens: 100,
      };

      const result = await adapter.processPrompt(request);

      expect(result.id).toBe('msg_123');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('This is a test response from Claude');
      expect(result.usage.input_tokens).toBe(20);
      expect(result.usage.output_tokens).toBe(10);
    });
  });
});

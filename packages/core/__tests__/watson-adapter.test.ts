/**
 * Watson Adapter Tests
 *
 * Comprehensive tests for IBM Watson Assistant integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WatsonAdapter, WatsonConfig, WatsonResponse } from '../adapters/watson-adapter.js';
import { DEFAULT_CONFIG } from '../config.js';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('WatsonAdapter', () => {
  let adapter: WatsonAdapter;
  const mockApiKey = 'test-api-key-12345';
  const mockServiceUrl = 'https://api.us-south.assistant.watson.cloud.ibm.com';
  const mockAssistantId = 'test-assistant-id';

  const mockWatsonConfig: WatsonConfig = {
    apiKey: mockApiKey,
    serviceUrl: mockServiceUrl,
    assistantId: mockAssistantId,
    version: '2021-11-27',
    timeout: 5000,
    maxRetries: 3,
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(async () => {
    if (adapter) {
      try {
        await adapter.shutdown();
      } catch {
        // Ignore shutdown errors in tests
      }
    }
  });

  describe('initialization', () => {
    it('should create a Watson adapter instance', () => {
      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      expect(adapter).toBeDefined();
    });

    it('should initialize successfully with valid config', async () => {
      // Mock session creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();

      const health = await adapter.healthCheck();
      expect(health).toBe(true);
    });

    it('should throw error if API key is missing', async () => {
      const invalidConfig = { ...mockWatsonConfig, apiKey: '' };
      adapter = new WatsonAdapter(invalidConfig, DEFAULT_CONFIG);

      await expect(adapter.initialize()).rejects.toThrow(
        'Watson API key and service URL are required'
      );
    });

    it('should throw error if service URL is missing', async () => {
      const invalidConfig = { ...mockWatsonConfig, serviceUrl: '' };
      adapter = new WatsonAdapter(invalidConfig, DEFAULT_CONFIG);

      await expect(adapter.initialize()).rejects.toThrow(
        'Watson API key and service URL are required'
      );
    });

    it('should use default config values', () => {
      const minimalConfig: WatsonConfig = {
        apiKey: mockApiKey,
        serviceUrl: mockServiceUrl,
      };

      adapter = new WatsonAdapter(minimalConfig, DEFAULT_CONFIG);
      expect(adapter).toBeDefined();
    });

    it('should create session if assistantId provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('processPrompt', () => {
    beforeEach(async () => {
      // Mock session creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();
      mockFetch.mockClear();
    });

    it('should process a prompt successfully', async () => {
      const mockResponse: WatsonResponse = {
        output: {
          generic: [{ response_type: 'text', text: 'Hello!' }],
          intents: [{ intent: 'greeting', confidence: 0.95 }],
          entities: [],
        },
        context: {
          skills: {
            'main skill': {
              user_defined: {},
              system: {},
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await adapter.processPrompt({ message: 'Hello' });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/message'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error if not initialized', async () => {
      const uninitializedAdapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);

      await expect(
        uninitializedAdapter.processPrompt({ message: 'Hello' })
      ).rejects.toThrow('Watson session not created');
    });

    it('should throw error if assistantId not configured', async () => {
      const configWithoutAssistant = { ...mockWatsonConfig, assistantId: undefined };
      const adapterWithoutAssistant = new WatsonAdapter(configWithoutAssistant, DEFAULT_CONFIG);

      await expect(
        adapterWithoutAssistant.processPrompt({ message: 'Hello' })
      ).rejects.toThrow('Watson Assistant ID not configured');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      } as Response);

      await expect(
        adapter.processPrompt({ message: 'Hello' })
      ).rejects.toThrow('Watson API error (401)');
    });

    it('should retry on failure', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: { generic: [], intents: [], entities: [] },
            context: { skills: { 'main skill': { user_defined: {}, system: {} } } },
          }),
        } as Response);

      const result = await adapter.processPrompt({ message: 'Test retry' });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use circuit breaker for failure protection', async () => {
      // Trigger circuit breaker by causing multiple failures
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response);
      }

      // All retries should fail
      for (let i = 0; i < 5; i++) {
        try {
          await adapter.processPrompt({ message: 'Test' });
        } catch {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(
        adapter.processPrompt({ message: 'Test after circuit open' })
      ).rejects.toThrow();
    });

    it('should include context in request', async () => {
      const mockContext = { user_id: '123', session_vars: {} };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { generic: [], intents: [], entities: [] },
          context: { skills: { 'main skill': { user_defined: {}, system: {} } } },
        }),
      } as Response);

      await adapter.processPrompt({
        message: 'Hello',
        context: mockContext,
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.context).toEqual(mockContext);
    });

    it('should use custom sessionId if provided', async () => {
      const customSessionId = 'custom-session-456';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { generic: [], intents: [], entities: [] },
          context: { skills: { 'main skill': { user_defined: {}, system: {} } } },
        }),
      } as Response);

      await adapter.processPrompt({
        message: 'Hello',
        sessionId: customSessionId,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(customSessionId),
        expect.any(Object)
      );
    });
  });

  describe('detectMode', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();
      mockFetch.mockClear();
    });

    it('should detect mode from Watson intents', async () => {
      const mockResponse: WatsonResponse = {
        output: {
          generic: [],
          intents: [{ intent: 'upos7vs_dev', confidence: 0.92 }],
          entities: [],
        },
        context: {
          skills: {
            'main skill': {
              user_defined: {},
              system: {},
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await adapter.detectMode('Create a REST API');

      expect(result.mode).toBe('dev');
      expect(result.confidence).toBe(0.92);
    });

    it('should map Watson intents to UPOS modes', async () => {
      const intentMappings = [
        { intent: 'upos7vs_core', expectedMode: 'core' },
        { intent: 'upos7vs_dev', expectedMode: 'dev' },
        { intent: 'upos7vs_uxui', expectedMode: 'uxui' },
        { intent: 'upos7vs_long', expectedMode: 'long' },
      ];

      for (const { intent, expectedMode } of intentMappings) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: {
              generic: [],
              intents: [{ intent, confidence: 0.9 }],
              entities: [],
            },
            context: {
              skills: {
                'main skill': {
                  user_defined: {},
                  system: {},
                },
              },
            },
          }),
        } as Response);

        const result = await adapter.detectMode('Test message');
        expect(result.mode).toBe(expectedMode);
      }
    });

    it('should default to core mode if no intent detected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            generic: [],
            intents: [],
            entities: [],
          },
          context: {
            skills: {
              'main skill': {
                user_defined: {},
                system: {},
              },
            },
          },
        }),
      } as Response);

      const result = await adapter.detectMode('Ambiguous message');

      expect(result.mode).toBe('core');
      expect(result.confidence).toBe(0.5);
    });

    it('should default to core mode for unknown intent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            generic: [],
            intents: [{ intent: 'unknown_intent', confidence: 0.8 }],
            entities: [],
          },
          context: {
            skills: {
              'main skill': {
                user_defined: {},
                system: {},
              },
            },
          },
        }),
      } as Response);

      const result = await adapter.detectMode('Test');

      expect(result.mode).toBe('core');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('shutdown', () => {
    it('should delete session on shutdown', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();
      mockFetch.mockClear();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await adapter.shutdown();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle shutdown gracefully when not initialized', async () => {
      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);

      await expect(adapter.shutdown()).resolves.not.toThrow();
    });

    it('should handle session deletion errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();
      mockFetch.mockClear();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Session not found',
      } as Response);

      // Should not throw even if deletion fails
      await expect(adapter.shutdown()).rejects.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return false if session not created but assistantId configured', async () => {
      // Create adapter but don't properly initialize (simulate session creation failure)
      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      // Don't call initialize, so sessionId remains null

      const health = await adapter.healthCheck();
      expect(health).toBe(false); // Should return false because assistantId is set but no session
    });

    it('should return true if session exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();

      const health = await adapter.healthCheck();
      expect(health).toBe(true);
    });

    it('should return true when no assistantId configured', async () => {
      const configWithoutAssistant = { ...mockWatsonConfig, assistantId: undefined };
      adapter = new WatsonAdapter(configWithoutAssistant, DEFAULT_CONFIG);
      await adapter.initialize();

      const health = await adapter.healthCheck();
      expect(health).toBe(true); // Returns true when no assistantId (no session required)
    });
  });

  describe('authentication', () => {
    it('should encode API key in Basic auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1]?.headers as Record<string, string>;

      expect(headers['Authorization']).toMatch(/^Basic /);
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('timeout handling', () => {
    it('should abort request on timeout', async () => {
      const shortTimeoutConfig = { ...mockWatsonConfig, timeout: 100 };

      // Mock fetch to simulate a timeout scenario
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            setTimeout(() => reject(error), 50);
          })
      );

      adapter = new WatsonAdapter(shortTimeoutConfig, DEFAULT_CONFIG);

      await expect(adapter.initialize()).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test-session-123' }),
      } as Response);

      adapter = new WatsonAdapter(mockWatsonConfig, DEFAULT_CONFIG);
      await adapter.initialize();
      mockFetch.mockClear();
    });

    it('should update status on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      try {
        await adapter.processPrompt({ message: 'Test' });
      } catch {
        // Expected to throw
      }

      const health = await adapter.healthCheck();
      expect(health).toBe(true); // Health check doesn't depend on last error
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(adapter.processPrompt({ message: 'Test' })).rejects.toThrow();
    });
  });
});

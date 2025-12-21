/**
 * Embeddings Client Tests
 *
 * Tests for semantic embeddings generation, caching, and similarity calculation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  EmbeddingsClient,
  OpenAIEmbeddingsProvider,
  LocalEmbeddingsProvider,
  MemoryEmbeddingCache,
} from '../utils/embeddings-client.js';

describe('MemoryEmbeddingCache', () => {
  let cache: MemoryEmbeddingCache;

  beforeEach(() => {
    cache = new MemoryEmbeddingCache(1000); // 1 second TTL for tests
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('get and set', () => {
    it('should store and retrieve embeddings', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);
    });

    it('should return null for non-existent keys', async () => {
      const retrieved = await cache.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should expire entries after TTL', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const retrieved = await cache.get('test-key');
      expect(retrieved).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      const embedding = [0.1, 0.2, 0.3];
      await cache.set('test-key', embedding);

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));

      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(embedding);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', [0.1, 0.2]);
      await cache.set('key2', [0.3, 0.4]);

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct cache size', async () => {
      expect(cache.size()).toBe(0);

      await cache.set('key1', [0.1]);
      expect(cache.size()).toBe(1);

      await cache.set('key2', [0.2]);
      expect(cache.size()).toBe(2);

      await cache.clear();
      expect(cache.size()).toBe(0);
    });
  });
});

describe('LocalEmbeddingsProvider', () => {
  let provider: LocalEmbeddingsProvider;

  beforeEach(() => {
    provider = new LocalEmbeddingsProvider();
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const embedding = await provider.generateEmbedding('test text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });

    it('should generate consistent embeddings for same text', async () => {
      const text = 'consistent text';
      const embedding1 = await provider.generateEmbedding(text);
      const embedding2 = await provider.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await provider.generateEmbedding('text one');
      const embedding2 = await provider.generateEmbedding('text two');

      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const embeddings = await provider.generateEmbeddings(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await provider.generateEmbeddings([]);
      expect(embeddings).toEqual([]);
    });
  });
});

describe('OpenAIEmbeddingsProvider', () => {
  let provider: OpenAIEmbeddingsProvider;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    provider = new OpenAIEmbeddingsProvider(mockApiKey, {
      baseUrl: 'http://localhost:3000', // Mock server URL
    });
  });

  describe('generateEmbedding', () => {
    it('should call generateEmbeddings with single text', async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3]];
      const generateEmbeddingsSpy = jest.spyOn(provider, 'generateEmbeddings').mockResolvedValue(mockEmbeddings);

      const result = await provider.generateEmbedding('test');

      expect(generateEmbeddingsSpy).toHaveBeenCalledWith(['test']);
      expect(result).toEqual(mockEmbeddings[0]);
    });
  });

  describe('generateEmbeddings', () => {
    it('should handle API errors gracefully', async () => {
      // Mock fetch to return error
      const mockFetch = jest.fn<typeof fetch>().mockRejectedValue(new Error('API Error'));
      global.fetch = mockFetch as unknown as typeof fetch;

      await expect(provider.generateEmbeddings(['test'])).rejects.toThrow();
    });

    it('should handle invalid API responses', async () => {
      // Mock fetch to return invalid response
      const mockFetch = jest.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);
      global.fetch = mockFetch as unknown as typeof fetch;

      await expect(provider.generateEmbeddings(['test'])).rejects.toThrow();
    });
  });
});

describe('EmbeddingsClient', () => {
  let client: EmbeddingsClient;
  let localProvider: LocalEmbeddingsProvider;
  let cache: MemoryEmbeddingCache;

  beforeEach(() => {
    localProvider = new LocalEmbeddingsProvider();
    cache = new MemoryEmbeddingCache(3600000);
    client = new EmbeddingsClient(localProvider, cache);
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('initialization', () => {
    it('should create client with provider and cache', () => {
      expect(client).toBeDefined();
    });

    it('should work without cache', () => {
      const clientWithoutCache = new EmbeddingsClient(localProvider);
      expect(clientWithoutCache).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should generate embedding for text', async () => {
      const embedding = await client.embed('test text');

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should use cache when available', async () => {
      const text = 'cached text';
      const embedding1 = await client.embed(text);

      // Second call should use cache
      const cacheGetSpy = jest.spyOn(cache, 'get');
      const embedding2 = await client.embed(text);

      expect(cacheGetSpy).toHaveBeenCalled();
      expect(embedding1).toEqual(embedding2);
    });

    it('should store in cache after generation', async () => {
      const text = 'text to cache';
      await client.embed(text);

      const cacheKey = `embed:${text.substring(0, 100)}`;
      const cached = await cache.get(cacheKey);
      expect(cached).toBeDefined();
      expect(Array.isArray(cached)).toBe(true);
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const embeddings = await client.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((embedding: number[]) => {
        expect(Array.isArray(embedding)).toBe(true);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await client.embedBatch([]);
      expect(embeddings).toEqual([]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity between embeddings', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [0, 1, 0];
      const embedding3 = [1, 0, 0]; // Same as embedding1

      const similarity1 = client.cosineSimilarity(embedding1, embedding2);
      const similarity2 = client.cosineSimilarity(embedding1, embedding3);

      expect(similarity1).toBe(0); // Orthogonal vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    it('should return value between -1 and 1', () => {
      const embedding1 = [0.5, 0.3, 0.2];
      const embedding2 = [0.1, 0.9, 0.0];

      const similarity = client.cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle zero vectors', () => {
      const embedding1 = [0, 0, 0];
      const embedding2 = [1, 0, 0];

      const similarity = client.cosineSimilarity(embedding1, embedding2);
      expect(similarity).toBe(0);
    });
  });

  describe('findMostSimilar', () => {
    it('should find most similar embedding', async () => {
      const query = 'query text';
      const candidates = ['similar text', 'different text', 'another text'];

      const queryEmbedding = await client.embed(query);
      const candidateEmbeddings = await client.embedBatch(candidates);

      const candidatesWithLabels = candidateEmbeddings.map((embedding, index) => ({
        embedding,
        label: candidates[index],
      }));

      const result = client.findMostSimilar(queryEmbedding, candidatesWithLabels);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(candidates).toContain(result.label);
        expect(result.similarity).toBeGreaterThanOrEqual(-1);
        expect(result.similarity).toBeLessThanOrEqual(1);
      }
    });

    it('should return highest similarity score', async () => {
      const query = 'test query';
      const candidates = ['test query', 'different text', 'another text'];

      const queryEmbedding = await client.embed(query);
      const candidateEmbeddings = await client.embedBatch(candidates);

      const candidatesWithLabels = candidateEmbeddings.map((embedding, index) => ({
        embedding,
        label: candidates[index],
      }));

      const result = client.findMostSimilar(queryEmbedding, candidatesWithLabels);

      expect(result).not.toBeNull();
      if (result) {
        // First candidate should be most similar (it's the same text)
        expect(result.label).toBe('test query');
        expect(result.similarity).toBeGreaterThan(0.5);
      }
    });

    it('should handle empty candidates array', () => {
      const queryEmbedding = [0.1, 0.2, 0.3];

      const result = client.findMostSimilar(queryEmbedding, []);
      expect(result).toBeNull();
    });
  });

  describe('integration', () => {
    it('should handle full workflow: generate, cache, similarity', async () => {
      const text1 = 'first text';
      const text2 = 'second text';
      const text3 = 'first text'; // Same as text1

      // Generate embeddings
      const embedding1 = await client.embed(text1);
      const embedding2 = await client.embed(text2);
      const embedding3 = await client.embed(text3); // Should use cache

      // Verify caching worked
      expect(embedding1).toEqual(embedding3);

      // Calculate similarity
      const candidates = [
        { embedding: embedding2, label: 'text2' },
        { embedding: embedding3, label: 'text3' },
      ];
      const result = client.findMostSimilar(embedding1, candidates);

      expect(result).not.toBeNull();
      if (result) {
        expect(result.label).toBe('text3'); // embedding3 should be most similar
        expect(result.similarity).toBeGreaterThan(0.9); // Very similar (same text)
      }
    });
  });
});

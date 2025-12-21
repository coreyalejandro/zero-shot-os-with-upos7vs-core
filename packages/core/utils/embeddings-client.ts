/**
 * Embeddings Client for Semantic Mode Detection
 *
 * Provides a provider-agnostic interface for generating embeddings
 * with caching, retries, and fallback strategies
 */

import { retryWithBackoff, CircuitBreaker } from './retry.js';
import { Logger } from './logger.js';

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingCache {
  get(key: string): Promise<number[] | null>;
  set(key: string, embedding: number[]): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory embedding cache with TTL
 */
export class MemoryEmbeddingCache implements EmbeddingCache {
  private cache: Map<string, { embedding: number[]; expires: number }> = new Map();
  private ttl: number; // milliseconds

  constructor(ttl: number = 3600000) {
    // Default 1 hour
    this.ttl = ttl;
  }

  async get(key: string): Promise<number[] | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.embedding;
  }

  async set(key: string, embedding: number[]): Promise<void> {
    this.cache.set(key, {
      embedding,
      expires: Date.now() + this.ttl,
    });
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * OpenAI Embeddings Provider
 */
export class OpenAIEmbeddingsProvider implements EmbeddingProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;

  constructor(apiKey: string, options: { model?: string; baseUrl?: string } = {}) {
    this.apiKey = apiKey;
    this.model = options.model || 'text-embedding-3-small';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    this.logger = new Logger('OpenAIEmbeddings');
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      successThreshold: 2,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return await this.circuitBreaker.execute(async () => {
      return await retryWithBackoff(
        async () => {
          const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: this.model,
              input: texts,
            }),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${error}`);
          }

          const data = await response.json();
          return data.data.map((item: any) => item.embedding as number[]);
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['429', '500', '502', '503', '504', 'timeout'],
          onRetry: (error, attempt) => {
            this.logger.warn(`OpenAI embedding request failed, retrying (attempt ${attempt}):`, error.message);
          },
        }
      );
    });
  }
}

/**
 * Local Embeddings Provider (using simple TF-IDF-like approach as fallback)
 * For production, consider using a local model like sentence-transformers
 */
export class LocalEmbeddingsProvider implements EmbeddingProvider {
  name = 'local';
  private logger: Logger;

  constructor() {
    this.logger = new Logger('LocalEmbeddings');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Simple character-level frequency vector as fallback
    // In production, replace with actual local model (e.g., via ONNX runtime)
    const normalized = text.toLowerCase().trim();
    const vector: number[] = new Array(384).fill(0); // Standard embedding size

    // Simple hash-based embedding (very basic, for fallback only)
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      const index = charCode % vector.length;
      vector[index] += 1 / normalized.length;
    }

    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map((v) => v / magnitude) : vector;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }
}

/**
 * Embeddings Client
 *
 * Main interface for generating embeddings with caching and provider management
 */
export class EmbeddingsClient {
  private provider: EmbeddingProvider;
  private cache: EmbeddingCache;
  private logger: Logger;
  private enabled: boolean;

  constructor(provider: EmbeddingProvider, cache?: EmbeddingCache) {
    this.provider = provider;
    this.cache = cache || new MemoryEmbeddingCache();
    this.logger = new Logger('EmbeddingsClient');
    this.enabled = true;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, useCache: boolean = true): Promise<number[]> {
    if (!this.enabled) {
      throw new Error('Embeddings client is disabled');
    }

    const cacheKey = `embed:${text.substring(0, 100)}`;

    if (useCache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for embedding');
        return cached;
      }
    }

    const startTime = Date.now();
    const embedding = await this.provider.generateEmbedding(text);
    const duration = Date.now() - startTime;

    this.logger.debug(`Generated embedding in ${duration}ms`);

    if (useCache) {
      await this.cache.set(cacheKey, embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[], useCache: boolean = true): Promise<number[][]> {
    if (!this.enabled) {
      throw new Error('Embeddings client is disabled');
    }

    // Check cache for each text
    const results: (number[] | null)[] = await Promise.all(
      texts.map((text, i) => {
        const cacheKey = `embed:${text.substring(0, 100)}`;
        return useCache ? this.cache.get(cacheKey) : Promise.resolve(null);
      })
    );

    // Find texts that need embedding
    const toEmbed: Array<{ text: string; index: number }> = [];
    results.forEach((cached, i) => {
      if (!cached) {
        toEmbed.push({ text: texts[i], index: i });
      }
    });

    if (toEmbed.length === 0) {
      return results as number[][];
    }

    // Generate embeddings for uncached texts
    const embeddings = await this.provider.generateEmbeddings(toEmbed.map((item) => item.text));

    // Update cache and results
    for (let i = 0; i < toEmbed.length; i++) {
      const { text, index } = toEmbed[i];
      const embedding = embeddings[i];
      const cacheKey = `embed:${text.substring(0, 100)}`;

      if (useCache) {
        await this.cache.set(cacheKey, embedding);
      }

      results[index] = embedding;
    }

    return results as number[][];
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Find most similar embedding from a set of candidates
   */
  findMostSimilar(query: number[], candidates: Array<{ embedding: number[]; label: string }>): {
    label: string;
    similarity: number;
  } | null {
    if (candidates.length === 0) {
      return null;
    }

    let bestMatch: { label: string; similarity: number } | null = null;

    for (const candidate of candidates) {
      const similarity = this.cosineSimilarity(query, candidate.embedding);
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { label: candidate.label, similarity };
      }
    }

    return bestMatch;
  }

  /**
   * Disable embeddings client
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Enable embeddings client
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; provider: string } {
    return {
      size: this.cache instanceof MemoryEmbeddingCache ? this.cache.size() : 0,
      provider: this.provider.name,
    };
  }
}

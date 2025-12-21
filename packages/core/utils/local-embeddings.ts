/**
 * Local Embeddings Generator
 *
 * Lightweight embedding generation that works offline.
 * Uses TF-IDF with word vectors for semantic similarity without external APIs.
 */

export interface LocalEmbeddingConfig {
  dimension: number; // Embedding dimension (128, 256, 512)
  vocabSize?: number; // Max vocabulary size
  useCache?: boolean;
}

/**
 * Simple local embeddings using TF-IDF and hashing
 * Not as powerful as OpenAI embeddings, but works offline and is fast
 */
export class LocalEmbeddingsGenerator {
  private config: Required<LocalEmbeddingConfig>;
  private vocabulary: Map<string, number>;
  private idf: Map<string, number>;
  private cache: Map<string, number[]>;

  constructor(config: LocalEmbeddingConfig = { dimension: 256 }) {
    this.config = {
      dimension: config.dimension,
      vocabSize: config.vocabSize || 10000,
      useCache: config.useCache ?? true,
    };

    this.vocabulary = new Map();
    this.idf = new Map();
    this.cache = new Map();
  }

  /**
   * Generate embedding for text
   */
  async generate(text: string): Promise<number[]> {
    // Check cache
    if (this.config.useCache && this.cache.has(text)) {
      return this.cache.get(text)!;
    }

    // Tokenize and normalize
    const tokens = this.tokenize(text);

    // Generate embedding
    const embedding = this.generateEmbedding(tokens);

    // Cache result
    if (this.config.useCache) {
      this.cache.set(text, embedding);
    }

    return embedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.generate(text)));
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar text from candidates
   */
  async findMostSimilar(
    query: string,
    candidates: string[]
  ): Promise<{ text: string; similarity: number; index: number }> {
    const queryEmbedding = await this.generate(query);
    const candidateEmbeddings = await this.generateBatch(candidates);

    let maxSimilarity = -1;
    let maxIndex = -1;

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        candidateEmbeddings[i]
      );

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        maxIndex = i;
      }
    }

    return {
      text: candidates[maxIndex],
      similarity: maxSimilarity,
      index: maxIndex,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
  }

  private tokenize(text: string): string[] {
    // Convert to lowercase
    text = text.toLowerCase();

    // Remove special characters but keep spaces
    text = text.replace(/[^\w\s]/g, ' ');

    // Split into words
    const words = text.split(/\s+/).filter(Boolean);

    // Basic stopword removal
    const stopwords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
      'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
      'that', 'the', 'to', 'was', 'will', 'with',
    ]);

    return words.filter((word) => !stopwords.has(word));
  }

  private generateEmbedding(tokens: string[]): number[] {
    const embedding = new Array(this.config.dimension).fill(0);

    if (tokens.length === 0) {
      return embedding;
    }

    // Build term frequency
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // Normalize term frequencies
    for (const [token, count] of tf) {
      tf.set(token, count / tokens.length);
    }

    // Generate embedding using hash-based feature extraction
    for (const [token, frequency] of tf) {
      const hash = this.hashString(token);

      // Use multiple hash functions to spread features
      for (let i = 0; i < 3; i++) {
        const index = (hash + i * 997) % this.config.dimension;
        const sign = ((hash + i) % 2) * 2 - 1; // ±1

        // TF-IDF weighted contribution
        const idfWeight = this.getIDF(token);
        embedding[index] += sign * frequency * idfWeight;
      }
    }

    // L2 normalization
    const norm = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private getIDF(token: string): number {
    // Simplified IDF - in production, would build from corpus
    if (this.idf.has(token)) {
      return this.idf.get(token)!;
    }

    // Default IDF based on token characteristics
    let idf = 1.0;

    // Longer words tend to be more specific
    if (token.length > 6) {
      idf *= 1.5;
    }

    // Words with numbers or mixed case are more specific
    if (/\d/.test(token)) {
      idf *= 1.3;
    }

    this.idf.set(token, idf);
    return idf;
  }

  /**
   * Build IDF weights from a corpus
   */
  buildCorpus(documents: string[]): void {
    const documentFrequency = new Map<string, number>();
    const totalDocs = documents.length;

    // Count document frequency for each term
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        documentFrequency.set(
          token,
          (documentFrequency.get(token) || 0) + 1
        );
      }
    }

    // Calculate IDF
    for (const [token, df] of documentFrequency) {
      const idf = Math.log(totalDocs / (df + 1));
      this.idf.set(token, idf);
    }

    console.log(`Built corpus with ${this.idf.size} terms`);
  }
}

/**
 * Factory function
 */
export function createLocalEmbeddings(
  config?: LocalEmbeddingConfig
): LocalEmbeddingsGenerator {
  return new LocalEmbeddingsGenerator(config);
}

/**
 * Simple keyword-based semantic matcher (fallback)
 */
export class KeywordMatcher {
  /**
   * Calculate simple keyword overlap similarity
   */
  static similarity(a: string, b: string): number {
    const tokensA = new Set(
      a.toLowerCase().split(/\s+/).filter(Boolean)
    );
    const tokensB = new Set(
      b.toLowerCase().split(/\s+/).filter(Boolean)
    );

    // Jaccard similarity
    const intersection = new Set(
      [...tokensA].filter((x) => tokensB.has(x))
    );

    const union = new Set([...tokensA, ...tokensB]);

    return intersection.size / union.size;
  }

  /**
   * Find best matching candidate
   */
  static findBest(
    query: string,
    candidates: string[]
  ): { text: string; similarity: number; index: number } {
    let maxSim = 0;
    let maxIndex = 0;

    for (let i = 0; i < candidates.length; i++) {
      const sim = this.similarity(query, candidates[i]);
      if (sim > maxSim) {
        maxSim = sim;
        maxIndex = i;
      }
    }

    return {
      text: candidates[maxIndex],
      similarity: maxSim,
      index: maxIndex,
    };
  }
}

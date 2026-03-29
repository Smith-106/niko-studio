export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: string;
  dimensions: number;
  usage?: TokenUsage;
  latencyMs?: number;
  cacheHits?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Embedding Service Protocol
 * 
 * Defines the core capabilities of Embedding services, including text encoding,
 * batch encoding, and similarity calculation.
 */
export interface EmbeddingService {
  /**
   * Generate vector representation for a single text
   */
  embed(
    text: string,
    options?: { model?: string }
  ): Promise<number[]>;

  /**
   * Batch generate vector representations for texts
   */
  embedBatch(
    texts: string[],
    options?: {
      model?: string;
      batchSize?: number;
    }
  ): Promise<number[][]>;

  /**
   * Generate vector representation (including metadata)
   */
  embedWithMetadata(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Calculate similarity between two vectors
   */
  similarity(embedding1: number[], embedding2: number[]): number;

  /**
   * Get vector dimensions of the model
   */
  getDimensions(model?: string): number;
}

/**
 * Embedding Provider Protocol
 *
 * Adapter interface for underlying Embedding providers.
 */
export interface EmbeddingProvider {
  /**
   * Provider type
   */
  readonly providerType: string;

  /**
   * Execute vector encoding request
   */
  embed(
    texts: string[],
    model: string,
    options?: { dimensions?: number }
  ): Promise<BatchEmbeddingResponse>;

  /**
   * Check provider health status
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get vector dimensions of the model
   */
  getDimensions(model: string): number;
}

/**
 * Embedding Cache Protocol
 * 
 * Defines the core capabilities of Embedding caching.
 */
export interface EmbeddingCache {
  /**
   * Get cached vector
   */
  get(text: string, model: string): Promise<number[] | null>;

  /**
   * Set cache
   */
  set(
    text: string,
    model: string,
    embedding: number[],
    ttl?: number
  ): Promise<void>;

  /**
   * Batch get cached vectors
   */
  getBatch(
    texts: string[],
    model: string
  ): Promise<Record<string, number[] | null>>;

  /**
   * Batch set cache
   */
  setBatch(
    items: Record<string, number[]>,
    model: string,
    ttl?: number
  ): Promise<void>;

  /**
   * Clear all caches
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  stats(): Promise<Record<string, unknown>>;
}

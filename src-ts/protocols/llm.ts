export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface LLMResponse {
  content: string;
  metadata: Record<string, unknown>;
}

export interface StreamChunk {
  content: string;
  isFinished: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * LLM Service Protocol
 * 
 * Defines the core capabilities of LLM services, including text generation,
 * JSON generation, streaming output, and batch processing.
 */
export interface LLMService {
  /**
   * Generate text response
   */
  generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): Promise<string>;

  /**
   * Generate text response with metadata
   */
  generateWithMetadata(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Generate JSON format response
   */
  generateJson(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<Record<string, unknown>>;

  /**
   * Stream text response
   */
  stream(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * Generate embedding (from instructions: Migrate LLMProtocol with generate(), stream(), embed() methods)
   */
  embed?(
    text: string,
    options?: { model?: string }
  ): Promise<number[]>;

  /**
   * Batch generate text responses
   */
  batchGenerate(
    prompts: string[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      maxConcurrency?: number;
    }
  ): Promise<string[]>;
}

/**
 * LLM Provider Protocol
 * 
 * Adapter interface for underlying LLM providers.
 */
export interface LLMProvider {
  /**
   * Provider type
   */
  readonly providerType: string;

  /**
   * Execute completion request
   */
  complete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
      responseFormat?: Record<string, unknown>;
    }
  ): Promise<LLMResponse>;

  /**
   * Execute streaming completion request
   */
  streamComplete(
    prompt: string,
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * Check provider health status
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get model name for tier
   */
  getModelForTier(tier: string): string;
}

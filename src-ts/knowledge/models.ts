/**
 * Knowledge module - data models
 *
 * Defines all request/response models, configuration types, and error classes
 * used across the knowledge service layer.
 */

// ============================================================
// Enums
// ============================================================

/**
 * Model tier - select based on task complexity
 */
export enum ModelTier {
  FAST = 'fast',         // Low latency, simple tasks (e.g. haiku, gpt-4o-mini)
  DEFAULT = 'default',   // Balanced performance (e.g. sonnet, gpt-4o)
  POWERFUL = 'powerful', // Maximum capability (e.g. opus, o1)
}

/**
 * Canonical model mapping — single source of truth for default model names.
 * Provider implementations should reference this instead of hardcoding.
 */
export const DEFAULT_MODEL_MAPPING: Record<string, Record<ModelTier, string>> = {
  openai: {
    [ModelTier.FAST]: 'gpt-4o-mini',
    [ModelTier.DEFAULT]: 'gpt-4o',
    [ModelTier.POWERFUL]: 'o1',
  },
  anthropic: {
    [ModelTier.FAST]: 'claude-haiku-4-5-20251001',
    [ModelTier.DEFAULT]: 'claude-sonnet-4-6',
    [ModelTier.POWERFUL]: 'claude-opus-4-7',
  },
};

/**
 * Service provider type
 */
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  AZURE = 'azure',
  LOCAL = 'local',
}

// ============================================================
// Token Usage
// ============================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export function createTokenUsage(overrides?: Partial<TokenUsage>): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0.0,
    ...overrides,
  };
}

// ============================================================
// LLM Request/Response
// ============================================================

export interface LLMRequest {
  prompt: string;
  modelTier: ModelTier;
  modelOverride: string | null;
  temperature: number;
  maxTokens: number | null;
  stopSequences: string[];
  systemPrompt: string | null;
  responseFormat: Record<string, unknown> | null;
}

export function createLLMRequest(overrides?: Partial<LLMRequest>): LLMRequest {
  return {
    prompt: overrides?.prompt ?? '',
    modelTier: overrides?.modelTier ?? ModelTier.DEFAULT,
    modelOverride: overrides?.modelOverride ?? null,
    temperature: overrides?.temperature ?? 0.7,
    maxTokens: overrides?.maxTokens ?? null,
    stopSequences: overrides?.stopSequences ?? [],
    systemPrompt: overrides?.systemPrompt ?? null,
    responseFormat: overrides?.responseFormat ?? null,
  };
}

export interface LLMResponse {
  content: string;
  modelUsed: string;
  provider: ProviderType;
  usage: TokenUsage;
  latencyMs: number;
  cached: boolean;
}

export interface LLMProviderEntry {
  readonly providerType: string;
  getModelForTier(tier: ModelTier): string;
  generate(request: LLMRequest): Promise<LLMResponse>;
  streamGenerate(request: LLMRequest): AsyncGenerator<StreamChunk>;
  healthCheck(): Promise<boolean>;
}

export interface EmbeddingProvider {
  readonly providerType: string;
  embed(texts: string[], model?: string): Promise<number[][]>;
  getModel(): string;
  healthCheck(): Promise<boolean>;
}

export function createLLMResponse(overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    content: '',
    modelUsed: '',
    provider: ProviderType.OPENAI,
    usage: createTokenUsage(),
    latencyMs: 0,
    cached: false,
    ...overrides,
  };
}

export interface StreamChunk {
  content: string;
  isFinal: boolean;
  usage: TokenUsage | null;
}

// ============================================================
// Embedding Request/Response
// ============================================================

export interface EmbeddingRequest {
  texts: string[];
  modelTier: ModelTier;
  modelOverride: string | null;
  dimensions: number | null;
}

export function createEmbeddingRequest(overrides?: Partial<EmbeddingRequest>): EmbeddingRequest {
  return {
    texts: [],
    modelTier: ModelTier.DEFAULT,
    modelOverride: null,
    dimensions: null,
    ...overrides,
  };
}

export interface EmbeddingResponse {
  embeddings: number[][];
  modelUsed: string;
  provider: ProviderType;
  dimensions: number;
  usage: TokenUsage;
  latencyMs: number;
  cacheHits: number;
}

export function createEmbeddingResponse(overrides?: Partial<EmbeddingResponse>): EmbeddingResponse {
  return {
    embeddings: [],
    modelUsed: '',
    provider: ProviderType.OPENAI,
    dimensions: 0,
    usage: createTokenUsage(),
    latencyMs: 0,
    cacheHits: 0,
    ...overrides,
  };
}

// ============================================================
// Provider Configuration
// ============================================================

export interface ProviderConfig {
  provider: ProviderType;
  apiKey: string | null;
  baseUrl: string | null;
  organization: string | null;
  modelMapping: Record<ModelTier, string>;
  embeddingModel: string;
  maxRetries: number;
  timeout: number;
  rateLimitRpm: number;
}

export function createProviderConfig(overrides?: Partial<ProviderConfig>): ProviderConfig {
  return {
    provider: ProviderType.OPENAI,
    apiKey: null,
    baseUrl: null,
    organization: null,
    modelMapping: {
      [ModelTier.FAST]: '',
      [ModelTier.DEFAULT]: '',
      [ModelTier.POWERFUL]: '',
    },
    embeddingModel: '',
    maxRetries: 3,
    timeout: 60.0,
    rateLimitRpm: 60,
    ...overrides,
  };
}

// ============================================================
// Service Configuration
// ============================================================

export interface ServiceConfig {
  providers: ProviderConfig[];
  defaultLLMProvider: ProviderType;
  defaultEmbeddingProvider: ProviderType;
  embeddingCacheEnabled: boolean;
  embeddingCacheTTL: number;
  embeddingCacheMaxSize: number;
  retryMaxAttempts: number;
  retryInitialDelay: number;
  retryMaxDelay: number;
  retryExponentialBase: number;
  healthCheckInterval: number;
}

export function createServiceConfig(overrides?: Partial<ServiceConfig>): ServiceConfig {
  return {
    providers: [],
    defaultLLMProvider: ProviderType.OPENAI,
    defaultEmbeddingProvider: ProviderType.LOCAL,
    embeddingCacheEnabled: true,
    embeddingCacheTTL: 86400,
    embeddingCacheMaxSize: 2000,
    retryMaxAttempts: 3,
    retryInitialDelay: 1.0,
    retryMaxDelay: 60.0,
    retryExponentialBase: 2.0,
    healthCheckInterval: 60,
    ...overrides,
  };
}

// ============================================================
// Error Types
// ============================================================

export class LLMError extends Error {
  public readonly provider: ProviderType | null;

  constructor(message: string, provider?: ProviderType | null) {
    if (provider) {
      super(`[${provider}] ${message}`);
    } else {
      super(message);
    }
    this.name = 'LLMError';
    this.provider = provider ?? null;
  }
}

export class RateLimitError extends LLMError {
  public readonly retryAfter: number | null;

  constructor(
    message: string = 'Rate limit exceeded',
    provider?: ProviderType | null,
    retryAfter?: number | null,
  ) {
    super(message, provider);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter ?? null;
  }
}

export class TokenLimitError extends LLMError {
  public readonly tokenCount: number | null;
  public readonly tokenLimit: number | null;

  constructor(
    message: string = 'Token limit exceeded',
    provider?: ProviderType | null,
    tokenCount?: number | null,
    tokenLimit?: number | null,
  ) {
    super(message, provider);
    this.name = 'TokenLimitError';
    this.tokenCount = tokenCount ?? null;
    this.tokenLimit = tokenLimit ?? null;
  }
}

export class ProviderUnavailableError extends LLMError {
  public readonly fallbackAvailable: boolean;

  constructor(
    message: string = 'Provider unavailable',
    provider?: ProviderType | null,
    fallbackAvailable: boolean = false,
  ) {
    super(message, provider);
    this.name = 'ProviderUnavailableError';
    this.fallbackAvailable = fallbackAvailable;
  }
}

export class EmbeddingError extends Error {
  public readonly provider: ProviderType | null;

  constructor(message: string, provider?: ProviderType | null) {
    if (provider) {
      super(`[${provider}] ${message}`);
    } else {
      super(message);
    }
    this.name = 'EmbeddingError';
    this.provider = provider ?? null;
  }
}

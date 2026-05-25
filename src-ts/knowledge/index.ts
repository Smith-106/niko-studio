/**
 * Knowledge module barrel export
 *
 * Re-exports all public types, classes, and functions from the knowledge module.
 */

// Enums and model types
export {
  ModelTier,
  ProviderType,
} from './models';

export type {
  TokenUsage,
  LLMRequest,
  LLMResponse,
  StreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderConfig,
  ServiceConfig,
} from './models';

// Factory functions
export {
  createTokenUsage,
  createLLMRequest,
  createLLMResponse,
  createEmbeddingRequest,
  createEmbeddingResponse,
  createProviderConfig,
  createServiceConfig,
} from './models';

// Error classes
export {
  LLMError,
  RateLimitError,
  TokenLimitError,
  ProviderUnavailableError,
  EmbeddingError,
} from './models';

// Protocols (re-exports from shared protocols)
export type {
  LLMService,
  LLMProvider,
  SearchInterface,
} from './protocols';

export type {
  EmbeddingService,
  EmbeddingProvider,
  EmbeddingCache,
} from './protocols';

// Cache
export { TieredEmbeddingCache, InMemoryEmbeddingCache } from './cache';

// Configuration
export { ConfigError, ConfigLoader, loadConfig } from './config';

// Services
export { LLMServiceImpl } from './llm-service';
export { EmbeddingServiceImpl } from './embedding-service';

// Manager
export { ServiceManager } from './manager';

// Providers
export { OpenAILLMProvider } from './providers/openai-llm';
export { AnthropicLLMProvider } from './providers/anthropic-llm';
export { OpenAIEmbeddingProvider } from './providers/openai-embedding';
export { LocalEmbeddingProvider } from './providers/local-embedding';

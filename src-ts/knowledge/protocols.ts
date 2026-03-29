/**
 * Knowledge module - protocols
 *
 * Protocol definitions for the knowledge service layer.
 * Re-exports shared protocol interfaces and defines the SearchInterface.
 */

export type {
  LLMService,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  StreamChunk,
} from '../protocols/llm';

export type {
  EmbeddingService,
  EmbeddingProvider,
  EmbeddingCache,
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingResponse,
  TokenUsage,
} from '../protocols/embedding';

export type { SearchInterface } from '../protocols/search';

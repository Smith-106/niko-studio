/**
 * Services Module - TypeScript Services Layer
 *
 * Exports all service implementations for the application.
 * Services implement protocol interfaces and are registered in the DI container.
 */

export { DistillationService, DistillationTemplate } from './distill-service';
export type {
  DistillationResult,
  LegacyDistillationData,
} from './distill-service';

export {
  LLMServiceImpl,
  ModelTier,
  ProviderType,
  LLMError,
  RateLimitError,
  TokenLimitError,
  ProviderUnavailableError,
} from './llm-service';
export type {
  TokenUsage,
  RetryConfig,
  LLMServiceConfig,
} from './llm-service';

export {
  EmbeddingServiceImpl,
  EmbeddingError,
  ProviderUnavailableError as EmbeddingProviderUnavailableError,
} from './embedding-service';
export type {
  TokenUsage as EmbeddingTokenUsage,
  EmbeddingServiceConfig,
} from './embedding-service';

export {
  KnowledgeServiceImpl,
  KnowledgeError,
  EntityNotFoundError,
  DocumentNotFoundError,
} from './knowledge-service';
export type {
  KnowledgeService,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeSearchResult,
  DocumentMetadata,
  KnowledgeServiceConfig,
} from '../protocols/knowledge';

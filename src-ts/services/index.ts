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
  BudgetExceededError,
  CircuitOpenError,
} from './llm-service';
export type {
  TokenUsage,
  RetryConfig,
  LLMServiceConfig,
} from './llm-service';

export {
  CircuitState,
  CircuitBreaker,
  CircuitBreakerRegistry,
} from './circuit-breaker';
export type {
  CircuitBreakerConfig,
} from './circuit-breaker';

export {
  LLMFallbackChainImpl,
  ProviderLatencyTracker,
} from './llm-fallback-chain';
export type {
  ILLMFallbackChain,
  FallbackChainConfig,
} from './llm-fallback-chain';

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

export {
  BackupManager,
  getBackupManager,
  resetBackupManager,
} from './backup-manager';
export type {
  BackupInfo,
  BackupProgress,
  BackupResult,
  ProgressCallback,
} from './backup-manager';

export {
  MemoryService,
  SimpleEmbedder,
  getMemoryService,
  resetMemoryService,
  configureMemoryEngineProvider,
} from './memory-service';
export type {
  Message,
  AddOptions,
  SearchOptions,
  SearchResult,
  Memory,
  Embedder,
} from './memory-service';

export {
  ObsidianService,
  getObsidianService,
  resetObsidianService,
} from './obsidian-service';
export type {
  VaultInfo,
  NoteInfo,
} from './obsidian-service';

export {
  TokenService,
  MODEL_PRICING,
  getTokenService,
  resetTokenService,
} from './token-service';
export type {
  TokenUsageRecord,
  BudgetStatus,
} from './token-service';

export {
  RerankerType,
  RerankerError,
  DEFAULT_RERANKER_CONFIG,
  RerankerStrategy,
  RerankerFactory,
  JinaReranker,
  VoyageReranker,
  TEIReranker,
  BailianReranker,
} from './reranker';
export type {
  RankedDocument,
  RerankerConfig,
  RerankerRequest,
  RerankerResponse,
} from './reranker';

export { RevisionServiceImpl } from './revision-service.js';

export { SessionIntelligenceServiceImpl } from './session-intelligence-service.js';

export { PersonalizationServiceImpl } from './personalization-service.js';

/**
 * Search Module Exports
 *
 * Provides search capabilities including smart search,
 * vector search, and hybrid search implementations.
 */

export {
  SmartSearch,
  SearchMode,
  createSmartSearch,
  type SmartSearchResult,
  type SearchResultLocation,
  type SearchResultMetadata,
  type SearchOptions,
  type VectorIndexInterface,
  type DatabaseConnection,
  type SmartSearchConfig,
} from './smart-search';

export {
  HybridSearch,
  HybridSearchBuilder,
  createHybridSearch,
  StrategyPresets,
  type HybridSearchConfig,
  type HybridSearchResult,
  type StrategyWeight,
} from './hybrid-search';

export {
  VectorSearch,
  VectorSearchError,
  DatabaseError,
  EmbeddingError,
  createVectorSearch,
  type VectorSearchConfig,
  type HNSWConfig,
} from './vector-search';

export {
  IterativeRetriever,
  createIterativeRetriever,
  type IterativeRetrieverConfig,
} from './iterative-retriever';

export {
  type SearchResult,
  type RetrievalProfile,
  type FusionConfig,
  type RerankConfig,
  type RouteMode,
  type ContextType,
  type ResolvedReference,
  type ElasticSearchAdapter,
  type MemorySearchProvider,
  type GraphSearchProvider,
  type SkillProvider,
  type CollectStageTrace,
  type RerankStageTrace,
  type TrimStageTrace,
  type RetrievalTrace,
  type IterativeRetrieveResult,
} from './retrieval-types';

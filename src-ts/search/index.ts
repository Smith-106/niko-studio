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

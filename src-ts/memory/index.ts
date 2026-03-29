/**
 * Memory module - barrel exports
 *
 * Re-exports all public types, classes, enums, functions from:
 * - memory-layers: Four-layer memory architecture
 * - memory-chunk: Memory chunking system
 * - conflict-resolver: Conflict detection and resolution
 * - temporal-memory: Temporal tracking and versioning
 * - six-dimensional-memory: Six-dimensional content classification
 * - core-memory-store: Core memory persistence with vector search
 * - unified-memory: Unified memory engine (4-layer + 6-dimensional + temporal)
 */

// Memory Layers
export {
  LayerType,
  LayerConfig,
  LAYER_CONFIGS,
  LayerEntry,
  LayerStats,
  IMemoryLayer,
  BaseMemoryLayer,
  EphemeralLayer,
  SessionLayer,
  UserLayer,
  ProjectLayer,
  LayerManager,
  createLayer,
} from "./memory-layers";

// Memory Chunk
export {
  MemoryChunk,
  EmbedderEngine,
  ChunkBuffer,
  TextChunker,
  ChunkSplitter,
  ChunkedMemoryAdapter,
  getChunkBuffer,
  getTextChunker,
  resetChunkBuffer,
  resetTextChunker,
} from "./memory-chunk";

// Conflict Resolver
export {
  ConflictResolutionStrategy,
  ConflictType,
  ConflictInfo,
  ResolutionResult,
  IConflictResolver,
  ConflictDbConnection,
  ConflictEmbedder,
  ConflictResolver,
  getConflictResolver,
  resetConflictResolver,
} from "./conflict-resolver";

// Temporal Memory
export {
  ValidityWindow,
  TemporalFact,
  SupersessionChain,
  ITemporalTracker,
  TemporalDbConnection,
  TemporalMemoryTracker,
  getTemporalTracker,
  resetTemporalTracker,
} from "./temporal-memory";

// Six-Dimensional Memory
export {
  DimensionType,
  DimensionScore,
  ClassificationResult,
  ProcessedContent,
  IDimensionProcessor,
  BaseDimensionProcessor,
  TimelineProcessor,
  ContextProcessor,
  CharacterProcessor,
  WorldviewProcessor,
  PreferenceProcessor,
  ExperienceProcessor,
  DimensionRouter,
  getDimensionRouter,
  resetDimensionRouter,
} from "./six-dimensional-memory";

// Core Memory Store
export {
  CoreMemory,
  CoreSearchInterface,
  CoreMemoryStore,
  getCoreMemoryStore,
  resetCoreMemoryStore,
} from "./core-memory-store";

// Unified Memory Engine
export {
  MemoryLayer,
  MemoryDimension,
  UnifiedMemory,
  EngineConflictResolver,
  UnifiedDbConnection,
  EmbeddingEngine,
  IntegrationFlags,
  StorageShadowWriter,
  IntegrationAdapters,
  EnginePlugin,
  UnifiedMemoryEngine,
  setConfigProvider,
  ConfigProvider,
  getUnifiedMemoryEngine,
  resetUnifiedMemoryEngine,
} from "./unified-memory";

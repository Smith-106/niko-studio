/**
 * Reader type re-exports from the API layer
 *
 * All reader-related types are defined in desktop/src/api/reader.ts
 * and re-exported here for convenience in desktop UI components.
 * Do NOT import directly from src-ts/ — use the API layer as the
 * single source of truth for frontend types.
 */
export type {
  OverlayMarker,
  ConsensusItem,
  ConsensusReport,
  DimensionOverlayEntry,
  ReaderAnalyzeResult,
  ReaderOverlayResult,
  ReaderPersona,
  ReaderPersonasResult,
  AIFlavorIndicator,
  AIFlavorResult,
  AIFlavorDetectionResult,
  DeAIRewriteResult,
  ComparisonDimension,
  ReaderCompareResult,
} from '../api/reader'

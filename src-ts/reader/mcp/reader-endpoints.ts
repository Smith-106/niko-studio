/**
 * Reader Simulation MCP Endpoints — Compatibility Shim
 *
 * Re-exports from submodules for backward compatibility.
 * All implementations have been moved to reader-routes.ts, reader-types.ts,
 * reader-services.ts, and reader-validation.ts.
 *
 * TODO: remove shim after all tests migrated (ISS-20260621-013)
 *
 * Related: T-036, SME-02, ISS-20260621-013
 */

// Endpoint handlers (routes)
export {
  rsAnalyzeEndpoint,
  rsGetPersonasEndpoint,
  rsCreateCustomPersonaEndpoint,
  rsGetOverlayEndpoint,
  rsAIFlavorEndpoint,
  rsFeedbackEndpoint,
  rsCompareEndpoint,
  rsDeAIEndpoint,
} from './reader-routes';

// Types
export type {
  AnalyzeRequest,
  CreatePersonaRequest,
  DeAIRequest,
  DeAIResponse,
  FeedbackRequest,
  FeedbackResponse,
  FeedbackAggregate,
  CompareRequest,
  CompareResult,
  CompareVersionInput,
  OverlayMarker,
  FeedbackAction,
} from './reader-types';

// Services, stores, and store management
export {
  getRevisionService,
  getConsensusEngine,
  getDualEngine,
  getDimensionAnalyzer,
  customPersonaStore,
  analysisResultCache,
  feedbackAggregateStore,
  loadCustomPersonas,
  saveCustomPersonas,
  deletePersonasFile,
  clearReaderStores,
  getCustomPersonaStore,
  getAnalysisResultCache,
  getFeedbackAggregateStore,
  clearFeedbackAggregateStore,
} from './reader-services';

// Validation helpers
export {
  resolvePersonas,
  buildOverlayMarkers,
  adjustPersonaWeights,
  extractCurrentWeights,
  DIMENSION_TO_PARAM,
} from './reader-validation';

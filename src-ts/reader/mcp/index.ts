/**
 * Reader MCP barrel export
 */

export {
  rsAnalyzeEndpoint,
  rsGetPersonasEndpoint,
  rsCreateCustomPersonaEndpoint,
  rsGetOverlayEndpoint,
  rsCompareEndpoint,
  clearReaderStores,
  getCustomPersonaStore,
  getAnalysisResultCache,
} from './reader-endpoints';

export type {
  AnalyzeRequest,
  CreatePersonaRequest,
  OverlayMarker,
  CompareRequest,
  CompareResult,
  CompareVersionInput,
} from './reader-endpoints';

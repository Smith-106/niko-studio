/**
 * Knowledge MCP barrel export
 */

export {
  sbGetEntitiesEndpoint,
  sbGetEntityEndpoint,
  sbCreateEntityEndpoint,
  sbUpdateEntityEndpoint,
  sbDeleteEntityEndpoint,
  sbExtractFromManuscriptEndpoint,
  sbGetCompletenessEndpoint,
  clearEntityStore,
  getEntityStore,
} from './story-bible-endpoints';

export type {
  ExtractionResult,
  CompletenessReport,
} from './story-bible-endpoints';

export {
  qcValidateOutputEndpoint,
  qcGetCreativityConfigEndpoint,
  clearValidationCache,
} from './qc-endpoints';

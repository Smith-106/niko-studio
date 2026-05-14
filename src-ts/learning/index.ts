/**
 * Learning Module — barrel exports
 */

export {
  LearningCapability,
  PipelineStatus,
  ExtractionTier,
  EntityType as LearningEntityType,
  WorldviewCategory,
  type ILearningPipeline,
  type PipelineInput,
  type PipelineStatusInfo,
  type ExtractionResult,
  type EntityExtraction,
  type StyleFeatureVector,
  type WorldviewElement,
  type Insight,
  type StyleRule,
  type StyleDriftReport,
  type PreferenceSignal,
  type FeedbackEvidence,
  type SpoilerGateResult,
  type ReadingSession,
  type DistilledInsight,
  type CrossReference,
  type LearningConfig,
} from './learning-types';

export {
  parseDocument,
  segmentText,
  extractEntities,
  calculateStyleFeatures,
  detectWorldviewElements,
  extractBasicInsights,
  type Segment,
} from './extraction-utils';

export {
  LearningOrchestrator,
  type LearningOrchestratorDeps,
} from './learning-orchestrator';

export { ImportLearningPipeline } from './import-pipeline';

export { SelfEvolvingAgent } from './self-evolving-agent';

export { RuleEvolver } from './rule-evolver';

export { PreferenceTracker } from './preference-tracker';

export { ReadingLearningPipeline } from './reading-pipeline';

export { determineExtractionTier } from './spoiler-gate';

export { distillInsights } from './insight-distiller';

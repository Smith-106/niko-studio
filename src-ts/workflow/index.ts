export * from './types';

export * from './state';
export * from './base-workflow';

// novel-state exports QualityLevel/QualityMode/WorkflowConfig which clash with types.ts and novel-quality.ts
// Use selective export to avoid duplicates
export {
  type WritingState,
  type SceneCard,
  type CritiqueResult,
  type LOCKScores,
  type CanonicalEntity,
  type CanonicalRelation,
  type CanonicalConflict,
  type DistillationResult,
  type RetrievalMetadata,
  type ContextBudget,
  type ContextGovernance,
  type SelfLearningState,
  type QualityDegradeStep,
  DEFAULT_NOVEL_CONFIG,
  createInitialState,
} from './novel-state';

// Re-export novel-specific WorkflowConfig for consumers that need it
export type { WorkflowConfig as NovelWorkflowConfig } from './novel-state';

export {
  evaluateNovelQuality,
  LEVEL_DIMENSION_MULTIPLIER,
  QUALITY_CONTRACT_KEYS,
  type NovelQualityResult,
} from './novel-quality';

export * from './project-tech';

export {
  RevisionLoop,
  RevisionDecision,
  RevisionConfig,
  DEFAULT_REVISION_CONFIG,
  RevisionState,
  QUALITY_LEVEL_ORDER,
  buildFeedbackArtifactEnvelope,
  runRevisionLoop,
  type RunRevisionLoopOptions,
  type WriterFn,
  type CriticFn,
} from './revision-loop';

export * from './levels/base-level';
export * from './levels/level1-rapid';
export * from './levels/level2-lite';
export * from './levels/level3-standard';
export * from './levels/level4-brainstorm';
export * from './levels/level5-coordinator';

export * from './adapters/base-adapter';
export * from './adapters/novel-adapter';
export * from './adapters/code-adapter';

export * from './session/session-manager';
export * from './session/resume-strategy';

export {
  WorkflowPhase,
  PlanActState,
  PlanPhaseExecutor,
  ActPhaseExecutor,
  ReviewPhaseExecutor,
  RevisePhaseExecutor,
  PlanActMode,
  getDefaultPlanActMode,
  type PhaseResult,
  type IPhaseExecutor,
  type IArchitectAgent,
  type IWriterAgent,
  type ICriticAgent,
} from './modes/plan-act';

export * from './artifact-contract';

export * from './graph';
export * from './graph-factory';
export * from './workflow-engine';

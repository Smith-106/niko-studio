/**
 * Narrative module barrel file
 *
 * Re-exports all narrative subsystems.
 * Uses explicit exports for modules with name collisions.
 */

// Shared types
export type { INarrativeLLMClient } from './types';
export { scoreToLevel, severityOrder } from './types';

// Analyzers
export * from './analyzers';

// Evaluators
export * from './evaluators';

// Fictional dream - exclude SensoryDetail and DreamEvaluator (already in analyzers/evaluators)
export {
  SympathyTrigger,
  SympathyAnalyzer,
} from './fictional_dream/sympathy';
export type {
  SympathyEvidence,
  SympathyAnalysisResult,
} from './fictional_dream/sympathy';

export {
  IdentificationElement,
  IdentificationBuilder,
} from './fictional_dream/identification';
export type {
  GodfatherTechnique,
  IdentificationEvidence,
  IdentificationAnalysisResult,
} from './fictional_dream/identification';

export {
  SenseType,
  EmpathyDeepener,
} from './fictional_dream/empathy';
export type {
  SensoryDetail as FictionalDreamSensoryDetail,
  CarrieTechnique,
  RedBadgeTechnique,
  EmpathyAnalysisResult,
} from './fictional_dream/empathy';

export {
  DilemmaType,
  ImmersionCatalyst,
} from './fictional_dream/immersion';
export type {
  InternalConflict,
  CarrieWaitingScene,
  RaskolnikovMoralWar,
  ImmersionAnalysisResult,
} from './fictional_dream/immersion';

export {
  DreamStrength,
  FictionalDreamEngine,
} from './fictional_dream/engine';
export type {
  DreamLayerScore,
  FictionalDreamResult,
} from './fictional_dream/engine';

export {
  DreamEvaluator as FictionalDreamEvaluator,
} from './fictional_dream/evaluator';
export type {
  QuickDreamReport,
  LayerDiagnosis,
  MasterComparison,
  ImprovementItem,
  DeepDiagnosisResult,
} from './fictional_dream/evaluator';

// Standalone modules - character-depth (exclude DualPersonality, collides with character-manager)
export {
  CharacterTrait,
  type DominantEmotion,
  createDominantEmotion,
  addEvolutionPoint,
  type Persona,
  type CharacterDepthScore,
  type CharacterDepthResult,
  computeCharacterDepthResult,
  CharacterDepthSystem,
  DynamicCharacterState as DynamicCharacterStateType,
  createEmptyDynamicState,
  mergeDynamicState,
} from './character-depth';

// character-manager (exclude CharacterState and DualPersonality, collide with analyzers/character-depth)
export {
  PersonalityType,
  MotivationType,
  RelationshipType,
  GrowthStage,
  EmotionalState,
  DepthLevel,
  type IGraphManager,
  type DynamicEmotion,
  evolveDynamicEmotion,
  getEmotionTrajectory,
  type Competence,
  addCompetenceDemo,
  type Eccentricity,
  addEccentricityQuirk,
  type EnvironmentContrast,
  type CmPersona,
  getDualConflictPotential,
  type DialogueStyle,
  type Personality,
  type KeyEvent,
  type Background,
  type Motivation,
  type Relationship,
  type Relationships,
  addRelationship,
  getRelationship,
  getRelationshipsByType,
  type GrowthArc,
  type FiveDimensionScore,
  getOverallScore,
  getDepthLevel,
  type Character,
  getFiveDimensionScore,
  CharacterManager,
  charToDict,
} from './character-manager';

// Other standalone modules
export * from './foreshadowing';
export * from './narrative-voice';
export * from './premise-validator';
export {
  ReaderSatisfactionAnalyzer,
  SatisfactionPoint as ReaderSatisfactionPoint,
  SatisfactionLayer,
  HookType,
  ExpectPhase,
  ChapterHook,
  ExpectationCycle,
  type ReaderSatisfactionResult,
} from './reader-satisfaction-analyzer';
export * from './scene-coherence';
export * from './style-system';
export * from './suspense-analyzer';

export {
  CharacterConflictType,
  ConsistencySeverity,
  CrossChapterCharacterTracker,
} from './cross-chapter-character-tracker';
export type {
  ChapterMeta,
  CharacterTimelineConflict,
  CharacterChapterState,
  CrossChapterCharacterReport,
} from './cross-chapter-character-tracker';

export {
  TimelineConflictType,
  TimelineSeverity,
  TimeRefType,
  TimelineConsistencyChecker,
} from './timeline-consistency-checker';
export type {
  ChapterMeta as TimelineChapterMeta,
  TimeReference,
  TimelineConflict,
  ChapterTimeProfile,
  TimelineReport,
} from './timeline-consistency-checker';

export {
  WorldviewConflictType,
  WorldviewSeverity,
  WorldviewCoherenceValidator,
} from './worldview-coherence-validator';
export type {
  ChapterMeta as WorldviewChapterMeta,
  WorldRule,
  WorldviewConflict,
  ChapterWorldviewProfile,
  WorldviewReport,
  IWorldviewGraphAdapter,
} from './worldview-coherence-validator';

export * from './writing-craft';

// Worldview extractor (M11 — BookWorld integration)
export {
  WorldviewNature,
  WorldviewExtractor,
} from './worldview-extractor';
export type {
  WorldviewSetting,
  ChapterContent as WorldviewChapterContent,
} from './worldview-extractor';


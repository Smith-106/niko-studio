/**
 * fictional_dream - barrel file
 *
 * Re-exports every public symbol from the sub-package.
 */

// Layer 1: Sympathy
export {
  SympathyTrigger,
  SympathyAnalyzer,
} from './sympathy';
export type {
  SympathyEvidence,
  SympathyAnalysisResult,
} from './sympathy';

// Layer 2: Identification
export {
  IdentificationElement,
  IdentificationBuilder,
} from './identification';
export type {
  GodfatherTechnique,
  IdentificationEvidence,
  IdentificationAnalysisResult,
} from './identification';

// Layer 3: Empathy
export {
  SenseType,
  EmpathyDeepener,
} from './empathy';
export type {
  SensoryDetail,
  CarrieTechnique,
  RedBadgeTechnique,
  EmpathyAnalysisResult,
} from './empathy';

// Layer 4: Immersion
export {
  DilemmaType,
  ImmersionCatalyst,
} from './immersion';
export type {
  InternalConflict,
  CarrieWaitingScene,
  RaskolnikovMoralWar,
  ImmersionAnalysisResult,
} from './immersion';

// Engine
export {
  DreamStrength,
  FictionalDreamEngine,
} from './engine';
export type {
  DreamLayerScore,
  FictionalDreamResult,
} from './engine';

// Evaluator
export {
  DreamEvaluator,
} from './evaluator';
export type {
  QuickDreamReport,
  LayerDiagnosis,
  MasterComparison,
  ImprovementItem,
  DeepDiagnosisResult,
} from './evaluator';

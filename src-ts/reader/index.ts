/**
 * Reader module barrel export
 *
 * Re-exports all public types, factory functions, and registry from the reader module.
 */

// Types
export type { ReaderPersona, PresetPersonaId } from './PersonaDefinition';
export type { DimensionScore, DimensionFinding } from './DimensionAnalyzer';
export type { ReaderReaction, EditorialAnalysis, DualEngineResult } from './DualEngine';
export type {
  OverlayMarker,
  DimensionOverlayEntry,
  OverlayBridgeResult,
  ConsensusItem as OverlayConsensusItem,
} from './OverlayBridge';
export type { ConsensusItem, ConsensusReport } from './ConsensusEngine';

// Preset factories
export {
  createSuspenseEnthusiast,
  createLiteraryCritic,
  createGeneralReader,
  createCustomPersona,
  PRESET_PERSONAS,
  getPresetPersona,
  listPresetPersonas,
} from './PersonaDefinition';

// Dimension analysis
export { DimensionAnalyzer, createDimensionAnalyzer } from './DimensionAnalyzer';

// Dual engine
export { DualEngine } from './DualEngine';

// Consensus engine
export { ConsensusEngine, createConsensusEngine } from './ConsensusEngine';

// Overlay bridge
export { transformToOverlay, resetOverlayBridge } from './OverlayBridge';

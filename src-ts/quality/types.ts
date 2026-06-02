/**
 * Quality Control types — hard constraints (CAS) + soft constraints (creativity spectrum)
 *
 * Hard constraints are enforced by Craft Analysis Services output.
 * Soft constraints come from the creativity spectrum slider.
 * Enforcement varies by co-writing mode (SA-03, SME-01).
 */

// ============================================================
// Quality Dimensions (SME-01)
// ============================================================

export enum QualityDimension {
  PLOT_COHERENCE = 'plot-coherence',
  CHARACTER_CONSISTENCY = 'character-consistency',
  STYLE_CONSISTENCY = 'style-consistency',
  PACING_TENSION = 'pacing-tension',
}

export const QUALITY_DIMENSIONS = Object.values(QualityDimension);

// ============================================================
// Hard Constraint (from CAS)
// ============================================================

export enum ConstraintSeverity {
  CRITICAL = 'critical',   // blocks output
  HIGH = 'high',           // warns in Auto/Guided, blocks in Directed
  MEDIUM = 'medium',       // warns in all modes
  LOW = 'low',             // informational
}

export interface HardConstraintViolation {
  dimension: QualityDimension;
  severity: ConstraintSeverity;
  message: string;
  location: {
    chapterId?: string;
    paragraphIndex?: number;
    characterId?: string;
  };
  evidence: string;
  suggestedFix: string | null;
}

export interface HardConstraintResult {
  dimension: QualityDimension;
  score: number; // 0-1
  violations: HardConstraintViolation[];
  passed: boolean;
}

export interface HardConstraintReport {
  overallScore: number;
  dimensionResults: HardConstraintResult[];
  allViolations: HardConstraintViolation[];
  blockingViolations: HardConstraintViolation[];
  timestamp: string;
}

// ============================================================
// Creativity Spectrum (Soft Constraint)
// ============================================================

export enum CreativityPreset {
  CONSERVATIVE = 'conservative', // 0.2
  BALANCED = 'balanced',        // mode-calibrated default
  CREATIVE = 'creative',        // 0.7
  EXPERIMENTAL = 'experimental', // 0.9
}

export const CREATIVITY_PRESET_VALUES: Record<CreativityPreset, number> = {
  [CreativityPreset.CONSERVATIVE]: 0.2,
  [CreativityPreset.BALANCED]: 0.5,
  [CreativityPreset.CREATIVE]: 0.7,
  [CreativityPreset.EXPERIMENTAL]: 0.9,
};

// Per-mode default "balanced" values (C-001 cross-role resolution)
export const MODE_BALANCED_DEFAULTS: Record<string, number> = {
  auto: 0.5,
  guided: 0.6,
  directed: 0.4,
};

export interface CreativitySpectrumConfig {
  value: number;          // 0-1, current creativity level
  preset: CreativityPreset;
  modeDefault: number;    // mode-calibrated default
  constraints: {
    maxSentenceLength: number;
    minVocabularyDiversity: number;
    maxMetaphorDensity: number;
    allowNonlinearStructure: boolean;
    allowUnreliableNarrator: boolean;
  };
}

// ============================================================
// QC Enforcement (mode-specific, C-003)
// ============================================================

export enum QCEforcementMode {
  BLOCKING = 'blocking',       // Auto/Guided: hard constraint violations block output
  ADVISORY = 'advisory',       // Directed: hard constraint violations produce warnings
}

export interface QCEnforcementResult {
  mode: QCEforcementMode;
  allowed: boolean;
  warnings: HardConstraintViolation[];
  blocked: HardConstraintViolation[];
  creativityConfig: CreativitySpectrumConfig;
}

// ============================================================
// Helpers
// ============================================================

export function createDefaultCreativityConfig(
  cowritingMode: string,
): CreativitySpectrumConfig {
  const modeDefault = MODE_BALANCED_DEFAULTS[cowritingMode] ?? 0.5;
  return {
    value: modeDefault,
    preset: CreativityPreset.BALANCED,
    modeDefault,
    constraints: {
      maxSentenceLength: 40,
      minVocabularyDiversity: 0.3,
      maxMetaphorDensity: 0.15,
      allowNonlinearStructure: modeDefault > 0.5,
      allowUnreliableNarrator: modeDefault > 0.7,
    },
  };
}

export function resolveCreativityConfig(
  preset: CreativityPreset,
  cowritingMode: string,
  customValue?: number,
): CreativitySpectrumConfig {
  const modeDefault = MODE_BALANCED_DEFAULTS[cowritingMode] ?? 0.5;
  const value = customValue ?? (
    preset === CreativityPreset.BALANCED
      ? modeDefault
      : CREATIVITY_PRESET_VALUES[preset]
  );
  return {
    value,
    preset,
    modeDefault,
    constraints: {
      maxSentenceLength: Math.round(20 + value * 40),
      minVocabularyDiversity: 0.2 + value * 0.3,
      maxMetaphorDensity: 0.05 + value * 0.2,
      allowNonlinearStructure: value > 0.5,
      allowUnreliableNarrator: value > 0.7,
    },
  };
}

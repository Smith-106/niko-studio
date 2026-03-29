/**
 * Novel writing workflow state definition (State Schema)
 *
 * Migrated from src/workflow/state.py
 * Renamed to novel-state.ts to avoid collision with the already-migrated state.ts
 *
 * Defines the "short-term memory" shared across all agents in the
 * LangGraph state machine.  TypedDict fields become an interface
 * (all optional, total=False equivalent).
 */

// ============================================================
// Quality types
// ============================================================

export type QualityMode = 'auto' | 'manual';
export type QualityLevel = 'ultra' | 'high' | 'medium' | 'fluent';

// ============================================================
// Novel-specific constants
// ============================================================

export const NOVEL_PASS_SCORE = 99;
export const NOVEL_MIN_C_SCORE = 7;
export const NOVEL_HUMAN_REVIEW_SCORE = 95;
export const NOVEL_SCORE_IMPROVEMENT_THRESHOLD = 5.0;

export const NOVEL_QUALITY_WEIGHTS: Record<string, number> = {
  repetition: 0.20,
  tone: 0.13,
  clarity: 0.17,
  causality: 0.20,
  detail: 0.20,
  factuality: 0.10,
};

export const NOVEL_QUALITY_THRESHOLDS: Record<string, number> = {
  pass: NOVEL_PASS_SCORE,
  block: 50.0,
  block_template_ratio: 0.80,
  repetition_issue: 0.45,
  repetition_issue_high: 0.70,
  min_conflict_points: 2,
  min_visual_details: 3,
  min_dialogue_ratio: 0.03,
  min_sentences_for_tone_issue: 4,
  low_quality: 55.0,
  low_clarity: 45.0,
};

// ============================================================
// Sub-type interfaces (Python TypedDict -> TS interface)
// ============================================================

export interface LOCKScores {
  L: number;  // Lead
  O: number;  // Objective
  C: number;  // Confrontation
  K: number;  // Knockout
  total: number;  // Weighted total (C weight 40%)
}

export interface SceneCard {
  scene_id?: string;
  chapter_num?: number;
  scene_num?: number;
  pov_character?: string;
  objective?: string;
  conflict?: string;
  outcome?: string;
  plot_beat?: string;
  emotional_arc?: string;
  sensory_guidance?: Record<string, string>;
  structural_function?: string;
  hook?: string | null;
  foreshadows_to_plant?: string[];
  foreshadows_to_harvest?: string[];
}

export interface CritiqueResult {
  decision?: 'APPROVED' | 'HUMAN_REVIEW' | 'REVISE' | 'REWRITE';
  decision_reason?: string;
  total_score?: number;
  lock_score?: number;
  style_score?: number;
  logic_score?: number;
  lock_analysis?: Record<string, unknown>;
  actionable_feedback?: string;
  revision_instructions?: Array<Record<string, string>>;
}

export interface CanonicalEntity {
  entity_id?: string;
  entity_type?: string;
  scope?: 'character' | 'world' | 'timeline';
  name?: string;
  attributes?: Record<string, unknown>;
  source_trace?: Record<string, string>;
}

export interface CanonicalRelation {
  relation_id?: string;
  source_entity_id?: string;
  target_entity_id?: string;
  relation_type?: string;
  attributes?: Record<string, unknown>;
  source_trace?: Record<string, string>;
}

export interface CanonicalConflict {
  conflict_id?: string;
  conflict_type?: string;
  severity?: 'critical' | 'major' | 'minor' | 'info';
  description?: string;
  critical_condition?: string;
  source_refs?: Record<string, string>;
}

export interface DistillationResult {
  entities_count?: number;
  relations_count?: number;
  events_count?: number;
  entities?: Array<Record<string, unknown>>;
  relations?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  canonical_entities?: CanonicalEntity[];
  canonical_relations?: CanonicalRelation[];
  canonical_conflicts?: CanonicalConflict[];
  canonical_schema_version?: string;
  canonical_trace?: Record<string, string>;
  template?: string;
  scene_id?: string;
  summary?: string | null;
  character_arcs?: Array<Record<string, unknown>>;
  plot_points?: Array<Record<string, unknown>>;
}

export interface RetrievalMetadata {
  stage1_candidates?: number;
  stage2_selected?: number;
  cited_count?: number;
  effective_hit_rate?: number;
  c_effective?: number;
  s_final?: number;
  r_memory?: number;
  retrieval_profile?: string;
  budget_tokens?: number;
  cache_hit?: boolean;
}

export interface ContextBudget {
  token_total?: number;
  token_effective?: number;
  utilization?: number;
}

export interface ContextGovernance {
  retrieval_hit_rate?: number;
  context_budget_utilization?: number;
  retrieval_passed?: boolean;
  budget_passed?: boolean;
  passed?: boolean;
}

export interface SelfLearningState {
  reflector?: Record<string, unknown>;
  curator?: Record<string, unknown>;
  playbook?: Record<string, unknown>;
}

export interface QualityDegradeStep {
  from_level?: string;
  to_level?: string;
  reason?: string;
  phase?: string;
  timestamp?: string;
}

// ============================================================
// WritingState - All agents' shared memory
// ============================================================

/**
 * Novel writing workflow state.
 *
 * State flow:
 * 1. user_idea -> Architect -> story_blueprint, scene_cards
 * 2. current_scene -> Writer -> draft_content
 * 3. draft_content -> Critic -> critique_result
 * 4. If critique_result.decision == "REVISE":
 *    - revision_count += 1
 *    - back to step 2 (with actionable_feedback)
 */
export interface WritingState {
  // ========================================
  // Input (from user)
  // ========================================
  user_idea?: string;
  genre?: string;
  target_chapters?: number;
  target_wordcount?: number;

  // ========================================
  // Workflow routing
  // ========================================
  workflow_level?: number;

  // ========================================
  // Session metadata
  // ========================================
  session_id?: string;
  created_at?: string;
  current_chapter?: number;
  current_scene_index?: number;

  // ========================================
  // Architect artifacts
  // ========================================
  story_blueprint?: Record<string, unknown>;
  lock_analysis?: Record<string, unknown>;
  scene_cards?: SceneCard[];
  current_scene?: SceneCard;

  // ========================================
  // Context (from Context Agents)
  // ========================================
  character_profiles?: Array<Record<string, unknown>>;
  world_settings?: Record<string, unknown>;
  foreshadow_tracker?: Record<string, unknown>;

  // ========================================
  // Writer artifacts
  // ========================================
  draft_content?: string;
  draft_version?: number;
  draft_wordcount?: number;
  writer_self_check?: Record<string, unknown>;

  // ========================================
  // Critic artifacts (Reflection)
  // ========================================
  critique_result?: CritiqueResult;
  revision_count?: number;
  revision_history?: Array<Record<string, unknown>>;
  checkpoint_trace?: Array<Record<string, unknown>>;
  last_checkpoint_id?: string;
  quality_mode?: QualityMode;
  requested_quality_level?: QualityLevel;
  effective_quality_level?: QualityLevel;
  degrade_reason?: string;
  degrade_steps?: QualityDegradeStep[];

  // ========================================
  // Distillation artifacts
  // ========================================
  distillation_result?: DistillationResult;
  distillation_state?: Record<string, unknown>;

  // ========================================
  // Retrieval & context governance
  // ========================================
  retrieval_metadata?: RetrievalMetadata;
  context_budget?: ContextBudget;
  context_governance?: ContextGovernance;

  // ========================================
  // Feedback context (used by Writer on rewrite)
  // ========================================
  feedback_context?: string;
  revision_instructions?: Array<Record<string, string>>;
  feedback_artifacts?: Array<Record<string, unknown>>;
  self_learning?: SelfLearningState;

  // ========================================
  // Final output
  // ========================================
  final_content?: string;
  final_score?: number;

  // ========================================
  // Error handling
  // ========================================
  errors?: string[];
  requires_human_intervention?: boolean;

  // ========================================
  // Extension (matches BaseState.metadata)
  // ========================================
  metadata?: Record<string, unknown>;
}

// ============================================================
// WorkflowConfig (novel-specific, extends base config)
// ============================================================

export interface WorkflowConfig {
  // Quality control
  quality_mode?: QualityMode;
  quality_level?: QualityLevel;
  degrade_on_timeout?: boolean;
  degrade_on_error?: boolean;
  critical_gate_always_on?: boolean;
  quality_phase_timeout_seconds?: number;

  // Quality thresholds
  pass_score?: number;
  min_c_score?: number;

  // Loop control
  max_revisions?: number;

  // Retrieval strategy
  retrieval_profile?: string;

  // Self-learning loop
  enable_self_learning_loop?: boolean;
  self_learning_max_rules?: number;
  self_learning_curate_every_n_revisions?: number;

  // Context governance
  enable_context_governance?: boolean;
  min_retrieval_hit_rate?: number;
  min_context_budget_utilization?: number;

  // Human review
  human_review_score?: number;
  auto_approve_timeout?: number;

  // Debug
  verbose?: boolean;
  save_intermediate?: boolean;
}

// ============================================================
// Default configuration
// ============================================================

export const DEFAULT_NOVEL_CONFIG: WorkflowConfig = {
  quality_mode: 'auto',
  quality_level: 'high',
  degrade_on_timeout: true,
  degrade_on_error: true,
  critical_gate_always_on: true,
  quality_phase_timeout_seconds: 30,
  pass_score: NOVEL_PASS_SCORE,
  min_c_score: NOVEL_MIN_C_SCORE,
  max_revisions: 3,
  human_review_score: NOVEL_HUMAN_REVIEW_SCORE,
  auto_approve_timeout: 300,
  retrieval_profile: 'standard_balanced',
  enable_self_learning_loop: false,
  self_learning_max_rules: 20,
  self_learning_curate_every_n_revisions: 2,
  enable_context_governance: false,
  min_retrieval_hit_rate: 0.70,
  min_context_budget_utilization: 0.60,
  verbose: true,
  save_intermediate: true,
};

// ============================================================
// Factory function
// ============================================================

/**
 * Create initial WritingState for a novel workflow.
 */
export function createInitialState(
  userIdea: string,
  options?: {
    genre?: string;
    targetChapters?: number;
    targetWordcount?: number;
    metadata?: Record<string, unknown>;
  },
): WritingState {
  return {
    // Input
    user_idea: userIdea,
    genre: options?.genre ?? '\u60ac\u7591',
    target_chapters: options?.targetChapters ?? 30,
    target_wordcount: options?.targetWordcount ?? 600000,

    // Metadata
    session_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    current_chapter: 1,
    current_scene_index: 0,

    // Architect
    story_blueprint: {},
    lock_analysis: {},
    scene_cards: [],
    current_scene: {},

    // Context
    character_profiles: [],
    world_settings: {},
    foreshadow_tracker: {},

    // Writer
    draft_content: '',
    draft_version: 0,
    draft_wordcount: 0,
    writer_self_check: {},

    // Critic
    critique_result: {},
    revision_count: 0,
    revision_history: [],
    checkpoint_trace: [],
    last_checkpoint_id: '',
    quality_mode: 'auto',
    requested_quality_level: 'high',
    effective_quality_level: 'high',
    degrade_reason: '',
    degrade_steps: [],

    // Distillation
    distillation_result: {},
    distillation_state: {},

    // Retrieval
    retrieval_metadata: {},
    context_budget: {},
    context_governance: {},

    // Feedback
    feedback_context: '',
    revision_instructions: [],
    feedback_artifacts: [],
    self_learning: {
      reflector: {},
      curator: {},
      playbook: { rules: [] },
    },

    // Final
    final_content: '',
    final_score: 0.0,

    // Errors
    errors: [],
    requires_human_intervention: false,

    // Extension
    metadata: options?.metadata ?? {},
  };
}

/**
 * Cross-domain workflow base state
 *
 * Defines shared base state fields for all domain workflows.
 * Domain adapters (Novel/Code/Knowledge) extend this with specialized fields.
 */

// Decision type constants
export const DecisionType = {
  APPROVED: 'APPROVED',
  REVISE: 'REVISE',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
  REWRITE: 'REWRITE',
  FAILED: 'FAILED',
} as const;

// Domain type constants
export const DomainType = {
  NOVEL: 'novel',
  CODE: 'code',
  KNOWLEDGE: 'knowledge',
  CUSTOM: 'custom',
} as const;

// Base state interface (all fields optional, like Python TypedDict total=False)
export interface BaseState {
  // Session metadata
  session_id?: string;
  created_at?: string;
  updated_at?: string;
  domain?: string;
  workflow_level?: number;

  // Input
  user_request?: string;
  context?: string;

  // Loop control
  current_step?: string;
  revision_count?: number;
  max_revisions?: number;
  iteration_count?: number;

  // Decision state
  decision?: string;
  decision_reason?: string;
  score?: number;

  // Output
  draft_content?: string;
  final_output?: string;

  // Error handling
  errors?: string[];
  warnings?: string[];
  requires_human_intervention?: boolean;

  // Extension metadata
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// Base workflow config interface
export interface BaseWorkflowConfig {
  pass_score?: number;
  human_review_score?: number;
  max_revisions?: number;
  auto_approve_timeout?: number;
  verbose?: boolean;
  save_intermediate?: boolean;
  domain?: string;
  domain_config?: Record<string, unknown>;
}

// Default config
export const DEFAULT_BASE_CONFIG: BaseWorkflowConfig = {
  pass_score: 80,
  human_review_score: 70,
  max_revisions: 3,
  auto_approve_timeout: 300,
  verbose: true,
  save_intermediate: true,
  domain: DomainType.CUSTOM,
  domain_config: {},
};

// Factory function
export function createBaseState(
  userRequest: string,
  options?: {
    domain?: string;
    workflowLevel?: number;
    metadata?: Record<string, unknown>;
  },
): BaseState {
  const now = new Date().toISOString();
  return {
    session_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    domain: options?.domain ?? DomainType.CUSTOM,
    workflow_level: options?.workflowLevel ?? 3,
    user_request: userRequest,
    context: '',
    current_step: 'init',
    revision_count: 0,
    max_revisions: 3,
    iteration_count: 0,
    decision: '',
    decision_reason: '',
    score: 0.0,
    draft_content: '',
    final_output: '',
    errors: [],
    warnings: [],
    requires_human_intervention: false,
    metadata: options?.metadata ?? {},
    tags: [],
  };
}

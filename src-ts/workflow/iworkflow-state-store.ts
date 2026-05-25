/**
 * Workflow state store interface — abstracts persistence for workflow plans and checkpoints.
 *
 * Pattern learned from maestro-flow's DelegateBrokerApi (dual backend):
 * - InMemoryWorkflowStateStore (zero-risk first step, for testing)
 * - SqliteWorkflowStateStore (production, WAL mode, event sourcing)
 *
 * This allows WorkflowEngine to swap persistence backends without changing
 * its core logic — the Maps become a cache over the store.
 */

import type { WorkflowPlan, Checkpoint } from './workflow-engine-core.js';
import type { WorkflowAuthority } from './engine/authority.js';

export interface IWorkflowStateStore {
  // ── Plans ──
  savePlan(plan: WorkflowPlan): Promise<void>;
  loadPlan(planId: string): Promise<WorkflowPlan | null>;
  listPlans(): Promise<WorkflowPlan[]>;
  deletePlan(planId: string): Promise<void>;

  // ── Plan Sessions (plan → sessionId mapping) ──
  savePlanSession(planId: string, sessionId: string): Promise<void>;
  loadPlanSession(planId: string): Promise<string | null>;

  // ── Plan Authorities ──
  savePlanAuthority(planId: string, authority: WorkflowAuthority): Promise<void>;
  loadPlanAuthority(planId: string): Promise<WorkflowAuthority | null>;

  // ── Checkpoints ──
  saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
  loadCheckpoint(planId: string): Promise<Checkpoint | null>;
  listCheckpoints(planId: string): Promise<Checkpoint[]>;

  // ── Lifecycle ──
  close(): Promise<void>;
}
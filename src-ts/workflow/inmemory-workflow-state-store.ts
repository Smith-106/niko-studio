/**
 * In-memory workflow state store — zero-risk first step for state persistence migration.
 *
 * Wraps the Map-based logic that currently lives in WorkflowEngine
 * behind the IWorkflowStateStore interface. No behavior change —
 * the Maps just move from the engine to this class.
 *
 * After this is proven stable, SqliteWorkflowStateStore can be swapped in.
 */

import type { IWorkflowStateStore } from './iworkflow-state-store.js';
import type { WorkflowPlan, Checkpoint } from './workflow-engine-core.js';

export class InMemoryWorkflowStateStore implements IWorkflowStateStore {
  private _plans = new Map<string, WorkflowPlan>();
  private _planSessions = new Map<string, string>();
  private _planAuthorities = new Map<string, any>();
  private _checkpoints = new Map<string, Checkpoint[]>();

  // ── Plans ──

  async savePlan(plan: WorkflowPlan): Promise<void> {
    this._plans.set(plan.id, plan);
  }

  async loadPlan(planId: string): Promise<WorkflowPlan | null> {
    return this._plans.get(planId) ?? null;
  }

  async listPlans(): Promise<WorkflowPlan[]> {
    return Array.from(this._plans.values());
  }

  async deletePlan(planId: string): Promise<void> {
    this._plans.delete(planId);
    this._planSessions.delete(planId);
    this._planAuthorities.delete(planId);
    this._checkpoints.delete(planId);
  }

  // ── Plan Sessions ──

  async savePlanSession(planId: string, sessionId: string): Promise<void> {
    this._planSessions.set(planId, sessionId);
  }

  async loadPlanSession(planId: string): Promise<string | null> {
    return this._planSessions.get(planId) ?? null;
  }

  // ── Plan Authorities ──

  async savePlanAuthority(planId: string, authority: any): Promise<void> {
    this._planAuthorities.set(planId, authority);
  }

  async loadPlanAuthority(planId: string): Promise<any | null> {
    return this._planAuthorities.get(planId) ?? null;
  }

  // ── Checkpoints ──

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const planId = checkpoint.plan_id ?? '';
    const list = this._checkpoints.get(planId) ?? [];
    // Replace existing checkpoint for same plan+step, or append
    const idx = list.findIndex((c) => c.step_id === checkpoint.step_id);
    if (idx >= 0) {
      list[idx] = checkpoint;
    } else {
      list.push(checkpoint);
    }
    this._checkpoints.set(planId, list);
  }

  async loadCheckpoint(planId: string): Promise<Checkpoint | null> {
    const list = this._checkpoints.get(planId);
    return list?.[list.length - 1] ?? null;
  }

  async listCheckpoints(planId: string): Promise<Checkpoint[]> {
    return this._checkpoints.get(planId) ?? [];
  }

  // ── Lifecycle ──

  async close(): Promise<void> {
    this._plans.clear();
    this._planSessions.clear();
    this._planAuthorities.clear();
    this._checkpoints.clear();
  }
}
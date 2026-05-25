/**
 * SQLite-backed workflow state store — production persistence for plans and checkpoints.
 *
 * Features:
 * - WAL mode for concurrent reads
 * - JSON serialization for complex plan/checkpoint structures
 * - Event sourcing via JSONL audit log
 * - Crash recovery: engine restart resumes from persisted state
 *
 * Pattern learned from maestro-flow's SqliteDelegateBroker.
 */

import Database from 'better-sqlite3';
import type { IWorkflowStateStore } from './iworkflow-state-store.js';
import { WorkflowPlan, Checkpoint } from './workflow-engine-core.js';
import type { WorkflowAuthority } from './engine/authority.js';

export class SqliteWorkflowStateStore implements IWorkflowStateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');
    this._initSchema();
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_plans (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS workflow_sessions (
        plan_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_authorities (
        plan_id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_checkpoints (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoints_plan ON workflow_checkpoints(plan_id);

      CREATE TABLE IF NOT EXISTS workflow_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_plan ON workflow_audit(plan_id);
    `);
  }

  private _serializePlan(plan: WorkflowPlan): string {
    return JSON.stringify(plan);
  }

  private _deserializePlan(data: string): WorkflowPlan {
    const obj = JSON.parse(data);
    return Object.assign(new WorkflowPlan(obj), obj);
  }

  private _serializeCheckpoint(cp: Checkpoint): string {
    return JSON.stringify(cp);
  }

  private _deserializeCheckpoint(data: string): Checkpoint {
    const obj = JSON.parse(data);
    return Object.assign(new Checkpoint(obj), obj);
  }

  // ── Plans ──

  async savePlan(plan: WorkflowPlan): Promise<void> {
    this.db.prepare(
      `INSERT INTO workflow_plans (id, data, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = datetime('now')`
    ).run(plan.id, this._serializePlan(plan), this._serializePlan(plan));
  }

  async loadPlan(planId: string): Promise<WorkflowPlan | null> {
    const row = this.db.prepare('SELECT data FROM workflow_plans WHERE id = ?').get(planId) as any;
    return row ? this._deserializePlan(row.data) : null;
  }

  async listPlans(): Promise<WorkflowPlan[]> {
    const rows = this.db.prepare('SELECT data FROM workflow_plans ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => this._deserializePlan(r.data));
  }

  async deletePlan(planId: string): Promise<void> {
    const deletePlan = this.db.prepare('DELETE FROM workflow_plans WHERE id = ?');
    const deleteSession = this.db.prepare('DELETE FROM workflow_sessions WHERE plan_id = ?');
    const deleteAuthority = this.db.prepare('DELETE FROM workflow_authorities WHERE plan_id = ?');
    const deleteCheckpoints = this.db.prepare('DELETE FROM workflow_checkpoints WHERE plan_id = ?');
    const deleteAudit = this.db.prepare('DELETE FROM workflow_audit WHERE plan_id = ?');

    const transaction = this.db.transaction(() => {
      deletePlan.run(planId);
      deleteSession.run(planId);
      deleteAuthority.run(planId);
      deleteCheckpoints.run(planId);
      deleteAudit.run(planId);
    });
    transaction();
  }

  // ── Plan Sessions ──

  async savePlanSession(planId: string, sessionId: string): Promise<void> {
    this.db.prepare(
      `INSERT INTO workflow_sessions (plan_id, session_id) VALUES (?, ?)
       ON CONFLICT(plan_id) DO UPDATE SET session_id = ?`
    ).run(planId, sessionId, sessionId);
  }

  async loadPlanSession(planId: string): Promise<string | null> {
    const row = this.db.prepare('SELECT session_id FROM workflow_sessions WHERE plan_id = ?').get(planId) as any;
    return row?.session_id ?? null;
  }

  // ── Plan Authorities ──

  async savePlanAuthority(planId: string, authority: WorkflowAuthority): Promise<void> {
    this.db.prepare(
      `INSERT INTO workflow_authorities (plan_id, data) VALUES (?, ?)
       ON CONFLICT(plan_id) DO UPDATE SET data = ?`
    ).run(planId, JSON.stringify(authority), JSON.stringify(authority));
  }

  async loadPlanAuthority(planId: string): Promise<WorkflowAuthority | null> {
    const row = this.db.prepare('SELECT data FROM workflow_authorities WHERE plan_id = ?').get(planId) as any;
    return row ? JSON.parse(row.data) : null;
  }

  // ── Checkpoints ──

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    this.db.prepare(
      `INSERT INTO workflow_checkpoints (id, plan_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = ?`
    ).run(checkpoint.id, checkpoint.plan_id, this._serializeCheckpoint(checkpoint), this._serializeCheckpoint(checkpoint));
  }

  async loadCheckpoint(planId: string): Promise<Checkpoint | null> {
    const row = this.db.prepare(
      'SELECT data FROM workflow_checkpoints WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(planId) as any;
    return row ? this._deserializeCheckpoint(row.data) : null;
  }

  async listCheckpoints(planId: string): Promise<Checkpoint[]> {
    const rows = this.db.prepare(
      'SELECT data FROM workflow_checkpoints WHERE plan_id = ? ORDER BY created_at ASC'
    ).all(planId) as any[];
    return rows.map((r) => this._deserializeCheckpoint(r.data));
  }

  // ── Audit (event sourcing) ──

  appendAudit(planId: string, eventType: string, data: Record<string, unknown>): void {
    this.db.prepare(
      'INSERT INTO workflow_audit (plan_id, event_type, data) VALUES (?, ?, ?)'
    ).run(planId, eventType, JSON.stringify(data));
  }

  // ── Lifecycle ──

  async close(): Promise<void> {
    this.db.close();
  }
}
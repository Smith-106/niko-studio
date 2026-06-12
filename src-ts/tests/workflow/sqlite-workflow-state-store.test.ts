import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let SqliteWorkflowStateStore: any;
let sqliteAvailable = false;
try {
  const mod = await import('../../workflow/sqlite-workflow-state-store.js');
  SqliteWorkflowStateStore = mod.SqliteWorkflowStateStore;
  sqliteAvailable = true;
} catch {
  sqliteAvailable = false;
}

describe.runIf(sqliteAvailable)('SqliteWorkflowStateStore', () => {
  let tmpDir: string;
  let dbPath: string;
  let store: InstanceType<typeof SqliteWorkflowStateStore>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-workflow-test-'));
    dbPath = path.join(tmpDir, 'workflow.db');
    store = new SqliteWorkflowStateStore(dbPath);
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('plans', () => {
    it('saves and loads a plan', async () => {
      const plan = { id: 'p1', name: 'Test Plan', steps: [], status: 'planned' };
      await store.savePlan(plan as any);
      const loaded = await store.loadPlan('p1');
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('p1');
    });

    it('returns null for non-existent plan', async () => {
      expect(await store.loadPlan('nonexistent')).toBeNull();
    });

    it('lists all plans', async () => {
      await store.savePlan({ id: 'p1', name: 'Plan 1', steps: [], status: 'planned' } as any);
      await store.savePlan({ id: 'p2', name: 'Plan 2', steps: [], status: 'planned' } as any);
      const plans = await store.listPlans();
      expect(plans).toHaveLength(2);
    });

    it('deletes a plan', async () => {
      await store.savePlan({ id: 'p1', name: 'Plan 1', steps: [], status: 'planned' } as any);
      await store.deletePlan('p1');
      expect(await store.loadPlan('p1')).toBeNull();
    });
  });

  describe('sessions', () => {
    it('saves and loads a plan session', async () => {
      await store.savePlanSession('p1', 'session-123');
      expect(await store.loadPlanSession('p1')).toBe('session-123');
    });

    it('returns null for non-existent session', async () => {
      expect(await store.loadPlanSession('p1')).toBeNull();
    });
  });

  describe('authorities', () => {
    it('saves and loads a plan authority', async () => {
      await store.savePlanAuthority('p1', { role: 'admin' });
      const auth = await store.loadPlanAuthority('p1');
      expect(auth).toEqual({ role: 'admin' });
    });

    it('returns null for non-existent authority', async () => {
      expect(await store.loadPlanAuthority('p1')).toBeNull();
    });
  });

  describe('checkpoints', () => {
    it('saves and loads a checkpoint', async () => {
      const cp = { plan_id: 'p1', step_id: 's1', timestamp: new Date().toISOString(), data: {} };
      await store.saveCheckpoint(cp as any);
      const loaded = await store.loadCheckpoint('p1');
      expect(loaded).not.toBeNull();
      expect(loaded!.step_id).toBe('s1');
    });

    it('returns null for plan with no checkpoints', async () => {
      expect(await store.loadCheckpoint('p1')).toBeNull();
    });

    it('lists checkpoints for a plan', async () => {
      await store.saveCheckpoint({ plan_id: 'p1', step_id: 's1', timestamp: new Date().toISOString(), data: {} } as any);
      await store.saveCheckpoint({ plan_id: 'p1', step_id: 's2', timestamp: new Date().toISOString(), data: {} } as any);
      const cps = await store.listCheckpoints('p1');
      expect(cps).toHaveLength(2);
    });
  });

  describe('audit', () => {
    it('appends audit events as serialized JSON data', () => {
      store.appendAudit('p1', 'plan_saved', { step: 'draft', ok: true });

      const row = store.db
        .prepare('SELECT plan_id, event_type, data FROM workflow_audit WHERE plan_id = ?')
        .get('p1');

      expect(row).toMatchObject({
        plan_id: 'p1',
        event_type: 'plan_saved',
      });
      expect(JSON.parse(row.data)).toEqual({ step: 'draft', ok: true });
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InMemoryWorkflowStateStore } from '../../workflow/inmemory-workflow-state-store.js';
import type { WorkflowPlan, Checkpoint } from '../../workflow/workflow-engine-core.js';

function makePlan(id: string, overrides?: Partial<WorkflowPlan>): WorkflowPlan {
  return {
    id,
    name: `Plan ${id}`,
    steps: [],
    status: 'planned',
    ...overrides,
  } as WorkflowPlan;
}

function makeCheckpoint(planId: string, stepId: string): Checkpoint {
  return {
    plan_id: planId,
    step_id: stepId,
    timestamp: new Date().toISOString(),
    data: { status: 'completed' },
  } as Checkpoint;
}

describe('InMemoryWorkflowStateStore', () => {
  let store: InMemoryWorkflowStateStore;

  beforeEach(() => {
    store = new InMemoryWorkflowStateStore();
  });

  afterEach(async () => {
    await store.close();
  });

  // ── Plans ──

  describe('plans', () => {
    it('saves and loads a plan', async () => {
      const plan = makePlan('p1');
      await store.savePlan(plan);
      const loaded = await store.loadPlan('p1');
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('p1');
    });

    it('returns null for non-existent plan', async () => {
      const loaded = await store.loadPlan('nonexistent');
      expect(loaded).toBeNull();
    });

    it('lists all plans', async () => {
      await store.savePlan(makePlan('p1'));
      await store.savePlan(makePlan('p2'));
      const plans = await store.listPlans();
      expect(plans).toHaveLength(2);
    });

    it('deletes a plan and related data', async () => {
      await store.savePlan(makePlan('p1'));
      await store.savePlanSession('p1', 's1');
      await store.saveCheckpoint(makeCheckpoint('p1', 'step1'));
      await store.deletePlan('p1');
      expect(await store.loadPlan('p1')).toBeNull();
      expect(await store.loadPlanSession('p1')).toBeNull();
      expect(await store.loadCheckpoint('p1')).toBeNull();
    });
  });

  // ── Sessions ──

  describe('sessions', () => {
    it('saves and loads a plan session', async () => {
      await store.savePlanSession('p1', 'session-123');
      const session = await store.loadPlanSession('p1');
      expect(session).toBe('session-123');
    });

    it('returns null for non-existent session', async () => {
      expect(await store.loadPlanSession('p1')).toBeNull();
    });
  });

  // ── Authorities ──

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

  // ── Checkpoints ──

  describe('checkpoints', () => {
    it('saves and loads a checkpoint', async () => {
      const cp = makeCheckpoint('p1', 'step1');
      await store.saveCheckpoint(cp);
      const loaded = await store.loadCheckpoint('p1');
      expect(loaded).not.toBeNull();
      expect(loaded!.step_id).toBe('step1');
    });

    it('replaces checkpoint for same plan+step', async () => {
      await store.saveCheckpoint(makeCheckpoint('p1', 'step1'));
      await store.saveCheckpoint(makeCheckpoint('p1', 'step1'));
      const cps = await store.listCheckpoints('p1');
      expect(cps).toHaveLength(1);
    });

    it('keeps multiple checkpoints for different steps', async () => {
      await store.saveCheckpoint(makeCheckpoint('p1', 'step1'));
      await store.saveCheckpoint(makeCheckpoint('p1', 'step2'));
      const cps = await store.listCheckpoints('p1');
      expect(cps).toHaveLength(2);
    });

    it('returns null for plan with no checkpoints', async () => {
      expect(await store.loadCheckpoint('p1')).toBeNull();
    });

    it('returns latest checkpoint', async () => {
      await store.saveCheckpoint(makeCheckpoint('p1', 'step1'));
      await store.saveCheckpoint(makeCheckpoint('p1', 'step2'));
      const loaded = await store.loadCheckpoint('p1');
      expect(loaded!.step_id).toBe('step2');
    });
  });

  // ── Close ──

  describe('close', () => {
    it('clears all data', async () => {
      await store.savePlan(makePlan('p1'));
      await store.close();
      expect(await store.listPlans()).toHaveLength(0);
    });
  });
});
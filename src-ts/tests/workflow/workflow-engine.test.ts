import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  WorkflowEngine,
  WorkflowStep,
  WorkflowPlan,
  RUNNER_ALLOWED_TRANSITIONS,
  STEP_ALLOWED_TRANSITIONS,
  STEP_LEGACY_TO_CANONICAL,
  TEMPLATE_METADATA_MAP,
  DESTRUCTIVE_STEP_NAMES,
  ENGINE_PUBLIC_ENTRY_API,
  WAVE6_BUDGET_GUARDRAIL,
  WORKFLOW_STATE_SCHEMA_VERSION,
  WORKFLOW_STATE_ALLOWED_PHASES,
} from '../../workflow/workflow-engine';

describe('WorkflowEngine constants', () => {
  it('ENGINE_PUBLIC_ENTRY_API exposes the five standard entry methods', () => {
    expect(WorkflowEngine.publicEntryApi()).toEqual(
      expect.arrayContaining(['route', 'plan', 'execute', 'run', 'run_stream']),
    );
  });

  it('RUNNER_ALLOWED_TRANSITIONS covers the expected runner states', () => {
    expect(RUNNER_ALLOWED_TRANSITIONS).toHaveProperty('pending');
    expect(RUNNER_ALLOWED_TRANSITIONS).toHaveProperty('running');
    expect(RUNNER_ALLOWED_TRANSITIONS).toHaveProperty('paused');
    expect(RUNNER_ALLOWED_TRANSITIONS).toHaveProperty('stopped');
    expect(RUNNER_ALLOWED_TRANSITIONS['pending']).toContain('running');
    expect(RUNNER_ALLOWED_TRANSITIONS['pending']).toContain('paused');
  });

  it('STEP_ALLOWED_TRANSITIONS covers the step lifecycle', () => {
    expect(STEP_ALLOWED_TRANSITIONS['planned']).toContain('executing');
    expect(STEP_ALLOWED_TRANSITIONS['executing']).toContain('review');
    expect(STEP_ALLOWED_TRANSITIONS['review']).toContain('test');
    expect(STEP_ALLOWED_TRANSITIONS['test']).toContain('done');
    expect(STEP_ALLOWED_TRANSITIONS['done'].size).toBe(0);
  });

  it('STEP_LEGACY_TO_CANONICAL maps legacy step statuses', () => {
    expect(STEP_LEGACY_TO_CANONICAL['pending']).toBe('planned');
    expect(STEP_LEGACY_TO_CANONICAL['running']).toBe('executing');
    expect(STEP_LEGACY_TO_CANONICAL['completed']).toBe('done');
  });

  it('TEMPLATE_METADATA_MAP provides metadata for all five levels', () => {
    const levels = Object.keys(TEMPLATE_METADATA_MAP).map(Number);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
    expect(levels).toContain(3);
    expect(levels).toContain(4);
    expect(levels).toContain(5);

    for (const meta of Object.values(TEMPLATE_METADATA_MAP)) {
      expect(meta).toHaveProperty('level');
      expect(meta).toHaveProperty('risk');
      expect(meta).toHaveProperty('gate_profile');
    }
  });

  it('DESTRUCTIVE_STEP_NAMES contains expected step names', () => {
    expect(DESTRUCTIVE_STEP_NAMES).toContain('checkpoint');
    expect(DESTRUCTIVE_STEP_NAMES).toContain('final_review');
  });

  it('WAVE6_BUDGET_GUARDRAIL has token and time budgets', () => {
    expect(WAVE6_BUDGET_GUARDRAIL.token_budget).toBeGreaterThan(0);
    expect(WAVE6_BUDGET_GUARDRAIL.time_budget_minutes).toBeGreaterThan(0);
  });

  it('WORKFLOW_STATE_SCHEMA_VERSION matches frozen policy format', () => {
    expect(WORKFLOW_STATE_SCHEMA_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it('WORKFLOW_STATE_ALLOWED_PHASES covers the full lifecycle', () => {
    for (const phase of ['planned', 'executing', 'review', 'test', 'done', 'failed', 'recovery']) {
      expect(WORKFLOW_STATE_ALLOWED_PHASES).toContain(phase);
    }
  });
});

describe('WorkflowStep', () => {
  it('initializes with planned status and no output', () => {
    const step = new WorkflowStep({
      id: 'step-1',
      name: 'analyze',
      description: 'Analyze the task',
    });

    expect(step.id).toBe('step-1');
    expect(step.name).toBe('analyze');
    expect(step.description).toBe('Analyze the task');
    expect(step.status).toBe('planned');
    expect(step.output).toBeNull();
    expect(step.dependencies).toEqual([]);
  });

  it('accepts explicit dependencies', () => {
    const step = new WorkflowStep({
      id: 'step-2',
      name: 'generate',
      description: 'Generate content',
      dependencies: ['step-1'],
    });

    expect(step.dependencies).toEqual(['step-1']);
  });
});

describe('WorkflowPlan', () => {
  it('initializes with default values', () => {
    const plan = new WorkflowPlan({
      id: 'plan-1',
      task: 'Write a chapter',
      level: 'L3',
    });

    expect(plan.id).toBe('plan-1');
    expect(plan.task).toBe('Write a chapter');
    expect(plan.level).toBe('L3');
    expect(plan.status).toBe('created');
    expect(plan.runner_state).toBe('pending');
    expect(plan.triage_state).toBe('open');
    expect(plan.steps).toEqual([]);
    expect(plan.created_at).toBeTruthy();
  });

  it('accepts steps and recommendations', () => {
    const steps = [new WorkflowStep({ id: 's1', name: 'analyze', description: 'Analyze' })];
    const recommendations = [{ action: 'focus_on_dialogue' }];

    const plan = new WorkflowPlan({
      id: 'plan-2',
      task: 'Write dialogue',
      level: 'L2',
      steps,
      recommendations: recommendations as unknown as Record<string, unknown>[],
    });

    expect(plan.steps).toHaveLength(1);
    expect(plan.recommendations).toHaveLength(1);
  });
});

describe('WorkflowEngine unit tests', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-wf-engine-unit-'));
  });

  afterEach(async () => {
    if (workspace) {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('route', () => {
    it('routes keyword-based tasks to the correct level', async () => {
      const engine = new WorkflowEngine(workspace, 'route-test');

      const l1 = await engine.route('What is the meaning of life?');
      expect(l1.level).toBe('L1');

      const l2 = await engine.route('写一段描述性段落');
      expect(l2.level).toBe('L2');

      const l3 = await engine.route('写一章关于主角的故事');
      expect(l3.level).toBe('L3');
    });

    it('returns routing diagnostics with matched features', async () => {
      const engine = new WorkflowEngine(workspace, 'route-diag');

      const result = await engine.route('Write a chapter');
      expect(result).toHaveProperty('matched_features');
      expect(result).toHaveProperty('routing_diagnostics');
      expect(result).toHaveProperty('suggested_workflow');
      expect(Array.isArray(result.matched_features)).toBe(true);
    });

    it('escalates long text tasks to at least L3', async () => {
      const engine = new WorkflowEngine(workspace, 'route-escalation');

      const longTask = 'A'.repeat(200);
      const result = await engine.route(longTask);
      // Long text escalation should bump to at least L3
      expect(['L3', 'L4', 'L5']).toContain(result.level);
    });
  });

  describe('plan', () => {
    it('creates a plan with the specified level', async () => {
      const engine = new WorkflowEngine(workspace, 'plan-test');
      const plan = await engine.plan('Write something', 'L2');

      expect(plan.level).toBe('L2');
      expect(plan.total_steps).toBe(3);
      expect(plan.plan_id).toBeTruthy();
      expect(plan.steps).toHaveLength(3);
      expect(plan.execution_mode).toBeTruthy();
      expect(plan.observability_metrics).toBeTruthy();
      expect(plan.budget_guardrail).toBeTruthy();
    });

    it('auto-routes when level is not specified', async () => {
      const engine = new WorkflowEngine(workspace, 'plan-auto-route');
      const plan = await engine.plan('What is a character arc?');

      // "What" and "is" are short; auto-route may choose L1 or L2
      expect(['L1', 'L2', 'L3']).toContain(plan.level);
      expect(plan.total_steps).toBeGreaterThanOrEqual(1);
    });

    it('creates L1 plans with a single answer step', async () => {
      const engine = new WorkflowEngine(workspace, 'plan-l1');
      const plan = await engine.plan('What is a character arc?', 'L1');

      expect(plan.total_steps).toBe(1);
      expect(plan.steps[0].name).toBe('answer');
    });

    it('creates L3 plans with multiple steps', async () => {
      const engine = new WorkflowEngine(workspace, 'plan-l3');
      const plan = await engine.plan('Write a chapter', 'L3');

      expect(plan.total_steps).toBe(8);
      const stepNames = plan.steps.map(s => s.name);
      expect(stepNames).toContain('analyze');
      expect(stepNames).toContain('generate_draft');
      expect(stepNames).toContain('evaluate');
      expect(stepNames).toContain('checkpoint');
    });

    it('includes gate_decision in the plan', async () => {
      const engine = new WorkflowEngine(workspace, 'plan-gate');
      const plan = await engine.plan('Write a chapter', 'L3');

      expect(plan).toHaveProperty('gate_decision');
      expect(plan.gate_decision).toBeTruthy();
    });
  });

  describe('execute', () => {
    it('executes L2 steps sequentially to completion', async () => {
      const engine = new WorkflowEngine(workspace, 'exec-l2');

      const plan = await engine.plan('Write a paragraph with dialogue', 'L2');
      const planId = String(plan.plan_id);

      // Execute all steps
      let result = await engine.execute(planId);
      while (result.status !== 'completed' && !result.error) {
        result = await engine.execute(planId);
      }

      expect(result.status).toBe('completed');
    });

    it('returns error for non-existent plan ID', async () => {
      const engine = new WorkflowEngine(workspace, 'exec-missing');

      const result = await engine.execute('nonexistent-plan');
      expect(result.error).toContain('not found');
    });
  });

  describe('run', () => {
    it('runs a complete L2 workflow end-to-end', async () => {
      const engine = new WorkflowEngine(workspace, 'run-l2');

      const result = await engine.run('Write a paragraph', 'L2');
      expect(result.status).toBe('completed');
      expect(result.plan_id).toBeTruthy();
    });
  });

  describe('getPlanStatus', () => {
    it('returns status for a known plan', async () => {
      const engine = new WorkflowEngine(workspace, 'status-test');

      const plan = await engine.plan('Test task', 'L2');
      const planId = String(plan.plan_id);
      const status = engine.getPlanStatus(planId);

      expect(status.plan_id).toBe(planId);
      expect(status.status).toBe('created');
      expect(status.runner_state).toBe('pending');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('template_meta');
      expect(status).toHaveProperty('observability_metrics');
      expect(status).toHaveProperty('budget_guardrail');
    });

    it('returns error for unknown plan', () => {
      const engine = new WorkflowEngine(workspace, 'status-unknown');

      const status = engine.getPlanStatus('missing');
      expect(status.error).toContain('not found');
    });
  });

  describe('lifecycle', () => {
    it('pauses and resumes a plan', async () => {
      const engine = new WorkflowEngine(workspace, 'lifecycle-test');

      const plan = await engine.plan('Test task', 'L3');
      const planId = String(plan.plan_id);
      const expectedPlanHash = String((engine.getPlanStatus(planId) as Record<string, unknown>)['plan_hash'] ?? '');
      expect(expectedPlanHash.length).toBeGreaterThan(0);

      const pauseResult = await engine.lifecycle(planId, 'pause');
      expect(pauseResult.runner_state).toBe('paused');
      expect(pauseResult.checkpoint_id).toBeTruthy();

      const replayRestore = await engine.restoreCheckpoint(String(pauseResult.checkpoint_id), 'approved-token');
      const replay = replayRestore['replay'] as Record<string, unknown>;
      expect(replay['applied']).toBe(true);
      expect(replay['plan_hash']).toBe(expectedPlanHash);

      const resumeResult = await engine.lifecycle(planId, 'resume');
      expect(resumeResult.runner_state).toBe('running');
    });

    it('returns status for lifecycle status query', async () => {
      const engine = new WorkflowEngine(workspace, 'lifecycle-status');

      const plan = await engine.plan('Test task', 'L3');
      const planId = String(plan.plan_id);

      const status = await engine.lifecycle(planId, 'status');
      expect(status.action).toBe('status');
      expect(status).toHaveProperty('runner_state');
      expect(status).toHaveProperty('observability_metrics');
      expect(status).toHaveProperty('budget_guardrail');
      expect(status).toHaveProperty('handoff_package');
    });
  });

  describe('bindPlanSession', () => {
    it('binds and retrieves plan session IDs', async () => {
      const engine = new WorkflowEngine(workspace, 'session-bind');

      const plan = await engine.plan('Test task', 'L2');
      const planId = String(plan.plan_id);

      const sessionId = engine.bindPlanSession(planId, 'custom-session-001');
      expect(sessionId).toBe('custom-session-001');
      expect(engine.getPlanSessionId(planId)).toBe('custom-session-001');
    });
  });

  describe('checkpoints', () => {
    it('creates a checkpoint without git commit', async () => {
      const engine = new WorkflowEngine(workspace, 'checkpoint-test');

      const plan = await engine.plan('Test task', 'L2');
      const planId = String(plan.plan_id);

      const checkpoint = await engine.createCheckpoint('test checkpoint', false, planId);
      expect(checkpoint.checkpoint_id).toBeTruthy();
      expect(checkpoint.description).toBe('test checkpoint');
      expect(checkpoint.plan_id).toBe(planId);
    });

    it('rejects replay restore when checkpoint payload plan_hash is missing', async () => {
      const engine = new WorkflowEngine(workspace, 'checkpoint-missing-hash');

      const plan = await engine.plan('Test task', 'L2');
      const planId = String(plan.plan_id);

      const checkpoint = await engine.createCheckpoint('missing hash replay', false, planId, undefined, {
        plan_id: planId,
        plan_hash: '',
        recommendations: [],
        recommendations_frozen: true,
      });

      const restored = await engine.restoreCheckpoint(String(checkpoint.checkpoint_id), 'approved-token');
      const replay = restored['replay'] as Record<string, unknown>;

      expect(restored['error']).toBe('No commit hash available for this checkpoint');
      expect(replay['applied']).toBe(false);
      expect(replay['reason']).toBe('missing_plan_hash');
    });

    it('rejects replay restore when checkpoint payload plan_hash mismatches current plan hash', async () => {
      const engine = new WorkflowEngine(workspace, 'checkpoint-hash-mismatch');

      const plan = await engine.plan('Test task', 'L2');
      const planId = String(plan.plan_id);
      const currentPlanHash = String((engine.getPlanStatus(planId) as Record<string, unknown>)['plan_hash'] ?? '');
      expect(currentPlanHash.length).toBeGreaterThan(0);

      const checkpoint = await engine.createCheckpoint('hash mismatch replay', false, planId, undefined, {
        plan_id: planId,
        plan_hash: `${currentPlanHash}-mismatch`,
        recommendations: [],
        recommendations_frozen: true,
      });

      const restored = await engine.restoreCheckpoint(String(checkpoint.checkpoint_id), 'approved-token');
      const replay = restored['replay'] as Record<string, unknown>;

      expect(restored['error']).toBe('No commit hash available for this checkpoint');
      expect(replay['applied']).toBe(false);
      expect(replay['reason']).toBe('plan_hash_mismatch');
      expect(replay['expected_plan_hash']).toBe(`${currentPlanHash}-mismatch`);
      expect(replay['current_plan_hash']).toBe(currentPlanHash);
    });

    it('lists checkpoints', async () => {
      const engine = new WorkflowEngine(workspace, 'checkpoint-list');

      await engine.createCheckpoint('first', false);
      await engine.createCheckpoint('second', false);
      await engine.createCheckpoint('third', false);

      const list = await engine.listCheckpoints(10);
      expect(list.length).toBe(3);
      // All checkpoint fields should be present
      for (const cp of list) {
        expect(cp).toHaveProperty('id');
        expect(cp).toHaveProperty('description');
        expect(cp).toHaveProperty('created_at');
      }
    });

    it('respects limit in listCheckpoints', async () => {
      const engine = new WorkflowEngine(workspace, 'checkpoint-limit');

      await engine.createCheckpoint('a', false);
      await engine.createCheckpoint('b', false);
      await engine.createCheckpoint('c', false);

      const list = await engine.listCheckpoints(2);
      expect(list.length).toBe(2);
    });
  });
});

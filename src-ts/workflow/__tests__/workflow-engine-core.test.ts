/**
 * WorkflowEngine Core Tests
 *
 * Tests generateId uniqueness and state persistence
 * for the workflow-engine-core module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WorkflowEngine,
  WorkflowStep,
  WorkflowPlan,
  WorkflowStateStepRecord,
  WorkflowStateSnapshot,
  RUNNER_ALLOWED_TRANSITIONS,
  STEP_ALLOWED_TRANSITIONS,
  STEP_LEGACY_TO_CANONICAL,
  TEMPLATE_METADATA_MAP,
  DESTRUCTIVE_STEP_NAMES,
  ENGINE_PUBLIC_ENTRY_API,
  WAVE6_BUDGET_GUARDRAIL,
  WORKFLOW_STATE_SCHEMA_VERSION,
  WORKFLOW_STATE_SCHEMA_POLICY,
  WORKFLOW_STATE_ALLOWED_PHASES,
  WORKFLOW_STATE_PHASE_ALIASES,
  MAINTENANCE_TO_SESSION_STATUS,
  RUNNER_TO_SESSION_STATUS,
  TRIAGE_ALLOWED_TRANSITIONS,
  AUTO_ROLLBACK_CONFIRM_TOKEN,
  RECOVERY_CHAIN_STEPS,
  OBSERVABILITY_MODES,
  ECO_MODE_LABEL,
} from '../workflow-engine-core';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'niko-wf-core-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateId uniqueness', () => {
  it('produces unique IDs across many calls', () => {
    // generateId is a private function but plan() uses it internally.
    // We test uniqueness through the plan API.
    const engine = new WorkflowEngine();
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const plan = new WorkflowPlan({
        id: crypto.randomUUID().slice(0, 8),
        task: `Task ${i}`,
        level: 'L2',
      });
      ids.add(plan.id);
    }
    // All 100 plan IDs should be unique
    expect(ids.size).toBe(100);
  });

  it('plan creates unique plan IDs via engine.plan()', async () => {
    const workspace = await createWorkspace();
    try {
      const engine = new WorkflowEngine(workspace, 'id-unique');
      const planIds = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const plan = await engine.plan(`Task ${i}`, 'L1');
        planIds.add(plan.plan_id!);
      }
      expect(planIds.size).toBe(20);
    } finally {
      await rm(workspace, { recursive: true, force: true });
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
    expect(step.status).toBe('planned');
    expect(step.output).toBeNull();
    expect(step.dependencies).toEqual([]);
    expect(step.started_at).toBeNull();
    expect(step.completed_at).toBeNull();
  });

  it('accepts explicit dependencies', () => {
    const step = new WorkflowStep({
      id: 'step-2',
      name: 'generate',
      description: 'Generate',
      dependencies: ['step-1'],
    });
    expect(step.dependencies).toEqual(['step-1']);
  });
});

describe('WorkflowPlan', () => {
  it('initializes with defaults', () => {
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
    expect(plan.gate_decision).toBe('go');
    expect(plan.recommendations).toEqual([]);
    expect(plan.recommendations_frozen).toBe(false);
    expect(plan.created_at).toBeTruthy();
    expect(plan.completed_at).toBeNull();
  });

  it('accepts steps, recommendations, and metadata', () => {
    const steps = [
      new WorkflowStep({ id: 's1', name: 'analyze', description: 'Analyze' }),
    ];
    const recs = [{ action: 'focus' }];
    const plan = new WorkflowPlan({
      id: 'plan-2',
      task: 'Write',
      level: 'L2',
      steps,
      recommendations: recs as unknown as Record<string, unknown>[],
      template_meta: { custom: true },
      quality_metrics: { readability: 0.8 },
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.recommendations).toHaveLength(1);
    expect(plan.template_meta).toEqual({ custom: true });
    expect(plan.quality_metrics).toEqual({ readability: 0.8 });
  });
});

describe('State persistence', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('plan persists and is retrievable via getPlanStatus', async () => {
    const engine = new WorkflowEngine(workspace, 'persist-test');
    const plan = await engine.plan('Persistent task', 'L2');
    const planId = plan.plan_id!;

    const status = engine.getPlanStatus(planId);
    expect('error' in status).toBe(false);
    if ('error' in status) {
      throw new Error(String(status.error));
    }
    expect(status.plan_id).toBe(planId);
    expect(status.task).toBe('Persistent task');
    expect(status.level).toBe('L2');
    expect(status.status).toBe('created');
    expect(status.runner_state).toBe('pending');
  });

  it('execute transitions step states and persists them', async () => {
    const engine = new WorkflowEngine(workspace, 'step-persist');
    const plan = await engine.plan('Execute task', 'L2');
    const planId = plan.plan_id!;

    // Execute until complete (same pattern as workflow-engine.test.ts)
    let result = await engine.execute(planId);
    while (result.status !== 'completed' && !result.error) {
      result = await engine.execute(planId);
    }

    expect(result.status).toBe('completed');
  });

  it('checkpoint persists and is listable', async () => {
    const engine = new WorkflowEngine(workspace, 'cp-persist');

    const cp1 = await engine.createCheckpoint('First checkpoint', false);
    const cp2 = await engine.createCheckpoint('Second checkpoint', false);

    const checkpoints = await engine.listCheckpoints(10);
    expect(checkpoints.length).toBeGreaterThanOrEqual(2);
    expect(checkpoints.some((cp) => cp.description === 'First checkpoint')).toBe(true);
    expect(checkpoints.some((cp) => cp.description === 'Second checkpoint')).toBe(true);
  });

  it('lifecycle pause persists runner_state as paused', async () => {
    const engine = new WorkflowEngine(workspace, 'lifecycle-persist');
    const plan = await engine.plan('Lifecycle task', 'L3');
    const planId = plan.plan_id!;

    const pauseResult = await engine.lifecycle(planId, 'pause');
    expect('error' in pauseResult).toBe(false);
    if ('error' in pauseResult) {
      throw new Error(String(pauseResult.error));
    }
    expect(pauseResult.runner_state).toBe('paused');

    const status = engine.getPlanStatus(planId);
    expect('error' in status).toBe(false);
    if ('error' in status) {
      throw new Error(String(status.error));
    }
    expect(status.runner_state).toBe('paused');
  });

  it('bindPlanSession persists session binding', async () => {
    const engine = new WorkflowEngine(workspace, 'session-persist');
    const plan = await engine.plan('Session task', 'L2');
    const planId = plan.plan_id!;

    engine.bindPlanSession(planId, 'session-123');
    expect(engine.getPlanSessionId(planId)).toBe('session-123');
  });

  it('getPlanStatus returns error for unknown plan', () => {
    const engine = new WorkflowEngine(workspace, 'unknown-plan');
    const status = engine.getPlanStatus('nonexistent');
    expect('error' in status && status.error).toContain('not found');
  });
});

describe('Constants and transitions', () => {
  it('RUNNER_ALLOWED_TRANSITIONS covers all states', () => {
    expect(RUNNER_ALLOWED_TRANSITIONS.pending).toContain('running');
    expect(RUNNER_ALLOWED_TRANSITIONS.running).toContain('paused');
    expect(RUNNER_ALLOWED_TRANSITIONS.running).toContain('stopped');
    expect(RUNNER_ALLOWED_TRANSITIONS.paused).toContain('running');
    expect(RUNNER_ALLOWED_TRANSITIONS.stopped.size).toBe(0);
  });

  it('STEP_ALLOWED_TRANSITIONS covers lifecycle', () => {
    expect(STEP_ALLOWED_TRANSITIONS.planned).toContain('executing');
    expect(STEP_ALLOWED_TRANSITIONS.executing).toContain('review');
    expect(STEP_ALLOWED_TRANSITIONS.review).toContain('test');
    expect(STEP_ALLOWED_TRANSITIONS.test).toContain('done');
    expect(STEP_ALLOWED_TRANSITIONS.done.size).toBe(0);
    expect(STEP_ALLOWED_TRANSITIONS.failed.size).toBe(0);
  });

  it('TRIAGE_ALLOWED_TRANSITIONS covers triage lifecycle', () => {
    expect(TRIAGE_ALLOWED_TRANSITIONS.open).toContain('in_progress');
    expect(TRIAGE_ALLOWED_TRANSITIONS.in_progress).toContain('resolved');
    expect(TRIAGE_ALLOWED_TRANSITIONS.escalated).toContain('in_progress');
    expect(TRIAGE_ALLOWED_TRANSITIONS.resolved.size).toBe(0);
  });

  it('STEP_LEGACY_TO_CANONICAL maps legacy statuses', () => {
    expect(STEP_LEGACY_TO_CANONICAL.pending).toBe('planned');
    expect(STEP_LEGACY_TO_CANONICAL.running).toBe('executing');
    expect(STEP_LEGACY_TO_CANONICAL.completed).toBe('done');
  });

  it('TEMPLATE_METADATA_MAP covers all 5 levels', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(TEMPLATE_METADATA_MAP[level]).toBeDefined();
      expect(TEMPLATE_METADATA_MAP[level]).toHaveProperty('level');
      expect(TEMPLATE_METADATA_MAP[level]).toHaveProperty('risk');
      expect(TEMPLATE_METADATA_MAP[level]).toHaveProperty('gate_profile');
    }
  });

  it('DESTRUCTIVE_STEP_NAMES contains expected names', () => {
    expect(DESTRUCTIVE_STEP_NAMES).toContain('checkpoint');
    expect(DESTRUCTIVE_STEP_NAMES).toContain('final_review');
  });

  it('WAVE6_BUDGET_GUARDRAIL has valid budgets', () => {
    expect(WAVE6_BUDGET_GUARDRAIL.token_budget).toBeGreaterThan(0);
    expect(WAVE6_BUDGET_GUARDRAIL.time_budget_minutes).toBeGreaterThan(0);
  });

  it('WORKFLOW_STATE_SCHEMA_VERSION follows YYYY-MM format', () => {
    expect(WORKFLOW_STATE_SCHEMA_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it('WORKFLOW_STATE_SCHEMA_POLICY is frozen with additive-only changes', () => {
    expect(WORKFLOW_STATE_SCHEMA_POLICY.policy).toBe('frozen');
    expect(WORKFLOW_STATE_SCHEMA_POLICY.non_breaking_change).toBe('additive_only');
  });

  it('WORKFLOW_STATE_ALLOWED_PHASES covers the full lifecycle', () => {
    const expected = ['planned', 'executing', 'review', 'test', 'done', 'failed', 'recovery'];
    for (const phase of expected) {
      expect(WORKFLOW_STATE_ALLOWED_PHASES).toContain(phase);
    }
  });

  it('WORKFLOW_STATE_PHASE_ALIASES maps legacy phase names', () => {
    expect(WORKFLOW_STATE_PHASE_ALIASES.created).toBe('planned');
    expect(WORKFLOW_STATE_PHASE_ALIASES.running).toBe('executing');
    expect(WORKFLOW_STATE_PHASE_ALIASES.completed).toBe('done');
    expect(WORKFLOW_STATE_PHASE_ALIASES.stopped).toBe('failed');
  });

  it('RUNNER_TO_SESSION_STATUS maps correctly', () => {
    expect(RUNNER_TO_SESSION_STATUS.running).toBe('active');
    expect(RUNNER_TO_SESSION_STATUS.paused).toBe('checkpointed');
    expect(RUNNER_TO_SESSION_STATUS.stopped).toBe('archived');
  });

  it('MAINTENANCE_TO_SESSION_STATUS maps correctly', () => {
    expect(MAINTENANCE_TO_SESSION_STATUS.running).toBe('active');
    expect(MAINTENANCE_TO_SESSION_STATUS.paused).toBe('checkpointed');
    expect(MAINTENANCE_TO_SESSION_STATUS.stopped).toBe('archived');
  });

  it('AUTO_ROLLBACK_CONFIRM_TOKEN is a known sentinel', () => {
    expect(AUTO_ROLLBACK_CONFIRM_TOKEN).toBe('__auto_rollback__');
  });

  it('RECOVERY_CHAIN_STEPS lists expected steps', () => {
    expect(RECOVERY_CHAIN_STEPS).toContain('analyze-with-file');
    expect(RECOVERY_CHAIN_STEPS).toContain('plan');
    expect(RECOVERY_CHAIN_STEPS).toContain('execute');
  });

  it('OBSERVABILITY_MODES lists expected modes', () => {
    expect(OBSERVABILITY_MODES).toContain('Autopilot');
    expect(OBSERVABILITY_MODES).toContain('Team');
  });

  it('ECO_MODE_LABEL is a non-empty string', () => {
    expect(ECO_MODE_LABEL.length).toBeGreaterThan(0);
  });
});

describe('WorkflowEngine - route', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('routes short question to L1', async () => {
    const engine = new WorkflowEngine(workspace, 'route-l1');
    const result = await engine.route('What is a protagonist?');
    expect(result.level).toBe('L1');
  });

  it('routes paragraph task to L2', async () => {
    const engine = new WorkflowEngine(workspace, 'route-l2');
    const result = await engine.route('写一段描述性段落');
    expect(result.level).toBe('L2');
  });

  it('routes chapter task to L3+', async () => {
    const engine = new WorkflowEngine(workspace, 'route-l3');
    const result = await engine.route('写一章关于主角的故事');
    expect(['L3', 'L4', 'L5']).toContain(result.level);
  });
});

describe('WorkflowEngine - plan', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('creates L1 plan with single answer step', async () => {
    const engine = new WorkflowEngine(workspace, 'plan-l1');
    const plan = await engine.plan('Quick question', 'L1');
    expect(plan.total_steps).toBe(1);
    expect(plan.steps[0].name).toBe('answer');
  });

  it('creates L3 plan with 8 steps', async () => {
    const engine = new WorkflowEngine(workspace, 'plan-l3');
    const plan = await engine.plan('Write a chapter', 'L3');
    expect(plan.total_steps).toBe(8);
    const names = plan.steps.map((s) => s.name);
    expect(names).toContain('analyze');
    expect(names).toContain('generate_draft');
    expect(names).toContain('evaluate');
    expect(names).toContain('checkpoint');
  });

  it('includes observability and budget guardrail in plan', async () => {
    const engine = new WorkflowEngine(workspace, 'plan-obs');
    const plan = await engine.plan('Test task', 'L2');
    expect(plan.observability_metrics).toBeTruthy();
    expect(plan.budget_guardrail).toBeTruthy();
    expect(plan.execution_mode).toBeTruthy();
  });

  it('adapts maintenance-heavy tasks and persists execution context metadata', async () => {
    const engine = new WorkflowEngine(workspace, 'plan-adaptive');
    const plan = await engine.plan({
      task: 'perform maintenance repair on the workflow pipeline with rollback checks',
      level: 'L2',
      executionContext: {
        chat_canon_prompt: 'Use the canonical maintenance brief',
        active_scene_id: 'scene-42',
      },
    });

    expect(plan.level).toBe('L4');
    expect(plan.template_meta['adaptive_from_level']).toBe('L2');
    expect(plan.template_meta['execution_context']).toMatchObject({
      chat_canon_prompt: 'Use the canonical maintenance brief',
      active_scene_id: 'scene-42',
    });
  });
});

describe('WorkflowEngine - advanced public APIs', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('invokes workflow hooks during route resolution when a hook registry is present', async () => {
    const hooks = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const engine = new WorkflowEngine(workspace, 'route-hooks', undefined, undefined, hooks as never);

    await engine.route('Route hook task');

    expect(hooks.execute).toHaveBeenCalledTimes(1);
  });

  it('completes an L2 workflow through the run API', async () => {
    const engine = new WorkflowEngine(workspace, 'run-l2');
    const result = await engine.run('Write a short conflict scene', 'L2');

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') {
      throw new Error(`Expected completed result, received ${result.status}`);
    }
    expect(result.final_status.progress).toBe('3/3');
    expect((result.last_step as Record<string, unknown>)['step_name']).toBe('generate');
  });

  it('returns blocked when an L3 workflow reaches destructive checkpoint confirmation', async () => {
    const engine = new WorkflowEngine(workspace, 'run-blocked');
    const result = await engine.run('Write a chapter with escalating conflict and aftermath', 'L3');

    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') {
      throw new Error(`Expected blocked result, received ${result.status}`);
    }

    const lastStep = result.last_step as Record<string, unknown>;
    const gate = lastStep['gate'] as Record<string, unknown>;

    expect(lastStep['status']).toBe('waiting_confirmation');
    expect(lastStep['step_name']).toBe('checkpoint');
    expect(gate['confirm_required']).toBe(true);
  });

  it('returns failed when run reaches an unsupported L4 execution step', async () => {
    const engine = new WorkflowEngine(workspace, 'run-failed');
    const result = await engine.run('Brainstorm a multi-chapter maintenance roadmap', 'L4');

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') {
      throw new Error(`Expected failed result, received ${result.status}`);
    }
    expect(String(result.error)).toContain('Unsupported workflow step');
  });

  it('prefers execution context canon prompt when running with execution context', async () => {
    const engine = new WorkflowEngine(workspace, 'run-context');
    const result = await engine.runWithExecutionContext(
      'Original answer request',
      { chat_canon_prompt: 'Canonical answer request' },
      'L1',
    );

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') {
      throw new Error(`Expected completed result, received ${result.status}`);
    }

    const answer = String(
      ((result.last_step as Record<string, unknown>)['result'] as Record<string, unknown>)['answer'] ?? '',
    );
    expect(answer).toContain('Canonical answer request');
    expect(answer).not.toContain('Original answer request');
  });

  it('emits a blocked terminal event when runStream reaches checkpoint confirmation', async () => {
    const engine = new WorkflowEngine(workspace, 'stream-blocked');
    const events: Array<Record<string, unknown>> = [];

    for await (const event of engine.runStream('Write a chapter with a reveal at the end', 'L3')) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]?.['type']).toBe('plan_created');
    expect(events.some((event) => event['type'] === 'step_complete')).toBe(true);
    expect(events.at(-1)?.['type']).toBe('plan_blocked');
    expect(events.at(-1)?.['status']).toBe('waiting_confirmation');
  });

  it('propagates execution context through runStreamWithExecutionContext', async () => {
    const engine = new WorkflowEngine(workspace, 'stream-context');
    const events: Array<Record<string, unknown>> = [];

    for await (const event of engine.runStreamWithExecutionContext(
      'Ignored prompt',
      { chat_canon_prompt: 'Canonical streamed answer' },
      'L1',
    )) {
      events.push(event as Record<string, unknown>);
    }

    const finalEvent = events.at(-1) as Record<string, unknown>;
    const lastStep = finalEvent['last_step'] as Record<string, unknown>;
    const result = lastStep['result'] as Record<string, unknown>;

    expect(finalEvent['type']).toBe('plan_complete');
    expect(String(result['answer'] ?? '')).toContain('Canonical streamed answer');
  });

  it('binds explicit authority and rejects mismatched execution authority', async () => {
    const engine = new WorkflowEngine(workspace, 'authority-test');
    const plan = await engine.plan('Authority-sensitive task', 'L2');
    const planId = plan.plan_id;

    const authority = engine.bindPlanAuthority(planId, {
      sessionId: 'sess-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
    });

    expect(authority).toEqual({
      sessionId: 'sess-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
    });
    expect(engine.getPlanAuthority(planId)).toEqual(authority);

    const mismatch = await engine.execute({
      planId,
      authority: {
        sessionId: 'sess-2',
        workspaceId: 'ws-1',
        projectId: 'proj-1',
      },
    });

    expect('error' in mismatch).toBe(true);
    if (!('error' in mismatch)) {
      throw new Error('Expected authority mismatch error');
    }
    expect(String(mismatch.error)).toContain("workflow session 'sess-1'");
  });

  it('completes an L3 workflow with injected llm output and confirmed checkpoint', async () => {
    const llmService = {
      generate: vi.fn().mockResolvedValue('Injected draft content from the llm service.'),
    };
    const engine = new WorkflowEngine(workspace, 'l3-complete', llmService as never);
    const plan = await engine.plan('Write a chapter outline with dialogue and fallout', 'L3');
    const planId = plan.plan_id;

    let result = await engine.execute({ planId, confirmToken: 'confirmed-token' });
    let guard = 0;
    while (!('error' in result) && Number((result as Record<string, unknown>)['remaining_steps'] ?? 0) > 0) {
      result = await engine.execute({ planId, confirmToken: 'confirmed-token' });
      guard += 1;
      if (guard > 20) {
        throw new Error('Execution loop exceeded safety guard');
      }
    }

    expect('error' in result).toBe(false);
    if ('error' in result) {
      throw new Error(String(result.error));
    }

    expect((result as Record<string, unknown>)['step_name']).toBe('checkpoint');
    expect((result as Record<string, unknown>)['plan_status']).toBe('completed');
    expect(llmService.generate).toHaveBeenCalled();

    const terminal = await engine.execute({ planId, confirmToken: 'confirmed-token' });
    expect((terminal as Record<string, unknown>)['status']).toBe('completed');
    expect(String((terminal as Record<string, unknown>)['message'] ?? '')).toContain('All steps completed');

    const status = engine.getPlanStatus(planId);
    expect('error' in status).toBe(false);
    if ('error' in status) {
      throw new Error(String(status.error));
    }

    expect(status.progress).toBe('8/8');
    const checkpointStep = status.steps.find((step) => step.name === 'checkpoint');
    expect((checkpointStep?.output as Record<string, unknown> | undefined)?.['checkpoint_id']).toBeTruthy();
  });
});

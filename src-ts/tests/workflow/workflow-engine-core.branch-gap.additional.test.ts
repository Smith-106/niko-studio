import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  Checkpoint,
  WorkflowEngine,
  WorkflowPlan,
  WorkflowStep,
} from '../../workflow/workflow-engine-core.js';

function makePlanResult(planId: string): Record<string, unknown> {
  return {
    plan_id: planId,
    level: 'L2',
    template_meta: {},
    gate_decision: 'go',
    recommendations: [],
    recommendations_frozen: false,
    plan_hash: 'hash-1',
    execution_mode: 'Autopilot',
    observability_metrics: {},
    budget_guardrail: {},
    steps: [],
    total_steps: 1,
  };
}

function makePlanStatus(planId: string): Record<string, unknown> {
  return {
    plan_id: planId,
    task: 'fallback task',
    level: 'L2',
    status: 'completed',
    runner_state: 'stopped',
    triage_state: 'open',
    fix_status: 'unfixed',
    fix_owner: '',
    template_meta: {},
    gate_decision: 'go',
    recommendations: [],
    recommendations_frozen: false,
    plan_hash: 'hash-1',
    execution_mode: 'Autopilot',
    observability_metrics: {},
    budget_guardrail: {},
    handoff_package: {},
    steps: [],
    progress: '100%',
  };
}

describe('workflow-engine-core branch gap additional coverage', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-wf-engine-branch-gap-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(workspace, { recursive: true, force: true });
  });

  it('covers static entry api and checkpoint default fallbacks', () => {
    expect(WorkflowEngine.publicEntryApi()).toEqual([
      'route',
      'plan',
      'execute',
      'run',
      'runStream',
    ]);

    const checkpoint = new Checkpoint({
      id: 'checkpoint-defaults',
      description: 'checkpoint defaults',
    });

    expect(checkpoint.commit_hash).toBeNull();
    expect(checkpoint.plan_id).toBeNull();
    expect(checkpoint.step_id).toBeNull();
    expect(checkpoint.replay_payload).toEqual({});
    expect(typeof checkpoint.created_at).toBe('string');
  });

  it('covers plan routing fallback plus template and level fallbacks for unknown adaptive levels', async () => {
    const workflowFallback = new WorkflowEngine('', undefined);
    expect(workflowFallback.bindPlanSession('fallback-plan', '   ')).toBe(
      'workflow--workflow-fallback-plan',
    );

    const engine = new WorkflowEngine(workspace, 'branch-gap-plan') as WorkflowEngine & {
      route: ReturnType<typeof vi.fn>;
    };
    const engineAny = engine as any;

    engine.route = vi.fn().mockResolvedValue({ level: 'L2' });
    engineAny._resolveAdaptiveLevel = vi.fn().mockReturnValue(99);

    const result = await engine.plan({ task: 'Plan through route fallback' } as never);

    expect(engine.route).toHaveBeenCalledWith({ task: 'Plan through route fallback' });
    expect(result.level).toBe('L3');
    expect(result.steps).toHaveLength(3);
    expect(result.template_meta).toMatchObject({
      lane: 'default',
      gate_profile: 'default-soft',
      adaptive_from_level: 'L2',
    });
    expect(result.template_meta).not.toHaveProperty('level');
    expect(engineAny._getWorkflowTemplate(999)).toEqual(engineAny._getWorkflowTemplate(2));
  });

  it('covers route task fallback plus run and stream total-step/status fallbacks', async () => {
    const hooks = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
    const routeEngine = new WorkflowEngine(
      workspace,
      'route-fallback',
      undefined,
      undefined,
      hooks as never,
    );

    const routeResult = await routeEngine.route({} as never);
    expect(hooks.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: '',
      }),
    );
    expect(routeResult.level).toMatch(/^L[1-5]$/);

    const engine = new WorkflowEngine(workspace, 'run-fallback') as WorkflowEngine & {
      plan: ReturnType<typeof vi.fn>;
      execute: ReturnType<typeof vi.fn>;
      getPlanStatus: ReturnType<typeof vi.fn>;
    };

    engine.plan = vi
      .fn()
      .mockResolvedValueOnce({ ...makePlanResult('run-fallback-plan'), total_steps: undefined })
      .mockResolvedValueOnce({ ...makePlanResult('stream-fallback-plan'), total_steps: undefined });
    engine.execute = vi
      .fn()
      .mockResolvedValueOnce({ status: 'completed', remaining_steps: 0, plan_status: 'completed' })
      .mockResolvedValueOnce({ status: 'completed', remaining_steps: 0, plan_status: 'completed' });
    engine.getPlanStatus = vi
      .fn()
      .mockReturnValueOnce(makePlanStatus('run-fallback-plan'))
      .mockReturnValueOnce({ error: undefined });

    const runResult = await engine.run({ task: 'Run fallback task' } as never);
    expect(runResult).toMatchObject({
      status: 'completed',
      plan_id: 'run-fallback-plan',
    });

    const events: Record<string, unknown>[] = [];
    for await (const event of engine.runStream({ task: 'Stream fallback task' } as never)) {
      events.push(event as Record<string, unknown>);
    }

    expect(events[0]).toMatchObject({
      type: 'plan_created',
      plan_id: 'stream-fallback-plan',
    });
    expect(events.at(-1)).toMatchObject({
      type: 'plan_error',
      plan_id: 'stream-fallback-plan',
      error: 'Plan status retrieval failed',
    });
  });

  it('covers lifecycle, persistence, and helper fallbacks for empty metadata branches', async () => {
    const engine = new WorkflowEngine(workspace, 'helper-fallback');
    const engineAny = engine as any;

    const planResult = await engine.plan('Helper fallback task', 'L2');
    const planId = String(planResult.plan_id);
    const plan = engineAny.plans.get(planId) as WorkflowPlan;

    delete plan.template_meta['current_phase'];
    delete plan.template_meta['last_checkpoint_id'];

    expect(engine.bindPlanSession(planId, 'explicit-session')).toBe('explicit-session');
    expect(
      engine.bindPlanAuthority(planId, {
        sessionId: 'explicit-authority',
        workspaceId: 'workspace-fallback',
        projectId: 'project-fallback',
      }),
    ).toMatchObject({
      sessionId: 'explicit-authority',
      workspaceId: 'workspace-fallback',
      projectId: 'project-fallback',
    });

    expect(engine.bindPlanSession('missing-plan', 'manual-session')).toBe('manual-session');
    expect(
      engine.bindPlanAuthority('missing-authority-plan', {
        sessionId: null,
        workspaceId: 'workspace-missing',
        projectId: null,
      }),
    ).toMatchObject({
      workspaceId: 'workspace-missing',
      projectId: null,
    });

    delete plan.template_meta['current_phase'];
    delete plan.template_meta['last_checkpoint_id'];
    const lifecycleStatus = engineAny._lifecycleStatus(plan);
    expect(lifecycleStatus).toMatchObject({
      action: 'status',
      last_checkpoint_id: '',
    });

    engineAny.createCheckpoint = vi.fn().mockResolvedValue({});
    const pauseResult = await engineAny._runLifecycleTransition(plan, 'pause');
    expect(pauseResult).toMatchObject({
      action: 'pause',
      runner_state: 'paused',
    });
    expect((pauseResult as Record<string, unknown>).checkpoint_id).toBeUndefined();

    delete plan.template_meta['current_phase'];
    delete plan.template_meta['last_checkpoint_id'];
    engineAny._restoreCheckpointInternal = vi.fn().mockResolvedValue({ status: 'restored' });
    const rollbackResult = await engine.quickRollback(
      planId,
      'cp-fallback',
      'branch-gap rollback',
    );
    expect(rollbackResult).toMatchObject({
      plan_id: planId,
      checkpoint_id: 'cp-fallback',
      restored: true,
    });

    delete plan.template_meta['last_checkpoint_id'];
    const lifecycleAction = engineAny._buildLifecycleActionResponse(
      plan,
      'resume',
      undefined,
      null,
    );
    expect(lifecycleAction.last_checkpoint_id).toBe('');

    const loadContext = engineAny._runLoadContext(
      new WorkflowPlan({
        id: 'load-context-plan',
        task: 'Load context fallback',
        level: 'L2',
      }),
    );
    expect(loadContext).toMatchObject({
      analysis: {},
      context_loaded: true,
    });

    const llmService = {
      generate: vi.fn().mockResolvedValue({ text: 'structured' }),
    };
    const draftEngine = new WorkflowEngine(workspace, 'draft-fallback', llmService as never);
    const draftEngineAny = draftEngine as any;
    const draftResult = await draftEngineAny._runGenerateDraft(
      new WorkflowPlan({
        id: 'draft-plan',
        task: 'Draft fallback task',
        level: 'L2',
      }),
    );
    expect(draftResult).toMatchObject({
      draft: '[object Object]',
      source_task: 'Draft fallback task',
      section_count: 3,
    });
    expect(llmService.generate).toHaveBeenCalled();

    expect(() =>
      draftEngineAny._runGenerate(
        new WorkflowPlan({
          id: 'generate-plan',
          task: 'Generate fallback task',
          level: 'L2',
        }),
      ),
    ).toThrow();

    const evaluateResult = draftEngineAny._runEvaluate(
      new WorkflowPlan({
        id: 'evaluate-plan',
        task: 'Evaluate fallback task',
        level: 'L2',
      }),
    );
    expect(evaluateResult).toMatchObject({
      score: 60,
      length: 0,
    });

    const reviseResult = draftEngineAny._runRevise(
      new WorkflowPlan({
        id: 'revise-plan',
        task: 'Revise fallback task',
        level: 'L2',
      }),
    );
    expect(reviseResult).toMatchObject({
      revised: true,
      score: 0,
    });
    expect(String(reviseResult.content)).toContain('0');

    const lockResult = await engineAny._withModuleLock('   ', async () => {
      expect(engineAny._moduleOwners.get('default')).toBe('helper-fallback');
      return 'locked';
    });
    expect(lockResult).toBe('locked');

    const overBudgetPlan = new WorkflowPlan({
      id: 'budget-plan',
      task: 'x'.repeat(2500),
      level: 'L2',
      steps: [
        new WorkflowStep({
          id: 'budget-step',
          name: 'analyze',
          description: 'y'.repeat(50),
        }),
      ],
    });
    const budgetGuardrail = engineAny._refreshBudgetGuardrail(overBudgetPlan);
    expect(budgetGuardrail).toMatchObject({
      threshold_triggered: true,
      degraded: true,
      degrade_mode: 'EcoMode',
    });
    expect(overBudgetPlan.template_meta['execution_mode']).toBe('EcoMode');

    const runnerPlan = new WorkflowPlan({
      id: 'runner-plan',
      task: 'Runner fallback task',
      level: 'L2',
    });
    delete runnerPlan.template_meta['current_phase'];
    const sessionLifecycle = engineAny._setRunnerState(
      runnerPlan,
      'running',
      undefined,
      'branch-gap',
    );
    expect(runnerPlan.runner_state).toBe('running');
    expect((sessionLifecycle as Record<string, unknown>).status).toBe('active');

    runnerPlan.fix_status = 'unfixed';
    engineAny._setTriageState(runnerPlan, 'open');
    expect(runnerPlan.fix_status).toBe('unfixed');

    const activePlanResult = await engine.plan('Prepare execution context', 'L2');
    const activePlanId = String(activePlanResult.plan_id);
    const activePlan = engineAny.plans.get(activePlanId) as WorkflowPlan;
    activePlan.status = 'running';
    const preparation = engineAny._prepareExecutionContext(
      activePlanId,
      activePlan.steps[0].id,
      undefined,
      undefined,
    );
    expect(preparation.context.plan.status).toBe('running');
  });

  it('covers created-status execution, rollback status fallback, and high-score evaluation feedback', async () => {
    const engine = new WorkflowEngine(workspace, 'created-running');
    const engineAny = engine as any;

    const activePlanResult = await engine.plan('Created status preparation', 'L2');
    const activePlanId = String(activePlanResult.plan_id);
    const activePlan = engineAny.plans.get(activePlanId) as WorkflowPlan;
    activePlan.status = 'created';
    activePlan.runner_state = 'running';

    const preparation = engineAny._prepareExecutionContext(
      activePlanId,
      activePlan.steps[0].id,
      undefined,
      undefined,
    );
    expect(preparation.context.plan.status).toBe('running');

    const rollbackPlanResult = await engine.plan('Rollback status fallback', 'L2');
    const rollbackPlanId = String(rollbackPlanResult.plan_id);
    const rollbackPlan = engineAny.plans.get(rollbackPlanId) as WorkflowPlan;
    rollbackPlan.status = 'review';
    delete rollbackPlan.template_meta['current_phase'];

    const persistSpy = vi.spyOn(engineAny, '_persistPlanState');
    engineAny._restoreCheckpointInternal = vi.fn().mockResolvedValue({ status: 'restored' });

    await expect(
      engine.quickRollback(rollbackPlanId, 'cp-status-fallback', 'branch-gap quick rollback'),
    ).resolves.toMatchObject({
      plan_id: rollbackPlanId,
      checkpoint_id: 'cp-status-fallback',
      restored: true,
    });
    expect(persistSpy).toHaveBeenCalledWith(rollbackPlan, 'review', 'cp-status-fallback');

    rollbackPlan.template_meta['current_phase'] = 'execution';
    await expect(
      engine.quickRollback(rollbackPlanId, 'cp-phase-preferred', 'branch-gap quick rollback'),
    ).resolves.toMatchObject({
      plan_id: rollbackPlanId,
      checkpoint_id: 'cp-phase-preferred',
      restored: true,
    });
    expect(persistSpy).toHaveBeenCalledWith(rollbackPlan, 'execution', 'cp-phase-preferred');

    const lowScoreResult = engineAny._runEvaluate(
      new WorkflowPlan({
        id: 'evaluate-low-score-plan',
        task: 'Evaluate a short draft',
        level: 'L2',
      }),
    );

    const evaluationPlan = new WorkflowPlan({
      id: 'evaluate-high-score-plan',
      task: 'Evaluate a long draft',
      level: 'L2',
      steps: [new WorkflowStep({ id: 'generate-step', name: 'generate', description: 'Generate' })],
    });
    evaluationPlan.steps[0]!.output = {
      content: 'x'.repeat(140),
    };

    const evaluateResult = engineAny._runEvaluate(evaluationPlan);
    expect(evaluateResult.score).toBeGreaterThanOrEqual(75);
    expect(evaluateResult.feedback).not.toBe(lowScoreResult.feedback);

    const analyzeResult = engineAny._runAnalyze(
      new WorkflowPlan({
        id: 'analyze-chapter-plan',
        task: '写一章新内容',
        level: 'L2',
      }),
    );
    expect(analyzeResult.intent).toBe('chapter_creation');
  });
});

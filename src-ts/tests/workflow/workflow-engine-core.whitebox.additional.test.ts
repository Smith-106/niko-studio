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
import type { IWorkflowStateStore } from '../../workflow/iworkflow-state-store.js';

const openAIProviderCtor = vi.hoisted(() => vi.fn());
const openAIProviderComplete = vi.hoisted(() => vi.fn());

vi.mock('../../knowledge/providers/openai-llm.js', () => ({
  OpenAILLMProvider: vi.fn().mockImplementation(function OpenAILLMProvider(
    this: Record<string, unknown>,
    options: unknown,
  ) {
    openAIProviderCtor(options);
    this.complete = openAIProviderComplete;
  }),
}));

function createMockStore(
  overrides: Partial<IWorkflowStateStore> = {},
): IWorkflowStateStore & Record<string, ReturnType<typeof vi.fn>> {
  return {
    savePlan: vi.fn().mockResolvedValue(undefined),
    loadPlan: vi.fn().mockResolvedValue(null),
    listPlans: vi.fn().mockResolvedValue([]),
    deletePlan: vi.fn().mockResolvedValue(undefined),
    savePlanSession: vi.fn().mockResolvedValue(undefined),
    loadPlanSession: vi.fn().mockResolvedValue(null),
    savePlanAuthority: vi.fn().mockResolvedValue(undefined),
    loadPlanAuthority: vi.fn().mockResolvedValue(null),
    saveCheckpoint: vi.fn().mockResolvedValue(undefined),
    loadCheckpoint: vi.fn().mockResolvedValue(null),
    listCheckpoints: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as IWorkflowStateStore & Record<string, ReturnType<typeof vi.fn>>;
}

function makePlanResult(planId: string): Record<string, unknown> {
  return {
    plan_id: planId,
    level: 'L1',
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

describe('workflow-engine-core whitebox additional coverage', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'niko-wf-engine-whitebox-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    openAIProviderCtor.mockReset();
    openAIProviderComplete.mockReset();
    await rm(workspace, { recursive: true, force: true });
  });

  it('falls back to a generated plan session id and exposes checkpoint lookup', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-bind');
    const plan = await engine.plan('Bind session fallback', 'L2');
    const planId = String(plan.plan_id);

    const fallbackSessionId = engine.bindPlanSession(planId, '   ');

    expect(fallbackSessionId).toContain('whitebox-bind--workflow-');
    expect(engine.getPlanSessionId(planId)).toBe(fallbackSessionId);
    expect(engine.getCheckpoint('missing-checkpoint')).toBeNull();

    const planStatus = engine.getPlanStatus(planId) as Record<string, unknown>;
    const checkpoint = await engine.createCheckpoint('lookup checkpoint', false, planId, 'step-1', {
      plan_id: planId,
      plan_hash: String(planStatus.plan_hash),
      recommendations: [],
      recommendations_frozen: true,
    });

    expect(engine.getCheckpoint(String(checkpoint.checkpoint_id))).toMatchObject({
      id: checkpoint.checkpoint_id,
      description: 'lookup checkpoint',
      plan_id: planId,
      step_id: 'step-1',
    });
  });

  it('returns failed run results when plan creation or final status resolution fails', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-run-failure') as WorkflowEngine & {
      plan: ReturnType<typeof vi.fn>;
      execute: ReturnType<typeof vi.fn>;
      getPlanStatus: ReturnType<typeof vi.fn>;
    };

    engine.plan = vi
      .fn()
      .mockResolvedValueOnce({ ...makePlanResult('missing-id'), plan_id: '' })
      .mockResolvedValueOnce(makePlanResult('blocked-plan'))
      .mockResolvedValueOnce(makePlanResult('completed-plan'));
    engine.execute = vi
      .fn()
      .mockResolvedValueOnce({ status: 'waiting_confirmation' })
      .mockResolvedValueOnce({ status: 'completed', remaining_steps: 0, plan_status: 'completed' });
    engine.getPlanStatus = vi
      .fn()
      .mockReturnValueOnce({ error: 'blocked status missing' })
      .mockReturnValueOnce({ error: 'completed status missing' });

    const missingPlan = await engine.run('missing plan id');
    expect(missingPlan).toMatchObject({
      status: 'failed',
      plan_id: '',
      error: 'Plan creation failed',
    });

    const blockedFailure = await engine.run('blocked plan failure');
    expect(blockedFailure).toMatchObject({
      status: 'failed',
      plan_id: 'blocked-plan',
      error: 'blocked status missing',
    });

    const completedFailure = await engine.run('completed plan failure');
    expect(completedFailure).toMatchObject({
      status: 'failed',
      plan_id: 'completed-plan',
      error: 'completed status missing',
    });
  });

  it('emits stream error events when plan creation, execution, or final status resolution fails', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-stream-failure') as WorkflowEngine & {
      plan: ReturnType<typeof vi.fn>;
      execute: ReturnType<typeof vi.fn>;
      getPlanStatus: ReturnType<typeof vi.fn>;
    };

    engine.plan = vi
      .fn()
      .mockResolvedValueOnce({ ...makePlanResult('missing-id'), plan_id: '' })
      .mockResolvedValueOnce(makePlanResult('execute-error-plan'))
      .mockResolvedValueOnce(makePlanResult('final-status-plan'));
    engine.execute = vi
      .fn()
      .mockResolvedValueOnce({ error: 'stream execution exploded' })
      .mockResolvedValueOnce({ status: 'completed', remaining_steps: 0, plan_status: 'completed' });
    engine.getPlanStatus = vi.fn().mockReturnValueOnce({ error: 'stream final status missing' });

    const missingPlanEvents: Record<string, unknown>[] = [];
    for await (const event of engine.runStream('missing plan stream')) {
      missingPlanEvents.push(event as Record<string, unknown>);
    }
    expect(missingPlanEvents).toHaveLength(1);
    expect(missingPlanEvents[0]).toMatchObject({
      type: 'error',
      status: 'failed',
      error: 'Plan creation failed',
    });

    const executeErrorEvents: Record<string, unknown>[] = [];
    for await (const event of engine.runStream('execute error stream')) {
      executeErrorEvents.push(event as Record<string, unknown>);
    }
    expect(executeErrorEvents.at(-1)).toMatchObject({
      type: 'plan_error',
      plan_id: 'execute-error-plan',
      error: 'stream execution exploded',
    });

    const finalStatusErrorEvents: Record<string, unknown>[] = [];
    for await (const event of engine.runStream('final status error stream')) {
      finalStatusErrorEvents.push(event as Record<string, unknown>);
    }
    expect(finalStatusErrorEvents.at(-1)).toMatchObject({
      type: 'plan_error',
      plan_id: 'final-status-plan',
      error: 'stream final status missing',
    });
  });

  it('returns detailed preparation errors and waiting-confirmation responses from whitebox execution context', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-prepare');
    const engineAny = engine as any;

    const missingPreparation = engineAny._prepareExecutionContext(
      'missing-plan',
      undefined,
      undefined,
      undefined,
    );
    expect(missingPreparation.response).toMatchObject({
      error: "Plan 'missing-plan' not found",
    });

    const stoppedPlan = await engine.plan('Stopped runner task', 'L2');
    const stoppedPlanId = String(stoppedPlan.plan_id);
    const stoppedInternalPlan = engineAny.plans.get(stoppedPlanId);
    stoppedInternalPlan.runner_state = 'stopped';

    const stoppedPreparation = engineAny._prepareExecutionContext(
      stoppedPlanId,
      undefined,
      undefined,
      undefined,
    );
    expect(stoppedPreparation.response).toMatchObject({ error: 'Loop runner is stopped' });

    const completedPlan = await engine.plan('Completed runner task', 'L2');
    const completedPlanId = String(completedPlan.plan_id);
    const completedInternalPlan = engineAny.plans.get(completedPlanId);
    completedInternalPlan.steps.forEach((step: WorkflowStep) => {
      step.status = 'done';
    });

    const completedPreparation = engineAny._prepareExecutionContext(
      completedPlanId,
      undefined,
      undefined,
      undefined,
    );
    expect(completedPreparation.response).toMatchObject({
      status: 'completed',
      message: 'All steps completed',
    });

    const dependencyPlan = await engine.plan('Dependency runner task', 'L2');
    const dependencyPlanId = String(dependencyPlan.plan_id);
    const dependencyInternalPlan = engineAny.plans.get(dependencyPlanId);
    const secondStep = dependencyInternalPlan.steps[1];

    const invalidStepPreparation = engineAny._prepareExecutionContext(
      dependencyPlanId,
      'missing-step',
      undefined,
      undefined,
    );
    expect(invalidStepPreparation.response).toMatchObject({
      error: "Step 'missing-step' not found",
    });

    const dependencyPreparation = engineAny._prepareExecutionContext(
      dependencyPlanId,
      secondStep.id,
      undefined,
      undefined,
    );
    expect(dependencyPreparation.response.error).toBe(
      `Dependency '${dependencyInternalPlan.steps[0].id}' not completed`,
    );

    const checkpointPlan = await engine.plan('Checkpoint confirmation task', 'L3');
    const checkpointPlanId = String(checkpointPlan.plan_id);
    const checkpointInternalPlan = engineAny.plans.get(checkpointPlanId);
    checkpointInternalPlan.steps.slice(0, -1).forEach((step: WorkflowStep) => {
      step.status = 'done';
    });

    const waitingPreparation = engineAny._prepareExecutionContext(
      checkpointPlanId,
      checkpointInternalPlan.steps.at(-1).id,
      undefined,
      undefined,
    );
    expect(waitingPreparation.response).toMatchObject({
      status: 'waiting_confirmation',
      step_name: 'checkpoint',
    });

    const readyPlan = await engine.plan('Ready runner task', 'L2');
    const readyPlanId = String(readyPlan.plan_id);
    const readyInternalPlan = engineAny.plans.get(readyPlanId);
    readyInternalPlan.status = 'created';
    const readyPreparation = engineAny._prepareExecutionContext(
      readyPlanId,
      readyInternalPlan.steps[0].id,
      [{ action: 'overwrite selected scene' }],
      'approved-token',
    );

    expect(readyPreparation.context.step.id).toBe(readyInternalPlan.steps[0].id);
    expect(readyPreparation.context.plan.runner_state).toBe('running');
    expect(readyPreparation.context.plan.status).toBe('running');
    expect(readyPreparation.context.plan.recommendations_frozen).toBe(true);
    expect(readyPreparation.context.plan.recommendations).toHaveLength(1);
    expect(readyPreparation.context.plan.recommendations[0]).toMatchObject({
      action: 'overwrite selected scene',
    });
  });

  it('executes after-step hooks, phase gate transitions, and draft provider fallbacks', async () => {
    const hooks = {
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
    const phaseOrch = {
      advance: vi.fn().mockReturnValue({
        success: false,
        gateReasons: ['needs sign-off'],
        forcedComplete: false,
      }),
    };
    const llmService = {
      generate: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const engine = new WorkflowEngine(
      workspace,
      'whitebox-hooks',
      llmService as never,
      undefined,
      hooks as never,
      phaseOrch as never,
    );
    const engineAny = engine as any;
    const plan = await engine.plan('Draft with provider fallback', 'L3');
    const internalPlan = engineAny.plans.get(String(plan.plan_id));

    const analyzeStep = internalPlan.steps.find((step: WorkflowStep) => step.name === 'analyze');
    if (!analyzeStep) {
      throw new Error('Expected analyze step to exist');
    }
    await engineAny._executeStep(internalPlan, analyzeStep);
    expect(hooks.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        content: 'Draft with provider fallback',
        metadata: expect.objectContaining({
          stepName: 'analyze',
        }),
      }),
    );

    const draftStep = internalPlan.steps.find((step: WorkflowStep) => step.name === 'generate_draft');
    if (!draftStep) {
      throw new Error('Expected generate_draft step to exist');
    }
    internalPlan.steps.find((step: WorkflowStep) => step.name === 'plan_structure')!.output = {
      structure: ['Opening', 'Conflict'],
    };

    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    openAIProviderComplete
      .mockResolvedValueOnce({ content: ' provider draft ' })
      .mockRejectedValueOnce(new Error('provider failed'));

    const providerDraft = await engineAny._executeStep(internalPlan, draftStep);
    expect(providerDraft).toMatchObject({
      draft: 'provider draft',
      section_count: 2,
      source_task: 'Draft with provider fallback',
    });
    expect(openAIProviderCtor).toHaveBeenCalledWith({
      apiKey: 'test-openai-key',
      baseUrl: null,
    });

    const stubDraft = await engineAny._runGenerateDraft(internalPlan);
    expect(stubDraft).toMatchObject({
      section_count: 2,
      source_task: 'Draft with provider fallback',
    });
    expect(String(stubDraft.draft)).toContain('1. Opening');
    expect(llmService.generate).toHaveBeenCalledTimes(2);

    const evaluateStep = internalPlan.steps.find((step: WorkflowStep) => step.name === 'evaluate');
    if (!evaluateStep) {
      throw new Error('Expected evaluate step to exist');
    }
    await engineAny._executeStep(internalPlan, evaluateStep);
    expect(phaseOrch.advance).toHaveBeenCalledWith(
      expect.objectContaining({
        review: expect.objectContaining({
          findings_count: expect.any(Number),
        }),
      }),
    );
  });

  it('runs whitebox execution steps through success and failure transitions', async () => {
    const successEngine = new WorkflowEngine(workspace, 'whitebox-exec-success');
    const successAny = successEngine as any;
    const successPlan = await successEngine.plan('Run success task', 'L2');
    const successPlanId = String(successPlan.plan_id);
    const successInternalPlan = successAny.plans.get(successPlanId);
    const successStep = successInternalPlan.steps[0];

    successAny._executeStep = vi.fn().mockResolvedValue({ ok: true });

    const successResult = await successAny._runExecutionStep({
      plan: successInternalPlan,
      step: successStep,
      gate: {
        decision: 'go',
        reason: 'ready',
        risk: 'low',
        blocking: false,
        destructive: false,
        confirm_required: false,
        confirmed: true,
      },
      preflightObservability: { aggregate: { covered: true } },
      preflightBudgetGuardrail: { token_budget: 1 },
      preflightExecutionMode: 'Autopilot',
    });

    expect(successResult).toMatchObject({
      status: 'completed',
      step_name: successStep.name,
    });
    expect(successStep.status).toBe('done');

    const failureEngine = new WorkflowEngine(workspace, 'whitebox-exec-failure');
    const failureAny = failureEngine as any;
    const failurePlan = await failureEngine.plan('Run failure task', 'L2');
    const failurePlanId = String(failurePlan.plan_id);
    const failureInternalPlan = failureAny.plans.get(failurePlanId);
    const failureStep = failureInternalPlan.steps[0];

    failureAny._executeStep = vi.fn().mockRejectedValue(new Error('execution exploded'));

    const failureResult = await failureAny._runExecutionStep({
      plan: failureInternalPlan,
      step: failureStep,
      gate: {
        decision: 'go',
        reason: 'ready',
        risk: 'low',
        blocking: false,
        destructive: false,
        confirm_required: false,
        confirmed: true,
      },
      preflightObservability: { aggregate: { covered: true } },
      preflightBudgetGuardrail: { token_budget: 1 },
      preflightExecutionMode: 'Autopilot',
    });

    expect(failureResult).toMatchObject({
      error: 'Error: execution exploded',
      step_id: failureStep.id,
    });
    expect(failureStep.status).toBe('failed');
  });

  it('applies triage transitions through lifecycle pause and successful quick rollback restores', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-lifecycle');
    const plan = await engine.plan('Lifecycle and rollback task', 'L3');
    const planId = String(plan.plan_id);

    const pauseResult = await engine.lifecycle(planId, 'pause', 'in_progress');
    expect(pauseResult).toMatchObject({
      runner_state: 'paused',
      triage_state: 'in_progress',
      fix_status: 'in_progress',
      fix_owner: planId,
    });

    const planStatus = engine.getPlanStatus(planId) as Record<string, unknown>;
    const checkpoint = await engine.createCheckpoint('rollback checkpoint', false, planId, undefined, {
      plan_id: planId,
      plan_hash: String(planStatus.plan_hash),
      recommendations: [],
      recommendations_frozen: true,
    });

    const rollbackResult = await engine.quickRollback(
      planId,
      String(checkpoint.checkpoint_id),
      'whitebox rollback',
    );
    expect(rollbackResult).toMatchObject({
      plan_id: planId,
      checkpoint_id: checkpoint.checkpoint_id,
      restored: true,
    });

    const updatedStatus = engine.getPlanStatus(planId) as Record<string, unknown>;
    expect((updatedStatus.template_meta as Record<string, unknown>).last_checkpoint_id).toBe(
      checkpoint.checkpoint_id,
    );
  });

  it('returns managed-plan errors for lifecycle and quick rollback, and clears module lock sentinels', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-managed-errors');
    const engineAny = engine as any;

    await expect(engine.lifecycle('missing-plan', 'status')).resolves.toMatchObject({
      error: "Plan 'missing-plan' not found",
    });
    await expect(engine.quickRollback('missing-plan', 'cp-missing', 'no-op')).resolves.toMatchObject({
      error: "Plan 'missing-plan' not found",
      checkpoint_id: 'cp-missing',
    });

    const thenable = {
      then(onFulfilled: () => unknown) {
        return Promise.resolve(onFulfilled());
      },
    };
    engineAny._moduleLocks.set('sentinel', thenable);

    const lockedResult = await engineAny._withModuleLock('sentinel', async () => {
      expect(engineAny._moduleOwners.get('sentinel')).toBe('whitebox-managed-errors');
      return 'sentinel-cleared';
    });

    expect(lockedResult).toBe('sentinel-cleared');
    expect(engineAny._moduleOwners.has('sentinel')).toBe(false);
    expect(engineAny._moduleLocks.has('sentinel')).toBe(false);
  });

  it('covers destructive-step detection, replay application, and gate input derivation', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-risk');
    const engineAny = engine as any;
    const plan = await engine.plan('Risk task', 'L3');
    const planId = String(plan.plan_id);
    const internalPlan = engineAny.plans.get(planId);

    expect(
      engineAny._isDestructiveStep(
        new WorkflowStep({ id: 'custom', name: 'custom', description: 'custom' }),
        [{ action: 'overwrite current scene' }],
      ),
    ).toBe(true);

    const appliedReplay = engineAny._applyReplayPayload(
      new Checkpoint({
        id: 'cp-apply',
        description: 'apply replay',
        plan_id: planId,
        replay_payload: {
          plan_id: planId,
          plan_hash: internalPlan.plan_hash,
          recommendations: [{ action: 'focus dialogue' }],
          recommendations_frozen: false,
        },
      }),
    );

    expect(appliedReplay).toMatchObject({
      applied: true,
      plan_id: planId,
      recommendation_count: 1,
    });

    const evaluateStep = internalPlan.steps.find((step: WorkflowStep) => step.name === 'evaluate');
    if (!evaluateStep) {
      throw new Error('Expected evaluate step to exist');
    }
    evaluateStep.output = { decision: 'soft_go', feedback: 'needs polish', score: 82 };

    expect(engineAny._buildGateInput(internalPlan)).toEqual({
      review: {
        verdict: 'soft_go',
        findings_count: 3,
      },
    });
  });

  it('hydrates and flushes workflow state through an injected store', async () => {
    const storedPlan = new WorkflowPlan({
      id: 'stored-plan',
      task: 'Stored workflow task',
      level: 'L2',
      steps: [new WorkflowStep({ id: 'stored-step', name: 'analyze', description: 'Analyze' })],
    });
    storedPlan.status = 'running';
    storedPlan.runner_state = 'paused';

    const store = createMockStore({
      listPlans: vi.fn().mockResolvedValue([storedPlan]),
      loadPlanSession: vi.fn().mockResolvedValue('stored-session-1'),
      loadPlanAuthority: vi.fn().mockResolvedValue({
        sessionId: 'stored-session-1',
        workspaceId: 'ws-1',
        projectId: 'proj-1',
      }),
    });

    const engine = new WorkflowEngine(workspace, 'whitebox-store', undefined, store);

    expect(engine.getStateStore()).toBe(store);

    await engine.hydrateFromStore();

    const status = engine.getPlanStatus('stored-plan');
    expect('error' in status).toBe(false);
    if ('error' in status) {
      throw new Error(status.error);
    }
    expect(engine.getPlanSessionId('stored-plan')).toBe('stored-session-1');
    expect(engine.getPlanAuthority('stored-plan')).toMatchObject({
      sessionId: 'stored-session-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
    });

    await engine.flushToStore();

    expect(store.savePlan).toHaveBeenCalledWith(expect.objectContaining({ id: 'stored-plan' }));
    expect(store.listPlans).toHaveBeenCalledTimes(1);
    expect(store.loadPlanSession).toHaveBeenCalledWith('stored-plan');
    expect(store.loadPlanAuthority).toHaveBeenCalledWith('stored-plan');
  });

  it('swallows state-store save rejections during fire-and-forget plan sync', async () => {
    const store = createMockStore({
      savePlan: vi.fn().mockRejectedValue(new Error('store write failed')),
    });
    const engine = new WorkflowEngine(workspace, 'whitebox-store-rejection', undefined, store);
    const plan = new WorkflowPlan({
      id: 'save-plan',
      task: 'Save plan task',
      level: 'L1',
    });

    expect(() => (engine as any)._syncPlanToStore(plan)).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    expect(store.savePlan).toHaveBeenCalledWith(plan);
  });

  it('uses session-id fallback callbacks when persisted authority has no session id', async () => {
    const engine = new WorkflowEngine(workspace, 'whitebox-authority-fallback');
    const engineAny = engine as any;
    const planResult = await engine.plan('Authority fallback task', 'L2');
    const planId = String(planResult.plan_id);
    const plan = engineAny.plans.get(planId);

    engineAny.planAuthorities.set(planId, {
      sessionId: null,
      workspaceId: 'workspace-fallback',
      projectId: null,
    });

    const lifecycle = engineAny._persistPlanState(plan, 'review', 'checkpoint-1');
    const resume = engineAny._stateResumeMetadata(plan);

    expect(lifecycle).toMatchObject({
      status: 'active',
    });
    expect(plan.template_meta.session_id).toBe(
      `whitebox-authority-fallback--workflow-${planId}`,
    );
    expect(resume.workspace_authority).toMatchObject({
      session_id: `whitebox-authority-fallback--workflow-${planId}`,
      workspace_id: 'workspace-fallback',
      project_id: null,
    });
  });

  it('covers helper fallbacks for namespace sanitization, draft generation, and gate derivation', async () => {
    const namespaceEngine = new WorkflowEngine(workspace, '!!!');
    const namespaceAny = namespaceEngine as any;
    const namespacePlan = await namespaceEngine.plan('Namespace fallback task', 'L2');
    const namespacePlanId = String(namespacePlan.plan_id);
    const namespaceInternalPlan = namespaceAny.plans.get(namespacePlanId);

    expect(namespaceEngine.bindPlanSession(namespacePlanId, '   ')).toBe(
      `workflow--workflow-${namespacePlanId}`,
    );

    delete namespaceInternalPlan.template_meta['current_phase'];
    delete namespaceInternalPlan.template_meta['last_checkpoint_id'];
    await expect(namespaceEngine.lifecycle(namespacePlanId, 'status')).resolves.toMatchObject({
      runner_state: namespaceInternalPlan.runner_state,
    });

    const llmService = {
      generate: vi.fn().mockResolvedValue('   '),
    };
    const helperEngine = new WorkflowEngine(workspace, 'whitebox-helper-fallbacks', llmService as never);
    const helperAny = helperEngine as any;
    const helperPlanResult = await helperEngine.plan('普通场景任务', 'L2');
    const helperPlanId = String(helperPlanResult.plan_id);
    const helperPlan = helperAny.plans.get(helperPlanId);

    helperPlan.template_meta['execution_context'] = {
      chat_canon_prompt: '   ',
    };
    expect(helperAny._getExecutionTask(helperPlan)).toBe('普通场景任务');
    helperPlan.template_meta['execution_context'] = {
      chat_canon_prompt: '规范提示词',
    };
    expect(helperAny._getExecutionTask(helperPlan)).toBe('规范提示词');
    helperPlan.template_meta['execution_context'] = {
      chat_canon_prompt: '   ',
    };

    const defaultSkillMatch = helperAny._runMatchSkills(
      new WorkflowPlan({ id: 'skill-default', task: '普通场景', level: 'L2' }),
    );
    expect(defaultSkillMatch).toEqual({
      skills: ['scene-builder'],
      skill_count: 1,
    });

    const keywordSkillMatch = helperAny._runMatchSkills(
      new WorkflowPlan({ id: 'skill-keywords', task: '人物对话冲突', level: 'L2' }),
    );
    expect(keywordSkillMatch).toEqual({
      skills: ['dialogue-system', 'character-forge', 'suspense-builder'],
      skill_count: 3,
    });

    expect(
      helperAny._runPlanStructure(
        new WorkflowPlan({ id: 'plan-dialogue', task: '对话润色', level: 'L2' }),
      ).section_count,
    ).toBe(5);
    expect(
      helperAny._runPlanStructure(
        new WorkflowPlan({ id: 'plan-outline', task: '大纲重构', level: 'L2' }),
      ).section_count,
    ).toBe(5);
    expect(
      helperAny._runPlanStructure(
        new WorkflowPlan({ id: 'plan-default', task: '普通场景', level: 'L2' }),
      ).section_count,
    ).toBe(5);

    const matchSkillsStep = helperPlan.steps.find((step: WorkflowStep) => step.name === 'match_skills');
    if (!matchSkillsStep) {
      throw new Error('Expected match_skills step to exist');
    }
    matchSkillsStep.output = { skills: [] };
    expect(helperAny._runGenerate(helperPlan)).toMatchObject({
      task: '普通场景任务',
    });
    expect(String(helperAny._runGenerate(helperPlan).content)).toContain('scene-builder');

    const draftResult = await helperAny._runGenerateDraft(helperPlan);
    expect(draftResult).toMatchObject({
      source_task: '普通场景任务',
      section_count: 3,
    });
    expect(String(draftResult.draft)).toContain('1. ');
    expect(llmService.generate).toHaveBeenCalled();

    const generateStep = helperPlan.steps.find((step: WorkflowStep) => step.name === 'generate');
    if (!generateStep) {
      throw new Error('Expected generate step to exist');
    }
    generateStep.output = { content: 'tiny' };
    const evaluateResult = helperAny._runEvaluate(helperPlan);
    expect(evaluateResult.score).toBeLessThan(75);

    const gatePlan = new WorkflowPlan({
      id: 'gate-plan',
      task: 'Gate task',
      level: 'L2',
      steps: [new WorkflowStep({ id: 'gate-evaluate', name: 'evaluate', description: 'Evaluate' })],
    });
    gatePlan.steps[0]!.output = { decision: 'soft_go' };
    expect(helperAny._buildGateInput(gatePlan)).toEqual({
      review: {
        verdict: 'soft_go',
        findings_count: 1,
      },
    });

    expect(helperAny._levelFromLabel('L9')).toBe(3);

    await expect(helperEngine.hydrateFromStore()).resolves.toBeUndefined();
    await expect(helperEngine.flushToStore()).resolves.toBeUndefined();
  });
});

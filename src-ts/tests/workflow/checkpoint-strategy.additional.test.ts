import { describe, expect, it, vi } from 'vitest';

import { WorkflowDecision } from '../../workflow/types';
import {
  type WorkflowCheckpointPlanLike,
  type WorkflowCheckpointRecordLike,
  DefaultWorkflowCheckpointStrategy,
} from '../../workflow/strategies/checkpoint-strategy';

type TestPlan = WorkflowCheckpointPlanLike & {
  id: string;
};

type TestCheckpoint = WorkflowCheckpointRecordLike;

function createHarness() {
  const checkpoints = new Map<string, TestCheckpoint>();
  const plans = new Map<string, TestPlan>();
  let idCounter = 0;

  const execFileAsync = vi.fn<
    (
      file: string,
      args: readonly string[],
      options?: Record<string, unknown>,
    ) => Promise<{ stdout: string; stderr?: string }>
  >();
  const createId = vi.fn(() => `cp-${++idCounter}`);
  const withContract = vi.fn(<T extends Record<string, unknown>>(payload: T) => payload);
  const hasValidConfirmToken = vi.fn(
    (confirmToken: string | null | undefined) => confirmToken === 'approved-token',
  );
  const canonicalizeRecommendations = vi.fn((recommendations?: unknown[]) =>
    (recommendations ?? []).map((item, index) => ({
      index,
      ...(item as Record<string, unknown>),
    })),
  );
  const computePlanHash = vi.fn(
    (plan: TestPlan) => `${plan.id}:${plan.status}:${plan.recommendations.length}`,
  );
  const persistPlanState = vi.fn(
    (plan: TestPlan, currentPhase?: string | null, checkpointId?: string) => ({
      planId: plan.id,
      currentPhase: currentPhase ?? null,
      checkpointId: checkpointId ?? null,
    }),
  );
  const createCheckpointRecord = vi.fn(
    (data: {
      id: string;
      description: string;
      commit_hash?: string | null;
      plan_id?: string | null;
      step_id?: string | null;
      replay_payload?: Record<string, unknown>;
    }): TestCheckpoint => ({
      id: data.id,
      description: data.description,
      commit_hash: data.commit_hash ?? null,
      plan_id: data.plan_id ?? null,
      step_id: data.step_id ?? null,
      replay_payload: data.replay_payload ?? {},
      created_at: `2026-06-05T00:00:0${idCounter}.000Z`,
    }),
  );

  const strategy = new DefaultWorkflowCheckpointStrategy<TestPlan, TestCheckpoint>(
    {
      workspace: 'C:/workspace',
      checkpoints,
      plans,
      execFileAsync,
      createId,
      createCheckpointRecord,
      withContract,
      hasValidConfirmToken,
      canonicalizeRecommendations,
      computePlanHash,
      persistPlanState,
    },
  );

  return {
    strategy,
    checkpoints,
    plans,
    execFileAsync,
    createId,
    createCheckpointRecord,
    withContract,
    hasValidConfirmToken,
    canonicalizeRecommendations,
    computePlanHash,
    persistPlanState,
  };
}

describe('workflow/checkpoint-strategy additional coverage', () => {
  it('creates checkpoints with git metadata, cloned replay payloads, and persisted plan state', async () => {
    const harness = createHarness();
    const replayPayload = {
      plan_id: 'plan-1',
      plan_hash: 'plan-1:ready:1',
      recommendations: [{ title: 'keep' }],
      recommendations_frozen: false,
      nested: { value: 1 },
    };
    harness.plans.set('plan-1', {
      id: 'plan-1',
      status: 'ready',
      template_meta: {},
      recommendations: [{ title: 'draft' }],
      recommendations_frozen: true,
      plan_hash: 'stale',
    });
    harness.execFileAsync
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: 'committed\n' })
      .mockResolvedValueOnce({ stdout: 'abc123\n' });

    const checkpoint = await harness.strategy.createCheckpoint(
      'save state',
      true,
      'plan-1',
      'step-1',
      replayPayload,
    );
    replayPayload.nested.value = 99;

    expect(checkpoint).toMatchObject({
      checkpoint_id: 'cp-1',
      commit_hash: 'abc123',
      description: 'save state',
      plan_id: 'plan-1',
      step_id: 'step-1',
    });
    expect(harness.execFileAsync).toHaveBeenNthCalledWith(
      1,
      'git',
      ['add', 'C:/workspace'],
      { cwd: 'C:/workspace' },
    );
    expect(harness.execFileAsync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '-m', '[checkpoint:cp-1] save state'],
      { cwd: 'C:/workspace' },
    );
    expect(harness.execFileAsync).toHaveBeenNthCalledWith(
      3,
      'git',
      ['rev-parse', 'HEAD'],
      { cwd: 'C:/workspace' },
    );
    expect(harness.persistPlanState).toHaveBeenCalledWith(
      harness.plans.get('plan-1'),
      undefined,
      'cp-1',
    );
    expect(harness.checkpoints.get('cp-1')?.replay_payload).toMatchObject({
      nested: { value: 1 },
    });
  });

  it('swallows git failures, supports list/get views, and skips plan persistence when absent', async () => {
    const harness = createHarness();
    harness.execFileAsync.mockRejectedValueOnce(new Error('git unavailable'));

    const first = await harness.strategy.createCheckpoint('first', true);
    const second = await harness.strategy.createCheckpoint('second', false);
    const listed = await harness.strategy.listCheckpoints(1);

    expect(first).toMatchObject({
      checkpoint_id: 'cp-1',
      commit_hash: null,
    });
    expect(second).toMatchObject({
      checkpoint_id: 'cp-2',
      commit_hash: null,
    });
    expect(harness.persistPlanState).not.toHaveBeenCalled();
    expect(listed).toEqual([
      {
        id: 'cp-2',
        description: 'second',
        commit_hash: null,
        created_at: '2026-06-05T00:00:02.000Z',
      },
    ]);
    expect(harness.strategy.getCheckpoint('cp-2')).toEqual({
      id: 'cp-2',
      description: 'second',
      commit_hash: null,
      created_at: '2026-06-05T00:00:02.000Z',
      plan_id: null,
      step_id: null,
      replay_payload: {},
    });
    expect(harness.strategy.getCheckpoint('missing')).toBeNull();
  });

  it('guards destructive restores and handles git-backed restore success and failure', async () => {
    const harness = createHarness();
    harness.checkpoints.set('cp-wait', {
      id: 'cp-wait',
      description: 'destructive',
      commit_hash: null,
      plan_id: 'plan-1',
      step_id: 'step-7',
      replay_payload: { plan_id: 'plan-1', plan_hash: 'abc' },
      created_at: '2026-06-05T00:00:00.000Z',
    });
    harness.checkpoints.set('cp-git-ok', {
      id: 'cp-git-ok',
      description: 'git ok',
      commit_hash: 'deadbeef',
      plan_id: null,
      step_id: null,
      replay_payload: {},
      created_at: '2026-06-05T00:00:01.000Z',
    });
    harness.checkpoints.set('cp-git-fail', {
      id: 'cp-git-fail',
      description: 'git fail',
      commit_hash: 'badcafe',
      plan_id: null,
      step_id: null,
      replay_payload: {},
      created_at: '2026-06-05T00:00:02.000Z',
    });
    harness.execFileAsync
      .mockResolvedValueOnce({ stdout: '' })
      .mockRejectedValueOnce(new Error('checkout failed'));

    const waiting = await harness.strategy.restoreCheckpointInternal('cp-wait');
    const restored = await harness.strategy.restoreCheckpointInternal(
      'cp-git-ok',
      'approved-token',
    );
    const failed = await harness.strategy.restoreCheckpointInternal(
      'cp-git-fail',
      'approved-token',
    );

    expect(waiting).toEqual({
      status: 'waiting_confirmation',
      error: 'destructive restore requires secondary confirmation',
      checkpoint_id: 'cp-wait',
      plan_id: 'plan-1',
      step_id: 'step-7',
      gate: {
        decision: WorkflowDecision.NO_GO,
        reason: 'destructive restore requires secondary confirmation',
        blocking: true,
      },
    });
    expect(restored).toEqual({
      status: 'restored',
      checkpoint_id: 'cp-git-ok',
      commit_hash: 'deadbeef',
      plan_id: null,
      step_id: null,
      replay: {
        applied: false,
        reason: 'no_replay_payload',
      },
    });
    expect(failed).toEqual({
      error: 'Git restore failed: Error: checkout failed',
      replay: {
        applied: false,
        reason: 'no_replay_payload',
      },
    });
  });

  it('covers missing checkpoint and all replay-payload resolution branches', async () => {
    const harness = createHarness();
    harness.plans.set('plan-1', {
      id: 'plan-1',
      status: 'ready',
      template_meta: {},
      recommendations: [{ title: 'old' }],
      recommendations_frozen: true,
      plan_hash: 'old-hash',
    });

    const noPayload = harness.strategy.applyReplayPayload({
      id: 'cp-empty',
      description: 'empty',
      commit_hash: null,
      plan_id: null,
      step_id: null,
      replay_payload: {},
      created_at: '2026-06-05T00:00:00.000Z',
    });
    const noPlanId = harness.strategy.applyReplayPayload({
      id: 'cp-no-plan',
      description: 'no plan',
      commit_hash: null,
      plan_id: null,
      step_id: null,
      replay_payload: { plan_hash: 'abc' },
      created_at: '2026-06-05T00:00:01.000Z',
    });
    const planMissing = harness.strategy.applyReplayPayload({
      id: 'cp-plan-missing',
      description: 'missing plan',
      commit_hash: null,
      plan_id: null,
      step_id: null,
      replay_payload: { plan_id: 'ghost', plan_hash: 'ghost-hash' },
      created_at: '2026-06-05T00:00:02.000Z',
    });
    const missingHash = harness.strategy.applyReplayPayload({
      id: 'cp-missing-hash',
      description: 'missing hash',
      commit_hash: null,
      plan_id: 'plan-1',
      step_id: null,
      replay_payload: { plan_id: 'plan-1', plan_hash: '   ' },
      created_at: '2026-06-05T00:00:03.000Z',
    });
    const mismatch = harness.strategy.applyReplayPayload({
      id: 'cp-mismatch',
      description: 'mismatch',
      commit_hash: null,
      plan_id: 'plan-1',
      step_id: null,
      replay_payload: { plan_id: 'plan-1', plan_hash: 'unexpected' },
      created_at: '2026-06-05T00:00:04.000Z',
    });
    const applied = harness.strategy.applyReplayPayload({
      id: 'cp-applied',
      description: 'applied',
      commit_hash: null,
      plan_id: 'plan-1',
      step_id: null,
      replay_payload: {
        plan_id: 'plan-1',
        plan_hash: 'plan-1:ready:1',
        recommendations: [{ title: 'new' }],
        recommendations_frozen: false,
      },
      created_at: '2026-06-05T00:00:05.000Z',
    });
    const restoredNoCommit = await harness.strategy.restoreCheckpointInternal(
      'missing',
      'approved-token',
    );

    expect(noPayload).toEqual({ applied: false, reason: 'no_replay_payload' });
    expect(noPlanId).toEqual({ applied: false, reason: 'no_plan_id' });
    expect(planMissing).toEqual({
      applied: false,
      reason: 'plan_not_found:ghost',
    });
    expect(missingHash).toEqual({
      applied: false,
      reason: 'missing_plan_hash',
    });
    expect(mismatch).toEqual({
      applied: false,
      reason: 'plan_hash_mismatch',
      expected_plan_hash: 'unexpected',
      current_plan_hash: 'plan-1:ready:1',
    });
    expect(applied).toEqual({
      applied: true,
      plan_id: 'plan-1',
      plan_hash: 'plan-1:ready:1',
      recommendation_count: 1,
    });
    expect(harness.plans.get('plan-1')).toMatchObject({
      recommendations: [{ index: 0, title: 'new' }],
      recommendations_frozen: false,
      plan_hash: 'plan-1:ready:1',
    });
    expect(restoredNoCommit).toEqual({
      error: "Checkpoint 'missing' not found",
    });
  });

  it('returns a contract-wrapped restore when replay succeeds without a commit hash', async () => {
    const harness = createHarness();
    harness.plans.set('plan-9', {
      id: 'plan-9',
      status: 'stable',
      template_meta: {},
      recommendations: [{ title: 'keep' }],
      recommendations_frozen: true,
      plan_hash: 'plan-9:stable:1',
    });
    harness.checkpoints.set('cp-replay', {
      id: 'cp-replay',
      description: 'replay only',
      commit_hash: null,
      plan_id: 'plan-9',
      step_id: 'step-9',
      replay_payload: {
        plan_id: 'plan-9',
        plan_hash: 'plan-9:stable:1',
        recommendations: [{ title: 'fresh' }],
        recommendations_frozen: true,
      },
      created_at: '2026-06-05T00:00:09.000Z',
    });

    const restored = await harness.strategy.restoreCheckpointInternal(
      'cp-replay',
      'approved-token',
    );

    expect(restored).toEqual({
      status: 'restored',
      checkpoint_id: 'cp-replay',
      commit_hash: null,
      plan_id: 'plan-9',
      step_id: 'step-9',
      replay: {
        applied: true,
        plan_id: 'plan-9',
        plan_hash: 'plan-9:stable:1',
        recommendation_count: 1,
      },
    });
    expect(harness.withContract).toHaveBeenCalled();
  });
});

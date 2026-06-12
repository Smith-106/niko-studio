import { describe, expect, it, vi } from 'vitest';

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
      created_at: `2026-06-09T00:00:0${idCounter}.000Z`,
    }),
  );

  const strategy = new DefaultWorkflowCheckpointStrategy<TestPlan, TestCheckpoint>({
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
  });

  return {
    strategy,
    checkpoints,
    plans,
    execFileAsync,
  };
}

describe('workflow/checkpoint-strategy branch-gap coverage', () => {
  it('uses the default auto-checkpoint description in git commits', async () => {
    const harness = createHarness();
    harness.execFileAsync
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: 'committed\n' })
      .mockResolvedValueOnce({ stdout: 'abc123\n' });

    await harness.strategy.createCheckpoint('', true);

    expect(harness.execFileAsync).toHaveBeenNthCalledWith(
      2,
      'git',
      ['commit', '-m', '[checkpoint:cp-1] Auto checkpoint'],
      { cwd: 'C:/workspace' },
    );
  });

  it('falls back to an empty replay payload when a checkpoint record omits it', () => {
    const harness = createHarness();
    harness.checkpoints.set('cp-null-replay', {
      id: 'cp-null-replay',
      description: 'no replay payload',
      commit_hash: null,
      plan_id: null,
      step_id: null,
      replay_payload: undefined as unknown as Record<string, unknown>,
      created_at: '2026-06-09T00:00:01.000Z',
    });

    expect(harness.strategy.getCheckpoint('cp-null-replay')).toEqual({
      id: 'cp-null-replay',
      description: 'no replay payload',
      commit_hash: null,
      created_at: '2026-06-09T00:00:01.000Z',
      plan_id: null,
      step_id: null,
      replay_payload: {},
    });
  });

  it('defaults replay restoration to frozen recommendations when the flag is omitted', () => {
    const harness = createHarness();
    harness.plans.set('plan-1', {
      id: 'plan-1',
      status: 'ready',
      template_meta: {},
      recommendations: [{ title: 'stale' }],
      recommendations_frozen: false,
      plan_hash: 'plan-1:ready:1',
    });

    const applied = harness.strategy.applyReplayPayload({
      id: 'cp-default-freeze',
      description: 'default freeze',
      commit_hash: null,
      plan_id: 'plan-1',
      step_id: null,
      replay_payload: {
        plan_id: 'plan-1',
        plan_hash: 'plan-1:ready:1',
        recommendations: [{ title: 'fresh' }],
      },
      created_at: '2026-06-09T00:00:02.000Z',
    });

    expect(applied).toEqual({
      applied: true,
      plan_id: 'plan-1',
      plan_hash: 'plan-1:ready:1',
      recommendation_count: 1,
    });
    expect(harness.plans.get('plan-1')).toMatchObject({
      recommendations: [{ index: 0, title: 'fresh' }],
      recommendations_frozen: true,
      plan_hash: 'plan-1:ready:1',
    });
  });

  it('returns a no-commit-hash error when replay does not apply', async () => {
    const harness = createHarness();
    harness.checkpoints.set('cp-no-commit', {
      id: 'cp-no-commit',
      description: 'no commit hash',
      commit_hash: null,
      plan_id: 'plan-404',
      step_id: 'step-404',
      replay_payload: {
        plan_id: 'plan-404',
        plan_hash: 'ghost-hash',
      },
      created_at: '2026-06-09T00:00:03.000Z',
    });

    await expect(
      harness.strategy.restoreCheckpointInternal('cp-no-commit', 'approved-token'),
    ).resolves.toEqual({
      error: 'No commit hash available for this checkpoint',
      plan_id: 'plan-404',
      step_id: 'step-404',
      replay: {
        applied: false,
        reason: 'plan_not_found:plan-404',
      },
    });
  });
});

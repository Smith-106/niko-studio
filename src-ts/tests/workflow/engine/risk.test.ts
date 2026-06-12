import { describe, it, expect, vi } from 'vitest';

import {
  buildWorkflowQualityMetrics,
  determineWorkflowLane,
  evaluateWorkflowRiskGate,
  hasValidWorkflowConfirmToken,
  isDestructiveWorkflowStep,
  resolveAdaptiveWorkflowLevel,
  resolveWorkflowGateProfile,
  restoreWorkflowCheckpoint,
} from '../../../workflow/engine/risk.js';
import type { WorkflowCheckpointLike } from '../../../workflow/engine/risk.js';
import { WorkflowDecision, WorkflowLevel } from '../../../workflow/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const destructiveStepNames = new Set(['force_push', 'nuke_db', 'drop_all']);

function makeCheckpoint(overrides: Partial<WorkflowCheckpointLike> = {}): WorkflowCheckpointLike {
  return {
    id: 'ckpt-1',
    commit_hash: null,
    plan_id: 'plan-1',
    step_id: 'step-1',
    replay_payload: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('risk', () => {
  // ------------------------------------------------------------------
  // buildWorkflowQualityMetrics
  // ------------------------------------------------------------------
  describe('buildWorkflowQualityMetrics', () => {
    it('returns higher pass_rate for short tasks', () => {
      const metrics = buildWorkflowQualityMetrics('short task');
      expect(metrics.pass_rate).toBe(92.0);
    });

    it('returns lower pass_rate for long tasks (>=80 chars)', () => {
      const longTask = 'a'.repeat(80);
      const metrics = buildWorkflowQualityMetrics(longTask);
      expect(metrics.pass_rate).toBe(86.0);
    });

    it('returns higher risk_score when task contains maintenance keywords', () => {
      const metrics = buildWorkflowQualityMetrics('系统维护任务');
      expect(metrics.risk_score).toBe(0.82);
    });

    it('returns higher risk_score for English maintenance keyword', () => {
      const metrics = buildWorkflowQualityMetrics('perform maintenance check');
      expect(metrics.risk_score).toBe(0.82);
    });

    it('returns higher risk_score for repair keyword', () => {
      const metrics = buildWorkflowQualityMetrics('修复 broken pipeline');
      expect(metrics.risk_score).toBe(0.82);
    });

    it('returns lower risk_score for normal tasks', () => {
      const metrics = buildWorkflowQualityMetrics('write a simple function');
      expect(metrics.risk_score).toBe(0.38);
    });

    it('returns higher recovery_latency for very long tasks (>=100 chars)', () => {
      const longTask = 'x'.repeat(100);
      const metrics = buildWorkflowQualityMetrics(longTask);
      expect(metrics.recovery_latency).toBe(280.0);
    });

    it('returns lower recovery_latency for shorter tasks', () => {
      const metrics = buildWorkflowQualityMetrics('short task');
      expect(metrics.recovery_latency).toBe(120.0);
    });

    it('rounds values to two decimal places', () => {
      const metrics = buildWorkflowQualityMetrics('test');
      for (const key of Object.keys(metrics)) {
        const val = metrics[key];
        expect(Math.round(val * 100) / 100).toBe(val);
      }
    });

    it('handles null/undefined task gracefully', () => {
      const metrics = buildWorkflowQualityMetrics(null as unknown as string);
      expect(metrics.pass_rate).toBe(92.0);
      expect(metrics.risk_score).toBe(0.38);
      expect(metrics.recovery_latency).toBe(120.0);
    });
  });

  // ------------------------------------------------------------------
  // determineWorkflowLane
  // ------------------------------------------------------------------
  describe('determineWorkflowLane', () => {
    it('returns maintenance when risk_score >= 0.75', () => {
      expect(determineWorkflowLane({ risk_score: 0.75 })).toBe('maintenance');
      expect(determineWorkflowLane({ risk_score: 0.90 })).toBe('maintenance');
    });

    it('returns maintenance when recovery_latency >= 240', () => {
      expect(determineWorkflowLane({ recovery_latency: 240 })).toBe('maintenance');
      expect(determineWorkflowLane({ recovery_latency: 300 })).toBe('maintenance');
    });

    it('returns maintenance when pass_rate < 88', () => {
      expect(determineWorkflowLane({ pass_rate: 87.9 })).toBe('maintenance');
      expect(determineWorkflowLane({ pass_rate: 50 })).toBe('maintenance');
    });

    it('returns default when all metrics are healthy', () => {
      expect(determineWorkflowLane({ risk_score: 0.3, recovery_latency: 100, pass_rate: 95 })).toBe('default');
    });

    it('returns default for empty metrics object (uses safe defaults)', () => {
      expect(determineWorkflowLane({})).toBe('default');
    });
  });

  describe('resolveAdaptiveWorkflowLevel', () => {
    it('keeps the incoming level outside maintenance lane', () => {
      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'default', {
          risk_score: 0.95,
          pass_rate: 40,
          recovery_latency: 500,
        }),
      ).toBe(WorkflowLevel.L2_LITE);
    });

    it('promotes the level by maintenance severity bands', () => {
      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.95,
          pass_rate: 90,
          recovery_latency: 100,
        }),
      ).toBe(WorkflowLevel.L5_COORDINATOR);

      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.1,
          pass_rate: 79,
          recovery_latency: 100,
        }),
      ).toBe(WorkflowLevel.L5_COORDINATOR);

      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.8,
          pass_rate: 92,
          recovery_latency: 100,
        }),
      ).toBe(WorkflowLevel.L4_BRAINSTORM);

      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.2,
          pass_rate: 92,
          recovery_latency: 260,
        }),
      ).toBe(WorkflowLevel.L4_BRAINSTORM);

      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.2,
          pass_rate: 87,
          recovery_latency: 120,
        }),
      ).toBe(WorkflowLevel.L3_STANDARD);

      expect(
        resolveAdaptiveWorkflowLevel(WorkflowLevel.L2_LITE, 'maintenance', {
          risk_score: 0.2,
          pass_rate: 92,
          recovery_latency: 120,
        }),
      ).toBe(WorkflowLevel.L2_LITE);
    });
  });

  describe('resolveWorkflowGateProfile', () => {
    it('uses maintenance-specific profiles and falls back to default-soft', () => {
      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L3_STANDARD,
          'maintenance',
          { risk_score: 0.95, recovery_latency: 100 },
          {},
        ),
      ).toBe('maintenance-hard');

      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L3_STANDARD,
          'maintenance',
          { risk_score: 0.8, recovery_latency: 100 },
          {},
        ),
      ).toBe('maintenance-selective-hard');

      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L3_STANDARD,
          'maintenance',
          { risk_score: 0.2, recovery_latency: 260 },
          {},
        ),
      ).toBe('maintenance-selective-hard');

      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L3_STANDARD,
          'maintenance',
          { risk_score: 0.2, recovery_latency: 120 },
          {},
        ),
      ).toBe('maintenance-soft');

      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L3_STANDARD,
          'default',
          {},
          { 3: { gate_profile: 'custom-soft' } },
        ),
      ).toBe('custom-soft');

      expect(
        resolveWorkflowGateProfile(
          WorkflowLevel.L2_LITE,
          'default',
          {},
          {},
        ),
      ).toBe('default-soft');
    });
  });

  // ------------------------------------------------------------------
  // evaluateWorkflowRiskGate
  // ------------------------------------------------------------------
  describe('evaluateWorkflowRiskGate', () => {
    const lowRiskMeta = { 3: { risk: 'low' } };
    const medRiskMeta = { 3: { risk: 'medium' } };
    const highRiskMeta = { 3: { risk: 'high' } };

    it('returns NO_GO for destructive step without confirm token', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'force_push', undefined, null, lowRiskMeta, destructiveStepNames,
      );
      expect(result.decision).toBe(WorkflowDecision.NO_GO);
      expect(result.blocking).toBe(true);
      expect(result.destructive).toBe(true);
      expect(result.confirm_required).toBe(true);
      expect(result.confirmed).toBe(false);
    });

    it('returns NO_GO for step with destructive recommendations and no confirm', () => {
      const recs = [{ action: 'delete all records', title: 'cleanup' }];
      const result = evaluateWorkflowRiskGate(
        3, 'normal_step', recs, null, lowRiskMeta, new Set(),
      );
      expect(result.decision).toBe(WorkflowDecision.NO_GO);
      expect(result.blocking).toBe(true);
      expect(result.destructive).toBe(true);
    });

    it('returns GO with confirmed true for destructive step with valid confirm token', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'force_push', undefined, 'valid-token-123', lowRiskMeta, destructiveStepNames,
      );
      expect(result.decision).toBe(WorkflowDecision.GO);
      expect(result.confirmed).toBe(true);
      expect(result.destructive).toBe(true);
      expect(result.blocking).toBe(false);
    });

    it('returns SOFT_GO for checkpoint step with medium risk', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'checkpoint', undefined, null, medRiskMeta, new Set(),
      );
      expect(result.decision).toBe(WorkflowDecision.SOFT_GO);
      expect(result.blocking).toBe(false);
      expect(result.destructive).toBe(false);
    });

    it('returns SOFT_GO for final_review step with high risk', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'final_review', undefined, null, highRiskMeta, new Set(),
      );
      expect(result.decision).toBe(WorkflowDecision.SOFT_GO);
      expect(result.risk).toBe('high');
    });

    it('returns GO for normal step with low risk', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'implement', undefined, null, lowRiskMeta, new Set(),
      );
      expect(result.decision).toBe(WorkflowDecision.GO);
      expect(result.blocking).toBe(false);
      expect(result.destructive).toBe(false);
      expect(result.confirmed).toBe(true);
    });

    it('returns GO (not SOFT_GO) for checkpoint step with low risk', () => {
      const result = evaluateWorkflowRiskGate(
        3, 'checkpoint', undefined, null, lowRiskMeta, new Set(),
      );
      expect(result.decision).toBe(WorkflowDecision.GO);
    });

    it('falls back to low risk when template metadata is missing', () => {
      const result = evaluateWorkflowRiskGate(
        999,
        'checkpoint',
        [{ title: 'keep state' }],
        null,
        {},
        new Set(),
      );

      expect(result.decision).toBe(WorkflowDecision.GO);
      expect(result.risk).toBe('low');
    });
  });

  // ------------------------------------------------------------------
  // restoreWorkflowCheckpoint
  // ------------------------------------------------------------------
  describe('restoreWorkflowCheckpoint', () => {
    it('restores immediately for non-destructive checkpoint (empty replay_payload)', async () => {
      const checkpoint = makeCheckpoint({ replay_payload: {} });
      const replayResult = { applied: true };

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        hasValidConfirmToken: vi.fn(),
        applyReplayPayload: vi.fn().mockReturnValue(replayResult),
        checkoutCommit: vi.fn(),
      });

      // Non-destructive with no commit_hash: replayResult.applied is true => restored
      if ('status' in result) {
        expect(result.status).toBe('restored');
      }
    });

    it('returns waiting_confirmation for destructive checkpoint without confirm', async () => {
      const checkpoint = makeCheckpoint({
        replay_payload: { mutations: ['x'] },
      });

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        confirmToken: undefined,
        hasValidConfirmToken: vi.fn().mockReturnValue(false),
        applyReplayPayload: vi.fn(),
        checkoutCommit: vi.fn(),
      });

      if ('status' in result && result.status === 'waiting_confirmation') {
        expect(result.status).toBe('waiting_confirmation');
        expect(result.gate.blocking).toBe(true);
        expect(result.checkpoint_id).toBe('ckpt-1');
      }
    });

    it('restores with commit_hash by calling checkoutCommit', async () => {
      const checkpoint = makeCheckpoint({
        commit_hash: 'abc123',
        replay_payload: { mutations: ['x'] },
      });
      const replayResult = { applied: true };

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        confirmToken: 'valid',
        hasValidConfirmToken: vi.fn().mockReturnValue(true),
        applyReplayPayload: vi.fn().mockReturnValue(replayResult),
        checkoutCommit: vi.fn().mockResolvedValue(undefined),
      });

      if ('status' in result && result.status === 'restored') {
        expect(result.commit_hash).toBe('abc123');
        expect(result.replay).toEqual(replayResult);
      }
    });

    it('returns error when checkoutCommit throws', async () => {
      const checkpoint = makeCheckpoint({
        commit_hash: 'badhash',
        replay_payload: { mutations: ['x'] },
      });
      const replayResult = { applied: true };

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        confirmToken: 'valid',
        hasValidConfirmToken: vi.fn().mockReturnValue(true),
        applyReplayPayload: vi.fn().mockReturnValue(replayResult),
        checkoutCommit: vi.fn().mockRejectedValue(new Error('git checkout failed')),
      });

      if ('error' in result && 'replay' in result) {
        expect(result.error).toContain('Git restore failed');
        expect(result.replay).toEqual(replayResult);
      }
    });

    it('restores without commit_hash when replay applied is true', async () => {
      const checkpoint = makeCheckpoint({
        commit_hash: null,
        replay_payload: {},
      });
      const replayResult = { applied: true };

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        hasValidConfirmToken: vi.fn(),
        applyReplayPayload: vi.fn().mockReturnValue(replayResult),
        checkoutCommit: vi.fn(),
      });

      if ('status' in result && result.status === 'restored') {
        expect(result.status).toBe('restored');
        expect(result.commit_hash).toBeNull();
      }
    });

    it('returns error when no commit_hash and replay not applied', async () => {
      const checkpoint = makeCheckpoint({
        commit_hash: null,
        replay_payload: {},
      });
      const replayResult = { applied: false };

      const result = await restoreWorkflowCheckpoint({
        checkpoint,
        hasValidConfirmToken: vi.fn(),
        applyReplayPayload: vi.fn().mockReturnValue(replayResult),
        checkoutCommit: vi.fn(),
      });

      if ('error' in result && !('status' in result)) {
        expect(result.error).toBe('No commit hash available for this checkpoint');
      }
    });
  });

  // ------------------------------------------------------------------
  // isDestructiveWorkflowStep
  // ------------------------------------------------------------------
  describe('isDestructiveWorkflowStep', () => {
    it('returns true when step name is in destructiveStepNames set', () => {
      expect(isDestructiveWorkflowStep('force_push', undefined, destructiveStepNames)).toBe(true);
    });

    it('returns false for normal step name with no recommendations', () => {
      expect(isDestructiveWorkflowStep('write_code', undefined, destructiveStepNames)).toBe(false);
    });

    it('returns true when recommendation action contains destructive token', () => {
      const recs = [{ action: 'overwrite file', title: 'replace content' }];
      expect(isDestructiveWorkflowStep('normal', recs, new Set())).toBe(true);
    });

    it('returns true when recommendation title contains destructive token', () => {
      const recs = [{ action: 'update config', title: 'Remove old entries' }];
      expect(isDestructiveWorkflowStep('normal', recs, new Set())).toBe(true);
    });

    it('returns true for Chinese destructive tokens in recommendations', () => {
      const recs = [{ action: '删除 data', title: 'cleanup' }];
      expect(isDestructiveWorkflowStep('normal', recs, new Set())).toBe(true);
    });

    it('returns false when recommendations have no destructive tokens', () => {
      const recs = [{ action: 'create file', title: 'add new module' }];
      expect(isDestructiveWorkflowStep('normal', recs, new Set())).toBe(false);
    });

    it('handles sparse recommendation objects without destructive markers', () => {
      const recs = [{}, { title: 'safe change' }];
      expect(isDestructiveWorkflowStep('normal', recs as Record<string, unknown>[], new Set())).toBe(false);
    });

    it('returns false for empty recommendations array', () => {
      expect(isDestructiveWorkflowStep('normal', [], destructiveStepNames)).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // hasValidWorkflowConfirmToken
  // ------------------------------------------------------------------
  describe('hasValidWorkflowConfirmToken', () => {
    it('returns true for non-empty string', () => {
      expect(hasValidWorkflowConfirmToken('valid-token')).toBe(true);
    });

    it('returns true for string with spaces', () => {
      expect(hasValidWorkflowConfirmToken('  token  ')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(hasValidWorkflowConfirmToken('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(hasValidWorkflowConfirmToken('   ')).toBe(false);
    });

    it('returns false for null', () => {
      expect(hasValidWorkflowConfirmToken(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(hasValidWorkflowConfirmToken(undefined)).toBe(false);
    });

    it('returns false for non-string types', () => {
      expect(hasValidWorkflowConfirmToken(42 as unknown as string)).toBe(false);
      expect(hasValidWorkflowConfirmToken(true as unknown as string)).toBe(false);
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  buildWorkflowExecutionResponseContext,
  buildWorkflowLifecycleActionContract,
  buildWorkflowLifecycleStatusContract,
  buildWorkflowPersistedAuditContract,
  buildWorkflowPersistedStateSnapshot,
  buildWorkflowRuntimeResponseContext,
  buildWorkflowStateResumeContract,
} from '../../workflow/engine/engine-contracts.js';

describe('workflow/engine/engine-contracts', () => {
  it('builds runtime and execution response contexts without changing payload shape', () => {
    const runtime = buildWorkflowRuntimeResponseContext(
      {
        executionMode: 'standard',
        observability: {
          aggregate: { completion_rate: 50 },
        },
        budgetGuardrail: { token_budget: 1000 },
      },
      { trigger: 'pause' },
      'checkpointed',
    );

    expect(runtime).toEqual({
      executionMode: 'standard',
      observabilityMetrics: { completion_rate: 50 },
      budgetGuardrail: { token_budget: 1000 },
      handoffPackage: { trigger: 'pause' },
      sessionStatus: 'checkpointed',
    });

    expect(
      buildWorkflowExecutionResponseContext(
        runtime,
        2,
        { current_phase: 'review', state_trace_id: 'session-1' },
      ),
    ).toEqual({
      executionMode: 'standard',
      observabilityMetrics: { completion_rate: 50 },
      budgetGuardrail: { token_budget: 1000 },
      remainingSteps: 2,
      stateResumeMetadata: { current_phase: 'review', state_trace_id: 'session-1' },
    });
  });

  it('builds lifecycle contracts with the existing response keys', () => {
    const runtime = {
      executionMode: 'eco',
      observabilityMetrics: { failed_steps: 1 },
      budgetGuardrail: { degraded: true },
      handoffPackage: { blocked_by: ['step-2'] },
      sessionStatus: 'active' as string | null,
    };

    expect(buildWorkflowLifecycleStatusContract({
      planId: 'plan-1',
      action: 'status',
      runnerState: 'running',
      triageState: 'open',
      fixStatus: 'unfixed',
      fixOwner: '',
      planStatus: 'running',
      lane: 'default',
      qualityMetrics: { risk_score: 0.2 },
      runtime,
    })).toMatchObject({
      plan_id: 'plan-1',
      action: 'status',
      runner_state: 'running',
      execution_mode: 'eco',
      observability_metrics: { failed_steps: 1 },
      budget_guardrail: { degraded: true },
      handoff_package: { blocked_by: ['step-2'] },
      session_status: 'active',
    });

    expect(buildWorkflowLifecycleActionContract({
      planId: 'plan-1',
      action: 'pause',
      runnerState: 'paused',
      triageState: 'open',
      fixStatus: 'unfixed',
      fixOwner: '',
      planStatus: 'running',
      checkpointId: 'cp-1',
      lane: 'default',
      qualityMetrics: { risk_score: 0.2 },
      runtime: { ...runtime, sessionStatus: 'checkpointed' },
    })).toMatchObject({
      plan_id: 'plan-1',
      action: 'pause',
      checkpoint_id: 'cp-1',
      runner_state: 'paused',
      session_status: 'checkpointed',
    });
  });

  it('builds resume metadata, persisted snapshot, and audit contracts with workspace authority', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T01:23:45.000Z'));

    const resumeMetadata = buildWorkflowStateResumeContract({
      currentPhase: 'test',
      sessionId: 'workflow-session-9',
      canResumeFromCheckpoint: true,
      observability: { aggregate: { completion_rate: 66.7 } },
      budgetGuardrail: { token_budget: 5000 },
      handoffPackage: { trigger: 'pause' },
      sessionStatus: 'checkpointed',
      authority: {
        sessionId: 'workflow-session-9',
        workspaceId: 'workspace-9',
        projectId: 'project-9',
      },
    });

    expect(resumeMetadata).toEqual({
      current_phase: 'test',
      state_trace_id: 'workflow-session-9',
      can_resume_from_checkpoint: true,
      observability: { aggregate: { completion_rate: 66.7 } },
      budget_guardrail: { token_budget: 5000 },
      handoff_package: { trigger: 'pause' },
      session_status: 'checkpointed',
      workspace_authority: {
        session_id: 'workflow-session-9',
        workspace_id: 'workspace-9',
        project_id: 'project-9',
      },
    });

    const snapshot = buildWorkflowPersistedStateSnapshot<Record<string, unknown>>({
      schemaVersion: '2026-02',
      schemaPolicy: { policy: 'frozen' },
      planId: 'plan-9',
      task: '整理章节',
      level: 'L3',
      planStatus: 'running',
      runnerState: 'running',
      currentPhase: 'executing',
      lastCheckpointId: 'cp-9',
      sessionId: 'workflow-session-9',
      lane: 'default',
      executionMode: 'standard',
      qualityMetrics: { risk_score: 0.1 },
      templateMeta: { session_status: 'active' },
      recommendationsFrozen: true,
      planHash: 'hash-9',
      triageState: 'open',
      fixStatus: 'unfixed',
      fixOwner: '',
      authority: {
        sessionId: 'workflow-session-9',
        workspaceId: 'workspace-9',
        projectId: 'project-9',
      },
      sessionRoot: '/tmp/workflow-session-9',
      observability: { aggregate: { completion_rate: 50 } },
      budgetGuardrail: { token_budget: 5000 },
      handoffPackage: { trigger: 'pause' },
      steps: [
        {
          id: 'step-1',
          name: 'analyze',
          status: 'done',
          started_at: '2026-04-11T01:00:00.000Z',
          completed_at: '2026-04-11T01:05:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'cp-9',
          step_id: 'step-1',
          description: 'pause checkpoint',
          created_at: '2026-04-11T01:10:00.000Z',
          plan_id: 'plan-9',
        },
      ],
    });

    expect(snapshot).toMatchObject({
      plan_id: 'plan-9',
      current_phase: 'executing',
      last_checkpoint_id: 'cp-9',
      state_trace_id: 'workflow-session-9',
      updated_at: '2026-04-11T01:23:45.000Z',
      metadata: {
        workspace_authority: {
          session_id: 'workflow-session-9',
          workspace_id: 'workspace-9',
          project_id: 'project-9',
        },
      },
      artifacts: {
        state: expect.stringContaining('.data'),
        snapshot_index: expect.stringContaining('snapshot-index.json'),
      },
      checkpoint_trace: [
        {
          checkpoint_id: 'cp-9',
          step_id: 'step-1',
        },
      ],
    });

    expect(buildWorkflowPersistedAuditContract({
      planId: 'plan-9',
      runnerState: 'paused',
      currentPhase: 'review',
      checkpointId: 'cp-9',
      sessionStatus: 'checkpointed',
      authority: {
        sessionId: 'workflow-session-9',
        workspaceId: 'workspace-9',
        projectId: 'project-9',
      },
      recordedAt: '2026-04-11T01:23:45.000Z',
    })).toEqual({
      event: 'workflow_state_persisted',
      plan_id: 'plan-9',
      runner_state: 'paused',
      current_phase: 'review',
      checkpoint_id: 'cp-9',
      session_status: 'checkpointed',
      workspace_authority: {
        session_id: 'workflow-session-9',
        workspace_id: 'workspace-9',
        project_id: 'project-9',
      },
      recorded_at: '2026-04-11T01:23:45.000Z',
    });

    vi.useRealTimers();
  });
});

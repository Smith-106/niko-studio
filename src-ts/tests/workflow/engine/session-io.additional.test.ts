import * as path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../workflow/engine/engine-contracts.js', () => ({
  buildWorkflowPersistedAuditContract: vi.fn((input: Record<string, unknown>) => ({
    kind: 'audit',
    ...input,
  })),
  buildWorkflowPersistedStateSnapshot: vi.fn((input: Record<string, unknown>) => ({
    kind: 'snapshot',
    updated_at: input.updatedAt,
    input,
  })),
  buildWorkflowStateResumeContract: vi.fn((input: Record<string, unknown>) => ({
    kind: 'resume',
    ...input,
  })),
}));

vi.mock('../../../workflow/engine/persistence.js', () => ({
  resolveWorkflowPersistencePhase: vi.fn(),
}));

import {
  buildWorkflowPersistedAuditContract,
  buildWorkflowPersistedStateSnapshot,
  buildWorkflowStateResumeContract,
} from '../../../workflow/engine/engine-contracts.js';
import { resolveWorkflowPersistencePhase } from '../../../workflow/engine/persistence.js';
import {
  buildWorkflowResumeMetadataForPlan,
  persistWorkflowPlanState,
  syncWorkflowSessionContext,
  writeWorkflowStateArtifacts,
} from '../../../workflow/engine/session-io.js';

function createSessionManager() {
  return {
    activePath: path.join('workspace', 'active'),
    archivedPath: path.join('workspace', 'archived'),
    syncLifecycle: vi.fn(),
    write: vi.fn(),
    appendAudit: vi.fn(),
  };
}

function createPlan() {
  return {
    id: 'plan-1',
    task: 'Ship session state',
    level: 'L3',
    status: 'in_progress',
    runner_state: 'running',
    triage_state: 'clear',
    fix_status: 'none',
    fix_owner: 'niko',
    template_meta: { execution_mode: 'serial' } as Record<string, unknown>,
    recommendations_frozen: false,
    plan_hash: 'hash-1',
    lane: 'default',
    quality_metrics: { coverage: 100 },
    observability: { traceId: 'obs-1' },
    budget_guardrail: { tokens: 1000 },
    handoff_package: { summary: 'handoff' },
    steps: [
      {
        id: 'step-1',
        name: 'Persist state',
        status: 'RUNNING',
        started_at: '2026-06-08T00:00:00.000Z',
        completed_at: null,
      },
    ],
  };
}

describe('workflow/engine/session-io additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chooses the archived root only when lifecycle status is archived', () => {
    const archivedManager = createSessionManager();
    archivedManager.syncLifecycle.mockReturnValue({ status: 'archived' });

    expect(
      syncWorkflowSessionContext({
        sessionManager: archivedManager as never,
        sessionId: 'session-1',
        runnerState: 'running',
        checkpointId: 'cp-1',
      }),
    ).toEqual({
      sessionLifecycle: { status: 'archived' },
      sessionRoot: path.join(archivedManager.archivedPath, 'session-1'),
    });

    const activeManager = createSessionManager();
    activeManager.syncLifecycle.mockReturnValue({});

    expect(
      syncWorkflowSessionContext({
        sessionManager: activeManager as never,
        sessionId: 'session-2',
        runnerState: 'paused',
      }),
    ).toEqual({
      sessionLifecycle: {},
      sessionRoot: path.join(activeManager.activePath, 'session-2'),
    });
  });

  it('writes workflow state snapshots and audit events to the session manager', () => {
    const sessionManager = createSessionManager();

    writeWorkflowStateArtifacts({
      sessionManager: sessionManager as never,
      sessionId: 'session-1',
      snapshot: { current_phase: 'persisted' },
      auditEvent: { kind: 'audit' },
    });

    expect(sessionManager.write).toHaveBeenCalledWith(
      'session-1',
      expect.anything(),
      JSON.stringify({ current_phase: 'persisted' }, null, 2),
    );
    expect(sessionManager.appendAudit).toHaveBeenCalledWith('session-1', { kind: 'audit' });
  });

  it('persists plan state with checkpoint metadata and archived session status when available', () => {
    const sessionManager = createSessionManager();
    sessionManager.syncLifecycle.mockReturnValue({ status: 'archived' });
    vi.mocked(resolveWorkflowPersistencePhase).mockReturnValue({
      phase: 'execution',
      lastCheckpointId: 'cp-1',
    });
    vi.mocked(buildWorkflowPersistedStateSnapshot).mockReturnValue({
      updated_at: '2026-06-08T03:00:00.000Z',
      snapshot: true,
    } as never);

    const plan = createPlan();
    const sessionLifecycle = persistWorkflowPlanState({
      plan,
      currentPhase: 'execution',
      checkpointId: 'cp-1',
      schemaVersion: '1.0.0',
      schemaPolicy: { workflow: 'strict' },
      sessionManager: sessionManager as never,
      checkpoints: [
        {
          id: 'cp-1',
          step_id: 'step-1',
          description: 'persisted',
          created_at: '2026-06-08T03:00:00.000Z',
          plan_id: 'plan-1',
        },
      ],
      canonicalizeStepStatus: (status) => status.toLowerCase(),
      getPlanAuthority: () => ({
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
      }),
      getPlanSessionId: () => 'fallback-session',
    });

    expect(sessionLifecycle).toEqual({ status: 'archived' });
    expect(plan.template_meta).toMatchObject({
      current_phase: 'execution',
      last_checkpoint_id: 'cp-1',
      session_id: 'session-1',
      session_status: 'archived',
    });
    expect(buildWorkflowPersistedStateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        currentPhase: 'execution',
        lastCheckpointId: 'cp-1',
        sessionId: 'session-1',
        sessionRoot: path.join(sessionManager.archivedPath, 'session-1'),
      }),
    );
    expect(buildWorkflowPersistedAuditContract).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpointId: 'cp-1',
        sessionStatus: 'archived',
        recordedAt: '2026-06-08T03:00:00.000Z',
      }),
    );
    expect(sessionManager.write).toHaveBeenCalledTimes(1);
    expect(sessionManager.appendAudit).toHaveBeenCalledTimes(1);
  });

  it('falls back to active sessions and synthesized timestamps when optional fields are absent', () => {
    const sessionManager = createSessionManager();
    sessionManager.syncLifecycle.mockReturnValue({});
    vi.mocked(resolveWorkflowPersistencePhase).mockReturnValue({
      phase: 'triage',
      lastCheckpointId: '',
    });
    vi.mocked(buildWorkflowPersistedStateSnapshot).mockReturnValue({
      snapshot: true,
    } as never);

    const plan = createPlan();
    delete plan.template_meta.execution_mode;

    persistWorkflowPlanState({
      plan,
      schemaVersion: '1.0.0',
      schemaPolicy: { workflow: 'strict' },
      sessionManager: sessionManager as never,
      checkpoints: [],
      canonicalizeStepStatus: (status) => status.toLowerCase(),
      getPlanAuthority: () => null,
      getPlanSessionId: () => 'fallback-session',
    });

    expect(plan.template_meta).toMatchObject({
      current_phase: 'triage',
      session_id: 'fallback-session',
      session_status: null,
    });
    expect(plan.template_meta).not.toHaveProperty('last_checkpoint_id');
    expect(buildWorkflowPersistedStateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: '',
        lastCheckpointId: '',
        sessionRoot: path.join(sessionManager.activePath, 'fallback-session'),
      }),
    );
    expect(buildWorkflowPersistedAuditContract).toHaveBeenCalledWith(
      expect.objectContaining({
        checkpointId: null,
        sessionStatus: null,
        recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('builds resume metadata from explicit template values and status fallbacks', () => {
    const explicit = buildWorkflowResumeMetadataForPlan({
      plan: {
        id: 'plan-1',
        status: 'running',
        template_meta: {
          current_phase: 'execution',
          last_checkpoint_id: 'cp-1',
          session_status: 'archived',
        },
        observability: { traceId: 'obs-1' },
        budget_guardrail: { tokens: 1000 },
        handoff_package: { summary: 'handoff' },
      },
      getPlanAuthority: () => ({
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
      }),
      getPlanSessionId: () => 'fallback-session',
    });

    expect(explicit).toMatchObject({
      kind: 'resume',
      currentPhase: 'execution',
      sessionId: 'session-1',
      canResumeFromCheckpoint: true,
      sessionStatus: 'archived',
      authority: {
        sessionId: 'session-1',
        workspaceId: 'workspace-1',
        projectId: 'project-1',
      },
    });

    const fallback = buildWorkflowResumeMetadataForPlan({
      plan: {
        id: 'plan-2',
        status: 'waiting',
        template_meta: {},
        observability: {},
        budget_guardrail: {},
        handoff_package: {},
      },
      getPlanAuthority: () => null,
      getPlanSessionId: () => 'fallback-session',
    });

    expect(fallback).toMatchObject({
      kind: 'resume',
      currentPhase: 'waiting',
      sessionId: 'fallback-session',
      canResumeFromCheckpoint: false,
      sessionStatus: null,
      authority: {
        sessionId: 'fallback-session',
        workspaceId: null,
        projectId: null,
      },
    });
    expect(buildWorkflowStateResumeContract).toHaveBeenCalledTimes(2);
  });
});

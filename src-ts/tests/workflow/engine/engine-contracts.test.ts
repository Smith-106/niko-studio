import { describe, it, expect } from 'vitest';

import {
  normalizeWorkflowRouteRequest,
  normalizeWorkflowPlanRequest,
  normalizeWorkflowRunRequest,
  normalizeWorkflowRunWithExecutionContextRequest,
  normalizeWorkflowExecuteRequest,
  normalizeWorkflowStreamRequest,
  normalizeWorkflowStreamWithExecutionContextRequest,
  buildWorkflowRuntimeResponseContext,
  buildWorkflowExecutionResponseContext,
  buildWorkflowLifecycleStatusContract,
  buildWorkflowLifecycleActionContract,
  buildWorkflowStateResumeContract,
  buildWorkflowPersistedStateSnapshot,
  buildWorkflowPersistedAuditContract,
} from '../../../workflow/engine/engine-contracts.js';
import type {
  WorkflowRouteRequest,
  WorkflowPlanRequest,
  WorkflowPlanRuntimeState,
  WorkflowPlanRuntimeResponseContext,
  WorkflowStateResumeMetadataContract,
  WorkflowExecutionResponseContext,
  WorkflowLifecycleResult,
} from '../../../workflow/engine/engine-contracts.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('engine-contracts', () => {
  // ===================================================================
  // normalizeWorkflowRouteRequest
  // ===================================================================
  describe('normalizeWorkflowRouteRequest', () => {
    it('converts a string into { task: string }', () => {
      const result = normalizeWorkflowRouteRequest('deploy the service');
      expect(result).toEqual({ task: 'deploy the service' });
    });

    it('extracts task from an object input', () => {
      const input: WorkflowRouteRequest = { task: 'run tests' };
      const result = normalizeWorkflowRouteRequest(input);
      expect(result).toEqual({ task: 'run tests' });
    });
  });

  // ===================================================================
  // normalizeWorkflowPlanRequest
  // ===================================================================
  describe('normalizeWorkflowPlanRequest', () => {
    it('converts a string into a full plan request with optional params', () => {
      const recs = [{ action: 'retry' }];
      const ec = { region: 'us-east' };
      const result = normalizeWorkflowPlanRequest('build feature', 'advanced', recs, ec);
      expect(result).toEqual({
        task: 'build feature',
        level: 'advanced',
        recommendations: recs,
        executionContext: ec,
      });
    });

    it('converts a string with no optional params (all undefined)', () => {
      const result = normalizeWorkflowPlanRequest('simple task');
      expect(result).toEqual({
        task: 'simple task',
        level: undefined,
        recommendations: undefined,
        executionContext: undefined,
      });
    });

    it('passes through an object input, extracting each field', () => {
      const input: WorkflowPlanRequest = {
        task: 'migrate database',
        level: 'critical',
        recommendations: [{ action: 'backup' }],
        executionContext: { dryRun: true },
      };
      const result = normalizeWorkflowPlanRequest(input);
      expect(result).toEqual({
        task: 'migrate database',
        level: 'critical',
        recommendations: [{ action: 'backup' }],
        executionContext: { dryRun: true },
      });
    });

    it('passes through an object with undefined optional fields', () => {
      const input: WorkflowPlanRequest = { task: 'clean up' };
      const result = normalizeWorkflowPlanRequest(input);
      expect(result.task).toBe('clean up');
      expect(result.level).toBeUndefined();
      expect(result.recommendations).toBeUndefined();
      expect(result.executionContext).toBeUndefined();
    });
  });

  // ===================================================================
  // normalizeWorkflowRunRequest
  // ===================================================================
  describe('normalizeWorkflowRunRequest', () => {
    it('delegates to normalizeWorkflowPlanRequest for string input', () => {
      const recs = [{ action: 'optimize' }];
      const result = normalizeWorkflowRunRequest('run workflow', 'standard', recs);
      expect(result).toEqual({
        task: 'run workflow',
        level: 'standard',
        recommendations: recs,
        executionContext: undefined,
      });
    });

    it('delegates to normalizeWorkflowPlanRequest for object input', () => {
      const input: WorkflowPlanRequest = {
        task: 'run workflow',
        level: 'basic',
      };
      const result = normalizeWorkflowRunRequest(input);
      expect(result.task).toBe('run workflow');
      expect(result.level).toBe('basic');
    });
  });

  // ===================================================================
  // normalizeWorkflowRunWithExecutionContextRequest
  // ===================================================================
  describe('normalizeWorkflowRunWithExecutionContextRequest', () => {
    it('converts a string into a request with executionContext, level, and recommendations', () => {
      const ec = { env: 'staging' };
      const recs = [{ action: 'validate' }];
      const result = normalizeWorkflowRunWithExecutionContextRequest(
        'task string',
        ec,
        'moderate',
        recs,
      );
      expect(result).toEqual({
        task: 'task string',
        executionContext: ec,
        level: 'moderate',
        recommendations: recs,
      });
    });

    it('passes through an object input', () => {
      const input = {
        task: 'obj task',
        executionContext: { env: 'prod' },
        level: 'high',
        recommendations: [{ action: 'check' }],
      };
      const result = normalizeWorkflowRunWithExecutionContextRequest(input);
      expect(result).toEqual({
        task: 'obj task',
        executionContext: { env: 'prod' },
        level: 'high',
        recommendations: [{ action: 'check' }],
      });
    });

    it('handles string input with only required params', () => {
      const result = normalizeWorkflowRunWithExecutionContextRequest('bare task');
      expect(result).toEqual({
        task: 'bare task',
        executionContext: undefined,
        level: undefined,
        recommendations: undefined,
      });
    });
  });

  // ===================================================================
  // normalizeWorkflowExecuteRequest
  // ===================================================================
  describe('normalizeWorkflowExecuteRequest', () => {
    it('converts a string into a full execute request', () => {
      const result = normalizeWorkflowExecuteRequest(
        'plan-001',
        'step-5',
        [{ action: 'retry' }],
        'token-abc',
        null,
      );
      expect(result).toEqual({
        planId: 'plan-001',
        stepId: 'step-5',
        recommendations: [{ action: 'retry' }],
        confirmToken: 'token-abc',
        authority: null,
      });
    });

    it('passes through an object input', () => {
      const input = {
        planId: 'plan-002',
        stepId: 'step-1',
        recommendations: undefined,
        confirmToken: undefined,
        authority: { sessionId: 's1', workspaceId: null, projectId: null },
      };
      const result = normalizeWorkflowExecuteRequest(input);
      expect(result.planId).toBe('plan-002');
      expect(result.stepId).toBe('step-1');
      expect(result.authority).toEqual({
        sessionId: 's1',
        workspaceId: null,
        projectId: null,
      });
    });

    it('handles string input with no optional params', () => {
      const result = normalizeWorkflowExecuteRequest('plan-003');
      expect(result).toEqual({
        planId: 'plan-003',
        stepId: undefined,
        recommendations: undefined,
        confirmToken: undefined,
        authority: undefined,
      });
    });
  });

  // ===================================================================
  // normalizeWorkflowStreamRequest
  // ===================================================================
  describe('normalizeWorkflowStreamRequest', () => {
    it('delegates to normalizeWorkflowPlanRequest for string input', () => {
      const result = normalizeWorkflowStreamRequest('stream task', 'low');
      expect(result).toEqual({
        task: 'stream task',
        level: 'low',
        recommendations: undefined,
        executionContext: undefined,
      });
    });

    it('delegates for object input', () => {
      const input: WorkflowPlanRequest = { task: 'stream obj', level: 'high' };
      const result = normalizeWorkflowStreamRequest(input);
      expect(result.task).toBe('stream obj');
      expect(result.level).toBe('high');
    });
  });

  // ===================================================================
  // normalizeWorkflowStreamWithExecutionContextRequest
  // ===================================================================
  describe('normalizeWorkflowStreamWithExecutionContextRequest', () => {
    it('delegates to normalizeWorkflowRunWithExecutionContextRequest for string', () => {
      const ec = { source: 'cli' };
      const result = normalizeWorkflowStreamWithExecutionContextRequest(
        'stream ec task',
        ec,
        'medium',
      );
      expect(result).toEqual({
        task: 'stream ec task',
        executionContext: ec,
        level: 'medium',
        recommendations: undefined,
      });
    });

    it('delegates for object input', () => {
      const input = {
        task: 'stream ec obj',
        executionContext: { source: 'api' },
        level: 'critical',
        recommendations: [],
      };
      const result = normalizeWorkflowStreamWithExecutionContextRequest(input);
      expect(result.task).toBe('stream ec obj');
      expect(result.executionContext).toEqual({ source: 'api' });
    });
  });

  // ===================================================================
  // buildWorkflowRuntimeResponseContext
  // ===================================================================
  describe('buildWorkflowRuntimeResponseContext', () => {
    it('maps runtime state to response context', () => {
      const runtime: WorkflowPlanRuntimeState = {
        executionMode: 'standard',
        observability: { aggregate: { completed_steps: 3 } },
        budgetGuardrail: { token_used: 500 },
      };
      const handoff = { trigger: 'auto' };
      const result = buildWorkflowRuntimeResponseContext(runtime, handoff, 'active');

      expect(result).toEqual({
        executionMode: 'standard',
        observabilityMetrics: { completed_steps: 3 },
        budgetGuardrail: { token_used: 500 },
        handoffPackage: handoff,
        sessionStatus: 'active',
      });
    });

    it('handles null sessionStatus', () => {
      const runtime: WorkflowPlanRuntimeState = {
        executionMode: 'eco',
        observability: { aggregate: null },
        budgetGuardrail: {},
      };
      const result = buildWorkflowRuntimeResponseContext(runtime, {}, null);
      expect(result.sessionStatus).toBeNull();
    });
  });

  // ===================================================================
  // buildWorkflowExecutionResponseContext
  // ===================================================================
  describe('buildWorkflowExecutionResponseContext', () => {
    it('maps runtime + remaining + metadata into execution response context', () => {
      const runtime: WorkflowPlanRuntimeResponseContext = {
        executionMode: 'fast',
        observabilityMetrics: { completion_rate: 75.0 },
        budgetGuardrail: { degraded: false },
        handoffPackage: {},
        sessionStatus: null,
      };
      const resume: WorkflowStateResumeMetadataContract = {
        current_phase: 'executing',
        state_trace_id: 'trace-1',
        can_resume_from_checkpoint: true,
        observability: {},
        budget_guardrail: {},
        handoff_package: {},
        session_status: null,
        workspace_authority: { session_id: 's1', workspace_id: null, project_id: null },
      };

      const result = buildWorkflowExecutionResponseContext(runtime, 4, resume);

      expect(result.executionMode).toBe('fast');
      expect(result.observabilityMetrics).toEqual({ completion_rate: 75.0 });
      expect(result.budgetGuardrail).toEqual({ degraded: false });
      expect(result.remainingSteps).toBe(4);
      expect(result.stateResumeMetadata).toBe(resume);
    });
  });

  // ===================================================================
  // buildWorkflowLifecycleStatusContract
  // ===================================================================
  describe('buildWorkflowLifecycleStatusContract', () => {
    it('wraps the status response builder and returns expected keys', () => {
      const runtime: WorkflowPlanRuntimeResponseContext = {
        executionMode: 'standard',
        observabilityMetrics: { mttr: 0 },
        budgetGuardrail: { token_budget: 10000 },
        handoffPackage: { trigger: 'manual' },
        sessionStatus: 'active',
      };

      const result = buildWorkflowLifecycleStatusContract({
        planId: 'plan-100',
        action: 'status',
        runnerState: 'running',
        triageState: 'none',
        fixStatus: 'none',
        fixOwner: '',
        planStatus: 'in_progress',
        lane: 'primary',
        qualityMetrics: { score: 95 },
        runtime,
      });

      expect(result.plan_id).toBe('plan-100');
      expect(result.action).toBe('status');
      expect(result.runner_state).toBe('running');
      expect(result.execution_mode).toBe('standard');
      expect(result.session_status).toBe('active');
      expect(result.quality_metrics).toEqual({ score: 95 });
    });
  });

  // ===================================================================
  // buildWorkflowLifecycleActionContract
  // ===================================================================
  describe('buildWorkflowLifecycleActionContract', () => {
    it('wraps the action response builder and returns expected keys', () => {
      const runtime: WorkflowPlanRuntimeResponseContext = {
        executionMode: 'eco',
        observabilityMetrics: null,
        budgetGuardrail: {},
        handoffPackage: {},
        sessionStatus: null,
      };

      const result = buildWorkflowLifecycleActionContract({
        planId: 'plan-200',
        action: 'pause',
        runnerState: 'paused',
        triageState: 'triaging',
        fixStatus: 'fixing',
        fixOwner: 'system',
        planStatus: 'blocked',
        checkpointId: 'cp-1',
        lane: 'secondary',
        qualityMetrics: {},
        runtime,
      });

      expect(result.plan_id).toBe('plan-200');
      expect(result.action).toBe('pause');
      expect(result.checkpoint_id).toBe('cp-1');
      expect(result.runner_state).toBe('paused');
      expect(result.execution_mode).toBe('eco');
    });
  });

  // ===================================================================
  // buildWorkflowStateResumeContract
  // ===================================================================
  describe('buildWorkflowStateResumeContract', () => {
    it('maps input to wire-format resume metadata contract', () => {
      const result = buildWorkflowStateResumeContract({
        currentPhase: 'executing',
        sessionId: 'session-xyz',
        canResumeFromCheckpoint: true,
        observability: { mode: 'standard' },
        budgetGuardrail: { token_used: 200 },
        handoffPackage: { trigger: 'resume' },
        sessionStatus: 'active',
        authority: {
          sessionId: 'session-xyz',
          workspaceId: 'ws-1',
          projectId: 'proj-1',
        },
      });

      expect(result.current_phase).toBe('executing');
      expect(result.state_trace_id).toBe('session-xyz');
      expect(result.can_resume_from_checkpoint).toBe(true);
      expect(result.session_status).toBe('active');
      expect(result.workspace_authority).toEqual({
        session_id: 'session-xyz',
        workspace_id: 'ws-1',
        project_id: 'proj-1',
      });
      expect(result.observability).toEqual({ mode: 'standard' });
      expect(result.budget_guardrail).toEqual({ token_used: 200 });
      expect(result.handoff_package).toEqual({ trigger: 'resume' });
    });

    it('handles null workspace/project in authority', () => {
      const result = buildWorkflowStateResumeContract({
        currentPhase: 'planned',
        sessionId: 's2',
        canResumeFromCheckpoint: false,
        observability: {},
        budgetGuardrail: {},
        handoffPackage: {},
        sessionStatus: null,
        authority: {
          sessionId: 's2',
          workspaceId: null,
          projectId: null,
        },
      });

      expect(result.workspace_authority).toEqual({
        session_id: 's2',
        workspace_id: null,
        project_id: null,
      });
    });
  });

  // ===================================================================
  // buildWorkflowPersistedStateSnapshot
  // ===================================================================
  describe('buildWorkflowPersistedStateSnapshot', () => {
    it('produces a snapshot with all expected top-level keys', () => {
      const snapshot = buildWorkflowPersistedStateSnapshot<Record<string, unknown>>({
        schemaVersion: '1.0',
        schemaPolicy: { strict: true },
        planId: 'plan-300',
        task: 'deploy app',
        level: 'high',
        planStatus: 'in_progress',
        runnerState: 'running',
        currentPhase: 'executing',
        lastCheckpointId: 'cp-99',
        sessionId: 'sess-300',
        lane: 'primary',
        executionMode: 'standard',
        qualityMetrics: { score: 88 },
        templateMeta: { source: 'test' },
        recommendationsFrozen: false,
        planHash: 'hash-abc',
        triageState: 'none',
        fixStatus: 'none',
        fixOwner: '',
        authority: { sessionId: 'sess-300', workspaceId: null, projectId: null },
        sessionRoot: '/tmp/sessions',
        observability: { mode: 'standard' },
        budgetGuardrail: { token_used: 0 },
        handoffPackage: {},
        steps: [{ id: 'step-1', status: 'pending' }],
        checkpoints: [
          { id: 'cp-1', step_id: 'step-1', description: 'start', created_at: '2025-01-01T00:00:00Z', plan_id: 'plan-300' },
        ],
      });

      expect(snapshot['schema_version']).toBe('1.0');
      expect(snapshot['plan_id']).toBe('plan-300');
      expect(snapshot['task']).toBe('deploy app');
      expect(snapshot['level']).toBe('high');
      expect(snapshot['plan_status']).toBe('in_progress');
      expect(snapshot['runner_state']).toBe('running');
      expect(snapshot['current_phase']).toBe('executing');
      expect(snapshot['state_trace_id']).toBe('sess-300');
      expect(snapshot['steps']).toEqual([{ id: 'step-1', status: 'pending' }]);
      // checkpoint_trace only includes checkpoints matching planId
      expect(snapshot['checkpoint_trace']).toEqual([
        {
          checkpoint_id: 'cp-1',
          step_id: 'step-1',
          description: 'start',
          created_at: '2025-01-01T00:00:00Z',
        },
      ]);
      // artifacts should be derived from sessionRoot
      expect(snapshot['artifacts']).toEqual(
        expect.objectContaining({
          state: expect.stringContaining('.data'),
        }),
      );
      // metadata should contain lane, execution_mode, etc.
      const metadata = snapshot['metadata'] as Record<string, unknown>;
      expect(metadata['lane']).toBe('primary');
      expect(metadata['execution_mode']).toBe('standard');
      expect(metadata['workspace_authority']).toEqual({
        session_id: 'sess-300',
        workspace_id: null,
        project_id: null,
      });
    });

    it('filters checkpoints by planId in checkpoint_trace', () => {
      const snapshot = buildWorkflowPersistedStateSnapshot<Record<string, unknown>>({
        schemaVersion: '1.0',
        schemaPolicy: {},
        planId: 'plan-A',
        task: 'test',
        level: 'low',
        planStatus: 'completed',
        runnerState: 'stopped',
        currentPhase: 'done',
        lastCheckpointId: '',
        sessionId: 'sess-A',
        lane: 'primary',
        executionMode: 'standard',
        qualityMetrics: {},
        templateMeta: {},
        recommendationsFrozen: true,
        planHash: 'h1',
        triageState: '',
        fixStatus: '',
        fixOwner: '',
        authority: { sessionId: 'sess-A', workspaceId: null, projectId: null },
        sessionRoot: '/tmp',
        observability: {},
        budgetGuardrail: {},
        handoffPackage: {},
        steps: [],
        checkpoints: [
          { id: 'cp-1', step_id: null, description: 'a', created_at: '2025-01-01T00:00:00Z', plan_id: 'plan-A' },
          { id: 'cp-2', step_id: null, description: 'b', created_at: '2025-01-02T00:00:00Z', plan_id: 'plan-B' },
          { id: 'cp-3', step_id: null, description: 'c', created_at: '2025-01-03T00:00:00Z', plan_id: 'plan-A' },
        ],
      });

      const trace = snapshot['checkpoint_trace'] as Array<Record<string, unknown>>;
      expect(trace).toHaveLength(2);
      expect(trace[0]['checkpoint_id']).toBe('cp-1');
      expect(trace[1]['checkpoint_id']).toBe('cp-3');
    });
  });

  // ===================================================================
  // buildWorkflowPersistedAuditContract
  // ===================================================================
  describe('buildWorkflowPersistedAuditContract', () => {
    it('returns audit event with correct type and key fields', () => {
      const result = buildWorkflowPersistedAuditContract({
        planId: 'plan-400',
        runnerState: 'running',
        currentPhase: 'executing',
        checkpointId: 'cp-5',
        sessionStatus: 'active',
        authority: {
          sessionId: 'sess-400',
          workspaceId: 'ws-10',
          projectId: 'proj-20',
        },
        recordedAt: '2025-06-15T12:00:00Z',
      });

      expect(result['event']).toBe('workflow_state_persisted');
      expect(result['plan_id']).toBe('plan-400');
      expect(result['runner_state']).toBe('running');
      expect(result['current_phase']).toBe('executing');
      expect(result['checkpoint_id']).toBe('cp-5');
      expect(result['session_status']).toBe('active');
      expect(result['recorded_at']).toBe('2025-06-15T12:00:00Z');
      expect(result['workspace_authority']).toEqual({
        session_id: 'sess-400',
        workspace_id: 'ws-10',
        project_id: 'proj-20',
      });
    });

    it('handles null checkpointId and null sessionStatus', () => {
      const result = buildWorkflowPersistedAuditContract({
        planId: 'plan-401',
        runnerState: 'stopped',
        currentPhase: 'done',
        checkpointId: null,
        sessionStatus: null,
        authority: {
          sessionId: 'sess-401',
          workspaceId: null,
          projectId: null,
        },
        recordedAt: '2025-01-01T00:00:00Z',
      });

      expect(result['checkpoint_id']).toBeNull();
      expect(result['session_status']).toBeNull();
    });
  });
});

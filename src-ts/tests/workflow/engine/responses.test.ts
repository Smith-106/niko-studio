import { describe, expect, it } from 'vitest';

import {
  buildWorkflowExecutionErrorResponse,
  buildWorkflowExecutionSuccessResponse,
  buildWorkflowExecutionTerminalResponse,
  buildWorkflowLifecycleActionContract,
  buildWorkflowLifecycleActionResponse,
  buildWorkflowLifecycleStatusContract,
  buildWorkflowLifecycleStatusResponse,
  buildWorkflowOperationError,
  buildWorkflowPlanResponse,
  buildWorkflowPlanStatusResponse,
  buildWorkflowRouteResponse,
  buildWorkflowRunBlockedResponse,
  buildWorkflowRunCompletedResponse,
  buildWorkflowRunFailedResponse,
  buildWorkflowStreamErrorEvent,
  buildWorkflowStreamEvents,
  buildWorkflowStreamPlanBlockedEvent,
  buildWorkflowStreamPlanCompleteEvent,
  buildWorkflowStreamPlanCreatedEvent,
  buildWorkflowStreamPlanErrorEvent,
  buildWorkflowStreamStepCompleteEvent,
  buildWorkflowStreamStepStartEvent,
  buildWorkflowWaitingConfirmationResponse,
  isWorkflowBlockedStatus,
  isWorkflowExecutionComplete,
} from '../../../workflow/engine/responses.js';
import type {
  WorkflowExecuteResult,
  WorkflowExecutionResponseContext,
  WorkflowPlanResult,
  WorkflowPlanRuntimeResponseContext,
  WorkflowPlanStatusResult,
  WorkflowRecommendation,
  WorkflowRiskGateResult,
  WorkflowStateResumeMetadataContract,
} from '../../../workflow/engine/engine-contracts.js';

const resumeMetadata: WorkflowStateResumeMetadataContract = {
  current_phase: 'execution',
  state_trace_id: 'trace-001',
  can_resume_from_checkpoint: true,
  observability: { trace: 'trace-001' },
  budget_guardrail: { spent: 3 },
  handoff_package: { owner: 'qa' },
  session_status: 'active',
  workspace_authority: {
    session_id: 'session-1',
    workspace_id: 'workspace-1',
    project_id: 'project-1',
  },
};

const gate: WorkflowRiskGateResult = {
  decision: 'allow',
  reason: 'safe',
  risk: 'low',
  blocking: false,
  destructive: false,
  confirm_required: false,
  confirmed: true,
};

const recommendations: WorkflowRecommendation[] = [
  { action: 'validate', detail: 'check output' },
];

const plan: WorkflowPlanResult = {
  plan_id: 'plan-1',
  level: 'L3',
  template_meta: { source: 'template' },
  gate_decision: 'allow',
  recommendations,
  recommendations_frozen: true,
  plan_hash: 'hash-1',
  execution_mode: 'auto',
  observability_metrics: { latency_ms: 10 },
  budget_guardrail: { max_tokens: 1000 },
  steps: [
    {
      id: 'step-1',
      name: 'Draft',
      description: 'Create draft',
      dependencies: [],
      status: 'pending',
    },
  ],
  total_steps: 1,
};

const finalStatus: WorkflowPlanStatusResult = {
  plan_id: 'plan-1',
  task: 'Ship feature',
  level: 'L3',
  status: 'completed',
  runner_state: 'idle',
  triage_state: 'clear',
  fix_status: 'none',
  fix_owner: 'n/a',
  template_meta: { source: 'template' },
  gate_decision: 'allow',
  recommendations,
  recommendations_frozen: true,
  plan_hash: 'hash-1',
  execution_mode: 'auto',
  observability_metrics: { latency_ms: 10 },
  budget_guardrail: { max_tokens: 1000 },
  handoff_package: { summary: 'ready' },
  steps: [
    {
      id: 'step-1',
      name: 'Draft',
      status: 'completed',
      output: { text: 'ok' },
    },
  ],
  progress: '1/1',
};

const runtime: WorkflowPlanRuntimeResponseContext = {
  executionMode: 'auto',
  observabilityMetrics: { latency_ms: 10 },
  budgetGuardrail: { max_tokens: 1000 },
  handoffPackage: { summary: 'ready' },
  sessionStatus: 'active',
};

const executionContext: WorkflowExecutionResponseContext = {
  executionMode: 'auto',
  observabilityMetrics: { latency_ms: 10 },
  budgetGuardrail: { max_tokens: 1000 },
  remainingSteps: 0,
  stateResumeMetadata: resumeMetadata,
};

describe('workflow/engine/responses', () => {
  it('builds route and plan responses with workflow metadata', () => {
    const route = buildWorkflowRouteResponse({
      level: 'L3',
      description: 'Use L3 workflow',
      suggestedWorkflow: [{ name: 'draft', description: 'Draft content' }],
      reason: 'matched capability',
      matchedFeatures: [{ id: 'feature-1' }],
      score: 0.9,
      finalLevel: 'L4',
      routingDiagnostics: { heuristic: 'score' },
    });

    const planResponse = buildWorkflowPlanResponse({
      planId: 'plan-1',
      level: 'L3',
      templateMeta: { source: 'template' },
      gateDecision: 'allow',
      recommendations,
      recommendationsFrozen: true,
      planHash: 'hash-1',
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 10 },
      budgetGuardrail: { max_tokens: 1000 },
      steps: plan.steps,
      totalSteps: 1,
    });

    expect(route).toEqual({
      level: 'L3',
      description: 'Use L3 workflow',
      suggested_workflow: [{ name: 'draft', description: 'Draft content' }],
      reason: 'matched capability',
      matched_features: [{ id: 'feature-1' }],
      score: 0.9,
      final_level: 'L4',
      routing_diagnostics: { heuristic: 'score' },
    });
    expect(planResponse).toEqual(plan);
  });

  it('builds waiting, success, terminal and error execution responses', () => {
    const waiting = buildWorkflowWaitingConfirmationResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'ready',
      runnerState: 'paused',
      remainingSteps: 2,
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 10 },
      budgetGuardrail: { max_tokens: 1000 },
      stateResumeMetadata: resumeMetadata,
      gate,
    });

    const success = buildWorkflowExecutionSuccessResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'completed',
      runnerState: 'idle',
      remainingSteps: 1,
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 11 },
      budgetGuardrail: { max_tokens: 999 },
      stateResumeMetadata: resumeMetadata,
      result: { text: 'done' },
      gate,
    });

    const terminal = buildWorkflowExecutionTerminalResponse({
      ...executionContext,
      message: 'all done',
    });

    const error = buildWorkflowExecutionErrorResponse({
      error: 'step failed',
      stepId: 'step-2',
      executionMode: 'manual',
      observabilityMetrics: { latency_ms: 99 },
      budgetGuardrail: { max_tokens: 100 },
      stateResumeMetadata: resumeMetadata,
    });

    expect(waiting).toMatchObject({
      step_id: 'step-1',
      step_name: 'Draft',
      status: 'waiting_confirmation',
      gate,
      plan_status: 'ready',
      runner_state: 'paused',
      remaining_steps: 2,
      execution_mode: 'auto',
      budget_guardrail: { max_tokens: 1000 },
      current_phase: 'execution',
    });
    expect(success).toMatchObject({
      step_id: 'step-1',
      step_name: 'Draft',
      status: 'completed',
      result: { text: 'done' },
      gate,
      remaining_steps: 1,
      current_phase: 'execution',
    });
    expect(terminal).toMatchObject({
      status: 'completed',
      message: 'all done',
      execution_mode: 'auto',
      current_phase: 'execution',
    });
    expect(error).toEqual({
      error: 'step failed',
      step_id: 'step-2',
      failure: { phase: 'executing', reason: 'step failed' },
      execution_mode: 'manual',
      observability_metrics: { latency_ms: 99 },
      ...resumeMetadata,
      budget_guardrail: { max_tokens: 100 },
    });
  });

  it('builds lifecycle responses and contracts from runtime metadata', () => {
    const statusResponse = buildWorkflowLifecycleStatusResponse({
      planId: 'plan-1',
      action: 'resume',
      runnerState: 'running',
      triageState: 'pending',
      fixStatus: 'queued',
      fixOwner: 'bot',
      planStatus: 'active',
      lane: 'release',
      qualityMetrics: { score: 95 },
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 1 },
      budgetGuardrail: { max_tokens: 1000 },
      handoffPackage: { summary: 'handoff' },
      sessionStatus: 'active',
    });
    const actionResponse = buildWorkflowLifecycleActionResponse({
      planId: 'plan-1',
      action: 'resume',
      runnerState: 'running',
      triageState: 'pending',
      fixStatus: 'queued',
      fixOwner: 'bot',
      planStatus: 'active',
      checkpointId: 'checkpoint-1',
      lane: 'release',
      qualityMetrics: { score: 95 },
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 1 },
      budgetGuardrail: { max_tokens: 1000 },
      handoffPackage: { summary: 'handoff' },
      sessionStatus: null,
    });
    const statusContract = buildWorkflowLifecycleStatusContract({
      planId: 'plan-1',
      action: 'ignored',
      runnerState: 'running',
      triageState: 'pending',
      fixStatus: 'queued',
      fixOwner: 'bot',
      planStatus: 'active',
      lane: 'release',
      qualityMetrics: { score: 95 },
      runtime,
    });
    const actionContract = buildWorkflowLifecycleActionContract({
      planId: 'plan-1',
      action: 'resume',
      runnerState: 'running',
      triageState: 'pending',
      fixStatus: 'queued',
      fixOwner: 'bot',
      planStatus: 'active',
      checkpointId: 'checkpoint-1',
      lane: 'release',
      qualityMetrics: { score: 95 },
      runtime,
    });

    expect(statusResponse.action).toBe('status');
    expect(statusResponse.session_status).toBe('active');
    expect(actionResponse.checkpoint_id).toBe('checkpoint-1');
    expect(actionResponse.session_status).toBeNull();
    expect(statusContract).toMatchObject({
      action: 'status',
      execution_mode: 'auto',
      handoff_package: { summary: 'ready' },
      session_status: 'active',
    });
    expect(actionContract).toMatchObject({
      action: 'resume',
      checkpoint_id: 'checkpoint-1',
      execution_mode: 'auto',
      handoff_package: { summary: 'ready' },
    });
  });

  it('builds plan status and run result envelopes', () => {
    const status = buildWorkflowPlanStatusResponse({
      planId: 'plan-1',
      task: 'Ship feature',
      level: 'L3',
      status: 'running',
      runnerState: 'working',
      triageState: 'pending',
      fixStatus: 'queued',
      fixOwner: 'bot',
      templateMeta: { source: 'template' },
      gateDecision: 'allow',
      recommendations,
      recommendationsFrozen: false,
      planHash: 'hash-2',
      executionMode: 'manual',
      observabilityMetrics: { latency_ms: 12 },
      budgetGuardrail: { max_tokens: 888 },
      handoffPackage: { summary: 'handoff' },
      steps: [
        {
          id: 'step-1',
          name: 'Draft',
          status: 'completed',
          output: { text: 'ok' },
        },
      ],
      progress: '1/3',
    });

    const stepResult: WorkflowExecuteResult = buildWorkflowExecutionSuccessResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'running',
      runnerState: 'working',
      remainingSteps: 2,
      executionMode: 'manual',
      observabilityMetrics: { latency_ms: 20 },
      budgetGuardrail: { max_tokens: 800 },
      stateResumeMetadata: resumeMetadata,
      result: { text: 'ok' },
      gate,
    });

    expect(status).toMatchObject({
      status: 'running',
      runner_state: 'working',
      progress: '1/3',
      execution_mode: 'manual',
    });
    expect(buildWorkflowRunFailedResponse({
      planId: 'plan-1',
      plan,
      error: new Error('boom'),
    })).toMatchObject({
      status: 'failed',
      plan_id: 'plan-1',
      plan,
    });
    expect(buildWorkflowRunBlockedResponse({
      planId: 'plan-1',
      plan,
      lastStep: stepResult,
      finalStatus: status,
    })).toEqual({
      status: 'blocked',
      plan_id: 'plan-1',
      plan,
      last_step: stepResult,
      final_status: status,
    });
    expect(buildWorkflowRunCompletedResponse({
      planId: 'plan-1',
      plan,
      lastStep: stepResult,
      finalStatus: status,
    })).toEqual({
      status: 'completed',
      plan_id: 'plan-1',
      plan,
      last_step: stepResult,
      final_status: status,
    });
  });

  it('builds stream events for each result branch', () => {
    const stepResult: WorkflowExecuteResult = buildWorkflowExecutionSuccessResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'running',
      runnerState: 'working',
      remainingSteps: 1,
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 1 },
      budgetGuardrail: { max_tokens: 1000 },
      stateResumeMetadata: resumeMetadata,
      result: { text: 'ok' },
      gate,
    });
    const blockedResult: WorkflowExecuteResult = buildWorkflowWaitingConfirmationResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'running',
      runnerState: 'paused',
      remainingSteps: 1,
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 2 },
      budgetGuardrail: { max_tokens: 1000 },
      stateResumeMetadata: resumeMetadata,
      gate,
    });
    const completeResult: WorkflowExecuteResult = buildWorkflowExecutionSuccessResponse({
      stepId: 'step-1',
      stepName: 'Draft',
      planStatus: 'completed',
      runnerState: 'idle',
      remainingSteps: 0,
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 3 },
      budgetGuardrail: { max_tokens: 1000 },
      stateResumeMetadata: resumeMetadata,
      result: { text: 'done' },
      gate,
    });
    const errorResult: WorkflowExecuteResult = buildWorkflowExecutionErrorResponse({
      error: 'bad',
      stepId: 'step-1',
      executionMode: 'auto',
      observabilityMetrics: { latency_ms: 4 },
      budgetGuardrail: { max_tokens: 1000 },
      stateResumeMetadata: resumeMetadata,
    });

    expect(buildWorkflowStreamErrorEvent({ error: 'fatal' })).toEqual({
      type: 'error',
      status: 'failed',
      error: 'fatal',
    });
    expect(buildWorkflowStreamPlanCreatedEvent({ planId: 'plan-1', plan })).toEqual({
      type: 'plan_created',
      plan_id: 'plan-1',
      plan,
    });
    expect(buildWorkflowStreamStepStartEvent({
      planId: 'plan-1',
      stepId: 'step-1',
      stepName: 'Draft',
      iteration: 2,
    })).toEqual({
      type: 'step_start',
      plan_id: 'plan-1',
      step_id: 'step-1',
      step_name: 'Draft',
      iteration: 2,
    });
    expect(buildWorkflowStreamStepCompleteEvent({
      planId: 'plan-1',
      result: stepResult,
    })).toEqual({
      type: 'step_complete',
      plan_id: 'plan-1',
      ...stepResult,
    });
    expect(buildWorkflowStreamPlanErrorEvent({ planId: 'plan-1', error: 'bad' })).toEqual({
      type: 'plan_error',
      plan_id: 'plan-1',
      error: 'bad',
    });
    expect(buildWorkflowStreamPlanBlockedEvent({
      planId: 'plan-1',
      status: 'waiting_confirmation',
      lastStep: blockedResult,
    })).toEqual({
      type: 'plan_blocked',
      plan_id: 'plan-1',
      status: 'waiting_confirmation',
      last_step: blockedResult,
    });
    expect(buildWorkflowStreamPlanCompleteEvent({
      planId: 'plan-1',
      plan,
      lastStep: completeResult,
      finalStatus,
    })).toEqual({
      type: 'plan_complete',
      plan_id: 'plan-1',
      status: 'completed',
      plan,
      last_step: completeResult,
      final_status: finalStatus,
    });

    expect(buildWorkflowStreamEvents({
      planId: 'plan-1',
      plan,
      result: errorResult,
      finalStatus,
      iteration: 1,
      currentStep: { id: 'step-1', name: 'Draft' },
    }).map(event => event.type)).toEqual(['step_start', 'step_complete', 'plan_error']);

    expect(buildWorkflowStreamEvents({
      planId: 'plan-1',
      plan,
      result: blockedResult,
      finalStatus,
      iteration: 2,
      currentStep: null,
    }).map(event => event.type)).toEqual(['step_complete', 'plan_blocked']);

    expect(buildWorkflowStreamEvents({
      planId: 'plan-1',
      plan,
      result: completeResult,
      finalStatus,
      iteration: 3,
      currentStep: { id: 'step-1', name: 'Draft' },
    }).map(event => event.type)).toEqual(['step_start', 'step_complete', 'plan_complete']);
  });

  it('detects blocked and completed workflow states and preserves extra error fields', () => {
    expect(isWorkflowBlockedStatus('waiting_confirmation')).toBe(true);
    expect(isWorkflowBlockedStatus('preflight_blocked')).toBe(true);
    expect(isWorkflowBlockedStatus('gate_blocked')).toBe(true);
    expect(isWorkflowBlockedStatus('completed')).toBe(false);

    expect(isWorkflowExecutionComplete({
      status: 'completed',
      remaining_steps: 0,
    })).toBe(true);
    expect(isWorkflowExecutionComplete({
      status: 'completed',
      remaining_steps: 2,
    })).toBe(false);
    expect(isWorkflowExecutionComplete({
      status: 'completed',
    })).toBe(false);
    expect(isWorkflowExecutionComplete({
      plan_status: 'completed',
      status: 'waiting_confirmation',
    })).toBe(true);

    expect(buildWorkflowOperationError({
      error: 'bad input',
      fields: { code: 'E_BAD_INPUT', retryable: false },
    })).toEqual({
      error: 'bad input',
      code: 'E_BAD_INPUT',
      retryable: false,
    });
  });
});

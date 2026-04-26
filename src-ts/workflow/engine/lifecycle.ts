import {
  executeWorkflowLifecycleTransition,
  normalizeWorkflowLifecycleAction,
} from './flow-control.js';
import type { WorkflowLifecycleResult } from './engine-contracts.js';

interface WorkflowLifecyclePlanLike {
  id: string;
  template_meta: Record<string, unknown>;
}

interface WorkflowLifecycleTransitionInput {
  plan: WorkflowLifecyclePlanLike;
  action: string;
  triageState?: string;
  createPauseCheckpoint: (description: string, planId: string) => Promise<string | undefined>;
  setRunnerState: (
    targetState: string,
    checkpointId?: string,
    transitionReason?: string,
  ) => Record<string, unknown>;
  setTriageState: (triageState: string, transitionReason?: string) => void;
  persistHandoffPackage: (trigger: string) => void;
  buildLifecycleActionResponse: (
    action: string,
    checkpointId: string | undefined,
    sessionStatus: string | null,
  ) => WorkflowLifecycleResult;
}

export async function runWorkflowLifecycleTransition(
  input: WorkflowLifecycleTransitionInput,
): Promise<WorkflowLifecycleResult | { error: string }> {
  return executeWorkflowLifecycleTransition({
    plan: input.plan,
    normalizedAction: normalizeWorkflowLifecycleAction(input.action),
    triageState: input.triageState,
    createPauseCheckpoint: async (plan) =>
      input.createPauseCheckpoint(`loop-pause:${plan.id}`, plan.id),
    setRunnerState: (_plan, targetState, checkpointId, transitionReason) =>
      input.setRunnerState(targetState, checkpointId, transitionReason),
    setTriageState: (_plan, triageState, transitionReason) =>
      input.setTriageState(triageState, transitionReason),
    persistHandoff: (_plan, trigger) => {
      input.persistHandoffPackage(trigger);
    },
    buildActionResponse: (_plan, action, checkpointId, sessionStatus) =>
      input.buildLifecycleActionResponse(action, checkpointId, sessionStatus),
  });
}

import {
  resolveLifecycleTargetState,
  resolveWorkflowLifecycleSessionStatus,
  shouldCreateWorkflowPauseCheckpoint,
  shouldPersistWorkflowHandoff,
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
  const targetState = resolveLifecycleTargetState(input.action);
  if (!targetState) {
    return { error: `Unsupported lifecycle action: ${input.action}` };
  }

  let checkpointId: string | undefined;
  if (shouldCreateWorkflowPauseCheckpoint(input.action)) {
    checkpointId = await input.createPauseCheckpoint(`loop-pause:${input.plan.id}`, input.plan.id);
  }

  let sessionLifecycle: Record<string, unknown> = {};
  try {
    sessionLifecycle = input.setRunnerState(
      targetState,
      checkpointId,
      `lifecycle:${input.action}`,
    );
    if (input.triageState) {
      input.setTriageState(
        input.triageState.trim().toLowerCase(),
        `lifecycle:${input.action}`,
      );
    }
  } catch (exc) {
    return { error: String(exc) };
  }

  if (shouldPersistWorkflowHandoff(input.action)) {
    input.persistHandoffPackage(input.action);
  }

  return input.buildLifecycleActionResponse(
    input.action,
    checkpointId,
    resolveWorkflowLifecycleSessionStatus(sessionLifecycle, input.plan.template_meta),
  );
}

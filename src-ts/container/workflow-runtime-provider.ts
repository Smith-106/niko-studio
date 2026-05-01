import { WorkflowEngine as WorkflowEngineRuntime } from '../workflow/workflow-engine.js';
import type { WorkflowAuthority } from '../workflow/engine/authority.js';
import type {
  WorkflowExecutionContextPayload,
  WorkflowRecommendationInput,
} from '../workflow/engine/engine-contracts.js';

export interface WorkflowCheckpointSnapshot {
  id: string;
  description: string;
  commit_hash?: string | null;
  created_at: string;
  plan_id?: string | null;
  step_id?: string | null;
  replay_payload?: Record<string, unknown>;
}

export interface IWorkflowEngineRuntime {
  route(task: string): Promise<Record<string, unknown>>;
  plan(
    task: string,
    level?: string,
    recommendations?: WorkflowRecommendationInput,
    executionContext?: WorkflowExecutionContextPayload,
  ): Promise<Record<string, unknown>>;
  execute(
    planId: string,
    stepId?: string,
    recommendations?: WorkflowRecommendationInput,
    confirmToken?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  quickRollback(
    planId: string,
    checkpointId: string,
    reason: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  lifecycle(
    planId: string,
    action: string,
    triageState?: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  createCheckpoint(description: string, autoCommit: boolean): Promise<Record<string, unknown>>;
  restoreCheckpoint(checkpointId: string, confirmToken?: string): Promise<Record<string, unknown>>;
  listCheckpoints(limit: number): Promise<Array<Record<string, unknown>>>;
  bindPlanSession(planId: string, sessionId: string): string;
  bindPlanAuthority?(planId: string, authority: WorkflowAuthority): WorkflowAuthority;
  getPlanAuthority?(planId: string): WorkflowAuthority;
  getCheckpoint?(checkpointId: string): WorkflowCheckpointSnapshot | null;
}

export type WorkflowEngineRuntimeProvider = (params: {
  workspace: string;
  sessionNamespace: string;
}) => IWorkflowEngineRuntime;

const defaultWorkflowEngineRuntimeProvider: WorkflowEngineRuntimeProvider = ({
  workspace,
  sessionNamespace,
}) => new WorkflowEngineRuntime(workspace, sessionNamespace) as unknown as IWorkflowEngineRuntime;

let workflowEngineRuntimeProvider: WorkflowEngineRuntimeProvider = defaultWorkflowEngineRuntimeProvider;
let workflowEngineRuntimeProviderVersion = 0;

export function getWorkflowEngineRuntimeProvider(): WorkflowEngineRuntimeProvider {
  return workflowEngineRuntimeProvider;
}

export function getWorkflowEngineRuntimeProviderVersion(): number {
  return workflowEngineRuntimeProviderVersion;
}

export function setWorkflowEngineRuntimeProvider(provider?: WorkflowEngineRuntimeProvider | null): void {
  workflowEngineRuntimeProvider = provider ?? defaultWorkflowEngineRuntimeProvider;
  workflowEngineRuntimeProviderVersion += 1;
}

export function resetWorkflowEngineRuntimeProvider(): void {
  workflowEngineRuntimeProvider = defaultWorkflowEngineRuntimeProvider;
  workflowEngineRuntimeProviderVersion += 1;
}

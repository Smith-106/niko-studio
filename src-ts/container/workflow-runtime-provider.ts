import { WorkflowEngine as WorkflowEngineRuntime } from '../workflow/workflow-engine.js';

export type WorkflowEngineRuntimeProvider = (params: {
  workspace: string;
  sessionNamespace: string;
}) => unknown;

const defaultWorkflowEngineRuntimeProvider: WorkflowEngineRuntimeProvider = ({
  workspace,
  sessionNamespace,
}) => new WorkflowEngineRuntime(workspace, sessionNamespace);

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

import { readRuntimePreferences } from '@/runtime/preferences'

export type WorkflowBackendMode = 'standard' | 'uiBridge'

export type WorkflowPlanEndpointPath =
  | '/route'
  | '/plan'
  | '/execute'
  | '/lifecycle'

export type WorkflowSchedulerEndpointPath =
  | '/scheduler/register'
  | '/scheduler/list'
  | '/scheduler/pause'
  | '/scheduler/resume'
  | '/scheduler/run-now'
  | '/scheduler/import-lite-plan'

export type WorkflowEndpointPath = WorkflowPlanEndpointPath | WorkflowSchedulerEndpointPath

const resolveWorkflowPrefix = (mode: WorkflowBackendMode): '/workflow' | '/ui-bridge/workflow' => (
  mode === 'uiBridge' ? '/ui-bridge/workflow' : '/workflow'
)

export function resolveWorkflowEndpoint(
  path: WorkflowEndpointPath,
  mode?: WorkflowBackendMode,
): string {
  const backendMode = mode ?? readRuntimePreferences().workflowBackendMode
  return `${resolveWorkflowPrefix(backendMode)}${path}`
}

export function resolveWorkflowSchedulerEndpoint(
  path: WorkflowSchedulerEndpointPath,
  mode?: WorkflowBackendMode,
): string {
  const backendMode = mode ?? readRuntimePreferences().workflowBackendMode
  return `${resolveWorkflowPrefix(backendMode)}${path}`
}

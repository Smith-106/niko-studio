import { readRuntimePreferences } from '@/runtime/preferences'

export function resolveWorkflowEndpoint(
  path: '/route' | '/plan' | '/execute' | '/lifecycle',
  mode?: 'standard' | 'uiBridge',
): string {
  const backendMode = mode ?? readRuntimePreferences().workflowBackendMode
  const prefix = backendMode === 'uiBridge' ? '/ui-bridge/workflow' : '/workflow'
  return `${prefix}${path}`
}

import { useSettingsStore } from '@/stores/settingsStore'

export function resolveWorkflowEndpoint(
  path: '/route' | '/plan' | '/execute' | '/lifecycle',
  mode?: 'standard' | 'uiBridge',
): string {
  const backendMode = mode ?? useSettingsStore.getState().settings.workflowBackendMode
  const prefix = backendMode === 'uiBridge' ? '/ui/workflow' : '/workflow'
  return `${prefix}${path}`
}

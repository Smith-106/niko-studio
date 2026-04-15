import type { WorkflowBackendMode } from '@/contracts/runtimePreferences'

export interface RuntimePreferencesSnapshot {
  apiBaseUrl: string
  workflowBackendMode: WorkflowBackendMode
}

const DEFAULT_RUNTIME_PREFERENCES: RuntimePreferencesSnapshot = {
  apiBaseUrl: 'http://127.0.0.1:8000',
  workflowBackendMode: 'standard',
}

let runtimePreferences: RuntimePreferencesSnapshot = { ...DEFAULT_RUNTIME_PREFERENCES }

export function readRuntimePreferences(): RuntimePreferencesSnapshot {
  return runtimePreferences
}

export function setRuntimePreferences(
  nextPreferences: RuntimePreferencesSnapshot,
): RuntimePreferencesSnapshot {
  runtimePreferences = { ...nextPreferences }
  return runtimePreferences
}

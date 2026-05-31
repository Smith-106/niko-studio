import { type ApiResponse, callApi } from './core'

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  dimension?: string
  enabled: boolean
}

export interface PluginResult {
  success: boolean
  output: string
  error?: string
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  dimension?: string
  rules: Array<{ keyword: string; score: number; evidence: string; suggestion?: string }>
}

export async function listPlugins(): Promise<ApiResponse<{ plugins: PluginInfo[] }>> {
  return callApi('/plugins/list', 'GET')
}

export async function executePlugin(
  pluginId: string,
  text: string,
): Promise<ApiResponse<{ results: PluginResult[] }>> {
  return callApi('/plugins/execute', 'POST', { pluginId, text })
}

export async function registerPlugin(
  manifest: PluginManifest,
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi('/plugins/register', 'POST', manifest as unknown as Record<string, unknown>)
}

import { type ApiResponse, callApi } from './core'

export interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
}

export interface PluginResult {
  success: boolean
  output: string
  error?: string
}

export async function listPlugins(): Promise<ApiResponse<{ plugins: PluginInfo[] }>> {
  return callApi('/plugins/list', 'GET')
}

export async function executePlugin(
  pluginId: string,
  input: Record<string, unknown>,
): Promise<ApiResponse<{ results: PluginResult[] }>> {
  return callApi('/plugins/execute', 'POST', { plugin_id: pluginId, input })
}

export async function registerPlugin(
  manifest: { name: string; version: string; description: string; entryPoint: string },
): Promise<ApiResponse<{ id: string; status: string }>> {
  return callApi('/plugins/register', 'POST', manifest)
}

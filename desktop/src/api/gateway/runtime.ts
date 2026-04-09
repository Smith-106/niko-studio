import type {
  GatewayConnectionState,
  GatewayHealth,
  GatewayMetrics,
  GatewayRuntimeView,
} from '../contracts'

import {
  type ApiResponse,
  callApi,
  checkTauriBackendHealth,
  getResolvedApiBase,
  isTauriRuntime,
  startTauriBackend,
} from '../core'

export type GatewayTools = Record<string, string[]>

function fallbackConnectionState(
  backendHealthy: boolean,
  services?: Record<string, string>,
): GatewayConnectionState {
  if (!backendHealthy) {
    return 'disconnected'
  }

  const serviceValues = Object.values(services || {})
  if (serviceValues.length === 0) {
    return 'connected'
  }
  return serviceValues.every((value) => value === 'ok') ? 'connected' : 'degraded'
}

export function deriveGatewayRuntimeState(
  health: GatewayHealth | null | undefined,
  backendHealthy: boolean,
): GatewayRuntimeView {
  const fallbackState = fallbackConnectionState(backendHealthy, health?.services)
  const runtime = health?.mcp_runtime

  return {
    connectionState: runtime?.connection_state ?? fallbackState,
    reconnectState: runtime?.reconnect_state ?? (fallbackState === 'connected' ? 'idle' : 'failed'),
    sessionId: runtime?.session_id ?? null,
    reconnectAttempts: runtime?.reconnect_attempts ?? 0,
    lastError: runtime?.last_error ?? null,
    lastProbeAt: runtime?.last_probe_at ?? null,
    servers: runtime?.servers ?? {},
  }
}

export async function startBackend(): Promise<ApiResponse<string>> {
  if (!isTauriRuntime()) {
    return { success: false, error: 'Not in Tauri environment' }
  }
  try {
    const result = await startTauriBackend()
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      return await checkTauriBackendHealth()
    } catch {
      return false
    }
  }

  try {
    const response = await fetch(`${getResolvedApiBase()}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function getGatewayHealth(): Promise<ApiResponse<GatewayHealth>> {
  return callApi('/health', 'GET')
}

export async function getGatewayMetrics(): Promise<ApiResponse<{ status: string; metrics: GatewayMetrics }>> {
  return callApi('/metrics', 'GET')
}

export async function listGatewayTools(): Promise<ApiResponse<GatewayTools>> {
  return callApi('/tools', 'GET')
}

export async function checkHealth(): Promise<boolean> {
  return checkBackendHealth()
}

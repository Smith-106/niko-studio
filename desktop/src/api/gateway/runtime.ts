import type {
  GatewayApiErrorData,
  GatewayConnectionState,
  GatewayHealth,
  GatewayHealthErrorResponse,
  GatewayMetrics,
  GatewayRuntimeDiagnostic,
  GatewayRuntimeView,
} from '../contracts'

import {
  type ApiResponse,
  callApi,
  checkTauriBackendHealth,
  getResolvedApiBase,
  isTauriRuntime,
  startTauriBackend,
  restartTauriBackend,
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
    diagnostic: runtime?.diagnostic ?? health?.diagnostic ?? null,
    servers: runtime?.servers ?? {},
  }
}

function extractGatewayDiagnostics(payload: unknown): GatewayRuntimeDiagnostic | null {
  if (!payload || typeof payload !== 'object') return null
  const errorPayload = payload as GatewayHealthErrorResponse
  return errorPayload.mcp_runtime?.diagnostic ?? errorPayload.diagnostic ?? null
}

export function toGatewayHealthFromErrorData(
  errorData: GatewayApiErrorData | GatewayHealthErrorResponse | null | undefined,
): GatewayHealth | null {
  if (!errorData) return null
  return {
    status: errorData.status ?? 'degraded',
    version: 'unavailable',
    services: {},
    diagnostic: extractGatewayDiagnostics(errorData),
    mcp_runtime: errorData.mcp_runtime,
  }
}

function buildFetchErrorResponse(error: unknown): GatewayHealthErrorResponse {
  const message = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'Failed to fetch gateway health'
  const resolvedBase = getResolvedApiBase()
  const detail = `${message} (gateway: ${resolvedBase})`
  return {
    error: detail,
    status: 'error',
    diagnostic: {
      failure_class: 'runtime_unavailable',
      summary: message,
      detail,
      action: `Check that the gateway is running at ${resolvedBase}/health`,
    },
    mcp_runtime: {
      connection_state: 'disconnected',
      reconnect_state: 'failed',
      reconnect_attempts: 0,
      last_error: detail,
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: message,
        detail,
        action: `Check that the gateway is running at ${resolvedBase}/health`,
      },
    },
  }
}

export async function getGatewayHealth(): Promise<ApiResponse<GatewayHealth, GatewayApiErrorData>> {
  const response = await callApi<GatewayHealth, GatewayHealthErrorResponse>('/health', 'GET')
  if (response.success) {
    return response
  }

  if (response.errorData) {
    return {
      success: false,
      error: response.error,
      errorData: {
        ...response.errorData,
        diagnostic: extractGatewayDiagnostics(response.errorData),
      },
    }
  }

  try {
    const directResponse = await fetch(`${getResolvedApiBase()}/health`)
    const payload = (await directResponse.json()) as GatewayHealthErrorResponse
    return {
      success: false,
      error: response.error,
      errorData: {
        ...payload,
        diagnostic: extractGatewayDiagnostics(payload),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: response.error,
      errorData: buildFetchErrorResponse(error),
    }
  }
}

export async function getGatewayMetrics(): Promise<ApiResponse<{ status: string; metrics: GatewayMetrics }, GatewayApiErrorData>> {
  return callApi('/metrics', 'GET')
}

export async function listGatewayTools(): Promise<ApiResponse<GatewayTools, GatewayApiErrorData>> {
  return callApi('/tools', 'GET')
}

export function extractGatewayHealthFailure(
  response: ApiResponse<GatewayHealth, GatewayApiErrorData> | null | undefined,
): GatewayRuntimeDiagnostic | null {
  return response?.errorData?.mcp_runtime?.diagnostic ?? response?.errorData?.diagnostic ?? null
}

export function formatGatewayHealthError(
  response: ApiResponse<GatewayHealth, GatewayApiErrorData> | null | undefined,
): string | null {
  return response?.errorData?.mcp_runtime?.last_error
    ?? extractGatewayHealthFailure(response)?.detail
    ?? extractGatewayHealthFailure(response)?.summary
    ?? response?.error
    ?? null
}

export function mergeGatewayHealthState(
  backendHealthy: boolean,
  response: ApiResponse<GatewayHealth, GatewayApiErrorData> | null | undefined,
): GatewayRuntimeView {
  if (response?.success && response.data) {
    return deriveGatewayRuntimeState(response.data, backendHealthy)
  }

  const errorHealth = toGatewayHealthFromErrorData(response?.errorData)
  const fallback = deriveGatewayRuntimeState(errorHealth, backendHealthy)
  const diagnostic = extractGatewayHealthFailure(response) ?? fallback.diagnostic
  const lastError = formatGatewayHealthError(response) ?? fallback.lastError

  return {
    ...fallback,
    connectionState: diagnostic?.failure_class === 'integration_degraded' && fallback.connectionState === 'connected'
      ? 'degraded'
      : fallback.connectionState,
    lastError,
    diagnostic,
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

export async function checkHealth(): Promise<boolean> {
  return checkBackendHealth()
}

export async function restartGatewayBackend(): Promise<ApiResponse<string>> {
  if (!isTauriRuntime()) {
    return { success: false, error: 'Not in Tauri environment' }
  }
  try {
    const result = await restartTauriBackend()
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

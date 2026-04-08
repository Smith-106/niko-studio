import type {
  GatewayConnectionState,
  GatewayHealth,
  GatewayMetrics,
  GatewayRuntimeView,
  GatewayServiceConfig,
  GatewayServiceConfigInput,
  GatewayServiceProbeResult,
} from './contracts'

import {
  GENERIC_API_ERROR_MESSAGE,
  type ApiResponse,
  callApi,
  checkTauriBackendHealth,
  getErrorName,
  getResolvedApiBase,
  isTauriRuntime,
  normalizeGatewayBaseUrl,
  startTauriBackend,
} from './core'

export type {
  GatewayConnectionState,
  GatewayHealth,
  GatewayMetrics,
  GatewayReconnectState,
  GatewayRuntime,
  GatewayRuntimeServerState,
  GatewayRuntimeView,
  GatewayServiceConfig,
  GatewayServiceConfigInput,
  GatewayServiceProbeResult,
} from './contracts'
export type GatewayTools = Record<string, string[]>

function fallbackConnectionState(backendHealthy: boolean, services?: Record<string, string>): GatewayConnectionState {
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
  backendHealthy: boolean
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

export interface ModelFetchResult {
  models: string[]
  source: 'gateway' | 'direct'
}

function deduplicateModels(models: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const model of models) {
    const normalized = model.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function normalizeModelName(model: string): string {
  if (model.startsWith('models/')) {
    return model.slice('models/'.length)
  }
  return model
}

function extractModelsFromPayload(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    const parsed = payload
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''
        const record = item as Record<string, unknown>
        if (typeof record.id === 'string') return record.id
        if (typeof record.name === 'string') return normalizeModelName(record.name)
        if (typeof record.model === 'string') return record.model
        return ''
      })
      .filter(Boolean)

    return deduplicateModels(parsed)
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const candidateKeys = ['models', 'data', 'items', 'result']

    for (const key of candidateKeys) {
      if (record[key] !== undefined) {
        const models = extractModelsFromPayload(record[key])
        if (models.length > 0) {
          return models
        }
      }
    }
  }

  return []
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  return response.json()
}

function buildModelFetchError(gatewayReason: string, directReason: string): string {
  return `gateway=${gatewayReason}; direct=${directReason}`
}

export async function fetchProviderModels(
  providerId: string,
  baseUrl: string,
  apiKey: string
): Promise<ApiResponse<ModelFetchResult>> {
  let gatewayReason = 'request_failed'

  try {
    const gatewayRes = await callApi<unknown>(`/models?provider=${encodeURIComponent(providerId)}`, 'GET')
    if (gatewayRes.success && gatewayRes.data) {
      const gatewayModels = extractModelsFromPayload(gatewayRes.data)
      if (gatewayModels.length > 0) {
        return { success: true, data: { models: gatewayModels, source: 'gateway' } }
      }
      gatewayReason = 'empty_models'
    } else {
      gatewayReason = (gatewayRes.error ?? '').trim() || 'request_failed'
    }
  } catch (error) {
    gatewayReason = getErrorName(error)
    console.error(`Gateway models fallback failed (${gatewayReason})`)
  }

  const normalizedBase = normalizeGatewayBaseUrl(baseUrl.trim())
  const trimmedApiKey = apiKey.trim()
  let payload: unknown

  try {
    switch (providerId) {
      case 'local': {
        payload = await requestJson(`${normalizedBase}/api/tags`)
        break
      }
      case 'google': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1beta/models?key=${encodeURIComponent(trimmedApiKey)}`)
        break
      }
      case 'anthropic': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1/models`, {
          headers: {
            'x-api-key': trimmedApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        break
      }
      case 'openai':
      case 'openrouter':
      default: {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        // OpenAI-compatible APIs use /v1/models endpoint
        const openaiBaseUrl = normalizedBase.includes('/v1') ? normalizedBase : `${normalizedBase}/v1`
        payload = await requestJson(`${openaiBaseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${trimmedApiKey}`,
          },
        })
        break
      }
    }

    const models = extractModelsFromPayload(payload)
    if (models.length === 0) {
      return {
        success: false,
        error: buildModelFetchError(gatewayReason, 'empty_models'),
      }
    }

    return { success: true, data: { models, source: 'direct' } }
  } catch (error) {
    const directReason = error instanceof Error ? error.message : GENERIC_API_ERROR_MESSAGE
    console.error(`Fetch provider models failed (${getErrorName(error)})`)
    return {
      success: false,
      error: buildModelFetchError(gatewayReason, directReason),
    }
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
  // 非 Tauri 环境直接检查
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

export async function listGatewayServiceConfigs(): Promise<ApiResponse<{ services: GatewayServiceConfig[] }>> {
  return callApi('/mcp/services', 'GET')
}

export async function createGatewayServiceConfig(
  payload: GatewayServiceConfigInput
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi('/mcp/services', 'POST', payload as Record<string, unknown>)
}

export async function updateGatewayServiceConfig(
  serviceId: string,
  payload: GatewayServiceConfigInput
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}`, 'PUT', payload as Record<string, unknown>)
}

export async function setGatewayServiceEnabled(
  serviceId: string,
  enabled: boolean
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}/enabled`, 'POST', { enabled })
}

export async function probeGatewayServiceHealth(
  serviceId: string
): Promise<ApiResponse<GatewayServiceProbeResult>> {
  return callApi(`/mcp/services/${encodeURIComponent(serviceId)}/health`, 'POST')
}

export async function checkHealth(): Promise<boolean> {
  return checkBackendHealth()
}

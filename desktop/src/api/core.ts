import { useSettingsStore } from '@/stores/settingsStore'

import {
  callTauriApi,
  checkTauriBackendHealth,
  getRuntimeGatewayBase,
  isTauriRuntime,
  normalizeGatewayBaseUrl,
  startTauriBackend,
} from './transport'
import type { GatewayRequestMethod } from './tauri-contract'

const DEFAULT_API_BASE = 'http://127.0.0.1:8000'
export const GENERIC_API_ERROR_MESSAGE = 'Request failed. Please try again.'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const getErrorName = (error: unknown): string =>
  error instanceof Error ? error.name : 'UnknownError'

const resolveApiBase = (): string => {
  const env = import.meta.env as Record<string, string | undefined>
  const envBase = env.NIKO_GATEWAY_URL ?? env.VITE_NIKO_GATEWAY_URL
  if (envBase && envBase.trim()) {
    return normalizeGatewayBaseUrl(envBase.trim())
  }

  const storeBase = useSettingsStore.getState().settings.apiBaseUrl
  if (storeBase && storeBase.trim()) {
    return normalizeGatewayBaseUrl(storeBase.trim())
  }

  return DEFAULT_API_BASE
}

// Gateway configuration:
// - Default local 127.0.0.1:8000
// - Remote mode: env(NIKO_GATEWAY_URL / VITE_NIKO_GATEWAY_URL) or settings apiBaseUrl
export const getResolvedApiBase = (): string => resolveApiBase()

/**
 * 统一 API 调用方法
 * 在 Tauri 环境中使用 invoke，否则直接 fetch
 */
export async function callApi<T>(
  endpoint: string,
  method: GatewayRequestMethod = 'GET',
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    let data: T

    if (isTauriRuntime()) {
      const response = await callTauriApi({
        endpoint,
        method,
        body: body ? JSON.stringify(body) : null,
      })
      data = JSON.parse(response)
    } else {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      }
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body)
      }
      const response = await fetch(`${getResolvedApiBase()}${endpoint}`, options)
      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }

      if (!response.ok) {
        const errorMessage =
          payload &&
          typeof payload === 'object' &&
          typeof (payload as { error?: unknown }).error === 'string' &&
          (payload as { error: string }).error.trim().length > 0
            ? (payload as { error: string }).error
            : `HTTP error: ${response.status}`
        return { success: false, error: errorMessage }
      }

      data = payload as T
    }

    return { success: true, data }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    console.error(`API call failed: ${endpoint} (${errorName})`)
    return { success: false, error: GENERIC_API_ERROR_MESSAGE }
  }
}

export {
  checkTauriBackendHealth,
  getRuntimeGatewayBase,
  isTauriRuntime,
  normalizeGatewayBaseUrl,
  startTauriBackend,
}

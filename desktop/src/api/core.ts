import { readRuntimePreferences } from '@/runtime/preferences'
import { captureException } from '../sentry'
import { logger } from '../utils/logger'

import {
  callTauriApi,
  checkTauriBackendHealth,
  getRuntimeGatewayBase,
  isTauriRuntime,
  normalizeGatewayBaseUrl,
  startTauriBackend,
  restartTauriBackend,
} from './transport'
import type { GatewayRequestMethod } from './tauri-contract'
import { LRUCache, makeCacheKey } from './ipc-chunk'
const DEFAULT_API_BASE = 'http://127.0.0.1:8000'
export const GENERIC_API_ERROR_MESSAGE = 'Request failed. Please try again.'

export interface ApiResponse<T, E = unknown> {
  success: boolean
  data?: T
  error?: string
  errorData?: E
}

export const getErrorName = (error: unknown): string =>
  error instanceof Error ? error.name : 'UnknownError'

const parseResponseText = (body: string): unknown => {
  const normalized = body.trim()
  if (!normalized) {
    return undefined
  }
  try {
    return JSON.parse(normalized)
  } catch {
    return body
  }
}

const readErrorMessage = (statusCode: number, payload: unknown): string => {
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { error?: unknown }).error === 'string' &&
    (payload as { error: string }).error.trim().length > 0
  ) {
    return (payload as { error: string }).error
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  return `HTTP error: ${statusCode}`
}

const isSuccessfulStatusCode = (statusCode: number): boolean =>
  statusCode >= 200 && statusCode < 300

const resolveApiBase = (): string => {
  const env = import.meta.env as Record<string, string | undefined>
  const envBase = env.NIKO_GATEWAY_URL ?? env.VITE_NIKO_GATEWAY_URL
  if (envBase && envBase.trim()) {
    return normalizeGatewayBaseUrl(envBase.trim())
  }

  const storeBase = readRuntimePreferences().apiBaseUrl
  if (storeBase && storeBase.trim()) {
    return normalizeGatewayBaseUrl(storeBase.trim())
  }

  return DEFAULT_API_BASE
}

// Gateway configuration:
// - Default browser-shell fallback is local 127.0.0.1:8000, matching the direct `python scripts/start_gateway.py` dev startup path.
// - Remote mode: env(NIKO_GATEWAY_URL / VITE_NIKO_GATEWAY_URL) or settings apiBaseUrl
export const getResolvedApiBase = (): string => resolveApiBase()

/**
 * 高频 IPC 请求的 LRU 缓存
 *
 * 只缓存 GET 请求的成功响应（POST/PUT 有副作用不应缓存）。
 * 避免短时间内重复发起完全相同的 API 调用（如频繁轮询健康检查、获取 wiki 列表等）。
 */

/** 缓存生效时间（5 秒）— 同一请求在此窗口内直接返回缓存 */
const CACHE_TTL_MS = 5_000

interface CacheEntry<T, E = unknown> {
  value: ApiResponse<T, E>
  storedAt: number
}

const timedCache = new LRUCache<CacheEntry<unknown>>(50)

/** 清除 LRU 缓存（仅用于测试） */
export function clearApiCache(): void {
  timedCache.clear()
}

/**
 * 统一 API 调用方法
 * 在 Tauri 环境中使用 invoke，否则直接 fetch
 *
 * 对 GET 请求启用短期 LRU 缓存，减少重复 IPC 调用开销
 */
export async function callApi<T, E = unknown>(
  endpoint: string,
  method: GatewayRequestMethod = 'GET',
  body?: Record<string, unknown>
): Promise<ApiResponse<T, E>> {
  // 对 GET 请求检查 LRU 缓存，避免重复 IPC 开销
  if (method === 'GET') {
    const cacheKey = makeCacheKey(endpoint, method)
    const cached = timedCache.get(cacheKey) as CacheEntry<T, E> | undefined
    if (cached && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value
    }
  }
  try {
    let data: T

    if (isTauriRuntime()) {
      const response = await callTauriApi({
        endpoint,
        method,
        body: body ? JSON.stringify(body) : null,
      })
      const payload = parseResponseText(response.body)
      if (!isSuccessfulStatusCode(response.statusCode)) {
        return {
          success: false,
          error: readErrorMessage(response.statusCode, payload),
          errorData: payload as E,
        }
      }
      data = payload as T
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
        return {
          success: false,
          error: readErrorMessage(response.status, payload),
          errorData: payload as E,
        }
      }

      data = payload as T
    }

    const result = { success: true, data } as ApiResponse<T, E>

    // 仅对 GET 请求的成功响应写入 LRU 缓存
    // 错误响应已在上方 return { success: false } 提前返回，此处一定为成功
    if (method === 'GET') {
      const cacheKey = makeCacheKey(endpoint, method)
      timedCache.set(cacheKey, { value: result, storedAt: Date.now() })
    }

    return result
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    logger.error(`API call failed: ${endpoint} (${errorName})`)
    if (import.meta.env.VITE_SENTRY_DSN) {
      void captureException(error, { tags: { api_endpoint: endpoint, api_method: method } })
    }
    return { success: false, error: GENERIC_API_ERROR_MESSAGE }
  }
}

export {
  checkTauriBackendHealth,
  getRuntimeGatewayBase,
  isTauriRuntime,
  normalizeGatewayBaseUrl,
  startTauriBackend,
  restartTauriBackend,
}

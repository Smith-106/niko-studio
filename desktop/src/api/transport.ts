import { invoke } from '@tauri-apps/api/core'

import {
  TAURI_GATEWAY_COMMANDS,
  type TauriGatewayApiRequest,
  type TauriGatewayApiResponse,
} from './tauri-contract'

const RUNTIME_GATEWAY_BASE_TTL_MS = 5000

let cachedRuntimeGatewayBase: string | null = null
let cachedRuntimeGatewayBaseAt: number | null = null

export const normalizeGatewayBaseUrl = (value: string): string => value.replace(/\/+$/, '')

export const isTauriRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window

export async function getRuntimeGatewayBase(
  resolveApiBase: () => string,
): Promise<string> {
  if (!isTauriRuntime()) {
    return resolveApiBase()
  }

  const now = Date.now()
  if (
    cachedRuntimeGatewayBase &&
    cachedRuntimeGatewayBaseAt &&
    now - cachedRuntimeGatewayBaseAt < RUNTIME_GATEWAY_BASE_TTL_MS
  ) {
    return cachedRuntimeGatewayBase
  }

  const base = await invoke<string>(TAURI_GATEWAY_COMMANDS.getGatewayBase)
  cachedRuntimeGatewayBase = normalizeGatewayBaseUrl(base)
  cachedRuntimeGatewayBaseAt = now
  return cachedRuntimeGatewayBase
}

export async function syncGatewayBaseOverride(base: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }

  await invoke<void>(TAURI_GATEWAY_COMMANDS.setGatewayBaseOverride, { base })
  cachedRuntimeGatewayBase = base ? normalizeGatewayBaseUrl(base) : null
  cachedRuntimeGatewayBaseAt = base ? Date.now() : null
}

export async function startTauriBackend(): Promise<string> {
  return invoke<string>(TAURI_GATEWAY_COMMANDS.startBackend)
}

export async function checkTauriBackendHealth(): Promise<boolean> {
  return invoke<boolean>(TAURI_GATEWAY_COMMANDS.checkBackendHealth)
}

export async function callTauriApi(
  request: TauriGatewayApiRequest,
): Promise<TauriGatewayApiResponse> {
  return invoke<TauriGatewayApiResponse>(TAURI_GATEWAY_COMMANDS.callApi, request)
}

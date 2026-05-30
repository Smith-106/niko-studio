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

export async function restartTauriBackend(): Promise<string> {
  if (!isTauriRuntime()) {
    return 'Mock restart success'
  }
  return invoke<string>(TAURI_GATEWAY_COMMANDS.restartBackend)
}

// ─── 分片信封类型 ──────────────────────────────────────────

/** Rust 端大载荷分片信封的 JSON 结构 */
interface ChunkedEnvelope {
  __chunked: true
  statusCode: number
  channelId: string
  totalChunks: number
  chunkIndex: number
  data: string
}

function isChunkedEnvelope(value: unknown): value is ChunkedEnvelope {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.__chunked === true
}

/**
 * 从分片信封中逐步获取所有分片，重组为完整响应
 *
 * Rust 端对超过 100KB 的响应自动拆分，首次 call_api 返回信封 + 第一块，
 * 后续分片通过 fetch_chunk 命令逐块获取。
 * 这样渲染端每次 invoke 只处理 ~64KB，避免单次传输超大 JSON 的 GC 压力
 */
async function reassembleFromChunks(envelope: ChunkedEnvelope): Promise<TauriGatewayApiResponse> {
  const { statusCode, channelId, totalChunks, data: firstChunk } = envelope

  // 收集所有分片（第一块已内联在信封中）
  const chunks: string[] = new Array(totalChunks)
  chunks[0] = firstChunk

  // 从 index=1 开始逐块获取
  for (let i = 1; i < totalChunks; i++) {
    const chunkData = await invoke<string>(TAURI_GATEWAY_COMMANDS.fetchChunk, {
      channelId,
      chunkIndex: i,
    })
    chunks[i] = chunkData
  }

  // 拼接所有分片为完整 body
  const fullBody = chunks.join('')

  return {
    statusCode,
    body: fullBody,
  }
}

// ─── 核心 IPC 调用 ──────────────────────────────────────────

export async function callTauriApi(
  request: TauriGatewayApiRequest,
): Promise<TauriGatewayApiResponse> {
  const result = await invoke<string>(TAURI_GATEWAY_COMMANDS.callApi, request)

  const parsed: unknown = JSON.parse(result)

  // 检测分片信封：Rust 端对大载荷返回 __chunked 标记
  if (isChunkedEnvelope(parsed)) {
    return reassembleFromChunks(parsed)
  }

  // 普通响应，直接返回
  return parsed as TauriGatewayApiResponse
}
/**
 * IPC 分块与 LRU 缓存工具
 *
 * 大载荷（完整聊天历史、嵌入向量、分析结果）通过 Tauri invoke 传输时，
 * JSON 序列化开销和 GC 压力显著。此模块提供：
 * 1. 分块协议 — 超过阈值的载荷自动拆分为 ~64KB 的块
 * 2. LRU 缓存 — 高频 IPC 通道的重复请求去重
 */

// ─── 分块常量 ───────────────────────────────────────────────

/** 触发分块的最小载荷字节数（100KB） */
export const CHUNK_THRESHOLD_BYTES = 100 * 1024

/** 每个分块的目标大小（64KB） */
export const CHUNK_SIZE_BYTES = 64 * 1024

// ─── 分块协议类型 ───────────────────────────────────────────

export interface ChunkMetadata {
  /** 原始 IPC 通道标识 */
  channelId: string
  /** 当前分块索引（从 0 开始） */
  chunkIndex: number
  /** 总分块数 */
  totalChunks: number
  /** 分块数据 */
  data: string
}

export interface ChunkedEnvelope {
  __chunked: true
  channelId: string
  totalChunks: number
}

// ─── 分块：将大载荷拆分为块 ─────────────────────────────────

/**
 * 将字符串载荷拆分为分块数组
 * 仅当载荷超过 CHUNK_THRESHOLD_BYTES 时才拆分
 */
export function splitIntoChunks(payload: string, channelId: string): ChunkMetadata[] | null {
  const byteLength = new TextEncoder().encode(payload).length
  if (byteLength <= CHUNK_THRESHOLD_BYTES) {
    return null
  }

  const chunks: ChunkMetadata[] = []
  let offset = 0
  let chunkIndex = 0

  while (offset < payload.length) {
    // 使用二分查找确定不超过 CHUNK_SIZE_BYTES 的最大字符边界
    const end = findChunkBoundary(payload, offset, CHUNK_SIZE_BYTES)
    const chunk = payload.slice(offset, end)

    chunks.push({
      channelId,
      chunkIndex,
      totalChunks: 0, // 先填 0，最后统一修正
      data: chunk,
    })
    offset = end
    chunkIndex++
  }

  // 修正 totalChunks
  const actualTotal = chunks.length
  for (const c of chunks) {
    c.totalChunks = actualTotal
  }

  return chunks
}

/**
 * 二分查找：从 offset 开始，找到不超过 maxBytes 的最大字符边界
 * 避免逐字符回退的 O(n*encode) 开销
 */
function findChunkBoundary(payload: string, offset: number, maxBytes: number): number {
  const remaining = payload.length - offset
  // 乐观估计：假设每字符 1 字节（ASCII 场景）
  let lo = offset + 1
  let hi = Math.min(payload.length, offset + remaining)
  let best = offset + 1

  // 先尝试乐观估计
  const optimisticEnd = Math.min(payload.length, offset + maxBytes)
  const optimisticBytes = new TextEncoder().encode(payload.slice(offset, optimisticEnd)).length
  if (optimisticBytes <= maxBytes) {
    return optimisticEnd
  }

  // 乐观估计超出，二分查找
  hi = optimisticEnd
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1)
    const bytes = new TextEncoder().encode(payload.slice(offset, mid)).length
    if (bytes <= maxBytes) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return best
}

// ─── 重组：将分块还原为原始载荷 ──────────────────────────────

interface ReassemblyState {
  chunks: Map<number, string>
  totalChunks: number
  receivedAt: number
}

/** 重组超时时间（10 秒） */
const REASSEMBLY_TIMEOUT_MS = 10_000

/** 正在重组的分块集合 */
const reassemblyMap = new Map<string, ReassemblyState>()

// 定期清理超时的重组状态
let cleanupScheduled = false
function scheduleReassemblyCleanup(): void {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setTimeout(() => {
    const now = Date.now()
    for (const [key, state] of reassemblyMap) {
      if (now - state.receivedAt > REASSEMBLY_TIMEOUT_MS) {
        reassemblyMap.delete(key)
      }
    }
    cleanupScheduled = false
    if (reassemblyMap.size > 0) {
      scheduleReassemblyCleanup()
    }
  }, REASSEMBLY_TIMEOUT_MS)
}

/**
 * 接收一个分块，当所有分块到齐时还原原始载荷
 * @returns 还原后的字符串，或 null 表示分块尚未齐备
 */
export function reassembleChunk(chunk: ChunkMetadata): string | null {
  const key = chunk.channelId

  let state = reassemblyMap.get(key)
  if (!state) {
    state = {
      chunks: new Map(),
      totalChunks: chunk.totalChunks,
      receivedAt: Date.now(),
    }
    reassemblyMap.set(key, state)
    scheduleReassemblyCleanup()
  }

  state.chunks.set(chunk.chunkIndex, chunk.data)

  if (state.chunks.size < state.totalChunks) {
    return null
  }

  // 所有分块齐备，按序拼接
  let result = ''
  for (let i = 0; i < state.totalChunks; i++) {
    const part = state.chunks.get(i)
    if (part === undefined) {
      // 不应到达此处（size 已等于 totalChunks）
      reassemblyMap.delete(key)
      return null
    }
    result += part
  }

  reassemblyMap.delete(key)
  return result
}

/** 清除所有重组状态（用于测试） */
export function clearReassemblyState(): void {
  reassemblyMap.clear()
}

// ─── LRU 缓存 ──────────────────────────────────────────────

export interface LRUEntry<T> {
  key: string
  value: T
}

/**
 * 简单 LRU 缓存，用于高频 IPC 请求去重
 * 避免短时间内重复发起完全相同的 API 调用
 */
export class LRUCache<T> {
  private readonly maxEntries: number
  private readonly map: Map<string, T>

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries
    this.map = new Map()
  }

  get(key: string): T | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    // 移到末尾（最近访问）
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key)
    } else if (this.map.size >= this.maxEntries) {
      // 淘汰最老的条目（Map 的迭代顺序即插入顺序）
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) {
        this.map.delete(oldest)
      }
    }
    this.map.set(key, value)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }
}

// ─── 缓存键生成 ─────────────────────────────────────────────

/**
 * 为 API 请求生成缓存键
 * 基于 endpoint + method + body 的确定性哈希
 */
export function makeCacheKey(endpoint: string, method: string, body?: Record<string, unknown>): string {
  // 使用简单拼接而非加密哈希，减少计算开销
  const bodyStr = body ? JSON.stringify(body) : ''
  return `${method}:${endpoint}:${bodyStr}`
}

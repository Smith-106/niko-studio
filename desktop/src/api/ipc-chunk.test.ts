import { describe, expect, it } from 'vitest'

import {
  splitIntoChunks,
  reassembleChunk,
  clearReassemblyState,
  LRUCache,
  makeCacheKey,
  CHUNK_THRESHOLD_BYTES,
} from './ipc-chunk'

// ---------------------------------------------------------------------------
// splitIntoChunks
// ---------------------------------------------------------------------------

describe('splitIntoChunks', () => {
  it('returns null for payloads below threshold', () => {
    const small = 'a'.repeat(100)
    const result = splitIntoChunks(small, 'test-channel')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(splitIntoChunks('', 'test')).toBeNull()
  })

  it('splits large payloads into chunks', () => {
    // 生成超过阈值的载荷（100KB+）
    const payload = 'x'.repeat(CHUNK_THRESHOLD_BYTES + 1000)
    const chunks = splitIntoChunks(payload, 'test-channel')

    expect(chunks).not.toBeNull()
    expect(chunks!.length).toBeGreaterThanOrEqual(2)

    // 每个 chunk 都有正确的元数据
    for (let i = 0; i < chunks!.length; i++) {
      expect(chunks![i].channelId).toBe('test-channel')
      expect(chunks![i].chunkIndex).toBe(i)
      expect(chunks![i].totalChunks).toBe(chunks!.length)
      expect(chunks![i].data.length).toBeGreaterThan(0)
    }
  })

  it('reassembles to the original payload', () => {
    const payload = 'abc'.repeat(CHUNK_THRESHOLD_BYTES)
    const chunks = splitIntoChunks(payload, 'reassemble-test')

    expect(chunks).not.toBeNull()

    clearReassemblyState()
    let result: string | null = null
    for (const chunk of chunks!) {
      result = reassembleChunk(chunk)
    }

    expect(result).toBe(payload)
  })

  it('handles unicode correctly in chunking', () => {
    // 包含中文和 emoji 的混合字符串
    const unicodePayload = '你好世界🎉'.repeat(CHUNK_THRESHOLD_BYTES)
    const chunks = splitIntoChunks(unicodePayload, 'unicode-test')

    expect(chunks).not.toBeNull()

    clearReassemblyState()
    let result: string | null = null
    for (const chunk of chunks!) {
      result = reassembleChunk(chunk)
    }

    expect(result).toBe(unicodePayload)
  })
})

// ---------------------------------------------------------------------------
// reassembleChunk
// ---------------------------------------------------------------------------

describe('reassembleChunk', () => {
  afterEach(() => {
    clearReassemblyState()
  })

  it('returns null when not all chunks received', () => {
    const chunk0 = {
      channelId: 'partial-test',
      chunkIndex: 0,
      totalChunks: 3,
      data: 'part-0-',
    }
    const chunk1 = {
      channelId: 'partial-test',
      chunkIndex: 1,
      totalChunks: 3,
      data: 'part-1',
    }

    expect(reassembleChunk(chunk0)).toBeNull()
    expect(reassembleChunk(chunk1)).toBeNull()
  })

  it('returns reassembled string when all chunks received', () => {
    const chunks = [
      { channelId: 'complete-test', chunkIndex: 0, totalChunks: 3, data: 'A' },
      { channelId: 'complete-test', chunkIndex: 1, totalChunks: 3, data: 'B' },
      { channelId: 'complete-test', chunkIndex: 2, totalChunks: 3, data: 'C' },
    ]

    expect(reassembleChunk(chunks[0])).toBeNull()
    expect(reassembleChunk(chunks[1])).toBeNull()
    expect(reassembleChunk(chunks[2])).toBe('ABC')
  })

  it('handles chunks arriving out of order', () => {
    const chunks = [
      { channelId: 'ooo-test', chunkIndex: 2, totalChunks: 3, data: 'C' },
      { channelId: 'ooo-test', chunkIndex: 0, totalChunks: 3, data: 'A' },
      { channelId: 'ooo-test', chunkIndex: 1, totalChunks: 3, data: 'B' },
    ]

    expect(reassembleChunk(chunks[0])).toBeNull()
    expect(reassembleChunk(chunks[1])).toBeNull()
    expect(reassembleChunk(chunks[2])).toBe('ABC')
  })

  it('cleans up state after successful reassembly', () => {
    const chunks = [
      { channelId: 'cleanup-test', chunkIndex: 0, totalChunks: 2, data: 'X' },
      { channelId: 'cleanup-test', chunkIndex: 1, totalChunks: 2, data: 'Y' },
    ]

    reassembleChunk(chunks[0])
    reassembleChunk(chunks[1])

    // 同一 channelId 的新分片不会与旧的冲突
    const newChunk = {
      channelId: 'cleanup-test',
      chunkIndex: 0,
      totalChunks: 1,
      data: 'Z',
    }
    // totalChunks=1 且 chunkIndex=0，应立即完成
    expect(reassembleChunk(newChunk)).toBe('Z')
  })
})

// ---------------------------------------------------------------------------
// LRUCache
// ---------------------------------------------------------------------------

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string>(3)
    cache.set('a', 'value-a')
    expect(cache.get('a')).toBe('value-a')
  })

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string>(3)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('evicts oldest entry when at capacity', () => {
    const cache = new LRUCache<string>(2)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.set('c', '3') // 'a' should be evicted

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe('2')
    expect(cache.get('c')).toBe('3')
  })

  it('refreshes entry on get (prevents eviction)', () => {
    const cache = new LRUCache<string>(2)
    cache.set('a', '1')
    cache.set('b', '2')

    // Access 'a' to move it to the end (most recently used)
    cache.get('a')

    // Now adding 'c' should evict 'b' (oldest), not 'a'
    cache.set('c', '3')

    expect(cache.get('a')).toBe('1')
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe('3')
  })

  it('updates existing key without growing size', () => {
    const cache = new LRUCache<string>(2)
    cache.set('a', '1')
    cache.set('a', 'updated')
    expect(cache.size).toBe(1)
    expect(cache.get('a')).toBe('updated')
  })

  it('has() works correctly', () => {
    const cache = new LRUCache<string>(5)
    cache.set('x', 'val')
    expect(cache.has('x')).toBe(true)
    expect(cache.has('y')).toBe(false)
  })

  it('delete() removes entries', () => {
    const cache = new LRUCache<string>(5)
    cache.set('a', '1')
    expect(cache.delete('a')).toBe(true)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.delete('a')).toBe(false)
  })

  it('clear() removes all entries', () => {
    const cache = new LRUCache<string>(5)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.size).toBe(0)
  })

  it('defaults to max 50 entries', () => {
    const cache = new LRUCache<string>()
    expect(cache.size).toBe(0)
    // Fill beyond 50 — should not grow beyond 50
    for (let i = 0; i < 60; i++) {
      cache.set(`key-${i}`, `val-${i}`)
    }
    expect(cache.size).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// makeCacheKey
// ---------------------------------------------------------------------------

describe('makeCacheKey', () => {
  it('produces deterministic keys for same inputs', () => {
    const key1 = makeCacheKey('/api/test', 'GET', { page: 1 })
    const key2 = makeCacheKey('/api/test', 'GET', { page: 1 })
    expect(key1).toBe(key2)
  })

  it('produces different keys for different endpoints', () => {
    const key1 = makeCacheKey('/api/a', 'GET')
    const key2 = makeCacheKey('/api/b', 'GET')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different methods', () => {
    const key1 = makeCacheKey('/api/test', 'GET')
    const key2 = makeCacheKey('/api/test', 'POST')
    expect(key1).not.toBe(key2)
  })

  it('produces different keys for different bodies', () => {
    const key1 = makeCacheKey('/api/test', 'POST', { a: 1 })
    const key2 = makeCacheKey('/api/test', 'POST', { a: 2 })
    expect(key1).not.toBe(key2)
  })

  it('handles undefined body', () => {
    const key = makeCacheKey('/api/test', 'GET')
    expect(key).toContain('GET')
    expect(key).toContain('/api/test')
  })
})
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Tauri invoke before importing transport
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import {
  normalizeGatewayBaseUrl,
  isTauriRuntime,
  getRuntimeGatewayBase,
  syncGatewayBaseOverride,
} from './transport'

const mockInvoke = vi.mocked(invoke)

function cleanupTauriGlobal() {
  delete (window as unknown as Record<string, unknown>).__TAURI__
}

/**
 * transport.ts uses module-level cached variables (cachedRuntimeGatewayBase,
 * cachedRuntimeGatewayBaseAt) that persist across tests. We clear them by
 * calling syncGatewayBaseOverride(null) while in Tauri mode. All cache-
 * dependent tests must manually manage this state.
 */

// ---------------------------------------------------------------------------
// normalizeGatewayBaseUrl (pure function, no state)
// ---------------------------------------------------------------------------

describe('normalizeGatewayBaseUrl', () => {
  it('removes trailing slashes', () => {
    expect(normalizeGatewayBaseUrl('http://localhost:8000/')).toBe('http://localhost:8000')
  })

  it('removes multiple trailing slashes', () => {
    expect(normalizeGatewayBaseUrl('http://localhost:8000///')).toBe('http://localhost:8000')
  })

  it('returns unchanged URL when no trailing slashes', () => {
    expect(normalizeGatewayBaseUrl('http://localhost:8000')).toBe('http://localhost:8000')
  })

  it('preserves path segments while removing trailing slash', () => {
    expect(normalizeGatewayBaseUrl('http://localhost:8000/api/v1/')).toBe('http://localhost:8000/api/v1')
  })

  it('handles empty string', () => {
    expect(normalizeGatewayBaseUrl('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// isTauriRuntime (reads window.__TAURI__)
// ---------------------------------------------------------------------------

describe('isTauriRuntime', () => {
  afterEach(() => {
    cleanupTauriGlobal()
  })

  it('returns false when __TAURI__ is not defined', () => {
    cleanupTauriGlobal()
    expect(isTauriRuntime()).toBe(false)
  })

  it('returns true when __TAURI__ is defined on window', () => {
    vi.stubGlobal('__TAURI__', {})
    expect(isTauriRuntime()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getRuntimeGatewayBase (non-Tauri path)
// ---------------------------------------------------------------------------

describe('getRuntimeGatewayBase (non-Tauri)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    cleanupTauriGlobal()
  })

  it('returns resolveApiBase() when not in Tauri runtime', async () => {
    const resolveApiBase = vi.fn(() => 'http://local:3000')
    const result = await getRuntimeGatewayBase(resolveApiBase)
    expect(result).toBe('http://local:3000')
    expect(resolveApiBase).toHaveBeenCalledOnce()
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('passes through different resolveApiBase results', async () => {
    const resolveApiBase = vi.fn(() => 'http://custom:9999')
    const result = await getRuntimeGatewayBase(resolveApiBase)
    expect(result).toBe('http://custom:9999')
  })
})

// ---------------------------------------------------------------------------
// getRuntimeGatewayBase (Tauri runtime) + cache + syncGatewayBaseOverride
// Grouped together because they share module-level cache state.
// ---------------------------------------------------------------------------

describe('getRuntimeGatewayBase (Tauri runtime)', () => {
  beforeEach(async () => {
    // Enter Tauri mode and clear module-level cache
    vi.stubGlobal('__TAURI__', {})
    mockInvoke.mockResolvedValue(undefined)
    await syncGatewayBaseOverride(null)
    mockInvoke.mockReset()
  })

  afterEach(() => {
    cleanupTauriGlobal()
  })

  it('calls invoke and returns normalized base', async () => {
    mockInvoke.mockResolvedValue('http://tauri-host:9000/')

    const resolveApiBase = vi.fn(() => 'http://fallback:8000')
    const result = await getRuntimeGatewayBase(resolveApiBase)

    expect(result).toBe('http://tauri-host:9000')
    expect(mockInvoke).toHaveBeenCalledWith('get_gateway_base')
    expect(resolveApiBase).not.toHaveBeenCalled()
  })

  it('caches the result and returns it within TTL', async () => {
    mockInvoke.mockResolvedValue('http://cached:5000/')

    const resolveApiBase = vi.fn(() => 'http://fallback:8000')

    // First call - should hit invoke
    const result1 = await getRuntimeGatewayBase(resolveApiBase)
    expect(result1).toBe('http://cached:5000')
    expect(mockInvoke).toHaveBeenCalledTimes(1)

    // Second call immediately - should use cache (no additional invoke)
    const result2 = await getRuntimeGatewayBase(resolveApiBase)
    expect(result2).toBe('http://cached:5000')
    expect(mockInvoke).toHaveBeenCalledTimes(1) // still 1
  })

  it('re-fetches after cache TTL expires', async () => {
    // The transport module uses Date.now() for cache timestamps.
    // We spy on Date.now to control time and simulate TTL expiry.
    const realDateNow = Date.now
    let currentTime = realDateNow()
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime)

    mockInvoke
      .mockResolvedValueOnce('http://first:5000/')
      .mockResolvedValueOnce('http://second:6000/')

    const resolveApiBase = vi.fn(() => 'http://fallback:8000')

    // First call at currentTime
    const result1 = await getRuntimeGatewayBase(resolveApiBase)
    expect(result1).toBe('http://first:5000')

    // Advance time past TTL (5000ms)
    currentTime += 6000

    // Second call - cache should be expired, invoke called again
    const result2 = await getRuntimeGatewayBase(resolveApiBase)
    expect(result2).toBe('http://second:6000')
    expect(mockInvoke).toHaveBeenCalledTimes(2)

    vi.restoreAllMocks()
    Date.now = realDateNow
  })
})

// ---------------------------------------------------------------------------
// syncGatewayBaseOverride
// ---------------------------------------------------------------------------

describe('syncGatewayBaseOverride', () => {
  beforeEach(async () => {
    // Clear module cache while in Tauri mode
    vi.stubGlobal('__TAURI__', {})
    mockInvoke.mockResolvedValue(undefined)
    await syncGatewayBaseOverride(null)
    mockInvoke.mockReset()
  })

  afterEach(() => {
    cleanupTauriGlobal()
  })

  it('is a no-op in non-Tauri runtime', async () => {
    cleanupTauriGlobal()
    mockInvoke.mockReset()
    await syncGatewayBaseOverride('http://override:9000')
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('calls invoke with the base and sets cache in Tauri runtime', async () => {
    await syncGatewayBaseOverride('http://override:9000/')

    expect(mockInvoke).toHaveBeenCalledWith('set_gateway_base_override', {
      base: 'http://override:9000/',
    })

    // After setting, a subsequent getRuntimeGatewayBase should use cache
    const resolveApiBase = vi.fn(() => 'http://fallback:8000')
    const result = await getRuntimeGatewayBase(resolveApiBase)
    expect(result).toBe('http://override:9000')
    // getGatewayBase should NOT have been called since cache is fresh
    expect(mockInvoke).not.toHaveBeenCalledWith('get_gateway_base')
  })

  it('clears cache when base is null', async () => {
    // First set a value
    await syncGatewayBaseOverride('http://set:1234/')
    mockInvoke.mockClear()

    // Now clear it
    await syncGatewayBaseOverride(null)

    expect(mockInvoke).toHaveBeenCalledWith('set_gateway_base_override', {
      base: null,
    })

    // Subsequent getRuntimeGatewayBase should call invoke again (no cache)
    mockInvoke.mockResolvedValueOnce('http://fresh:7000/')
    const result = await getRuntimeGatewayBase(() => 'http://fallback:8000')
    expect(result).toBe('http://fresh:7000')
    expect(mockInvoke).toHaveBeenCalledWith('get_gateway_base')
  })
})

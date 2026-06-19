import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import {
  callTauriApi,
  checkTauriBackendHealth,
  isTauriRuntime,
  restartTauriBackend,
  startTauriBackend,
  syncGatewayBaseOverride,
} from './transport'

const mockInvoke = vi.mocked(invoke)

function cleanupTauriGlobal() {
  if (typeof window === 'undefined' || !window) {
    return
  }
  delete (window as unknown as Record<string, unknown>).__TAURI__
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  delete (window as unknown as Record<string, unknown>).isTauri
}

describe('transport additional coverage', () => {
  beforeEach(async () => {
    cleanupTauriGlobal()
    vi.unstubAllGlobals()
    vi.stubGlobal('__TAURI_INTERNALS__', {
      invoke: vi.fn(),
    })
    mockInvoke.mockResolvedValue(undefined)
    await syncGatewayBaseOverride(null)
    mockInvoke.mockReset()
  })

  afterEach(() => {
    cleanupTauriGlobal()
    vi.unstubAllGlobals()
  })

  it('returns false when window is unavailable', () => {
    vi.stubGlobal('window', undefined)

    expect(isTauriRuntime()).toBe(false)
  })

  it('starts and health-checks the tauri backend through invoke', async () => {
    mockInvoke
      .mockResolvedValueOnce('Backend started')
      .mockResolvedValueOnce(true)

    await expect(startTauriBackend()).resolves.toBe('Backend started')
    await expect(checkTauriBackendHealth()).resolves.toBe(true)

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'start_backend')
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'check_backend_health')
  })

  it('uses the mock restart path outside tauri runtime and invoke inside tauri runtime', async () => {
    cleanupTauriGlobal()
    mockInvoke.mockReset()

    await expect(restartTauriBackend()).resolves.toBe('Mock restart success')
    expect(mockInvoke).not.toHaveBeenCalled()

    vi.stubGlobal('__TAURI_INTERNALS__', {
      invoke: vi.fn(),
    })
    mockInvoke.mockResolvedValueOnce('Restarted from tauri')

    await expect(restartTauriBackend()).resolves.toBe('Restarted from tauri')
    expect(mockInvoke).toHaveBeenCalledWith('restart_backend')
  })

  it('treats primitive JSON payloads as non-chunked responses', async () => {
    mockInvoke.mockResolvedValueOnce('null')

    const result = await callTauriApi({
      endpoint: '/primitive-response',
      method: 'GET',
      body: null,
    })

    expect(result).toBeNull()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../api/transport', () => ({
  getRuntimeGatewayBase: vi.fn(),
  isTauriRuntime: vi.fn(),
  startTauriBackend: vi.fn(),
  syncGatewayBaseOverride: vi.fn(),
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}))

import { logger } from '../utils/logger'

import {
  getRuntimeGatewayBase,
  isTauriRuntime,
  startTauriBackend,
  syncGatewayBaseOverride,
} from '../api/transport'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppBackendBootstrap } from './useAppBackendBootstrap'

describe('useAppBackendBootstrap', () => {
  const originalLoggerError = logger.error

  beforeEach(() => {
    vi.clearAllMocks()
    logger.error = vi.fn()
    vi.mocked(getRuntimeGatewayBase).mockResolvedValue('http://127.0.0.1:8000')
    vi.mocked(syncGatewayBaseOverride).mockResolvedValue(undefined)
    vi.mocked(startTauriBackend).mockResolvedValue('Gateway ready')
  })

  afterEach(() => {
    logger.error = originalLoggerError
  })

  it('does not call startTauriBackend or syncGatewayBaseOverride in non-Tauri runtime', () => {
    vi.mocked(isTauriRuntime).mockReturnValue(false)

    renderHook(() => useAppBackendBootstrap())

    expect(isTauriRuntime).toHaveBeenCalledTimes(1)
    expect(startTauriBackend).not.toHaveBeenCalled()
    expect(syncGatewayBaseOverride).not.toHaveBeenCalled()
  })

  it('calls startTauriBackend and syncGatewayBaseOverride with apiBaseUrl in Tauri runtime', async () => {
    const updateSettings = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: '  http://localhost:8080  ' },
      updateSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(syncGatewayBaseOverride).toHaveBeenCalledTimes(1)
      expect(syncGatewayBaseOverride).toHaveBeenCalledWith('http://localhost:8080')
      expect(startTauriBackend).toHaveBeenCalledTimes(1)
      expect(updateSettings).not.toHaveBeenCalled()
    })
  })

  it('passes null to syncGatewayBaseOverride when apiBaseUrl is empty or whitespace-only', async () => {
    const updateSettings = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: '   ' },
      updateSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(syncGatewayBaseOverride).toHaveBeenCalledWith(null)
      expect(startTauriBackend).toHaveBeenCalledTimes(1)
      expect(updateSettings).not.toHaveBeenCalled()
    })
  })

  it('passes null to syncGatewayBaseOverride when apiBaseUrl is undefined', async () => {
    const updateSettings = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {},
      updateSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(syncGatewayBaseOverride).toHaveBeenCalledWith(null)
    })
  })

  it('repairs stale persisted 127.0.0.1:8000 when runtime resolves a different healthy loopback base', async () => {
    const updateSettings = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(getRuntimeGatewayBase).mockResolvedValue('http://127.0.0.1:5389')
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: 'http://127.0.0.1:8000' },
      updateSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ apiBaseUrl: 'http://127.0.0.1:5389' })
    })
  })

  it('does not rewrite persisted gateway base when runtime resolves a non-loopback host alias', async () => {
    const updateSettings = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(getRuntimeGatewayBase).mockResolvedValue('http://localhost:5389')
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: 'http://127.0.0.1:8000' },
      updateSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(getRuntimeGatewayBase).toHaveBeenCalledTimes(1)
      expect(updateSettings).not.toHaveBeenCalled()
    })
  })

  it('reports bootstrap failures through the logger and the optional callback', async () => {
    const onError = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: 'http://127.0.0.1:8000' },
      updateSettings: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsStore.getState>)
    vi.mocked(startTauriBackend).mockRejectedValue(new Error('gateway boot failed'))

    renderHook(() => useAppBackendBootstrap(onError))

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith(
        '[useAppBackendBootstrap] Backend bootstrap failed:',
        expect.any(Error),
      )
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('gateway boot failed'))
    })
  })

  it('stringifies non-Error bootstrap failures before notifying the caller', async () => {
    const onError = vi.fn()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: 'http://127.0.0.1:8000' },
      updateSettings: vi.fn(),
    } as unknown as ReturnType<typeof useSettingsStore.getState>)
    vi.mocked(startTauriBackend).mockRejectedValue('plain failure')

    renderHook(() => useAppBackendBootstrap(onError))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('plain failure'))
    })
  })
})

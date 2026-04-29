import { describe, expect, it, vi, beforeEach, waitFor } from 'vitest'
import { renderHook } from '@testing-library/react'

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

import {
  getRuntimeGatewayBase,
  isTauriRuntime,
  startTauriBackend,
  syncGatewayBaseOverride,
} from '../api/transport'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppBackendBootstrap } from './useAppBackendBootstrap'

describe('useAppBackendBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getRuntimeGatewayBase).mockResolvedValue('http://127.0.0.1:8000')
    vi.mocked(syncGatewayBaseOverride).mockResolvedValue(undefined)
    vi.mocked(startTauriBackend).mockResolvedValue('Gateway ready')
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
    } as ReturnType<typeof useSettingsStore.getState>)

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
    } as ReturnType<typeof useSettingsStore.getState>)

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
    } as ReturnType<typeof useSettingsStore.getState>)

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
    } as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ apiBaseUrl: 'http://127.0.0.1:5389' })
    })
  })
})

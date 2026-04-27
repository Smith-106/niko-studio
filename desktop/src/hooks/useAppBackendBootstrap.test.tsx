import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../api/transport', () => ({
  isTauriRuntime: vi.fn(),
  startTauriBackend: vi.fn(),
  syncGatewayBaseOverride: vi.fn(),
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}))

import { isTauriRuntime, startTauriBackend, syncGatewayBaseOverride } from '../api/transport'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppBackendBootstrap } from './useAppBackendBootstrap'

describe('useAppBackendBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not call startTauriBackend or syncGatewayBaseOverride in non-Tauri runtime', () => {
    vi.mocked(isTauriRuntime).mockReturnValue(false)

    renderHook(() => useAppBackendBootstrap())

    expect(isTauriRuntime).toHaveBeenCalledTimes(1)
    expect(startTauriBackend).not.toHaveBeenCalled()
    expect(syncGatewayBaseOverride).not.toHaveBeenCalled()
  })

  it('calls startTauriBackend and syncGatewayBaseOverride with apiBaseUrl in Tauri runtime', () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: '  http://localhost:8080  ' },
    } as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    expect(syncGatewayBaseOverride).toHaveBeenCalledTimes(1)
    expect(syncGatewayBaseOverride).toHaveBeenCalledWith('http://localhost:8080')
    expect(startTauriBackend).toHaveBeenCalledTimes(1)
  })

  it('passes null to syncGatewayBaseOverride when apiBaseUrl is empty or whitespace-only', () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: { apiBaseUrl: '   ' },
    } as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    expect(syncGatewayBaseOverride).toHaveBeenCalledWith(null)
    expect(startTauriBackend).toHaveBeenCalledTimes(1)
  })

  it('passes null to syncGatewayBaseOverride when apiBaseUrl is undefined', () => {
    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      settings: {},
    } as ReturnType<typeof useSettingsStore.getState>)

    renderHook(() => useAppBackendBootstrap())

    expect(syncGatewayBaseOverride).toHaveBeenCalledWith(null)
  })
})

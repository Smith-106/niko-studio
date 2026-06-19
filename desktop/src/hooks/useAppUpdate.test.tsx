import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkMock = vi.hoisted(() => vi.fn())
const relaunchMock = vi.hoisted(() => vi.fn())
const isTauriRuntimeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: checkMock,
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: relaunchMock,
}))

vi.mock('../api/transport', () => ({
  isTauriRuntime: isTauriRuntimeMock,
}))

import { useAppUpdate } from './useAppUpdate'

describe('useAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriRuntimeMock.mockReturnValue(true)
    relaunchMock.mockResolvedValue(undefined)
  })

  it('skips update checks outside of the Tauri runtime', async () => {
    isTauriRuntimeMock.mockReturnValue(false)

    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      await result.current.checkForUpdate()
    })

    expect(checkMock).not.toHaveBeenCalled()
    expect(result.current.status).toMatchObject({
      checking: false,
      available: false,
      version: null,
    })
  })

  it('records an available update and only checks once per hook instance', async () => {
    const notify = vi.fn()
    checkMock.mockResolvedValue({
      version: '11.0.1',
      downloadAndInstall: vi.fn(),
    })

    const { result } = renderHook(() => useAppUpdate(notify))

    await act(async () => {
      await result.current.checkForUpdate()
      await result.current.checkForUpdate()
    })

    expect(checkMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toMatchObject({
      checking: false,
      available: true,
      version: '11.0.1',
    })
    expect(notify).toHaveBeenCalledWith('New version 11.0.1 available')
  })

  it('clears checking state when no update is available or when the probe fails', async () => {
    checkMock.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'))

    const first = renderHook(() => useAppUpdate())
    await act(async () => {
      await first.result.current.checkForUpdate()
    })

    expect(first.result.current.status).toMatchObject({
      checking: false,
      available: false,
      version: null,
    })

    const second = renderHook(() => useAppUpdate())
    await act(async () => {
      await second.result.current.checkForUpdate()
    })

    expect(second.result.current.status).toMatchObject({
      checking: false,
      available: false,
      error: null,
    })
  })

  it('reports a missing update during download flow', async () => {
    checkMock.mockResolvedValue(null)

    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      await result.current.downloadAndInstall()
    })

    expect(result.current.status).toMatchObject({
      downloading: false,
      ready: false,
      error: 'No update available',
    })
    expect(relaunchMock).not.toHaveBeenCalled()
  })

  it('tracks download progress and relaunches after a successful install', async () => {
    const downloadAndInstallMock = vi.fn(async (onEvent: (payload: { event: string }) => void) => {
      onEvent({ event: 'Started' })
      onEvent({ event: 'Progress' })
      onEvent({ event: 'Finished' })
    })

    checkMock.mockResolvedValue({
      version: '11.1.0',
      downloadAndInstall: downloadAndInstallMock,
    })

    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      await result.current.downloadAndInstall()
    })

    expect(downloadAndInstallMock).toHaveBeenCalledTimes(1)
    expect(relaunchMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toMatchObject({
      downloading: false,
      ready: true,
      progress: 100,
      error: null,
    })
  })

  it('surfaces install failures with a readable error message', async () => {
    checkMock.mockRejectedValueOnce(new Error('installer unavailable')).mockRejectedValueOnce('boom')

    const first = renderHook(() => useAppUpdate())
    await act(async () => {
      await first.result.current.downloadAndInstall()
    })

    await waitFor(() => {
      expect(first.result.current.status.error).toBe('installer unavailable')
    })

    const second = renderHook(() => useAppUpdate())
    await act(async () => {
      await second.result.current.downloadAndInstall()
    })

    await waitFor(() => {
      expect(second.result.current.status.error).toBe('Update failed')
    })
  })
})

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useThemeMock = vi.hoisted(() => vi.fn())
const useAppBackendBootstrapMock = vi.hoisted(() => vi.fn())
const checkForUpdateMock = vi.hoisted(() => vi.fn())
const useAppUpdateMock = vi.hoisted(() => vi.fn())

vi.mock('./useTheme', () => ({
  useTheme: (...args: unknown[]) => useThemeMock(...args),
}))

vi.mock('./useAppBackendBootstrap', () => ({
  useAppBackendBootstrap: (...args: unknown[]) => useAppBackendBootstrapMock(...args),
}))

vi.mock('./useAppUpdate', () => ({
  useAppUpdate: (...args: unknown[]) => useAppUpdateMock(...args),
}))

import { useAppStartup } from './useAppStartup'

describe('useAppStartup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkForUpdateMock.mockResolvedValue(undefined)
    useAppUpdateMock.mockReturnValue({ checkForUpdate: checkForUpdateMock })
  })

  it('boots theme, backend bootstrap, and update checks with the same notifier', async () => {
    const notify = vi.fn()

    renderHook(() => useAppStartup(notify))

    expect(useThemeMock).toHaveBeenCalledTimes(1)
    expect(useAppBackendBootstrapMock).toHaveBeenCalledTimes(1)
    expect(useAppBackendBootstrapMock).toHaveBeenCalledWith(notify)
    expect(useAppUpdateMock).toHaveBeenCalledTimes(1)
    expect(useAppUpdateMock).toHaveBeenCalledWith(notify)

    await waitFor(() => {
      expect(checkForUpdateMock).toHaveBeenCalledTimes(1)
    })
  })

  it('still triggers the update probe when no notifier is provided', async () => {
    renderHook(() => useAppStartup())

    expect(useAppBackendBootstrapMock).toHaveBeenCalledWith(undefined)
    expect(useAppUpdateMock).toHaveBeenCalledWith(undefined)

    await waitFor(() => {
      expect(checkForUpdateMock).toHaveBeenCalledTimes(1)
    })
  })
})

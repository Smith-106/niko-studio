import { describe, expect, it, vi } from 'vitest'

import { createBackendSlice, type BackendSlice } from './backendSlice'

const checkBackendHealthMock = vi.hoisted(() => vi.fn())

vi.mock('@/api/client', () => ({
  checkBackendHealth: checkBackendHealthMock,
}))

type SetFn = Parameters<typeof createBackendSlice>[0]

function createHarness() {
  let state: BackendSlice = {
    backendStatus: false,
    checkBackend: async () => {},
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createBackendSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }

  return {
    getState: () => state,
    patchState: (partial: Partial<BackendSlice> | ((current: BackendSlice) => Partial<BackendSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('backendSlice', () => {
  it('starts with backendStatus false', () => {
    const store = createHarness()
    expect(store.getState().backendStatus).toBe(false)
  })

  it('sets backendStatus true when checkBackendHealth resolves true', async () => {
    checkBackendHealthMock.mockResolvedValue(true)
    const store = createHarness()

    await store.getState().checkBackend()

    expect(checkBackendHealthMock).toHaveBeenCalledOnce()
    expect(store.getState().backendStatus).toBe(true)
  })

  it('sets backendStatus false when checkBackendHealth resolves false', async () => {
    checkBackendHealthMock.mockResolvedValue(false)
    const store = createHarness()

    await store.getState().checkBackend()

    expect(store.getState().backendStatus).toBe(false)
  })

  it('sets backendStatus false when checkBackendHealth throws', async () => {
    checkBackendHealthMock.mockRejectedValue(new Error('network failure'))
    const store = createHarness()

    await store.getState().checkBackend()

    expect(store.getState().backendStatus).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { createLoadingSlice, type LoadingSlice } from './loadingSlice'

type SetFn = Parameters<typeof createLoadingSlice>[0]

function createHarness() {
  let state: LoadingSlice = {
    loadingMap: {},
    startLoading: () => {},
    finishLoading: () => {},
    isLoading: () => false,
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createLoadingSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }

  return {
    getState: () => state,
    patchState: (partial: Partial<LoadingSlice> | ((current: LoadingSlice) => Partial<LoadingSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('loadingSlice', () => {
  it('starts with empty loadingMap', () => {
    const store = createHarness()
    expect(store.getState().loadingMap).toEqual({})
  })

  it('startLoading sets loadingMap[id] to true', () => {
    const store = createHarness()
    store.getState().startLoading('x')
    expect(store.getState().loadingMap).toEqual({ x: true })
  })

  it('finishLoading sets loadingMap[id] to false', () => {
    const store = createHarness()
    store.getState().startLoading('x')
    store.getState().finishLoading('x')
    expect(store.getState().loadingMap).toEqual({ x: false })
  })

  it('isLoading returns true for an active loading id', () => {
    const store = createHarness()
    store.getState().startLoading('x')
    expect(store.getState().isLoading('x')).toBe(true)
  })

  it('isLoading returns false after finishLoading', () => {
    const store = createHarness()
    store.getState().startLoading('x')
    store.getState().finishLoading('x')
    expect(store.getState().isLoading('x')).toBe(false)
  })

  it('isLoading returns false for a missing id (?? fallback)', () => {
    const store = createHarness()
    expect(store.getState().isLoading('missing')).toBe(false)
  })

  it('multiple concurrent loading states coexist', () => {
    const store = createHarness()
    store.getState().startLoading('a')
    store.getState().startLoading('b')
    store.getState().startLoading('c')

    expect(store.getState().isLoading('a')).toBe(true)
    expect(store.getState().isLoading('b')).toBe(true)
    expect(store.getState().isLoading('c')).toBe(true)
    expect(store.getState().loadingMap).toEqual({ a: true, b: true, c: true })

    store.getState().finishLoading('b')
    expect(store.getState().isLoading('b')).toBe(false)
    expect(store.getState().isLoading('a')).toBe(true)
    expect(store.getState().isLoading('c')).toBe(true)

    expect(store.getState().loadingMap).toEqual({ a: true, b: false, c: true })
  })
})

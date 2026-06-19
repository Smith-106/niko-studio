import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createLoadingSlice, type LoadingSlice } from '../stores/app/loadingSlice'

// ---------------------------------------------------------------------------
// createStore harness (matches projectSlice.additional.test.ts getLiveStore pattern)
// ---------------------------------------------------------------------------

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
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLoadingHooks / loadingSlice additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadingSlice concurrent loading scenarios', () => {
    it('handles 10+ concurrent loading states', () => {
      const store = createHarness()

      for (let i = 0; i < 15; i++) {
        store.getState().startLoading(`task-${i}`)
      }

      for (let i = 0; i < 15; i++) {
        expect(store.getState().isLoading(`task-${i}`)).toBe(true)
      }

      expect(Object.keys(store.getState().loadingMap)).toHaveLength(15)
    })

    it('allows finishing loading states in arbitrary order', () => {
      const store = createHarness()

      store.getState().startLoading('a')
      store.getState().startLoading('b')
      store.getState().startLoading('c')

      // Finish in reverse order
      store.getState().finishLoading('c')
      store.getState().finishLoading('a')
      store.getState().finishLoading('b')

      expect(store.getState().isLoading('a')).toBe(false)
      expect(store.getState().isLoading('b')).toBe(false)
      expect(store.getState().isLoading('c')).toBe(false)
    })

    it('preserves other loading states when finishing one', () => {
      const store = createHarness()

      store.getState().startLoading('api-call-1')
      store.getState().startLoading('api-call-2')
      store.getState().startLoading('file-load')

      store.getState().finishLoading('api-call-1')

      expect(store.getState().isLoading('api-call-1')).toBe(false)
      expect(store.getState().isLoading('api-call-2')).toBe(true)
      expect(store.getState().isLoading('file-load')).toBe(true)
    })
  })

  describe('loadingSlice idempotent operations', () => {
    it('startLoading is idempotent - calling twice does not change state', () => {
      const store = createHarness()

      store.getState().startLoading('task-1')
      store.getState().startLoading('task-1')
      store.getState().startLoading('task-1')

      expect(store.getState().loadingMap['task-1']).toBe(true)
      expect(store.getState().isLoading('task-1')).toBe(true)
    })

    it('finishLoading is idempotent - calling twice does not change state', () => {
      const store = createHarness()

      store.getState().startLoading('task-1')
      store.getState().finishLoading('task-1')
      store.getState().finishLoading('task-1')

      expect(store.getState().loadingMap['task-1']).toBe(false)
      expect(store.getState().isLoading('task-1')).toBe(false)
    })

    it('finishLoading on never-started id sets to false', () => {
      const store = createHarness()

      store.getState().finishLoading('never-started')

      expect(store.getState().loadingMap['never-started']).toBe(false)
      expect(store.getState().isLoading('never-started')).toBe(false)
    })
  })

  describe('loadingSlice unknown id lookups', () => {
    it('isLoading returns false for unknown string ids', () => {
      const store = createHarness()

      expect(store.getState().isLoading('')).toBe(false)
      expect(store.getState().isLoading('nonexistent')).toBe(false)
      expect(store.getState().isLoading('task-with-unicode-你好')).toBe(false)
    })

    it('isLoading returns false after loadingMap is populated with other ids', () => {
      const store = createHarness()

      store.getState().startLoading('active-task')

      expect(store.getState().isLoading('other-task')).toBe(false)
    })
  })

  describe('loadingSlice state persistence and re-entry', () => {
    it('maintains loading state across multiple start/finish cycles', () => {
      const store = createHarness()

      // First cycle
      store.getState().startLoading('cycle-task')
      expect(store.getState().isLoading('cycle-task')).toBe(true)
      store.getState().finishLoading('cycle-task')
      expect(store.getState().isLoading('cycle-task')).toBe(false)

      // Second cycle
      store.getState().startLoading('cycle-task')
      expect(store.getState().isLoading('cycle-task')).toBe(true)
      store.getState().finishLoading('cycle-task')
      expect(store.getState().isLoading('cycle-task')).toBe(false)
    })

    it('accumulates loadingMap entries without clearing previous ones', () => {
      const store = createHarness()

      store.getState().startLoading('batch-1')
      store.getState().startLoading('batch-2')
      store.getState().finishLoading('batch-1')

      // batch-2 is still loading
      store.getState().startLoading('batch-3')

      expect(store.getState().loadingMap).toEqual({
        'batch-1': false,
        'batch-2': true,
        'batch-3': true,
      })
    })
  })

  describe('loadingSlice functional set behavior', () => {
    it('uses functional set correctly for startLoading (spreads existing map)', () => {
      const store = createHarness()

      store.getState().startLoading('first')
      const mapAfterFirst = { ...store.getState().loadingMap }

      store.getState().startLoading('second')

      // first should still be present
      expect(store.getState().loadingMap['first']).toBe(true)
      expect(store.getState().loadingMap['second']).toBe(true)
      expect(Object.keys(store.getState().loadingMap)).toHaveLength(2)
    })

    it('uses functional set correctly for finishLoading (preserves other keys)', () => {
      const store = createHarness()

      store.getState().startLoading('a')
      store.getState().startLoading('b')
      store.getState().finishLoading('a')

      expect(store.getState().loadingMap).toEqual({
        a: false,
        b: true,
      })
    })
  })
})

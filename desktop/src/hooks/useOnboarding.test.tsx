import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useOnboarding } from './useOnboarding'

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('treats missing onboarding state as a first run', () => {
    const { result } = renderHook(() => useOnboarding())

    expect(result.current.isFirstRun).toBe(true)
  })

  it('treats persisted completion as a returning user session', () => {
    localStorage.setItem('niko-onboarding-done', 'true')

    const { result } = renderHook(() => useOnboarding())

    expect(result.current.isFirstRun).toBe(false)
  })

  it('marks onboarding as done and persists the flag', () => {
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.markDone()
    })

    expect(result.current.isFirstRun).toBe(false)
    expect(localStorage.getItem('niko-onboarding-done')).toBe('true')
  })

  it('resets onboarding state and removes the persisted flag', () => {
    localStorage.setItem('niko-onboarding-done', 'true')
    const { result } = renderHook(() => useOnboarding())

    act(() => {
      result.current.resetOnboarding()
    })

    expect(result.current.isFirstRun).toBe(true)
    expect(localStorage.getItem('niko-onboarding-done')).toBeNull()
  })
})

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAppContextUsage } from './useAppContextUsage'

describe('useAppContextUsage', () => {
  it('starts with the default context window usage and updates when usage changes', () => {
    const { result } = renderHook(() => useAppContextUsage())

    expect(result.current.contextUsage).toEqual({
      usedChars: 0,
      usedK: 0,
      totalK: 128,
      percent: 0,
    })

    const nextUsage = {
      usedChars: 4096,
      usedK: 4,
      totalK: 200,
      percent: 2,
    }

    act(() => {
      result.current.handleContextUsageChange(nextUsage)
    })

    expect(result.current.contextUsage).toEqual(nextUsage)
  })

  it('reuses the current state object when the usage payload is unchanged', () => {
    const { result } = renderHook(() => useAppContextUsage())

    act(() => {
      result.current.handleContextUsageChange({
        usedChars: 8192,
        usedK: 8,
        totalK: 128,
        percent: 6.25,
      })
    })

    const firstSnapshot = result.current.contextUsage

    act(() => {
      result.current.handleContextUsageChange({
        usedChars: 8192,
        usedK: 8,
        totalK: 128,
        percent: 6.25,
      })
    })

    expect(result.current.contextUsage).toBe(firstSnapshot)
  })
})

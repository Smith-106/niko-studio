import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToast, type ToastType } from './useToast'

describe('useToast', () => {
  it('initializes with empty toasts', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toEqual([])
  })

  it('adds a toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addToast('success', 'Test message')
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].type).toBe('success')
    expect(result.current.toasts[0].message).toBe('Test message')
  })

  it('removes a toast by id', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.addToast('info', 'First')
      result.current.addToast('error', 'Second')
    })
    expect(result.current.toasts).toHaveLength(2)
    act(() => {
      result.current.removeToast(result.current.toasts[0].id)
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Second')
  })

  it('limits toast queue to 5 items', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.addToast('info' as ToastType, `Toast ${i}`)
      }
    })
    expect(result.current.toasts).toHaveLength(5)
    // Oldest toasts should be dropped
    expect(result.current.toasts[0].message).toBe('Toast 2')
  })
})

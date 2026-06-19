import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { THEMES } from '../styles/themes'
import { useSettingsStore } from '../stores/settingsStore'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  const root = document.documentElement

  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
    root.style.cssText = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    root.removeAttribute('data-theme')
    root.classList.remove('dark')
    root.style.cssText = ''
  })

  it('applies explicit dark theme tokens to the document root', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        theme: 'slate',
      },
    }))

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('slate')
    expect(root.getAttribute('data-theme')).toBe('slate')
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.style.getPropertyValue('--primary-cta')).toBe(THEMES.slate.tokens['--primary-cta'])
  })

  it('tracks system theme changes and removes the listener on cleanup', () => {
    let prefersDark = false
    let changeHandler: (() => void) | undefined
    const removeEventListener = vi.fn()

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        get matches() {
          return prefersDark
        },
        addEventListener: vi.fn((_event: string, handler: () => void) => {
          changeHandler = handler
        }),
        removeEventListener,
      })),
    })

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        theme: 'system',
      },
    }))

    const { result, unmount } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(root.getAttribute('data-theme')).toBe('sorbet')
    expect(root.classList.contains('dark')).toBe(false)

    prefersDark = true
    act(() => {
      changeHandler?.()
    })

    expect(root.getAttribute('data-theme')).toBe('slate')
    expect(root.classList.contains('dark')).toBe(true)

    prefersDark = false
    act(() => {
      changeHandler?.()
    })

    expect(root.getAttribute('data-theme')).toBe('sorbet')
    expect(root.classList.contains('dark')).toBe(false)

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', changeHandler)
  })
})

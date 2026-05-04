import { describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'

describe('uiSlice', () => {
  it('toggles focus mode', () => {
    useAppStore.setState({ focusMode: false })
    expect(useAppStore.getState().focusMode).toBe(false)

    useAppStore.getState().toggleFocusMode()
    expect(useAppStore.getState().focusMode).toBe(true)

    useAppStore.getState().toggleFocusMode()
    expect(useAppStore.getState().focusMode).toBe(false)
  })

  it('sets focus mode directly', () => {
    useAppStore.setState({ focusMode: false })
    useAppStore.getState().setFocusMode(true)
    expect(useAppStore.getState().focusMode).toBe(true)

    useAppStore.getState().setFocusMode(false)
    expect(useAppStore.getState().focusMode).toBe(false)
  })

  it('updates word metrics partially', () => {
    useAppStore.setState({ wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 } })

    useAppStore.getState().updateWordMetrics({ wordCount: 100 })
    expect(useAppStore.getState().wordMetrics).toEqual({
      wordCount: 100,
      charCount: 0,
      readingTime: 0,
    })

    useAppStore.getState().updateWordMetrics({ charCount: 500, readingTime: 1.5 })
    expect(useAppStore.getState().wordMetrics).toEqual({
      wordCount: 100,
      charCount: 500,
      readingTime: 1.5,
    })
  })
})

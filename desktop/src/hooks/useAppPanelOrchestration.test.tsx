import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAppPanelOrchestration } from './useAppPanelOrchestration'

describe('useAppPanelOrchestration', () => {
  it('returns to writing helper after settings when opened from that panel', () => {
    const setActiveRightPanel = vi.fn()

    const { result } = renderHook(() => useAppPanelOrchestration({ setActiveRightPanel }))

    act(() => {
      result.current.openSettingsFromWritingHelper('models')
    })

    expect(result.current.settingsOpen).toBe(true)
    expect(result.current.settingsRequestedSection).toBe('models')
    expect(setActiveRightPanel).toHaveBeenCalledWith('none')

    act(() => {
      result.current.closeSettings()
    })

    expect(result.current.settingsOpen).toBe(false)
    expect(result.current.settingsRequestedSection).toBe('workflow')
    expect(setActiveRightPanel).toHaveBeenLastCalledWith('writingHelper')
  })

  it('returns to text optimizer after settings when opened from that panel', () => {
    const setActiveRightPanel = vi.fn()

    const { result } = renderHook(() => useAppPanelOrchestration({ setActiveRightPanel }))

    act(() => {
      result.current.openSettingsFromTextOptimizer()
    })

    expect(result.current.settingsOpen).toBe(true)
    expect(result.current.settingsRequestedSection).toBe('workflow')
    expect(setActiveRightPanel).toHaveBeenCalledWith('none')

    act(() => {
      result.current.closeSettings()
    })

    expect(setActiveRightPanel).toHaveBeenLastCalledWith('textOptimizer')
  })

  it('returns to automation after settings when opened from that panel', () => {
    const setActiveRightPanel = vi.fn()

    const { result } = renderHook(() => useAppPanelOrchestration({ setActiveRightPanel }))

    act(() => {
      result.current.openSettingsFromAutomation('workflow')
    })

    expect(result.current.settingsOpen).toBe(true)
    expect(result.current.settingsRequestedSection).toBe('workflow')
    expect(setActiveRightPanel).toHaveBeenCalledWith('none')

    act(() => {
      result.current.closeSettings()
    })

    expect(setActiveRightPanel).toHaveBeenLastCalledWith('automation')
  })

  it('opens automation panel and clears settings return route state', () => {
    const setActiveRightPanel = vi.fn()

    const { result } = renderHook(() => useAppPanelOrchestration({ setActiveRightPanel }))

    act(() => {
      result.current.openSettingsFromWritingHelper('workflow')
      result.current.openAutomationPanel()
    })

    expect(result.current.settingsOpen).toBe(false)
    expect(result.current.isTemplatePanelOpen).toBe(false)
    expect(setActiveRightPanel).toHaveBeenLastCalledWith('automation')

    act(() => {
      result.current.closeSettings()
    })

    expect(setActiveRightPanel).toHaveBeenCalledTimes(2)
  })


  it('does not restore a panel when settings are opened globally', () => {
    const setActiveRightPanel = vi.fn()

    const { result } = renderHook(() => useAppPanelOrchestration({ setActiveRightPanel }))

    act(() => {
      result.current.openSettings('retrieval')
    })

    expect(result.current.settingsOpen).toBe(true)
    expect(result.current.settingsRequestedSection).toBe('retrieval')

    act(() => {
      result.current.closeSettings()
    })

    expect(setActiveRightPanel).not.toHaveBeenCalled()
    expect(result.current.settingsOpen).toBe(false)
    expect(result.current.settingsRequestedSection).toBe('workflow')
  })
})

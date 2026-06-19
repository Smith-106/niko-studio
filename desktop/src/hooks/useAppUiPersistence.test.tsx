import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWritingHelperDraft, useAppUiPersistence } from './useAppUiPersistence'

describe('useAppUiPersistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('creates drafts with default values when handoff is omitted', () => {
    expect(createWritingHelperDraft({ content: 'draft' })).toEqual({
      content: 'draft',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
  })

  it('defaults to an expanded chat sidebar and no active right panel for a fresh session', () => {
    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sidebarCollapsed).toBe(false)
    expect(result.current.chatSidebarCollapsed).toBe(false)
    expect(result.current.activeRightPanel).toBe('none')
  })

  it('restores persisted sidebar and panel states', () => {
    localStorage.setItem('niko.sidebar-collapsed-v1', 'true')
    localStorage.setItem('niko.chat-sidebar-collapsed-v1', 'true')
    localStorage.setItem('niko.active-right-panel-v1', 'narrativeVisualization')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sidebarCollapsed).toBe(true)
    expect(result.current.chatSidebarCollapsed).toBe(true)
    expect(result.current.activeRightPanel).toBe('narrativeVisualization')
  })

  it('restores explicit false sidebar states from storage', () => {
    localStorage.setItem('niko.sidebar-collapsed-v1', 'false')
    localStorage.setItem('niko.chat-sidebar-collapsed-v1', 'false')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sidebarCollapsed).toBe(false)
    expect(result.current.chatSidebarCollapsed).toBe(false)
  })

  it('restores a persisted writing helper draft and revision session metadata', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: 'Body',
      mode: 'rewrite',
      maxSentences: 5,
      maxItems: 7,
      guidance: 'Tighten the tension',
      handoff: {
        source: 'evaluation',
        suggestionTitle: 'Escalate conflict',
        suggestionReason: 'Raise scene pressure',
        guidance: 'Lean into the confrontation',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
        revisionSession: {
          id: 'revision-session-1',
          chapterId: 'chapter-7',
          state: 'COMPARED',
          iteration: 2,
          comparisonSummary: 'Score improved',
        },
      },
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.writingHelperDraft).toEqual({
      content: 'Body',
      mode: 'rewrite',
      maxSentences: 5,
      maxItems: 7,
      guidance: 'Tighten the tension',
      handoff: {
        source: 'evaluation',
        suggestionTitle: 'Escalate conflict',
        suggestionReason: 'Raise scene pressure',
        guidance: 'Lean into the confrontation',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
        revisionSession: {
          id: 'revision-session-1',
          chapterId: 'chapter-7',
          state: 'COMPARED',
          iteration: 2,
          comparisonSummary: 'Score improved',
        },
      },
    })
  })

  it('normalizes invalid persisted draft fields and revision session metadata', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: 12,
      mode: 'unsupported',
      maxSentences: 0,
      maxItems: 'oops',
      guidance: false,
      handoff: {
        source: 'evaluation',
        suggestionTitle: 1,
        suggestionReason: null,
        guidance: ['bad'],
        carriedContent: 'original-reply',
        preset: 'bad-preset',
        revisionSession: {
          id: 42,
          chapterId: 7,
          state: true,
          iteration: 'three',
          comparisonSummary: ['bad'],
        },
      },
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.writingHelperDraft).toEqual({
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: {
        source: 'evaluation',
        suggestionTitle: '',
        suggestionReason: '',
        guidance: '',
        carriedContent: 'original-reply',
        preset: {
          mode: 'polish',
          maxSentences: 3,
          maxItems: 6,
        },
        revisionSession: {
          id: '',
          chapterId: null,
          state: null,
          iteration: null,
          comparisonSummary: null,
        },
      },
    })
  })

  it('drops invalid handoff payloads and invalid persisted panel values', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: 'valid text',
      handoff: {
        source: 'chat',
        carriedContent: 'invalid-value',
      },
    }))
    localStorage.setItem('niko.active-right-panel-v1', 'unsupported-panel')
    localStorage.setItem('niko.sidebar-collapsed-v1', 'maybe')
    localStorage.setItem('niko.chat-sidebar-collapsed-v1', 'maybe')
    localStorage.setItem('niko.session-intelligence-v1', JSON.stringify({
      enabled: 'yes',
      summary: 9,
      insights: ['valid', 1, null],
      sessionId: 3,
    }))
    localStorage.setItem('niko.personalized-craft-v1', JSON.stringify({
      enabled: 'yes',
      summary: 4,
      trajectory: 5,
      recommendations: 'bad',
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sidebarCollapsed).toBe(false)
    expect(result.current.chatSidebarCollapsed).toBe(false)
    expect(result.current.activeRightPanel).toBe('none')
    expect(result.current.writingHelperDraft.handoff).toBeNull()
    expect(result.current.sessionIntelligenceState).toEqual({
      enabled: false,
      summary: null,
      insights: ['valid'],
      sessionId: null,
    })
    expect(result.current.personalizedCraftState).toEqual({
      enabled: false,
      summary: null,
      trajectory: null,
      recommendations: [],
    })
  })

  it('drops non-object handoff payloads and keeps the rest of the draft intact', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: 'valid text',
      mode: 'expand',
      maxSentences: 8,
      maxItems: 9,
      guidance: 'keep this',
      handoff: 'bad-handoff',
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.writingHelperDraft).toEqual({
      content: 'valid text',
      mode: 'expand',
      maxSentences: 8,
      maxItems: 9,
      guidance: 'keep this',
      handoff: null,
    })
  })

  it('restores persisted session intelligence and personalized craft shells', () => {
    localStorage.setItem('niko.session-intelligence-v1', JSON.stringify({
      enabled: true,
      summary: 'Mild pacing drift detected.',
      insights: ['Finish one small scene goal first.'],
      sessionId: 'session-1',
    }))
    localStorage.setItem('niko.personalized-craft-v1', JSON.stringify({
      enabled: true,
      summary: 'Character clarity and rhythm are your current focus.',
      trajectory: 'The trajectory is stable and ready for incremental tuning.',
      recommendations: ['Tighten motivation visibility in the next revision pass.'],
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sessionIntelligenceState).toEqual({
      enabled: true,
      summary: 'Mild pacing drift detected.',
      insights: ['Finish one small scene goal first.'],
      sessionId: 'session-1',
    })
    expect(result.current.personalizedCraftState).toEqual({
      enabled: true,
      summary: 'Character clarity and rhythm are your current focus.',
      trajectory: 'The trajectory is stable and ready for incremental tuning.',
      recommendations: ['Tighten motivation visibility in the next revision pass.'],
    })
  })

  it('falls back to an empty insights list when persisted session intelligence insights is not an array', () => {
    localStorage.setItem('niko.session-intelligence-v1', JSON.stringify({
      enabled: true,
      summary: 'Summary',
      insights: 'not-an-array',
      sessionId: 'session-3',
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sessionIntelligenceState).toEqual({
      enabled: true,
      summary: 'Summary',
      insights: [],
      sessionId: 'session-3',
    })
  })

  it('defaults revisionSession to null when the handoff is otherwise valid', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: 'draft',
      handoff: {
        source: 'evaluation',
        suggestionTitle: 'Title',
        suggestionReason: 'Reason',
        guidance: 'Guidance',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
      },
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.writingHelperDraft.handoff).toEqual({
      source: 'evaluation',
      suggestionTitle: 'Title',
      suggestionReason: 'Reason',
      guidance: 'Guidance',
      carriedContent: 'revision-preview',
      preset: {
        mode: 'rewrite',
        maxSentences: 4,
        maxItems: 6,
      },
      revisionSession: null,
    })
  })

  it('falls back to defaults when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sidebarCollapsed).toBe(false)
    expect(result.current.chatSidebarCollapsed).toBe(false)
    expect(result.current.activeRightPanel).toBe('none')
    expect(result.current.writingHelperDraft).toEqual(createWritingHelperDraft())
    expect(result.current.sessionIntelligenceState).toEqual({
      enabled: false,
      summary: null,
      insights: [],
      sessionId: null,
    })
    expect(result.current.personalizedCraftState).toEqual({
      enabled: false,
      summary: null,
      trajectory: null,
      recommendations: [],
    })
  })

  it('collapses sidebars on narrow resize events and unregisters the listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = renderHook(() => useAppUiPersistence())

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 700,
    })

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.chatSidebarCollapsed).toBe(true)
    expect(result.current.sidebarCollapsed).toBe(true)

    unmount()
    expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('persists debounced state updates to localStorage and clears pending timers between updates', () => {
    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const { result } = renderHook(() => useAppUiPersistence())

    act(() => {
      result.current.setWritingHelperDraft(createWritingHelperDraft({ content: 'updated draft', guidance: 'focus' }))
      result.current.setSidebarCollapsed(true)
      result.current.setChatSidebarCollapsed(true)
      result.current.setActiveRightPanel('analysis')
      result.current.setSessionIntelligenceState({
        enabled: true,
        summary: 'summary',
        insights: ['insight'],
        sessionId: 'session-2',
      })
      result.current.setPersonalizedCraftState({
        enabled: true,
        summary: 'craft summary',
        trajectory: 'trajectory',
        recommendations: ['recommendation'],
      })
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(setItemSpy).toHaveBeenCalledWith(
      'niko.writing-helper-draft-v1',
      JSON.stringify(createWritingHelperDraft({ content: 'updated draft', guidance: 'focus' })),
    )
    expect(setItemSpy).toHaveBeenCalledWith('niko.sidebar-collapsed-v1', 'true')
    expect(setItemSpy).toHaveBeenCalledWith('niko.chat-sidebar-collapsed-v1', 'true')
    expect(setItemSpy).toHaveBeenCalledWith('niko.active-right-panel-v1', 'analysis')
    expect(setItemSpy).toHaveBeenCalledWith(
      'niko.session-intelligence-v1',
      JSON.stringify({
        enabled: true,
        summary: 'summary',
        insights: ['insight'],
        sessionId: 'session-2',
      }),
    )
    expect(setItemSpy).toHaveBeenCalledWith(
      'niko.personalized-craft-v1',
      JSON.stringify({
        enabled: true,
        summary: 'craft summary',
        trajectory: 'trajectory',
        recommendations: ['recommendation'],
      }),
    )
  })

  it('persists default false sidebar state and the default right panel on the initial debounce flush', () => {
    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    renderHook(() => useAppUiPersistence())

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(setItemSpy).toHaveBeenCalledWith('niko.sidebar-collapsed-v1', 'false')
    expect(setItemSpy).toHaveBeenCalledWith('niko.chat-sidebar-collapsed-v1', 'false')
    expect(setItemSpy).toHaveBeenCalledWith('niko.active-right-panel-v1', 'none')
  })

  it('swallows write and remove failures while resetting the in-memory draft', () => {
    vi.useFakeTimers()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove failed')
    })

    const { result } = renderHook(() => useAppUiPersistence())

    act(() => {
      result.current.setWritingHelperDraft(createWritingHelperDraft({ content: 'draft before clear' }))
    })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(setItemSpy).toHaveBeenCalled()

    act(() => {
      result.current.clearWritingHelperDraft()
    })

    expect(removeItemSpy).toHaveBeenCalledWith('niko.writing-helper-draft-v1')
    expect(result.current.writingHelperDraft).toEqual(createWritingHelperDraft())
  })
})

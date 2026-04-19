import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAppUiPersistence } from './useAppUiPersistence'

describe('useAppUiPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to a collapsed chat sidebar and no active right panel for a fresh session', () => {
    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.chatSidebarCollapsed).toBe(true)
    expect(result.current.activeRightPanel).toBe('none')
  })

  it('restores a user-opened chat sidebar from persisted storage', () => {
    localStorage.setItem('niko.chat-sidebar-collapsed-v1', 'false')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.chatSidebarCollapsed).toBe(false)
  })

  it('restores a user-collapsed chat sidebar from persisted storage', () => {
    localStorage.setItem('niko.chat-sidebar-collapsed-v1', 'true')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.chatSidebarCollapsed).toBe(true)
  })


  it('restores automation as an active right panel from persisted storage', () => {
    localStorage.setItem('niko.active-right-panel-v1', 'automation')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.activeRightPanel).toBe('automation')
  })

  it('restores writing helper guidance from persisted draft storage', () => {
    localStorage.setItem('niko.writing-helper-draft-v1', JSON.stringify({
      content: '正文',
      mode: 'rewrite',
      maxSentences: 5,
      maxItems: 7,
      guidance: '优先强化冲突升级。',
      handoff: {
        source: 'evaluation',
        suggestionTitle: '增加冲突',
        suggestionReason: '提升张力',
        guidance: '优先强化冲突升级。',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
      },
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.writingHelperDraft).toEqual({
      content: '正文',
      mode: 'rewrite',
      maxSentences: 5,
      maxItems: 7,
      guidance: '优先强化冲突升级。',
      handoff: {
        source: 'evaluation',
        suggestionTitle: '增加冲突',
        suggestionReason: '提升张力',
        guidance: '优先强化冲突升级。',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 6,
        },
      },
    })
  })
})

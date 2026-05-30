import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAppUiPersistence } from './useAppUiPersistence'

describe('useAppUiPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to a collapsed chat sidebar and no active right panel for a fresh session', () => {
    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.chatSidebarCollapsed).toBe(false)
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

  it('restores narrative visualization as an active right panel from persisted storage', () => {
    localStorage.setItem('niko.active-right-panel-v1', 'narrativeVisualization')

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.activeRightPanel).toBe('narrativeVisualization')
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
        revisionSession: null,
      },
    })
  })

  it('preserves revision session metadata in persisted evaluation handoff drafts', () => {
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

    expect(result.current.writingHelperDraft.handoff?.revisionSession).toEqual({
      id: 'revision-session-1',
      chapterId: 'chapter-7',
      state: 'COMPARED',
      iteration: 2,
      comparisonSummary: 'Score improved',
    })
  })

  it('restores persisted session intelligence shell state', () => {
    localStorage.setItem('niko.session-intelligence-v1', JSON.stringify({
      enabled: true,
      summary: '检测到轻微停滞风险。',
      insights: ['先完成一个最小段落目标。'],
      sessionId: 'session-1',
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.sessionIntelligenceState).toEqual({
      enabled: true,
      summary: '检测到轻微停滞风险。',
      insights: ['先完成一个最小段落目标。'],
      sessionId: 'session-1',
    })
  })

  it('restores persisted personalized craft shell state', () => {
    localStorage.setItem('niko.personalized-craft-v1', JSON.stringify({
      enabled: true,
      summary: '近期角色塑造与节奏控制是你的主要个性化关注点。',
      trajectory: '近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。',
      recommendations: ['优先针对角色动机与冲突可见性做小范围修订。'],
    }))

    const { result } = renderHook(() => useAppUiPersistence())

    expect(result.current.personalizedCraftState).toEqual({
      enabled: true,
      summary: '近期角色塑造与节奏控制是你的主要个性化关注点。',
      trajectory: '近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。',
      recommendations: ['优先针对角色动机与冲突可见性做小范围修订。'],
    })
  })
})

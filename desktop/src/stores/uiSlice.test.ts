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

  it('sets editor dirty state directly', () => {
    useAppStore.setState({ editorIsDirty: false })

    useAppStore.getState().setEditorIsDirty(true)
    expect(useAppStore.getState().editorIsDirty).toBe(true)

    useAppStore.getState().setEditorIsDirty(false)
    expect(useAppStore.getState().editorIsDirty).toBe(false)
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

  it('toggles and sets sidebar and history panel visibility', () => {
    useAppStore.setState({
      sidebarExpanded: false,
      historyPanelOpen: false,
    })

    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarExpanded).toBe(true)

    useAppStore.getState().setSidebarExpanded(false)
    expect(useAppStore.getState().sidebarExpanded).toBe(false)

    useAppStore.getState().toggleHistoryPanel()
    expect(useAppStore.getState().historyPanelOpen).toBe(true)

    useAppStore.getState().setHistoryPanelOpen(false)
    expect(useAppStore.getState().historyPanelOpen).toBe(false)
  })

  it('stores session intelligence visibility and summary independently', () => {
    useAppStore.setState({
      sessionIntelligenceEnabled: false,
      sessionIntelligenceSummary: null,
      sessionIntelligenceInsights: [],
      sessionIntelligenceSessionId: null,
    })

    useAppStore.getState().setSessionIntelligenceEnabled(true)
    useAppStore.getState().setSessionIntelligenceSummary('检测到轻微停滞风险。')
    useAppStore.getState().setSessionIntelligenceInsights(['先完成一个最小段落目标。'])
    useAppStore.getState().setSessionIntelligenceSessionId('session-1')

    expect(useAppStore.getState().sessionIntelligenceEnabled).toBe(true)
    expect(useAppStore.getState().sessionIntelligenceSummary).toBe('检测到轻微停滞风险。')
    expect(useAppStore.getState().sessionIntelligenceInsights).toEqual(['先完成一个最小段落目标。'])
    expect(useAppStore.getState().sessionIntelligenceSessionId).toBe('session-1')
  })

  it('stores personalized craft state independently', () => {
    useAppStore.setState({
      personalizedCraftEnabled: false,
      personalizedCraftSummary: null,
      personalizedCraftTrajectory: null,
      personalizedCraftRecommendations: [],
    })

    useAppStore.getState().setPersonalizedCraftEnabled(true)
    useAppStore.getState().setPersonalizedCraftSummary('近期角色塑造与节奏控制是你的主要个性化关注点。')
    useAppStore.getState().setPersonalizedCraftTrajectory('近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。')
    useAppStore.getState().setPersonalizedCraftRecommendations([
      '优先针对角色动机与冲突可见性做小范围修订。',
    ])

    expect(useAppStore.getState().personalizedCraftEnabled).toBe(true)
    expect(useAppStore.getState().personalizedCraftSummary).toBe('近期角色塑造与节奏控制是你的主要个性化关注点。')
    expect(useAppStore.getState().personalizedCraftTrajectory).toBe('近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。')
    expect(useAppStore.getState().personalizedCraftRecommendations).toEqual([
      '优先针对角色动机与冲突可见性做小范围修订。',
    ])
  })
})

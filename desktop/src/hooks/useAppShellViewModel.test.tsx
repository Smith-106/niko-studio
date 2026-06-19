import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { WritingHelperDraftState } from './useAppUiPersistence'
import { useAppShellViewModel } from './useAppShellViewModel'

function createOptions() {
  const writingHelperDraft: WritingHelperDraftState = {
    content: '',
    mode: 'polish',
    maxSentences: 3,
    maxItems: 6,
    guidance: '',
  }

  const uiPersistence = {
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    chatSidebarCollapsed: false,
    setChatSidebarCollapsed: vi.fn(),
    activeRightPanel: 'none' as const,
    writingHelperDraft,
    setWritingHelperDraft: vi.fn(),
    clearWritingHelperDraft: vi.fn(),
  }

  const panelOrchestration = {
    settingsOpen: false,
    settingsRequestedSection: 'workflow' as const,
    isTemplatePanelOpen: true,
    setIsTemplatePanelOpen: vi.fn(),
    closeRightPanel: vi.fn(),
    toggleRightPanel: vi.fn(),
    openSettings: vi.fn(),
    openDiagnostics: vi.fn(),
    openPrompts: vi.fn(),
    closeSettings: vi.fn(),
    openDetailedDiagnostics: vi.fn(),
    openSettingsFromWritingHelper: vi.fn(),
    openSettingsFromTextOptimizer: vi.fn(),
    openSettingsFromAutomation: vi.fn(),
    openAutomationPanel: vi.fn(),
  }

  const checkpointMenu = {
    checkpointMenuOpen: false,
    checkpointsLoading: false,
    checkpoints: [],
    checkpointMenuContainerRef: { current: null as HTMLDivElement | null },
    checkpointMenuTriggerRef: { current: null as HTMLButtonElement | null },
    closeCheckpointMenu: vi.fn(),
    handleToggleCheckpointMenu: vi.fn(),
    handleRestoreCheckpoint: vi.fn(),
    restoreStatus: null,
  }

  return {
    uiPersistence,
    panelOrchestration,
    evaluationSources: [
      {
        kind: 'latestAssistantReply' as const,
        label: 'Latest assistant reply',
        content: 'Latest assistant reply',
      },
    ],
    t: {
      appTitle: 'Niko Studio',
      contextUsage: 'Context',
      checkpoint: 'Checkpoint',
      loadingCheckpoints: 'Loading checkpoints',
      noCheckpoints: 'No checkpoints',
      restore: 'Restore',
      contextEstimated: 'Estimated',
    },
    headerViewModel: {
      headerConnectionState: 'degraded' as const,
      headerDotClass: 'bg-amber-500',
      headerConnectionText: 'Some actions may need retry',
      contextUsageVisible: false,
      contextUsageText: '0.0k/128k',
      contextUsageWidthPercent: 0,
    },
    checkpointMenu,
    onContextUsageChange: vi.fn(),
  }
}

describe('useAppShellViewModel', () => {
  it('covers sidebar, header, main-content, and chat-sidebar action callbacks', () => {
    const options = createOptions()
    options.onReconnectGateway = vi.fn()

    const { result } = renderHook(() => useAppShellViewModel(options))

    act(() => {
      result.current.sidebarProps.onToggle()
      result.current.sidebarProps.onOpenKnowledge()
      result.current.sidebarProps.onOpenEvaluation()
      result.current.sidebarProps.onOpenForeshadowingTracker()
      result.current.sidebarProps.onOpenPatternDashboard()
      result.current.sidebarProps.onOpenSessionAnalytics()
      result.current.sidebarProps.onOpenAnalysis()
      result.current.sidebarProps.onOpenEvaluationDrillDown()
      result.current.sidebarProps.onOpenCharacterRelationships()
      result.current.sidebarProps.onOpenNarrativeVisualization()
      result.current.sidebarProps.onOpenMcpStatus()

      result.current.appMainContentProps.headerProps.onAiRewrite()
      result.current.appMainContentProps.headerProps.onAiDescribe()
      result.current.appMainContentProps.headerProps.onAiBrainstorm()
      result.current.appMainContentProps.headerProps.onOpenWritingHelper()
      result.current.appMainContentProps.headerProps.onOpenTextOptimizer()

      result.current.appMainContentProps.onOpenWritingHelper()
      result.current.appMainContentProps.onOpenSettings()
      result.current.appMainContentProps.onOpenCharacterPanel()
      result.current.appMainContentProps.onOpenTemplateBrowser()
      result.current.appMainContentProps.onOpenPanel('workflowEditor')

      result.current.chatSidebarProps.onToggleChatSidebar()
      result.current.chatSidebarProps.chatAreaProps.onToggleKnowledgePanel()
    })

    expect(options.uiPersistence.setSidebarCollapsed).toHaveBeenCalledWith(true)
    expect(options.uiPersistence.setChatSidebarCollapsed).toHaveBeenCalledWith(true)
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('knowledge')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('evaluation')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('foreshadowingTracker')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('patternDashboard')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('sessionAnalytics')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('analysis')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('evaluationDrillDown')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('characterRelationships')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('narrativeVisualization')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('mcpStatus')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('textOptimizer')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('templateBrowser')
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('workflowEditor')
    expect(options.panelOrchestration.openSettings).toHaveBeenCalledTimes(1)
    expect(result.current.appMainContentProps.headerProps.onReconnectGateway).toBe(options.onReconnectGateway)

    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(1, {
      content: '',
      mode: 'rewrite',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(2, {
      content: '',
      mode: 'expand',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(3, {
      content: '',
      mode: 'outline',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(4, {
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(5, {
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
  })

  it('uses connected fallback, exposes visible context percent, and avoids reopening the active panel', () => {
    const options = createOptions()
    options.uiPersistence.activeRightPanel = 'knowledge'
    options.headerViewModel.headerConnectionState = undefined as never
    options.headerViewModel.contextUsageVisible = true
    options.headerViewModel.contextUsageWidthPercent = 42
    options.headerViewModel.contextUsageText = ''

    const { result } = renderHook(() => useAppShellViewModel(options))

    act(() => {
      result.current.appMainContentProps.onOpenPanel('knowledge')
    })

    expect(result.current.appMainContentProps.headerProps.headerConnectionState).toBe('connected')
    expect(result.current.chatSidebarProps.chatAreaProps.connectionState).toBe('connected')
    expect(result.current.appMainContentProps.contextEstimatedText).toBe('')
    expect(result.current.appMainContentProps.contextPercent).toBe(42)
    expect(options.panelOrchestration.toggleRightPanel).not.toHaveBeenCalled()
  })

  it('wires the header connection state into both the header and chat sidebar props', () => {
    const options = createOptions()

    const { result } = renderHook(() => useAppShellViewModel(options))

    expect(result.current.appMainContentProps.headerProps.headerConnectionState).toBe('degraded')
    expect(result.current.appMainContentProps.headerProps.headerConnectionText).toBe('Some actions may need retry')
    expect(result.current.appMainContentProps.headerProps.onOpenDiagnostics).toBe(options.panelOrchestration.openDiagnostics)
    expect(result.current.chatSidebarProps.chatAreaProps.connectionState).toBe('degraded')
    expect(result.current.chatSidebarProps.chatAreaProps.onTemplatePanelOpenChange).toBe(options.panelOrchestration.setIsTemplatePanelOpen)
    expect(result.current.appRightPanelsProps.evaluationSources).toEqual(options.evaluationSources)
  })

  it('surfaces the header context meter inside the main content footer text', () => {
    const options = createOptions()

    const { result } = renderHook(() => useAppShellViewModel(options))

    expect(result.current.appMainContentProps.contextEstimatedText).toBe('Estimated · 0.0k/128k')
  })

  it('keeps continue-writing and chat-toggle shell actions routed through the expected coordinators', () => {
    const options = createOptions()

    const { result } = renderHook(() => useAppShellViewModel(options))

    act(() => {
      result.current.sidebarProps.onContinueWriting()
      result.current.appMainContentProps.headerProps.onToggleChatSidebar()
    })

    expect(options.panelOrchestration.setIsTemplatePanelOpen).toHaveBeenCalledWith(false)
    expect(options.panelOrchestration.closeSettings).toHaveBeenCalledTimes(1)
    expect(options.panelOrchestration.closeRightPanel).toHaveBeenCalledTimes(1)
    expect(options.uiPersistence.setChatSidebarCollapsed).toHaveBeenCalledWith(true)
  })

  it('opens writing helper from evaluation with a rewrite draft based on the handed-off content', () => {
    const options = createOptions()

    const { result } = renderHook(() => useAppShellViewModel(options))

    act(() => {
      result.current.appRightPanelsProps.onOpenWritingHelperFromEvaluation({
        content: 'Draft from evaluation',
        guidance: 'Prioritize the conflict escalation.',
        mode: 'outline',
        maxSentences: 5,
        maxItems: 8,
        handoff: {
          source: 'evaluation',
          suggestionTitle: 'Increase the conflict',
          suggestionReason: 'Raise the stakes',
          guidance: 'Prioritize the conflict escalation.',
          carriedContent: 'revision-preview',
          preset: {
            mode: 'outline',
            maxSentences: 5,
            maxItems: 8,
          },
        },
      })
    })

    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenCalledWith({
      content: 'Draft from evaluation',
      mode: 'outline',
      maxSentences: 5,
      maxItems: 8,
      guidance: 'Prioritize the conflict escalation.',
      handoff: {
        source: 'evaluation',
        suggestionTitle: 'Increase the conflict',
        suggestionReason: 'Raise the stakes',
        guidance: 'Prioritize the conflict escalation.',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'outline',
          maxSentences: 5,
          maxItems: 8,
        },
      },
    })
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('writingHelper')
  })

  it('passes distinct settings entrypoints for writing helper, text optimizer, and automation panels', () => {
    const options = createOptions()

    const { result } = renderHook(() => useAppShellViewModel(options))

    expect(result.current.appRightPanelsProps.openSettingsFromWritingHelper).toBe(
      options.panelOrchestration.openSettingsFromWritingHelper,
    )
    expect(result.current.appRightPanelsProps.openSettingsFromTextOptimizer).toBe(
      options.panelOrchestration.openSettingsFromTextOptimizer,
    )
    expect(result.current.appRightPanelsProps.openSettingsFromAutomation).toBe(
      options.panelOrchestration.openSettingsFromAutomation,
    )
    expect(result.current.appRightPanelsProps.onOpenAutomationFromEvaluation).toBe(
      options.panelOrchestration.openAutomationPanel,
    )
  })

  it('treats header writing-helper launches as fresh starts instead of stale draft resumes', () => {
    const options = createOptions()
    options.uiPersistence.writingHelperDraft = {
      content: 'stale draft',
      mode: 'rewrite',
      maxSentences: 9,
      maxItems: 9,
      guidance: 'stale guidance',
      handoff: {
        source: 'evaluation',
        suggestionTitle: 'Old suggestion',
        suggestionReason: 'Old reason',
        guidance: 'stale guidance',
        carriedContent: 'revision-preview',
        preset: {
          mode: 'rewrite',
          maxSentences: 9,
          maxItems: 9,
        },
      },
    }

    const { result } = renderHook(() => useAppShellViewModel(options))

    act(() => {
      result.current.appMainContentProps.headerProps.onAiWrite()
    })

    expect(options.uiPersistence.setWritingHelperDraft).toHaveBeenCalledWith({
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(options.panelOrchestration.toggleRightPanel).toHaveBeenCalledWith('writingHelper')
  })
})

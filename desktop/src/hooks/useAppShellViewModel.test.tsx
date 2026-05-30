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

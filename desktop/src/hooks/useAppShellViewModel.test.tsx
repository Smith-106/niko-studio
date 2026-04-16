import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useAppShellViewModel } from './useAppShellViewModel'

function createOptions() {
  const uiPersistence = {
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
    chatSidebarCollapsed: false,
    setChatSidebarCollapsed: vi.fn(),
    activeRightPanel: 'none' as const,
    writingHelperDraft: {
      content: '',
      mode: 'polish' as const,
      maxSentences: 3,
      maxItems: 6,
    },
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
  }

  const checkpointMenu = {
    checkpointMenuOpen: false,
    checkpointsLoading: false,
    checkpoints: [],
    checkpointMenuContainerRef: { current: null as HTMLDivElement | null },
    handleToggleCheckpointMenu: vi.fn(),
    handleRestoreCheckpoint: vi.fn(),
    restoreStatus: null,
  }

  return {
    uiPersistence,
    panelOrchestration,
    latestAssistantContent: 'Latest assistant reply',
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
      contextUsageBarClass: 'bg-primary-500',
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
})

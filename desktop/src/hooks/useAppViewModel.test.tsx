import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hookMocks = vi.hoisted(() => ({
  useAppStoreMock: vi.fn(),
  useLatestAssistantMessageContentMock: vi.fn(),
  getCurrentEditorSelectionTextMock: vi.fn(),
  useAppRuntimeHealthMock: vi.fn(),
  useAppUiPersistenceMock: vi.fn(),
  useAppCheckpointMenuMock: vi.fn(),
  useAppPanelOrchestrationMock: vi.fn(),
  useAppHeaderViewModelMock: vi.fn(),
  useAppContextUsageMock: vi.fn(),
  useAppShellViewModelMock: vi.fn(),
  useI18nMock: vi.fn(),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: hookMocks.useAppStoreMock,
}))

vi.mock('../stores/selectors', () => ({
  useLatestAssistantMessageContent: hookMocks.useLatestAssistantMessageContentMock,
}))

vi.mock('../utils/editorHandle', () => ({
  getCurrentEditorSelectionText: hookMocks.getCurrentEditorSelectionTextMock,
}))

vi.mock('./useAppRuntimeHealth', () => ({
  useAppRuntimeHealth: hookMocks.useAppRuntimeHealthMock,
}))

vi.mock('./useAppUiPersistence', () => ({
  useAppUiPersistence: hookMocks.useAppUiPersistenceMock,
}))

vi.mock('./useAppCheckpointMenu', () => ({
  useAppCheckpointMenu: hookMocks.useAppCheckpointMenuMock,
}))

vi.mock('./useAppPanelOrchestration', () => ({
  useAppPanelOrchestration: hookMocks.useAppPanelOrchestrationMock,
}))

vi.mock('./useAppHeaderViewModel', () => ({
  useAppHeaderViewModel: hookMocks.useAppHeaderViewModelMock,
}))

vi.mock('./useAppContextUsage', () => ({
  useAppContextUsage: hookMocks.useAppContextUsageMock,
}))

vi.mock('./useAppShellViewModel', () => ({
  useAppShellViewModel: hookMocks.useAppShellViewModelMock,
}))

vi.mock('../i18n', () => ({
  useI18n: hookMocks.useI18nMock,
}))

import { useAppViewModel } from './useAppViewModel'

describe('useAppViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects shell inputs from the app hooks and forwards them into useAppShellViewModel', () => {
    const backendStore = {
      backendStatus: false,
      checkBackend: vi.fn(),
    }
    const uiPersistence = {
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      chatSidebarCollapsed: true,
      setChatSidebarCollapsed: vi.fn(),
      activeRightPanel: 'evaluation' as const,
      setActiveRightPanel: vi.fn(),
      writingHelperDraft: {
        content: 'Current draft',
        mode: 'polish' as const,
        maxSentences: 3,
        maxItems: 6,
        guidance: '',
      },
      setWritingHelperDraft: vi.fn(),
      clearWritingHelperDraft: vi.fn(),
    }
    const contextUsageView = {
      contextUsage: {
        usedK: 0,
        totalK: 128,
        percent: 0,
      },
      handleContextUsageChange: vi.fn(),
    }
    const runtimeView = {
      connectionState: 'degraded',
      reconnectState: 'failed',
      sessionId: null,
      reconnectAttempts: 1,
      lastError: null,
      lastProbeAt: null,
      servers: {},
    }
    const panelOrchestration = {
      settingsOpen: false,
      settingsRequestedSection: 'workflow' as const,
      isTemplatePanelOpen: false,
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
      checkpointMenuTriggerRef: { current: null as HTMLButtonElement | null },
      closeCheckpointMenu: vi.fn(),
      handleToggleCheckpointMenu: vi.fn(),
      handleRestoreCheckpoint: vi.fn(),
      restoreStatus: null,
    }
    const headerViewModel = {
      headerConnectionState: 'degraded' as const,
      headerDotClass: 'bg-amber-500',
      headerConnectionText: 'Some actions may need retry',
      contextUsageVisible: false,
      contextUsageText: '',
      contextUsageBarClass: 'bg-primary-500',
      contextUsageWidthPercent: 0,
    }
    const shellViewModel = {
      sidebarProps: { collapsed: false },
      appRightPanelsProps: { activeRightPanel: 'none' },
      appMainContentProps: { contextEstimatedText: '' },
      chatSidebarProps: { chatSidebarCollapsed: true },
    }
    const t = {
      restoreFailed: 'Restore failed',
      restoreSuccess: 'Restore successful',
    }

    hookMocks.useAppStoreMock.mockReturnValue(backendStore)
    hookMocks.useAppUiPersistenceMock.mockReturnValue(uiPersistence)
    hookMocks.useLatestAssistantMessageContentMock.mockReturnValue('Latest assistant reply')
    hookMocks.getCurrentEditorSelectionTextMock.mockReturnValue('Selected text')
    hookMocks.useAppContextUsageMock.mockReturnValue(contextUsageView)
    hookMocks.useAppRuntimeHealthMock.mockReturnValue(runtimeView)
    hookMocks.useI18nMock.mockReturnValue({ t, language: 'en' })
    hookMocks.useAppPanelOrchestrationMock.mockReturnValue(panelOrchestration)
    hookMocks.useAppCheckpointMenuMock.mockReturnValue(checkpointMenu)
    hookMocks.useAppHeaderViewModelMock.mockReturnValue(headerViewModel)
    hookMocks.useAppShellViewModelMock.mockReturnValue(shellViewModel)

    const { result } = renderHook(() => useAppViewModel())

    expect(hookMocks.useAppRuntimeHealthMock).toHaveBeenCalledWith({
      backendStatus: false,
      checkBackend: backendStore.checkBackend,
    })
    expect(hookMocks.useAppPanelOrchestrationMock).toHaveBeenCalledWith({
      setActiveRightPanel: uiPersistence.setActiveRightPanel,
    })
    expect(hookMocks.useAppCheckpointMenuMock).toHaveBeenCalledWith({
      restoreFailedText: 'Restore failed',
      restoreSuccessText: 'Restore successful',
    })
    expect(hookMocks.useAppHeaderViewModelMock).toHaveBeenCalledWith({
      runtimeView,
      backendStatus: false,
      t,
      contextUsage: contextUsageView.contextUsage,
    })
    expect(hookMocks.useAppShellViewModelMock).toHaveBeenCalledWith({
      uiPersistence,
      panelOrchestration,
      evaluationSources: [
        {
          kind: 'latestAssistantReply',
          label: 'Latest assistant reply',
          content: 'Latest assistant reply',
        },
        {
          kind: 'editorSelection',
          label: 'Current editor selection',
          content: 'Selected text',
        },
        {
          kind: 'currentDraft',
          label: 'Current draft',
          content: 'Current draft',
        },
      ],
      t,
      headerViewModel,
      checkpointMenu,
      onContextUsageChange: contextUsageView.handleContextUsageChange,
    })
    expect(result.current).toBe(shellViewModel)
  })

  it('skips editor selection reads while the evaluation panel is closed', () => {
    hookMocks.useAppStoreMock.mockReturnValue({ backendStatus: false, checkBackend: vi.fn() })
    hookMocks.useAppUiPersistenceMock.mockReturnValue({
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      chatSidebarCollapsed: true,
      setChatSidebarCollapsed: vi.fn(),
      activeRightPanel: 'none',
      setActiveRightPanel: vi.fn(),
      writingHelperDraft: { content: 'Current draft', mode: 'polish', maxSentences: 3, maxItems: 6, guidance: '' },
      setWritingHelperDraft: vi.fn(),
      clearWritingHelperDraft: vi.fn(),
    })
    hookMocks.useLatestAssistantMessageContentMock.mockReturnValue('Latest assistant reply')
    hookMocks.useAppContextUsageMock.mockReturnValue({ contextUsage: { usedK: 0, totalK: 128, percent: 0 }, handleContextUsageChange: vi.fn() })
    hookMocks.useAppRuntimeHealthMock.mockReturnValue({ connectionState: 'connected' })
    hookMocks.useI18nMock.mockReturnValue({ t: { restoreFailed: 'Restore failed', restoreSuccess: 'Restore successful' }, language: 'en' })
    hookMocks.useAppPanelOrchestrationMock.mockReturnValue({})
    hookMocks.useAppCheckpointMenuMock.mockReturnValue({})
    hookMocks.useAppHeaderViewModelMock.mockReturnValue({})
    hookMocks.useAppShellViewModelMock.mockReturnValue({ sidebarProps: {}, appRightPanelsProps: {}, appMainContentProps: {}, chatSidebarProps: {} })

    renderHook(() => useAppViewModel())

    expect(hookMocks.getCurrentEditorSelectionTextMock).not.toHaveBeenCalled()
  })
})

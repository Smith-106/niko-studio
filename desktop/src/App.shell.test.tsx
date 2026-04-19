import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appShellMocks = vi.hoisted(() => ({
  useAppStoreMock: vi.fn(),
  useLatestAssistantMessageContentMock: vi.fn(),
  useAppRuntimeHealthMock: vi.fn(),
  useAppUiPersistenceMock: vi.fn(),
  useAppCheckpointMenuMock: vi.fn(),
  useAppPanelOrchestrationMock: vi.fn(),
  useAppHeaderViewModelMock: vi.fn(),
  useAppContextUsageMock: vi.fn(),
  useAppStartupMock: vi.fn(),
  useToastMock: vi.fn(),
  useI18nMock: vi.fn(),
  useSettingsStoreMock: vi.fn(),
}))

vi.mock('./components/Sidebar', () => ({
  Sidebar: (props: {
    collapsed: boolean
    onContinueWriting: () => void
  }) => (
    <aside>
      <div>{`sidebar-collapsed:${String(props.collapsed)}`}</div>
      <button onClick={props.onContinueWriting}>continue writing</button>
    </aside>
  ),
}))

vi.mock('./components/AppMainContent', () => ({
  AppMainContent: (props: {
    headerProps: {
      headerConnectionText: string
      onOpenDiagnostics: () => void
      onToggleChatSidebar: () => void
      onAiWrite: () => void
      onOpenWritingHelper: () => void
    }
  }) => (
    <main id="app-main-content" tabIndex={-1}>
      <div>{`header-connection:${props.headerProps.headerConnectionText}`}</div>
      <button onClick={props.headerProps.onOpenDiagnostics}>open diagnostics</button>
      <button onClick={props.headerProps.onToggleChatSidebar}>toggle chat sidebar</button>
      <button onClick={props.headerProps.onAiWrite}>header ai write</button>
      <button onClick={props.headerProps.onOpenWritingHelper}>header open writing helper</button>
    </main>
  ),
}))

vi.mock('./components/ChatSidebar', () => ({
  ChatSidebar: (props: {
    chatSidebarCollapsed: boolean
    chatAreaProps: {
      connectionState: string
    }
  }) => (
    <aside>
      <div>{`chat-collapsed:${String(props.chatSidebarCollapsed)}`}</div>
      <div>{`chat-connection:${props.chatAreaProps.connectionState}`}</div>
    </aside>
  ),
}))

vi.mock('./components/AppRightPanels', () => ({
  AppRightPanels: (props: {
    activeRightPanel: string
    evaluationSources: Array<{
      label: string
      content: string
    }>
    settingsOpen: boolean
  }) => (
    <aside>
      <div>{`active-panel:${props.activeRightPanel}`}</div>
      <div>{`latest-assistant:${props.evaluationSources[0]?.content ?? ''}`}</div>
      <div>{`settings-open:${String(props.settingsOpen)}`}</div>
    </aside>
  ),
}))

vi.mock('./components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('./components/ToastContainer', () => ({
  ToastContainer: () => null,
}))

vi.mock('./stores/appStore', () => ({
  useAppStore: appShellMocks.useAppStoreMock,
}))

vi.mock('./stores/selectors', () => ({
  useLatestAssistantMessageContent: appShellMocks.useLatestAssistantMessageContentMock,
}))

vi.mock('./hooks/useAppRuntimeHealth', () => ({
  useAppRuntimeHealth: appShellMocks.useAppRuntimeHealthMock,
}))

vi.mock('./hooks/useAppUiPersistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./hooks/useAppUiPersistence')>()
  return {
    ...actual,
    useAppUiPersistence: appShellMocks.useAppUiPersistenceMock,
  }
})

vi.mock('./hooks/useAppCheckpointMenu', () => ({
  useAppCheckpointMenu: appShellMocks.useAppCheckpointMenuMock,
}))

vi.mock('./hooks/useAppPanelOrchestration', () => ({
  useAppPanelOrchestration: appShellMocks.useAppPanelOrchestrationMock,
}))

vi.mock('./hooks/useAppHeaderViewModel', () => ({
  useAppHeaderViewModel: appShellMocks.useAppHeaderViewModelMock,
}))

vi.mock('./hooks/useAppContextUsage', () => ({
  useAppContextUsage: appShellMocks.useAppContextUsageMock,
}))

vi.mock('./hooks/useAppStartup', () => ({
  useAppStartup: appShellMocks.useAppStartupMock,
}))

vi.mock('./hooks/useToast', () => ({
  useToast: appShellMocks.useToastMock,
}))

vi.mock('./stores/settingsStore', () => ({
  useSettingsStore: appShellMocks.useSettingsStoreMock,
}))

vi.mock('./i18n', () => ({
  useI18n: appShellMocks.useI18nMock,
}))

import App from './App'

describe('App shell integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the real app shell wiring through useAppViewModel and routes shell actions to the right coordinators', async () => {
    const user = userEvent.setup()
    const uiPersistence = {
      sidebarCollapsed: false,
      setSidebarCollapsed: vi.fn(),
      chatSidebarCollapsed: false,
      setChatSidebarCollapsed: vi.fn(),
      activeRightPanel: 'evaluation' as const,
      setActiveRightPanel: vi.fn(),
      writingHelperDraft: {
        content: '',
        mode: 'polish' as const,
        maxSentences: 3,
        maxItems: 6,
        guidance: '',
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
      openSettingsFromTextOptimizer: vi.fn(),
      openSettingsFromAutomation: vi.fn(),
      openAutomationPanel: vi.fn(),
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

    appShellMocks.useAppStoreMock.mockReturnValue({
      backendStatus: false,
      checkBackend: vi.fn(),
    })
    appShellMocks.useLatestAssistantMessageContentMock.mockReturnValue('Latest assistant reply')
    appShellMocks.useAppRuntimeHealthMock.mockReturnValue({
      connectionState: 'degraded',
      reconnectState: 'failed',
      sessionId: null,
      reconnectAttempts: 1,
      lastError: null,
      lastProbeAt: null,
      servers: {},
    })
    appShellMocks.useAppUiPersistenceMock.mockReturnValue(uiPersistence)
    appShellMocks.useAppCheckpointMenuMock.mockReturnValue(checkpointMenu)
    appShellMocks.useAppPanelOrchestrationMock.mockReturnValue(panelOrchestration)
    appShellMocks.useAppHeaderViewModelMock.mockReturnValue({
      headerConnectionState: 'degraded',
      headerDotClass: 'bg-amber-500',
      headerConnectionText: 'Some actions may need retry',
      contextUsageVisible: false,
      contextUsageText: '',
      contextUsageBarClass: 'bg-primary-500',
      contextUsageWidthPercent: 0,
    })
    appShellMocks.useAppContextUsageMock.mockReturnValue({
      contextUsage: {
        usedK: 0,
        totalK: 128,
        percent: 0,
      },
      handleContextUsageChange: vi.fn(),
    })
    appShellMocks.useAppStartupMock.mockImplementation(() => {})
    appShellMocks.useToastMock.mockReturnValue({
      toasts: [],
      removeToast: vi.fn(),
    })
    appShellMocks.useI18nMock.mockReturnValue({
      t: {
        skipToMainContent: 'Skip to main content',
        appTitle: 'Niko Studio',
        contextUsage: 'Context',
        checkpoint: 'Checkpoint',
        loadingCheckpoints: 'Loading checkpoints',
        noCheckpoints: 'No checkpoints',
        restore: 'Restore',
        contextEstimated: 'Estimated',
        restoreFailed: 'Restore failed',
        restoreSuccess: 'Restore successful',
      },
    })
    appShellMocks.useSettingsStoreMock.mockImplementation(
      (selector: (state: { settings: { fontSize: 'small' | 'medium' | 'large' } }) => unknown) =>
        selector({ settings: { fontSize: 'medium' } }),
    )

    render(<App />)

    expect(appShellMocks.useAppStartupMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('sidebar-collapsed:false')).toBeInTheDocument()
    expect(screen.getByText('header-connection:Some actions may need retry')).toBeInTheDocument()
    expect(screen.getByText('chat-collapsed:false')).toBeInTheDocument()
    expect(screen.getByText('chat-connection:degraded')).toBeInTheDocument()
    expect(screen.getByText('active-panel:evaluation')).toBeInTheDocument()
    expect(screen.getByText('latest-assistant:Latest assistant reply')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'open diagnostics' }))
    await user.click(screen.getByRole('button', { name: 'continue writing' }))
    await user.click(screen.getByRole('button', { name: 'toggle chat sidebar' }))
    await user.click(screen.getByRole('button', { name: 'header ai write' }))
    await user.click(screen.getByRole('button', { name: 'header open writing helper' }))

    expect(panelOrchestration.openDiagnostics).toHaveBeenCalledTimes(1)
    expect(panelOrchestration.setIsTemplatePanelOpen).toHaveBeenCalledWith(false)
    expect(panelOrchestration.closeSettings).toHaveBeenCalledTimes(1)
    expect(panelOrchestration.closeRightPanel).toHaveBeenCalledTimes(1)
    expect(uiPersistence.setChatSidebarCollapsed).toHaveBeenCalledWith(true)
    expect(uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(1, {
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(uiPersistence.setWritingHelperDraft).toHaveBeenNthCalledWith(2, {
      content: '',
      mode: 'polish',
      maxSentences: 3,
      maxItems: 6,
      guidance: '',
      handoff: null,
    })
    expect(panelOrchestration.toggleRightPanel).toHaveBeenNthCalledWith(1, 'writingHelper')
    expect(panelOrchestration.toggleRightPanel).toHaveBeenNthCalledWith(2, 'writingHelper')
  })
})

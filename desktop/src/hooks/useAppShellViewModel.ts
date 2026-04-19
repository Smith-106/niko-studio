import type { ComponentProps } from 'react'
import { Sidebar } from '../components/Sidebar'
import { AppRightPanels } from '../components/AppRightPanels'
import { AppMainContent } from '../components/AppMainContent'
import { ChatSidebar } from '../components/ChatSidebar'
import { createWritingHelperDraft, type RightPanelType, type WritingHelperDraftState } from './useAppUiPersistence'
import type { SettingsSectionId } from './useAppPanelOrchestration'
import type { EvaluationSourceDescriptor } from '../stores/selectors'

interface UseAppShellViewModelOptions {
  uiPersistence: {
    sidebarCollapsed: boolean
    setSidebarCollapsed: (collapsed: boolean) => void
    chatSidebarCollapsed: boolean
    setChatSidebarCollapsed: (collapsed: boolean) => void
    activeRightPanel: RightPanelType
    writingHelperDraft: WritingHelperDraftState
    setWritingHelperDraft: (draft: WritingHelperDraftState) => void
    clearWritingHelperDraft: () => void
  }
  panelOrchestration: {
    settingsOpen: boolean
    settingsRequestedSection: SettingsSectionId
    isTemplatePanelOpen: ComponentProps<typeof ChatSidebar>['chatAreaProps']['isTemplatePanelOpen']
    setIsTemplatePanelOpen: (isOpen: boolean) => void
    closeRightPanel: () => void
    toggleRightPanel: (panel: Exclude<RightPanelType, 'none'>) => void
    openSettings: (section?: SettingsSectionId) => void
    openDiagnostics: () => void
    openPrompts: () => void
    closeSettings: () => void
    openDetailedDiagnostics: () => void
    openSettingsFromWritingHelper: () => void
    openSettingsFromTextOptimizer: () => void
    openSettingsFromAutomation: () => void
    openAutomationPanel: () => void
  }
  evaluationSources: EvaluationSourceDescriptor[]
  t: {
    appTitle: string
    contextUsage: string
    checkpoint: string
    loadingCheckpoints: string
    noCheckpoints: string
    restore: string
    contextEstimated: string
  }
  headerViewModel: {
    headerConnectionState: ComponentProps<typeof ChatSidebar>['chatAreaProps']['connectionState']
    headerDotClass: string
    headerConnectionText: string
    contextUsageVisible: boolean
    contextUsageText: string
    contextUsageBarClass: string
    contextUsageWidthPercent: number
  }
  checkpointMenu: {
    checkpointMenuOpen: boolean
    checkpointsLoading: boolean
    checkpoints: ComponentProps<typeof AppMainContent>['headerProps']['checkpoints']
    checkpointMenuContainerRef: ComponentProps<typeof AppMainContent>['headerProps']['checkpointMenuContainerRef']
    handleToggleCheckpointMenu: ComponentProps<typeof AppMainContent>['headerProps']['onToggleCheckpointMenu']
    handleRestoreCheckpoint: ComponentProps<typeof AppMainContent>['headerProps']['onRestoreCheckpoint']
    restoreStatus: ComponentProps<typeof AppMainContent>['restoreStatus']
  }
  onContextUsageChange: ComponentProps<typeof ChatSidebar>['chatAreaProps']['onContextUsageChange']
}

export function useAppShellViewModel({
  uiPersistence,
  panelOrchestration,
  evaluationSources,
  t,
  headerViewModel,
  checkpointMenu,
  onContextUsageChange,
}: UseAppShellViewModelOptions) {
  const openWritingHelperFreshStart = (mode: WritingHelperDraftState['mode'] = 'polish') => {
    uiPersistence.setWritingHelperDraft(createWritingHelperDraft({ mode }))
    panelOrchestration.toggleRightPanel('writingHelper')
  }

  const sidebarProps: ComponentProps<typeof Sidebar> = {
    collapsed: uiPersistence.sidebarCollapsed,
    onToggle: () => uiPersistence.setSidebarCollapsed(!uiPersistence.sidebarCollapsed),
    onContinueWriting: () => {
      panelOrchestration.setIsTemplatePanelOpen(false)
      panelOrchestration.closeSettings()
      panelOrchestration.closeRightPanel()
    },
    onOpenKnowledge: () => panelOrchestration.toggleRightPanel('knowledge'),
    onOpenPrompts: panelOrchestration.openPrompts,
    onOpenSettings: panelOrchestration.openSettings,
    onOpenEvaluation: () => panelOrchestration.toggleRightPanel('evaluation'),
  }

  const appRightPanelsProps: ComponentProps<typeof AppRightPanels> = {
    activeRightPanel: uiPersistence.activeRightPanel,
    settingsOpen: panelOrchestration.settingsOpen,
    settingsRequestedSection: panelOrchestration.settingsRequestedSection,
    evaluationSources,
    writingHelperDraft: uiPersistence.writingHelperDraft,
    closeRightPanel: panelOrchestration.closeRightPanel,
    closeSettings: panelOrchestration.closeSettings,
    openDetailedDiagnostics: panelOrchestration.openDetailedDiagnostics,
    openSettingsFromWritingHelper: panelOrchestration.openSettingsFromWritingHelper,
    openSettingsFromTextOptimizer: panelOrchestration.openSettingsFromTextOptimizer,
    openSettingsFromAutomation: panelOrchestration.openSettingsFromAutomation,
    onOpenAutomationFromEvaluation: panelOrchestration.openAutomationPanel,
    onOpenWritingHelperFromEvaluation: ({ content, guidance, mode, maxSentences, maxItems, handoff }) => {
      uiPersistence.setWritingHelperDraft({
        ...uiPersistence.writingHelperDraft,
        content,
        mode,
        maxSentences,
        maxItems,
        guidance,
        handoff,
      })
      panelOrchestration.toggleRightPanel('writingHelper')
    },
    setWritingHelperDraft: uiPersistence.setWritingHelperDraft,
    clearWritingHelperDraft: uiPersistence.clearWritingHelperDraft,
  }

  const appMainContentProps: ComponentProps<typeof AppMainContent> = {
    headerProps: {
      appTitle: t.appTitle,
      contextUsageLabel: t.contextUsage,
      contextUsageVisible: headerViewModel.contextUsageVisible,
      contextUsageText: headerViewModel.contextUsageText,
      contextUsageBarClass: headerViewModel.contextUsageBarClass,
      contextUsageWidthPercent: headerViewModel.contextUsageWidthPercent,
      headerConnectionState: headerViewModel.headerConnectionState ?? 'connected',
      headerDotClass: headerViewModel.headerDotClass,
      headerConnectionText: headerViewModel.headerConnectionText,
      onOpenDiagnostics: panelOrchestration.openDiagnostics,
      checkpointLabel: t.checkpoint,
      loadingCheckpointsLabel: t.loadingCheckpoints,
      noCheckpointsLabel: t.noCheckpoints,
      restoreLabel: t.restore,
      checkpointMenuOpen: checkpointMenu.checkpointMenuOpen,
      checkpointsLoading: checkpointMenu.checkpointsLoading,
      checkpoints: checkpointMenu.checkpoints,
      checkpointMenuContainerRef: checkpointMenu.checkpointMenuContainerRef,
      onToggleCheckpointMenu: checkpointMenu.handleToggleCheckpointMenu,
      onRestoreCheckpoint: checkpointMenu.handleRestoreCheckpoint,
      chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
      onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
      aiToolbarDisabled: false,
      onAiWrite: () => openWritingHelperFreshStart('polish'),
      onAiRewrite: () => openWritingHelperFreshStart('rewrite'),
      onAiDescribe: () => openWritingHelperFreshStart('expand'),
      onAiBrainstorm: () => openWritingHelperFreshStart('outline'),
      onOpenWritingHelper: () => openWritingHelperFreshStart('polish'),
      onOpenTextOptimizer: () => panelOrchestration.toggleRightPanel('textOptimizer'),
    },
    restoreStatus: checkpointMenu.restoreStatus,
    contextEstimatedText: '',
    onOpenWritingHelper: () => openWritingHelperFreshStart('polish'),
  }

  const chatSidebarProps = {
    chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
    onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
    chatAreaProps: {
      onContextUsageChange,
      connectionState: headerViewModel.headerConnectionState ?? 'connected',
      isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
      onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
    }
  }

  return {
    sidebarProps,
    appRightPanelsProps,
    appMainContentProps,
    chatSidebarProps,
  }
}

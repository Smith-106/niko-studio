import type { ComponentProps } from 'react'
import { Sidebar } from '../components/Sidebar'
import { AppRightPanels } from '../components/AppRightPanels'
import { AppMainContent } from '../components/AppMainContent'
import type { RightPanelType, WritingHelperDraftState } from './useAppUiPersistence'

interface UseAppShellViewModelOptions {
  uiPersistence: {
    sidebarCollapsed: boolean
    setSidebarCollapsed: (collapsed: boolean) => void
    activeRightPanel: RightPanelType
    writingHelperDraft: WritingHelperDraftState
    setWritingHelperDraft: (draft: WritingHelperDraftState) => void
    clearWritingHelperDraft: () => void
  }
  panelOrchestration: {
    settingsOpen: boolean
    isTemplatePanelOpen: ComponentProps<typeof AppMainContent>['chatAreaProps']['isTemplatePanelOpen']
    setIsTemplatePanelOpen: ComponentProps<typeof AppMainContent>['chatAreaProps']['onTemplatePanelOpenChange']
    closeRightPanel: () => void
    toggleRightPanel: (panel: Exclude<RightPanelType, 'none'>) => void
    openSettings: () => void
    openPrompts: () => void
    closeSettings: () => void
    openSettingsFromWritingHelper: () => void
  }
  latestAssistantContent: string
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
    headerConnectionState: ComponentProps<typeof AppMainContent>['chatAreaProps']['connectionState']
    headerDotClass: string
    headerConnectionText: string
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
  onContextUsageChange: ComponentProps<typeof AppMainContent>['chatAreaProps']['onContextUsageChange']
}

export function useAppShellViewModel({
  uiPersistence,
  panelOrchestration,
  latestAssistantContent,
  t,
  headerViewModel,
  checkpointMenu,
  onContextUsageChange,
}: UseAppShellViewModelOptions) {
  const sidebarProps: ComponentProps<typeof Sidebar> = {
    collapsed: uiPersistence.sidebarCollapsed,
    onToggle: () => uiPersistence.setSidebarCollapsed(!uiPersistence.sidebarCollapsed),
    onOpenKnowledge: () => panelOrchestration.toggleRightPanel('knowledge'),
    onOpenPrompts: panelOrchestration.openPrompts,
    onOpenSettings: panelOrchestration.openSettings,
    onOpenEvaluation: () => panelOrchestration.toggleRightPanel('evaluation'),
    onOpenMcpStatus: () => panelOrchestration.toggleRightPanel('mcpStatus'),
    onOpenWritingHelper: () => panelOrchestration.toggleRightPanel('writingHelper'),
  }

  const appRightPanelsProps: ComponentProps<typeof AppRightPanels> = {
    activeRightPanel: uiPersistence.activeRightPanel,
    settingsOpen: panelOrchestration.settingsOpen,
    latestAssistantContent,
    writingHelperDraft: uiPersistence.writingHelperDraft,
    closeRightPanel: panelOrchestration.closeRightPanel,
    closeSettings: panelOrchestration.closeSettings,
    openSettingsFromWritingHelper: panelOrchestration.openSettingsFromWritingHelper,
    setWritingHelperDraft: uiPersistence.setWritingHelperDraft,
    clearWritingHelperDraft: uiPersistence.clearWritingHelperDraft,
  }

  const appMainContentProps: ComponentProps<typeof AppMainContent> = {
    headerProps: {
      appTitle: t.appTitle,
      contextUsageLabel: t.contextUsage,
      contextUsageText: headerViewModel.contextUsageText,
      contextUsageBarClass: headerViewModel.contextUsageBarClass,
      contextUsageWidthPercent: headerViewModel.contextUsageWidthPercent,
      headerDotClass: headerViewModel.headerDotClass,
      headerConnectionText: headerViewModel.headerConnectionText,
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
    },
    restoreStatus: checkpointMenu.restoreStatus,
    chatAreaProps: {
      onContextUsageChange,
      connectionState: headerViewModel.headerConnectionState,
      isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
      onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
    },
    contextEstimatedText: t.contextEstimated,
  }

  return {
    sidebarProps,
    appRightPanelsProps,
    appMainContentProps,
  }
}

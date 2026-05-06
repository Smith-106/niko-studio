import { useCallback, useState } from 'react'
import type { RightPanelType } from './useAppUiPersistence'

export type SettingsSectionId = 'backend' | 'workflow' | 'retrieval' | 'templates' | 'models' | 'style' | 'ui' | 'diagnostics'
type SettingsReturnPanel = Extract<RightPanelType, 'writingHelper' | 'textOptimizer' | 'automation'>

interface SettingsReturnRoute {
  panel: SettingsReturnPanel
  section: SettingsSectionId
}

interface UseAppPanelOrchestrationOptions {
  setActiveRightPanel: (value: RightPanelType | ((prev: RightPanelType) => RightPanelType)) => void
}

export function useAppPanelOrchestration({ setActiveRightPanel }: UseAppPanelOrchestrationOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsRequestedSection, setSettingsRequestedSection] = useState<SettingsSectionId>('workflow')
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const [settingsReturnRoute, setSettingsReturnRoute] = useState<SettingsReturnRoute | null>(null)

  const closeRightPanel = useCallback(() => {
    setActiveRightPanel('none')
  }, [setActiveRightPanel])

  const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
    setIsTemplatePanelOpen(false)
    setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
  }, [setActiveRightPanel])

  const openSettings = useCallback((section: SettingsSectionId = 'workflow') => {
    setSettingsReturnRoute(null)
    setSettingsRequestedSection(section)
    setSettingsOpen(true)
  }, [])

  const openDiagnostics = useCallback(() => {
    openSettings('diagnostics')
  }, [openSettings])

  const openPrompts = useCallback(() => {
    setActiveRightPanel('none')
    setIsTemplatePanelOpen(true)
  }, [setActiveRightPanel])

  const closeSettings = useCallback(() => {
    const returnRoute = settingsReturnRoute
    setSettingsOpen(false)
    setSettingsRequestedSection('workflow')
    setSettingsReturnRoute(null)
    if (returnRoute) {
      setActiveRightPanel(returnRoute.panel)
    }
  }, [settingsReturnRoute, setActiveRightPanel])

  const openSettingsFromPanel = useCallback((panel: SettingsReturnPanel, section: SettingsSectionId = 'workflow') => {
    setSettingsReturnRoute({ panel, section })
    setActiveRightPanel('none')
    setSettingsRequestedSection(section)
    setSettingsOpen(true)
  }, [setActiveRightPanel])

  const openSettingsFromWritingHelper = useCallback((section: SettingsSectionId = 'workflow') => {
    openSettingsFromPanel('writingHelper', section)
  }, [openSettingsFromPanel])

  const openSettingsFromTextOptimizer = useCallback((section: SettingsSectionId = 'workflow') => {
    openSettingsFromPanel('textOptimizer', section)
  }, [openSettingsFromPanel])

  const openSettingsFromAutomation = useCallback((section: SettingsSectionId = 'workflow') => {
    openSettingsFromPanel('automation', section)
  }, [openSettingsFromPanel])

  const openAutomationPanel = useCallback(() => {
    setSettingsOpen(false)
    setSettingsReturnRoute(null)
    setIsTemplatePanelOpen(false)
    setActiveRightPanel('automation')
  }, [setActiveRightPanel])

  const openDetailedDiagnostics = useCallback(() => {
    setSettingsOpen(false)
    setSettingsReturnRoute(null)
    setIsTemplatePanelOpen(false)
    setActiveRightPanel('mcpStatus')
  }, [setActiveRightPanel])

  return {
    settingsOpen,
    settingsRequestedSection,
    isTemplatePanelOpen,
    setIsTemplatePanelOpen,
    closeRightPanel,
    toggleRightPanel,
    openSettings,
    openDiagnostics,
    openPrompts,
    closeSettings,
    openSettingsFromWritingHelper,
    openSettingsFromTextOptimizer,
    openSettingsFromAutomation,
    openAutomationPanel,
    openDetailedDiagnostics,
  }
}

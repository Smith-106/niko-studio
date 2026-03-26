import { useCallback, useState } from 'react'
import type { RightPanelType } from './useAppUiPersistence'

interface UseAppPanelOrchestrationOptions {
  setActiveRightPanel: (value: RightPanelType | ((prev: RightPanelType) => RightPanelType)) => void
}

export function useAppPanelOrchestration({ setActiveRightPanel }: UseAppPanelOrchestrationOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)

  const closeRightPanel = useCallback(() => {
    setActiveRightPanel('none')
  }, [setActiveRightPanel])

  const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
    setIsTemplatePanelOpen(false)
    setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
  }, [setActiveRightPanel])

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const openPrompts = useCallback(() => {
    setActiveRightPanel('none')
    setIsTemplatePanelOpen(true)
  }, [setActiveRightPanel])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    if (resumeWritingHelperAfterSettings) {
      setActiveRightPanel('writingHelper')
      setResumeWritingHelperAfterSettings(false)
    }
  }, [resumeWritingHelperAfterSettings, setActiveRightPanel])

  const openSettingsFromWritingHelper = useCallback(() => {
    setResumeWritingHelperAfterSettings(true)
    setActiveRightPanel('none')
    setSettingsOpen(true)
  }, [setActiveRightPanel])

  return {
    settingsOpen,
    isTemplatePanelOpen,
    setIsTemplatePanelOpen,
    closeRightPanel,
    toggleRightPanel,
    openSettings,
    openPrompts,
    closeSettings,
    openSettingsFromWritingHelper,
  }
}

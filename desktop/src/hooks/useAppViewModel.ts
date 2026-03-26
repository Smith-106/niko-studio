import { useAppStore } from '../stores/appStore'
import { useLatestAssistantMessageContent } from '../stores/selectors'
import { useAppRuntimeHealth } from './useAppRuntimeHealth'
import { useAppUiPersistence } from './useAppUiPersistence'
import { useAppCheckpointMenu } from './useAppCheckpointMenu'
import { useAppPanelOrchestration } from './useAppPanelOrchestration'
import { useAppHeaderViewModel } from './useAppHeaderViewModel'
import { useAppContextUsage } from './useAppContextUsage'
import { useAppShellViewModel } from './useAppShellViewModel'
import { useI18n } from '../i18n'

export function useAppViewModel() {
  const { backendStatus, checkBackend } = useAppStore()
  const uiPersistence = useAppUiPersistence()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const contextUsageView = useAppContextUsage()
  const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
  const { t } = useI18n()

  const panelOrchestration = useAppPanelOrchestration({
    setActiveRightPanel: uiPersistence.setActiveRightPanel,
  })

  const checkpointMenu = useAppCheckpointMenu({
    restoreFailedText: t.restoreFailed,
    restoreSuccessText: t.restoreSuccess,
  })

  const headerViewModel = useAppHeaderViewModel({
    runtimeView,
    backendStatus,
    t,
    contextUsage: contextUsageView.contextUsage,
  })

  return useAppShellViewModel({
    uiPersistence,
    panelOrchestration,
    latestAssistantContent,
    t,
    headerViewModel,
    checkpointMenu,
    onContextUsageChange: contextUsageView.handleContextUsageChange,
  })
}

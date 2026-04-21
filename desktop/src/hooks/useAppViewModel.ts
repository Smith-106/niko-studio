import { useAppStore } from '../stores/appStore'
import { type EvaluationSourceDescriptor, useLatestAssistantMessageContent } from '../stores/selectors'
import { useAppRuntimeHealth } from './useAppRuntimeHealth'
import { useAppUiPersistence } from './useAppUiPersistence'
import { useAppCheckpointMenu } from './useAppCheckpointMenu'
import { useAppPanelOrchestration } from './useAppPanelOrchestration'
import { useAppHeaderViewModel } from './useAppHeaderViewModel'
import { useAppContextUsage } from './useAppContextUsage'
import { useAppShellViewModel } from './useAppShellViewModel'
import { useI18n } from '../i18n'
import { getCurrentEditorSelectionText } from '../utils/editorHandle'

export function useAppViewModel() {
  const { backendStatus, checkBackend } = useAppStore()
  const uiPersistence = useAppUiPersistence()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const contextUsageView = useAppContextUsage()
  const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
  const { t, language } = useI18n()
  const isZh = language === 'zh'
  const shouldCollectEvaluationSources = uiPersistence.activeRightPanel === 'evaluation'
  // TipTap selection reads walk the current document, so avoid them while the evaluation UI is closed.
  const editorSelectionContent = shouldCollectEvaluationSources ? getCurrentEditorSelectionText() : ''
  const currentDraftContent = shouldCollectEvaluationSources ? uiPersistence.writingHelperDraft.content.trim() : ''
  const evaluationSources: EvaluationSourceDescriptor[] = []

  if (latestAssistantContent.trim()) {
    evaluationSources.push({
      kind: 'latestAssistantReply',
      label: isZh ? '最近一次助手回复' : 'Latest assistant reply',
      content: latestAssistantContent.trim(),
    })
  }

  if (editorSelectionContent) {
    evaluationSources.push({
      kind: 'editorSelection',
      label: isZh ? '当前编辑器选区' : 'Current editor selection',
      content: editorSelectionContent,
    })
  }

  if (currentDraftContent) {
    evaluationSources.push({
      kind: 'currentDraft',
      label: isZh ? '当前写作草稿' : 'Current draft',
      content: currentDraftContent,
    })
  }

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
    evaluationSources,
    t,
    headerViewModel,
    checkpointMenu,
    onContextUsageChange: contextUsageView.handleContextUsageChange,
  })
}

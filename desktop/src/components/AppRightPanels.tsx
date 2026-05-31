import { Suspense, lazy } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

import type { SettingsSectionId } from '../hooks/useAppPanelOrchestration'
import type { RightPanelType, WritingHelperDraftState, WritingHelperEvaluationHandoff } from '../hooks/useAppUiPersistence'
import type { EvaluationSourceDescriptor } from '../stores/selectors'

const SettingsModal = lazy(async () => {
  const module = await import('./SettingsModal')
  return { default: module.SettingsModal }
})

const KnowledgeModal = lazy(async () => {
  const module = await import('./KnowledgeModal')
  return { default: module.KnowledgeModal }
})

const EvaluationPanel = lazy(async () => {
  const module = await import('./EvaluationPanel')
  return { default: module.EvaluationPanel }
})

const AutomationPanel = lazy(async () => {
  const module = await import('./AutomationPanel')
  return { default: module.AutomationPanel }
})

const McpStatusPanel = lazy(async () => {
  const module = await import('./McpStatusPanel')
  return { default: module.McpStatusPanel }
})

const WritingHelperPanel = lazy(async () => {
  const module = await import('./WritingHelperPanel')
  return { default: module.WritingHelperPanel }
})

const AiTextOptimizer = lazy(async () => {
  const module = await import('./AiTextOptimizer')
  return { default: module.AiTextOptimizer }
})

const ForeshadowingTrackerPanel = lazy(async () => {
  const module = await import('./ForeshadowingTrackerPanel')
  return { default: module.ForeshadowingTrackerPanel }
})

const PatternDashboardPanel = lazy(async () => {
  const module = await import('./PatternDashboardPanel')
  return { default: module.PatternDashboardPanel }
})

const SessionAnalyticsPanel = lazy(async () => {
  const module = await import('./SessionAnalyticsPanel')
  return { default: module.SessionAnalyticsPanel }
})

const EvaluationDrillDownPanel = lazy(async () => {
  const module = await import('./EvaluationDrillDownPanel')
  return { default: module.EvaluationDrillDownPanel }
})

const CharacterRelationshipsPanel = lazy(async () => {
  const module = await import('./CharacterRelationshipsPanel')
  return { default: module.CharacterRelationshipsPanel }
})

const AnalysisPanel = lazy(async () => {
  const module = await import('./AnalysisPanel')
  return { default: module.AnalysisPanel }
})

const TemplateBrowserPanel = lazy(async () => {
  const module = await import('./TemplateBrowserPanel')
  return { default: module.TemplateBrowserPanel }
})

const WorkflowEditorPanel = lazy(async () => {
  const module = await import('./WorkflowEditorPanel')
  return { default: module.WorkflowEditorPanel }
})

const NarrativeVisualizationPanel = lazy(async () => {
  const module = await import('./NarrativeVisualizationPanel')
  return { default: module.NarrativeVisualizationPanel }
})


interface AppRightPanelsProps {
  activeRightPanel: RightPanelType
  settingsOpen: boolean
  settingsRequestedSection?: SettingsSectionId
  evaluationSources: EvaluationSourceDescriptor[]
  writingHelperDraft: WritingHelperDraftState
  closeRightPanel: () => void
  closeSettings: () => void
  openDetailedDiagnostics: () => void
  openSettingsFromWritingHelper: () => void
  openSettingsFromTextOptimizer: () => void
  openSettingsFromAutomation: () => void
  onOpenAutomationFromEvaluation: () => void
  onOpenWritingHelperFromEvaluation: (handoff: {
    content: string
    guidance: string
    mode: WritingHelperDraftState['mode']
    maxSentences: number
    maxItems: number
    handoff: WritingHelperEvaluationHandoff
  }) => void
  setWritingHelperDraft: (draft: WritingHelperDraftState) => void
  clearWritingHelperDraft: () => void
}

export function AppRightPanels({
  activeRightPanel,
  settingsOpen,
  settingsRequestedSection,
  evaluationSources,
  writingHelperDraft,
  closeRightPanel,
  closeSettings,
  openDetailedDiagnostics,
  openSettingsFromWritingHelper,
  openSettingsFromTextOptimizer,
  openSettingsFromAutomation,
  onOpenAutomationFromEvaluation,
  onOpenWritingHelperFromEvaluation,
  setWritingHelperDraft,
  clearWritingHelperDraft,
}: AppRightPanelsProps) {
  return (
    <Suspense fallback={null}>
      {activeRightPanel === 'knowledge' && (
        <KnowledgeModal isOpen onClose={closeRightPanel} />
      )}

      {settingsOpen && (
        <SettingsModal
          isOpen
          onClose={closeSettings}
          requestedSection={settingsRequestedSection}
          onOpenDetailedDiagnostics={openDetailedDiagnostics}
        />
      )}

      {activeRightPanel === 'evaluation' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">评估面板加载失败，请关闭后重试。</div>}>
          <EvaluationPanel
            evaluationSources={evaluationSources}
            onClose={closeRightPanel}
            onOpenAutomation={onOpenAutomationFromEvaluation}
            onOpenWritingHelper={onOpenWritingHelperFromEvaluation}
          />
        </ErrorBoundary>
      )}

      {activeRightPanel === 'automation' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">自动化面板加载失败，请关闭后重试。</div>}>
          <AutomationPanel
            onClose={closeRightPanel}
            onOpenSettings={openSettingsFromAutomation}
          />
        </ErrorBoundary>
      )}

      {activeRightPanel === 'mcpStatus' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">MCP 状态面板加载失败，请关闭后重试。</div>}>
          <McpStatusPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}

      {activeRightPanel === 'writingHelper' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">写作助手面板加载失败，请关闭后重试。</div>}>
          <WritingHelperPanel
            onClose={closeRightPanel}
            onOpenSettings={openSettingsFromWritingHelper}
            draftState={writingHelperDraft}
            onDraftStateChange={setWritingHelperDraft}
            onClearDraft={clearWritingHelperDraft}
          />
        </ErrorBoundary>
      )}

      {activeRightPanel === 'textOptimizer' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">文本优化器加载失败，请关闭后重试。</div>}>
          <AiTextOptimizer
            onClose={closeRightPanel}
            onOpenSettings={openSettingsFromTextOptimizer}
          />
        </ErrorBoundary>
      )}

      {activeRightPanel === 'foreshadowingTracker' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">伏笔追踪面板加载失败，请关闭后重试。</div>}>
          <ForeshadowingTrackerPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'patternDashboard' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">模式仪表盘加载失败，请关闭后重试。</div>}>
          <PatternDashboardPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'sessionAnalytics' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">会话分析面板加载失败，请关闭后重试。</div>}>
          <SessionAnalyticsPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'evaluationDrillDown' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">评估详情面板加载失败，请关闭后重试。</div>}>
          <EvaluationDrillDownPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'characterRelationships' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">角色关系面板加载失败，请关闭后重试。</div>}>
          <CharacterRelationshipsPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'analysis' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">分析面板加载失败，请关闭后重试。</div>}>
          <AnalysisPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'templateBrowser' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">模板浏览器加载失败，请关闭后重试。</div>}>
          <TemplateBrowserPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'workflowEditor' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">工作流编辑器加载失败，请关闭后重试。</div>}>
          <WorkflowEditorPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
      {activeRightPanel === 'narrativeVisualization' && (
        <ErrorBoundary fallback={<div className="p-4 text-dark-text-muted text-sm">叙事可视化面板加载失败，请关闭后重试。</div>}>
          <NarrativeVisualizationPanel onClose={closeRightPanel} />
        </ErrorBoundary>
      )}
    </Suspense>
  )
}

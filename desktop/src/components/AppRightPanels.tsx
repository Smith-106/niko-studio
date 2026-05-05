import { Suspense, lazy } from 'react'

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
        <EvaluationPanel
          evaluationSources={evaluationSources}
          onClose={closeRightPanel}
          onOpenAutomation={onOpenAutomationFromEvaluation}
          onOpenWritingHelper={onOpenWritingHelperFromEvaluation}
        />
      )}

      {activeRightPanel === 'automation' && (
        <AutomationPanel
          onClose={closeRightPanel}
          onOpenSettings={openSettingsFromAutomation}
        />
      )}

      {activeRightPanel === 'mcpStatus' && <McpStatusPanel onClose={closeRightPanel} />}

      {activeRightPanel === 'writingHelper' && (
        <WritingHelperPanel
          onClose={closeRightPanel}
          onOpenSettings={openSettingsFromWritingHelper}
          draftState={writingHelperDraft}
          onDraftStateChange={setWritingHelperDraft}
          onClearDraft={clearWritingHelperDraft}
        />
      )}

      {activeRightPanel === 'textOptimizer' && (
        <AiTextOptimizer
          onClose={closeRightPanel}
          onOpenSettings={openSettingsFromTextOptimizer}
        />
      )}

      {activeRightPanel === 'foreshadowingTracker' && <ForeshadowingTrackerPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'patternDashboard' && <PatternDashboardPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'sessionAnalytics' && <SessionAnalyticsPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'evaluationDrillDown' && <EvaluationDrillDownPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'characterRelationships' && <CharacterRelationshipsPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'analysis' && <AnalysisPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'templateBrowser' && <TemplateBrowserPanel onClose={closeRightPanel} />}
      {activeRightPanel === 'workflowEditor' && <WorkflowEditorPanel onClose={closeRightPanel} />}
    </Suspense>
  )
}

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./SettingsModal', () => ({
  SettingsModal: ({
    requestedSection,
    onClose,
    onOpenDetailedDiagnostics,
  }: {
    requestedSection?: string
    onClose: () => void
    onOpenDetailedDiagnostics: () => void
  }) => (
    <div data-testid="settings-modal">
      <span>{requestedSection ?? 'none'}</span>
      <button type="button" onClick={onClose}>
        close-settings
      </button>
      <button type="button" onClick={onOpenDetailedDiagnostics}>
        open-diagnostics
      </button>
    </div>
  ),
}))

vi.mock('./KnowledgeModal', () => ({
  KnowledgeModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <button type="button" data-testid="knowledge-panel" data-open={String(isOpen)} onClick={onClose}>
      knowledge
    </button>
  ),
}))

function createCloseOnlyMock(testId: string) {
  return ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid={testId} onClick={onClose}>
      {testId}
    </button>
  )
}

vi.mock('./McpStatusPanel', () => ({
  McpStatusPanel: createCloseOnlyMock('mcp-panel'),
}))

vi.mock('./ForeshadowingTrackerPanel', () => ({
  ForeshadowingTrackerPanel: createCloseOnlyMock('foreshadowing-panel'),
}))

vi.mock('./PatternDashboardPanel', () => ({
  PatternDashboardPanel: createCloseOnlyMock('pattern-dashboard-panel'),
}))

vi.mock('./SessionAnalyticsPanel', () => ({
  SessionAnalyticsPanel: createCloseOnlyMock('session-analytics-panel'),
}))

vi.mock('./EvaluationDrillDownPanel', () => ({
  EvaluationDrillDownPanel: createCloseOnlyMock('evaluation-drilldown-panel'),
}))

vi.mock('./CharacterRelationshipsPanel', () => ({
  CharacterRelationshipsPanel: createCloseOnlyMock('character-relationships-panel'),
}))

vi.mock('./AnalysisPanel', () => ({
  AnalysisPanel: createCloseOnlyMock('analysis-panel'),
}))

vi.mock('./TemplateBrowserPanel', () => ({
  TemplateBrowserPanel: createCloseOnlyMock('template-browser-panel'),
}))

vi.mock('./WorkflowEditorPanel', () => ({
  WorkflowEditorPanel: createCloseOnlyMock('workflow-editor-panel'),
}))

vi.mock('./NarrativeVisualizationPanel', () => ({
  NarrativeVisualizationPanel: createCloseOnlyMock('narrative-visualization-panel'),
}))

import type { WritingHelperDraftState } from '../hooks/useAppUiPersistence'

import { AppRightPanels } from './AppRightPanels'

const defaultDraft: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
  guidance: '',
  handoff: null,
}

function renderPanels(
  overrides: Partial<React.ComponentProps<typeof AppRightPanels>> = {},
) {
  const closeRightPanel = overrides.closeRightPanel ?? vi.fn()
  const closeSettings = overrides.closeSettings ?? vi.fn()
  const openDetailedDiagnostics = overrides.openDetailedDiagnostics ?? vi.fn()

  render(
    <AppRightPanels
      activeRightPanel="none"
      settingsOpen={false}
      evaluationSources={[]}
      writingHelperDraft={defaultDraft}
      closeRightPanel={closeRightPanel}
      closeSettings={closeSettings}
      openDetailedDiagnostics={openDetailedDiagnostics}
      openSettingsFromWritingHelper={() => {}}
      openSettingsFromTextOptimizer={() => {}}
      openSettingsFromAutomation={() => {}}
      onOpenAutomationFromEvaluation={() => {}}
      onOpenWritingHelperFromEvaluation={() => {}}
      setWritingHelperDraft={() => {}}
      clearWritingHelperDraft={() => {}}
      {...overrides}
    />,
  )

  return { closeRightPanel, closeSettings, openDetailedDiagnostics }
}

describe('AppRightPanels branch coverage', () => {
  it('renders the settings modal branch and forwards callbacks', async () => {
    const user = userEvent.setup()
    const { closeSettings, openDetailedDiagnostics } = renderPanels({
      settingsOpen: true,
      settingsRequestedSection: 'providers',
    })

    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument()
    expect(screen.getByText('providers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'open-diagnostics' }))
    await user.click(screen.getByRole('button', { name: 'close-settings' }))

    expect(openDetailedDiagnostics).toHaveBeenCalledTimes(1)
    expect(closeSettings).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['knowledge', 'knowledge-panel'],
    ['mcpStatus', 'mcp-panel'],
    ['foreshadowingTracker', 'foreshadowing-panel'],
    ['patternDashboard', 'pattern-dashboard-panel'],
    ['sessionAnalytics', 'session-analytics-panel'],
    ['evaluationDrillDown', 'evaluation-drilldown-panel'],
    ['characterRelationships', 'character-relationships-panel'],
    ['analysis', 'analysis-panel'],
    ['templateBrowser', 'template-browser-panel'],
    ['workflowEditor', 'workflow-editor-panel'],
    ['narrativeVisualization', 'narrative-visualization-panel'],
  ])('renders the %s panel branch and wires onClose', async (panel, testId) => {
    const user = userEvent.setup()
    const { closeRightPanel } = renderPanels({
      activeRightPanel: panel as React.ComponentProps<typeof AppRightPanels>['activeRightPanel'],
    })

    const trigger = await screen.findByTestId(testId)
    if (panel === 'knowledge') {
      expect(trigger).toHaveAttribute('data-open', 'true')
    }

    await user.click(trigger)
    expect(closeRightPanel).toHaveBeenCalledTimes(1)
  })
})

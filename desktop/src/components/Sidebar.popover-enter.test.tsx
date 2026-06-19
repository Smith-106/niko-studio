import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Sidebar } from './Sidebar'

const createConversationMock = vi.fn()
const selectConversationMock = vi.fn()

let mockConversations: { id: string; title: string; messages: unknown[] }[] = [
  { id: 'conv-1', title: 'Chapter 1 Draft', messages: [] },
  { id: 'conv-2', title: 'Character Notes', messages: [] },
]
let mockCurrentConversationId = 'conv-1'

vi.mock('../stores/selectors', () => ({
  useConversationList: () => mockConversations,
  useCurrentConversationId: () => mockCurrentConversationId,
  useCreateConversation: () => createConversationMock,
  useSelectConversation: () => selectConversationMock,
}))

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: () => ({
    hasMeaningfulScope: false,
    projectLabel: null,
    chapterLabel: null,
    storyBibleLabel: null,
    focusLabel: null,
    workspaceLabel: null,
    workflowLabel: null,
    scopeChips: [],
    meaningfulWorkspace: null,
  }),
}))

vi.mock('../hooks/useResizablePanel', () => ({
  useResizablePanel: () => ({
    width: 288,
    isResizing: false,
    startResize: vi.fn(),
    resetWidth: vi.fn(),
  }),
}))

vi.mock('./PanelResizeHandle', () => ({
  PanelResizeHandle: () => <button type="button" aria-label="resize-handle">resize-handle</button>,
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      nikoStudio: 'Niko-Studio',
      sidebarToggleExpand: 'Expand sidebar',
      sidebarToggleCollapse: 'Collapse sidebar',
      sidebarNewDocument: 'New Document',
      sidebarDocuments: 'Documents',
      sidebarContinueWriting: 'Continue writing',
      templateLibraryEntry: 'Templates',
      knowledgeBase: 'Story Notes',
      settings: 'Settings',
      sidebarEvaluationPanel: 'Reply Review',
      sidebarNarrativeVisualization: 'Narrative Visualization',
      sidebarWriterIntelligence: 'Writer Intelligence',
      sidebarAnalysis: 'Smart Analysis',
      sidebarEvaluationDrillDown: 'Deep Evaluation',
      sidebarForeshadowingTracker: 'Foreshadowing',
      sidebarCharacterRelationships: 'Characters',
      sidebarPatternDashboard: 'Patterns',
      sidebarSessionAnalytics: 'Session Stats',
      sidebarFlowWrite: 'Write & Evaluate',
      sidebarFlowEvaluate: 'Evaluate & Revise',
      sidebarFlowRevise: 'Revise & Track',
      sidebarFlowTrack: 'Narrative Tracking',
      sidebarFlowStep: 'Step',
      sidebarMcpStatus: 'Service Diagnostics',
    },
    translate: (key: string) => key,
    language: 'en',
  }),
}))

const defaultSidebarProps = {
  collapsed: false,
  onToggle: vi.fn(),
  onContinueWriting: vi.fn(),
  onOpenKnowledge: vi.fn(),
  onOpenPrompts: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenEvaluation: vi.fn(),
  onOpenForeshadowingTracker: vi.fn(),
  onOpenPatternDashboard: vi.fn(),
  onOpenSessionAnalytics: vi.fn(),
  onOpenAnalysis: vi.fn(),
  onOpenEvaluationDrillDown: vi.fn(),
  onOpenCharacterRelationships: vi.fn(),
  onOpenNarrativeVisualization: vi.fn(),
  onOpenMcpStatus: vi.fn(),
}

describe('Sidebar popover mouse enter coverage (lines 180-182)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('covers handleMouseEnterPopover lines 180-182 via direct fireEvent', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    // Step 1 button triggers the popover
    const stepOneButton = screen.getByRole('button', { name: '1' })
    const stepOneWrapper = stepOneButton.parentElement!
    expect(stepOneWrapper).not.toBeNull()

    const user = userEvent.setup()

    // Hover step to show popover using userEvent
    await user.hover(stepOneWrapper)
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    // Leave the step trigger — this sets a close timeout (150ms)
    await user.unhover(stepOneWrapper)

    // Before the 150ms elapses, move mouse into the popover
    const popoverButton = screen.getByRole('button', { name: 'Smart Analysis' })
    const popover = popoverButton.closest('.step-flyout-popover')!
    expect(popover).not.toBeNull()

    await user.hover(popover)

    // clearTimeout was called to cancel the close timeout (lines 180-181)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    // The call should be from handleMouseEnterPopover, not handleMouseEnterStep
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

    clearTimeoutSpy.mockRestore()
  })
})

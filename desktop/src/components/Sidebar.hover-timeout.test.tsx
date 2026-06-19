import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Sidebar } from './Sidebar'

const createConversationMock = vi.fn()
const selectConversationMock = vi.fn()

type ConversationLike = { id: string; title: string; messages: unknown[] }

let mockConversations: ConversationLike[] = [
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

vi.mock('../i18n', () => {
  const textMap = {
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
  } as const

  return {
    useI18n: () => ({
      t: textMap,
      translate: (key: keyof typeof textMap) => textMap[key] ?? key,
      language: 'en',
    }),
  }
})

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

describe('Sidebar hover timeout cancellation (lines 180-182)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('cancels the close timeout when mouse enters the popover after leaving the step trigger', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    // Step 1 button triggers the popover
    const stepOneButton = screen.getByRole('button', { name: '1' })
    const stepOneWrapper = stepOneButton.parentElement!
    expect(stepOneWrapper).not.toBeNull()

    // Hover step to show popover
    fireEvent.mouseEnter(stepOneWrapper)
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    // Leave the step trigger — this sets a close timeout (150ms)
    fireEvent.mouseLeave(stepOneWrapper)

    // Before the 150ms elapses, move mouse into the popover — this cancels the timeout
    const popoverButton = screen.getByRole('button', { name: 'Smart Analysis' })
    const popover = popoverButton.closest('.step-flyout-popover')!
    expect(popover).not.toBeNull()

    // Advance only 50ms so the timeout has NOT fired yet
    act(() => {
      vi.advanceTimersByTime(50)
    })

    // Mouse enters popover, which calls handleMouseEnterPopover and cancels the pending timeout
    fireEvent.mouseEnter(popover)

    // clearTimeout was called to cancel the close timeout (lines 180-181)
    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Advance past the original 150ms — popover should still be visible because timeout was cancelled
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    clearTimeoutSpy.mockRestore()
    vi.useRealTimers()
  })

  it('sets closeTimeoutRef.current to null when the popover is re-entered', async () => {
    vi.useFakeTimers()

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    const stepOneButton = screen.getByRole('button', { name: '1' })
    const stepOneWrapper = stepOneButton.parentElement!

    // Hover step then leave to start the close timeout
    fireEvent.mouseEnter(stepOneWrapper)
    fireEvent.mouseLeave(stepOneWrapper)

    // Before timeout fires, enter popover to cancel it
    const popoverButton = screen.getByRole('button', { name: 'Smart Analysis' })
    const popover = popoverButton.closest('.step-flyout-popover')!

    act(() => {
      vi.advanceTimersByTime(50)
    })
    fireEvent.mouseEnter(popover)

    // After cancellation, the popover stays open even after the full timeout period
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    // Now leave the popover — should close immediately
    fireEvent.mouseLeave(popover)
    expect(screen.queryByRole('button', { name: 'Smart Analysis' })).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('does not call clearTimeout when entering the popover if no close timeout is pending', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    const stepOneButton = screen.getByRole('button', { name: '1' })
    const stepOneWrapper = stepOneButton.parentElement!

    // Hover the step and stay — no mouseLeave, so no close timeout is pending
    fireEvent.mouseEnter(stepOneWrapper)

    // Now directly mouseEnter the popover (no prior mouseLeave, so no pending timeout)
    const popoverButton = screen.getByRole('button', { name: 'Smart Analysis' })
    const popover = popoverButton.closest('.step-flyout-popover')!

    // Reset the spy so we only count calls from this point
    clearTimeoutSpy.mockClear()

    fireEvent.mouseEnter(popover)

    // clearTimeout should NOT be called because there was no pending close timeout
    expect(clearTimeoutSpy).not.toHaveBeenCalled()

    clearTimeoutSpy.mockRestore()
    vi.useRealTimers()
  })
})

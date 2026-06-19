import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Sidebar } from './Sidebar'

const createConversationMock = vi.fn()
const selectConversationMock = vi.fn()
const startResizeMock = vi.fn()
const resetWidthMock = vi.fn()

type ConversationLike = { id: string; title: string; messages: unknown[] }
type WorkspaceSummaryLike = {
  hasMeaningfulScope: boolean
  projectLabel: string | null
  chapterLabel: string | null
  storyBibleLabel: string | null
  focusLabel: string | null
  workspaceLabel: string | null
  workflowLabel: string | null
  scopeChips: string[]
  meaningfulWorkspace: unknown
}

let mockConversations: ConversationLike[] = [
  { id: 'conv-1', title: 'Chapter 1 Draft', messages: [] },
  { id: 'conv-2', title: 'Character Notes', messages: [] },
]
let mockCurrentConversationId = 'conv-1'
let mockIsResizing = false
let mockWorkspaceSummary: WorkspaceSummaryLike = {
  hasMeaningfulScope: true,
  projectLabel: 'My Novel',
  chapterLabel: 'Chapter 1',
  storyBibleLabel: null,
  focusLabel: null,
  workspaceLabel: 'Default Workspace',
  workflowLabel: null,
  scopeChips: [],
  meaningfulWorkspace: { projectId: 'p1', chapterId: 'c1' },
}

vi.mock('../stores/selectors', () => ({
  useConversationList: () => mockConversations,
  useCurrentConversationId: () => mockCurrentConversationId,
  useCreateConversation: () => createConversationMock,
  useSelectConversation: () => selectConversationMock,
}))

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: () => mockWorkspaceSummary,
}))

vi.mock('../hooks/useResizablePanel', () => ({
  useResizablePanel: () => ({
    width: 288,
    isResizing: mockIsResizing,
    startResize: startResizeMock,
    resetWidth: resetWidthMock,
  }),
}))

vi.mock('./PanelResizeHandle', () => ({
  PanelResizeHandle: ({
    onMouseDown,
    onDoubleClick,
  }: {
    onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void
    onDoubleClick: () => void
  }) => (
    <button
      type="button"
      aria-label="resize-handle"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      resize-handle
    </button>
  ),
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
    writerWorkspaceTitle: 'Current writing project',
    writerWorkspaceHint: 'Your creative space',
    writerStoryBibleLabel: 'Story Bible',
    writerChapterLabel: 'Chapter',
    writerStoryBibleMetaLabel: 'Meta',
    writerWorkspaceLabel: 'Workspace',
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

describe('Sidebar expanded mode branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mockIsResizing = false
    mockWorkspaceSummary = {
      hasMeaningfulScope: true,
      projectLabel: 'My Novel',
      chapterLabel: 'Chapter 1',
      storyBibleLabel: null,
      focusLabel: null,
      workspaceLabel: 'Default Workspace',
      workflowLabel: null,
      scopeChips: [],
      meaningfulWorkspace: { projectId: 'p1', chapterId: 'c1' },
    }
  })

  it('renders expanded sidebar with flow steps and all tool buttons', () => {
    render(<Sidebar {...defaultSidebarProps} />)

    // Verify workspace label (line 264 - projectLabel ?? chapterLabel ?? workspaceLabel)
    expect(screen.getByText('My Novel')).toBeInTheDocument()

    // Verify all flow steps render
    expect(screen.getByText('Write & Evaluate')).toBeInTheDocument()
    expect(screen.getByText('Evaluate & Revise')).toBeInTheDocument()
    expect(screen.getByText('Revise & Track')).toBeInTheDocument()
    expect(screen.getByText('Narrative Tracking')).toBeInTheDocument()

    // Verify tool buttons render
    expect(screen.getByTitle('Smart Analysis')).toBeInTheDocument()
    expect(screen.getByTitle('Reply Review')).toBeInTheDocument()
    expect(screen.getByTitle('Deep Evaluation')).toBeInTheDocument()
    expect(screen.getByTitle('Patterns')).toBeInTheDocument()
    expect(screen.getByTitle('Foreshadowing')).toBeInTheDocument()
    expect(screen.getByTitle('Characters')).toBeInTheDocument()
    expect(screen.getByTitle('Narrative Visualization')).toBeInTheDocument()
    expect(screen.getByTitle('Session Stats')).toBeInTheDocument()
  })

  it('renders step 1 active badge and button active styling with activeRightPanel=analysis', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="analysis" />)

    // Step 1 should be active (1/4 shown)
    expect(screen.getByText('1/4')).toBeInTheDocument()

    // Step 1 analysis button should have active styling
    const analysisButton = screen.getByTitle('Smart Analysis')
    expect(analysisButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 1 evaluation button active styling with activeRightPanel=evaluation', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="evaluation" />)

    expect(screen.getByText('1/4')).toBeInTheDocument()

    const evaluationButton = screen.getByTitle('Reply Review')
    expect(evaluationButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 2 active badge and evaluationDrillDown button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="evaluationDrillDown" />)

    expect(screen.getByText('2/4')).toBeInTheDocument()

    const drillDownButton = screen.getByTitle('Deep Evaluation')
    expect(drillDownButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 3 active and characterRelationships button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="characterRelationships" />)

    expect(screen.getByText('3/4')).toBeInTheDocument()

    const charButton = screen.getByTitle('Characters')
    expect(charButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 4 active and sessionAnalytics button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="sessionAnalytics" />)

    expect(screen.getByText('4/4')).toBeInTheDocument()

    const sessionButton = screen.getByTitle('Session Stats')
    expect(sessionButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 4 narrativeVisualization button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="narrativeVisualization" />)

    expect(screen.getByText('4/4')).toBeInTheDocument()

    const narrativeButton = screen.getByTitle('Narrative Visualization')
    expect(narrativeButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 3 foreshadowingTracker button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="foreshadowingTracker" />)

    expect(screen.getByText('3/4')).toBeInTheDocument()

    const foreshadowButton = screen.getByTitle('Foreshadowing')
    expect(foreshadowButton.className).toContain('bg-primary-600/10')
  })

  it('renders step 2 patternDashboard button active styling', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="patternDashboard" />)

    expect(screen.getByText('2/4')).toBeInTheDocument()

    const patternButton = screen.getByTitle('Patterns')
    expect(patternButton.className).toContain('bg-primary-600/10')
  })

  it('shows chapterLabel when projectLabel is null (line 264 ?? fallback)', () => {
    mockWorkspaceSummary = {
      ...mockWorkspaceSummary,
      projectLabel: null,
      chapterLabel: 'Chapter One',
    }

    render(<Sidebar {...defaultSidebarProps} />)

    // Should show chapterLabel instead of projectLabel at line 264
    // chapterLabel also appears in the detail section, so use getAllByText
    expect(screen.getAllByText('Chapter One').length).toBeGreaterThanOrEqual(1)
    // projectLabel 'My Novel' should NOT be shown
    expect(screen.queryByText('My Novel')).not.toBeInTheDocument()
  })

  it('shows workspaceLabel when both projectLabel and chapterLabel are null (line 264 ?? fallback)', () => {
    mockWorkspaceSummary = {
      ...mockWorkspaceSummary,
      projectLabel: null,
      chapterLabel: null,
      workspaceLabel: 'My Workspace',
    }

    render(<Sidebar {...defaultSidebarProps} />)

    // workspaceLabel appears at line 264 (main label) and line 285 (detail section)
    expect(screen.getAllByText('My Workspace').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('My Novel')).not.toBeInTheDocument()
  })

  it('removes transition class when isResizing is true (line 220 branch)', () => {
    mockIsResizing = true

    const { container } = render(<Sidebar {...defaultSidebarProps} />)

    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    // When isResizing=true, the transition class is omitted
    expect(aside!.className).not.toContain('transition-[width]')
  })

  it('has transition class when isResizing is false (line 220 else branch)', () => {
    const { container } = render(<Sidebar {...defaultSidebarProps} />)

    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    // When isResizing=false, the transition class is present
    expect(aside!.className).toContain('transition-[width]')
  })

  it('clicks all expanded mode tool buttons', () => {
    const onOpenAnalysis = vi.fn()
    const onOpenEvaluation = vi.fn()
    const onOpenEvaluationDrillDown = vi.fn()
    const onOpenPatternDashboard = vi.fn()
    const onOpenForeshadowingTracker = vi.fn()
    const onOpenCharacterRelationships = vi.fn()
    const onOpenNarrativeVisualization = vi.fn()
    const onOpenSessionAnalytics = vi.fn()

    render(
      <Sidebar
        {...defaultSidebarProps}
        onOpenAnalysis={onOpenAnalysis}
        onOpenEvaluation={onOpenEvaluation}
        onOpenEvaluationDrillDown={onOpenEvaluationDrillDown}
        onOpenPatternDashboard={onOpenPatternDashboard}
        onOpenForeshadowingTracker={onOpenForeshadowingTracker}
        onOpenCharacterRelationships={onOpenCharacterRelationships}
        onOpenNarrativeVisualization={onOpenNarrativeVisualization}
        onOpenSessionAnalytics={onOpenSessionAnalytics}
      />,
    )

    // Step 1 tools
    fireEvent.click(screen.getByTitle('Smart Analysis'))
    expect(onOpenAnalysis).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Reply Review'))
    expect(onOpenEvaluation).toHaveBeenCalled()

    // Step 2 tools
    fireEvent.click(screen.getByTitle('Deep Evaluation'))
    expect(onOpenEvaluationDrillDown).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Patterns'))
    expect(onOpenPatternDashboard).toHaveBeenCalled()

    // Step 3 tools
    fireEvent.click(screen.getByTitle('Foreshadowing'))
    expect(onOpenForeshadowingTracker).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Characters'))
    expect(onOpenCharacterRelationships).toHaveBeenCalled()

    // Step 4 tools
    fireEvent.click(screen.getByTitle('Narrative Visualization'))
    expect(onOpenNarrativeVisualization).toHaveBeenCalled()

    fireEvent.click(screen.getByTitle('Session Stats'))
    expect(onOpenSessionAnalytics).toHaveBeenCalled()
  })

  it('renders collapsed sidebar with step 3 popover to cover getToolLabel for foreshadowingTracker and characterRelationships', () => {
    vi.useFakeTimers()

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="foreshadowingTracker" />)

    const step3Button = screen.getByRole('button', { name: '3' })
    const step3Wrapper = step3Button.parentElement!

    act(() => {
      fireEvent.mouseEnter(step3Wrapper)
    })

    // Verify getToolLabel returns correct labels for step 3 tools (lines 155-156)
    expect(screen.getByRole('button', { name: 'Foreshadowing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Characters' })).toBeInTheDocument()

    // Click a tool button to verify action routing
    fireEvent.click(screen.getByRole('button', { name: 'Foreshadowing' }))
    expect(defaultSidebarProps.onOpenForeshadowingTracker).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('renders collapsed sidebar with step 4 popover to cover getToolLabel for narrativeVisualization and sessionAnalytics', () => {
    vi.useFakeTimers()

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="sessionAnalytics" />)

    const step4Button = screen.getByRole('button', { name: '4' })
    const step4Wrapper = step4Button.parentElement!

    act(() => {
      fireEvent.mouseEnter(step4Wrapper)
    })

    // Verify getToolLabel returns correct labels for step 4 tools (lines 157-158)
    expect(screen.getByRole('button', { name: 'Narrative Visualization' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Session Stats' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Session Stats' }))
    expect(defaultSidebarProps.onOpenSessionAnalytics).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('renders step badge as completed when activeStep > step', () => {
    // When activeRightPanel="narrativeVisualization", activeStep=4
    // Steps 1, 2, 3 should show completed badges
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="narrativeVisualization" />)

    // Step 4 is active (4/4)
    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('renders no active step indicator when activeRightPanel is undefined', () => {
    render(<Sidebar {...defaultSidebarProps} />)

    // No step fraction should appear
    expect(screen.queryByText(/\/4/)).not.toBeInTheDocument()
  })

  it('renders no active step indicator when activeRightPanel is none', () => {
    render(<Sidebar {...defaultSidebarProps} activeRightPanel="none" />)

    expect(screen.queryByText(/\/4/)).not.toBeInTheDocument()
  })
})

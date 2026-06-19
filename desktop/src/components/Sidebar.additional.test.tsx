import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

let mockConversations: ConversationLike[] = []
let mockCurrentConversationId = 'conv-1'
let mockWorkspaceSummary: WorkspaceSummaryLike = {
  hasMeaningfulScope: false,
  projectLabel: null,
  chapterLabel: null,
  storyBibleLabel: null,
  focusLabel: null,
  workspaceLabel: null,
  workflowLabel: null,
  scopeChips: [],
  meaningfulWorkspace: null,
}
let mockVirtualItems = [
  { index: 0, start: 0, size: 40, end: 40, key: 'v-0' },
  { index: 1, start: 40, size: 40, end: 80, key: 'v-1' },
]
let latestVirtualizerOptions: {
  getScrollElement?: () => Element | null
  estimateSize?: () => number
} | null = null

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn((options) => {
    latestVirtualizerOptions = options
    return {
      getTotalSize: () => 80,
      getVirtualItems: () => mockVirtualItems,
    }
  }),
}))

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
    isResizing: false,
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
    writerWorkspaceTitle: 'Current writing project',
    writerWorkspaceHint: 'Stay anchored to this project.',
    writerStoryBibleLabel: 'Open story notes',
    writerChapterLabel: 'Chapter',
    writerStoryBibleMetaLabel: 'Story bible',
    writerWorkspaceLabel: 'Workspace',
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

import { Sidebar } from './Sidebar'

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

function makeConversation(id: string, title: string): ConversationLike {
  return { id, title, messages: [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  mockCurrentConversationId = 'conv-1'
  mockConversations = [
    makeConversation('conv-1', 'Chapter 1 Draft'),
    makeConversation('conv-2', 'Character Notes'),
  ]
  mockWorkspaceSummary = {
    hasMeaningfulScope: false,
    projectLabel: null,
    chapterLabel: null,
    storyBibleLabel: null,
    focusLabel: null,
    workspaceLabel: null,
    workflowLabel: null,
    scopeChips: [],
    meaningfulWorkspace: null,
  }
  mockVirtualItems = [
    { index: 0, start: 0, size: 40, end: 40, key: 'v-0' },
    { index: 1, start: 40, size: 40, end: 80, key: 'v-1' },
  ]
  latestVirtualizerOptions = null
})

describe('Sidebar additional coverage', () => {
  it('renders expanded workflow progress with completed and active step states', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={false} activeRightPanel="patternDashboard" />)

    expect(screen.getByText('2/4')).toBeInTheDocument()
    expect(screen.getByText('Write & Evaluate')).toBeInTheDocument()
    expect(screen.getByText('Evaluate & Revise')).toBeInTheDocument()
    expect(screen.getByText('Revise & Track')).toBeInTheDocument()
    expect(screen.getByText('Narrative Tracking')).toBeInTheDocument()
  })

  it('renders workspace summary card and keeps continue writing focused on the main content area', async () => {
    mockWorkspaceSummary = {
      hasMeaningfulScope: true,
      projectLabel: 'Novel Alpha',
      chapterLabel: 'Chapter 3',
      storyBibleLabel: 'Myth Arc',
      focusLabel: null,
      workspaceLabel: 'Desk A',
      workflowLabel: null,
      scopeChips: [],
      meaningfulWorkspace: { scope: 'alpha' },
    }

    const mainContent = document.createElement('div')
    mainContent.id = 'app-main-content'
    mainContent.tabIndex = -1
    document.body.appendChild(mainContent)

    render(<Sidebar {...defaultSidebarProps} collapsed={false} />)

    expect(screen.getByText('Current writing project')).toBeInTheDocument()
    expect(screen.getByText('Novel Alpha')).toBeInTheDocument()
    expect(screen.getByText('Stay anchored to this project.')).toBeInTheDocument()
    expect(screen.getByText('Chapter:')).toBeInTheDocument()
    expect(screen.getByText('Chapter 3')).toBeInTheDocument()
    expect(screen.getByText('Story bible:')).toBeInTheDocument()
    expect(screen.getByText('Myth Arc')).toBeInTheDocument()
    expect(screen.getByText('Workspace:')).toBeInTheDocument()
    expect(screen.getByText('Desk A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue writing' }))
    expect(defaultSidebarProps.onContinueWriting).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(document.activeElement).toBe(mainContent)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Open story notes' }))
    expect(defaultSidebarProps.onOpenKnowledge).toHaveBeenCalledTimes(1)

    document.body.removeChild(mainContent)
  })

  it('opens MCP panel and forwards resize handle interactions', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={false} activeRightPanel="mcpStatus" />)

    const mcpButton = screen.getByRole('button', { name: 'MCP' })
    expect(mcpButton.className).toContain('text-primary-300')

    fireEvent.click(mcpButton)
    expect(defaultSidebarProps.onOpenMcpStatus).toHaveBeenCalledTimes(1)

    const resizeHandle = screen.getByRole('button', { name: 'resize-handle' })
    fireEvent.mouseDown(resizeHandle, { clientX: 20 })
    fireEvent.doubleClick(resizeHandle)

    expect(startResizeMock).toHaveBeenCalledTimes(1)
    expect(resetWidthMock).toHaveBeenCalledTimes(1)
  })

  it('shows collapsed flow popovers and routes tool actions', async () => {
    vi.useFakeTimers()

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    const stepOneButton = screen.getByRole('button', { name: '1' })
    act(() => {
      fireEvent.mouseEnter(stepOneButton)
    })

    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Smart Analysis' }))
    })
    expect(defaultSidebarProps.onOpenAnalysis).toHaveBeenCalledTimes(1)

    const stepTwoButton = screen.getByRole('button', { name: '2' })
    act(() => {
      fireEvent.mouseEnter(stepTwoButton)
    })
    expect(screen.getByRole('button', { name: 'Deep Evaluation' })).toBeInTheDocument()
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Deep Evaluation' }))
    })
    expect(defaultSidebarProps.onOpenEvaluationDrillDown).toHaveBeenCalledTimes(1)

    act(() => {
      fireEvent.mouseEnter(stepTwoButton)
      fireEvent.mouseLeave(stepTwoButton)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(151)
    })

    expect(screen.queryByRole('button', { name: 'Deep Evaluation' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('clears pending close timers when moving between collapsed steps and their popovers', async () => {
    vi.useFakeTimers()

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    const stepOneButton = screen.getByRole('button', { name: '1' })
    fireEvent.mouseEnter(stepOneButton)
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    fireEvent.mouseLeave(stepOneButton)
    const stepTwoButton = screen.getByRole('button', { name: '2' })
    fireEvent.mouseEnter(stepTwoButton)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(151)
    })

    const drillDownButton = screen.getByRole('button', { name: 'Deep Evaluation' })
    expect(drillDownButton).toBeInTheDocument()

    fireEvent.mouseLeave(stepTwoButton)
    const popover = drillDownButton.closest('.step-flyout-popover')
    expect(popover).not.toBeNull()
    fireEvent.mouseEnter(popover!)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(151)
    })

    expect(screen.getByRole('button', { name: 'Deep Evaluation' })).toBeInTheDocument()

    fireEvent.mouseLeave(popover!)
    expect(screen.queryByRole('button', { name: 'Deep Evaluation' })).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('clears the close timer when the expanded popover is re-entered', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    render(<Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="analysis" />)

    const stepOneButton = screen.getByRole('button', { name: '1' })
    const stepOneWrapper = stepOneButton.parentElement
    expect(stepOneWrapper).not.toBeNull()

    fireEvent.mouseOver(stepOneWrapper!)
    fireEvent.mouseOut(stepOneWrapper!)

    const popoverButton = screen.getByRole('button', { name: 'Smart Analysis' })
    const popover = popoverButton.closest('.step-flyout-popover')
    expect(popover).not.toBeNull()

    fireEvent.mouseOver(popover!)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(151)
    })
    expect(screen.getByRole('button', { name: 'Smart Analysis' })).toBeInTheDocument()

    fireEvent.mouseOut(popover!)

    expect(screen.queryByRole('button', { name: 'Smart Analysis' })).not.toBeInTheDocument()

    clearTimeoutSpy.mockRestore()
    vi.useRealTimers()
  })

  it('renders the virtualized conversation branch for long lists', () => {
    mockConversations = Array.from({ length: 55 }, (_, index) => makeConversation(`conv-${index + 1}`, `Draft ${index + 1}`))
    mockCurrentConversationId = 'conv-2'
    mockVirtualItems = [
      { index: 0, start: 0, size: 40, end: 40, key: 'v-0' },
      { index: 1, start: 40, size: 40, end: 80, key: 'v-1' },
      { index: 2, start: 80, size: 40, end: 120, key: 'v-2' },
    ]

    render(<Sidebar {...defaultSidebarProps} collapsed={false} />)

    expect(screen.getByText('Draft 1')).toBeInTheDocument()
    expect(screen.getByText('Draft 2')).toBeInTheDocument()
    expect(screen.getByText('Draft 3')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Draft 3'))
    expect(selectConversationMock).toHaveBeenCalledWith('conv-3')
  })

  it('exposes the virtualizer callbacks and renders collapsed virtualized avatars', () => {
    mockConversations = [
      makeConversation('conv-1', ''),
      makeConversation('conv-2', 'Draft 2'),
      ...Array.from({ length: 53 }, (_, index) => makeConversation(`conv-${index + 3}`, `Draft ${index + 3}`)),
    ]
    mockCurrentConversationId = 'conv-2'
    mockVirtualItems = [
      { index: 0, start: 0, size: 40, end: 40, key: 'v-0' },
      { index: 1, start: 40, size: 40, end: 80, key: 'v-1' },
      { index: 2, start: 80, size: 40, end: 120, key: 'v-2' },
    ]

    const { container } = render(
      <Sidebar {...defaultSidebarProps} collapsed={true} activeRightPanel="narrativeVisualization" />,
    )

    expect(latestVirtualizerOptions?.estimateSize?.()).toBe(40)
    const scrollElement = latestVirtualizerOptions?.getScrollElement?.()
    expect(scrollElement).toBe(container.querySelector('.custom-scrollbar'))

    expect(screen.getByText('?')).toBeInTheDocument()
    expect(screen.getAllByText('D').length).toBeGreaterThan(0)

    const stepButtons = Array.from(container.querySelectorAll('button')).filter((button) =>
      button.className.includes('rounded-full'),
    )
    expect(stepButtons).toHaveLength(4)
  })
})

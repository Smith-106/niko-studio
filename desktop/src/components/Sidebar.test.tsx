import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Sidebar } from './Sidebar'

const createConversationMock = vi.fn()
const selectConversationMock = vi.fn()

const mockAppState = {
  createConversation: createConversationMock,
  selectConversation: selectConversationMock,
  currentWorkspace: null,
}

vi.mock('../stores/appStore', () => ({
  useAppStore: ((selector?: (state: Record<string, unknown>) => unknown) =>
    selector ? selector(mockAppState) : mockAppState) as unknown,
}))

vi.mock('../stores/selectors', () => ({
  useConversationList: () => [
    { id: 'conv-1', title: 'Chapter 1 Draft', messages: [] },
    { id: 'conv-2', title: 'Character Notes', messages: [] },
  ],
  useCurrentConversationId: () => 'conv-1',
  useCreateConversation: () => mockAppState.createConversation,
  useSelectConversation: () => mockAppState.selectConversation,
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
    },
    translate: (key: string) => key,
    language: 'zh',
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
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders app title when expanded', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={false} />)
    expect(screen.getByText('Niko-Studio')).toBeInTheDocument()
  })

  it('hides app title when collapsed', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={true} />)
    expect(screen.queryByText('Niko-Studio')).not.toBeInTheDocument()
  })

  it('calls onToggle when toggle button is clicked', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    const toggleButton = screen.getByTitle('Collapse sidebar')
    fireEvent.click(toggleButton)
    expect(defaultSidebarProps.onToggle).toHaveBeenCalledOnce()
  })

  it('calls createConversation when new document button is clicked', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    const newDocButton = screen.getByTitle('New Document')
    fireEvent.click(newDocButton)
    expect(createConversationMock).toHaveBeenCalledOnce()
  })

  it('renders conversation list', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    expect(screen.getByText('Chapter 1 Draft')).toBeInTheDocument()
    expect(screen.getByText('Character Notes')).toBeInTheDocument()
  })

  it('highlights the current conversation', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    const currentButton = screen.getByText('Chapter 1 Draft').closest('button')
    expect(currentButton?.className).toContain('bg-primary-50')
  })

  it('calls selectConversation when a conversation is clicked', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    fireEvent.click(screen.getByText('Character Notes'))
    expect(selectConversationMock).toHaveBeenCalledWith('conv-2')
  })

  it('renders primary navigation buttons when expanded', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={false} />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByText('Story Notes')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('hides navigation button labels when collapsed', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={true} />)
    expect(screen.queryByText('Templates')).not.toBeInTheDocument()
    expect(screen.queryByText('Story Notes')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  it('calls onOpenSettings when settings button is clicked', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    fireEvent.click(screen.getByTitle('Settings'))
    expect(defaultSidebarProps.onOpenSettings).toHaveBeenCalledOnce()
  })

  it('renders evaluation panel button', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={false} />)
    expect(screen.getByTitle('Reply Review')).toBeInTheDocument()
    expect(screen.getByText('Reply Review')).toBeInTheDocument()
  })

  it('hides evaluation panel label when collapsed', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={true} />)
    expect(screen.getByTitle('Reply Review')).toBeInTheDocument()
    expect(screen.queryByText('Reply Review')).not.toBeInTheDocument()
  })

  it('renders without errors', () => {
    render(<Sidebar {...defaultSidebarProps} />)
    expect(document.body).toBeTruthy()
  })

  it('matches snapshot', () => {
    const { container } = render(<Sidebar {...defaultSidebarProps} collapsed={false} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('shows initial letter of conversation title when collapsed', () => {
    render(<Sidebar {...defaultSidebarProps} collapsed={true} />)
    // Both conversations start with 'C', so we expect two matching spans
    const initialLetters = screen.getAllByText('C')
    expect(initialLetters).toHaveLength(2)
    initialLetters.forEach((el) => {
      expect(el.tagName).toBe('SPAN')
      expect(el).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

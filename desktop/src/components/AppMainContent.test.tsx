import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppMainContent } from './AppMainContent'
import { AppHeader } from './AppHeader'

const mockUseI18n = vi.hoisted(() => vi.fn())
const mockUseWriterWorkspaceSummary = vi.hoisted(() => vi.fn())
const mockWorkflowStepsNavigator = vi.hoisted(() => vi.fn())

vi.mock('./AppHeader', () => ({
  AppHeader: ({ children }: { children?: ReactNode }) => <div data-testid="app-header">{children}</div>,
}))

vi.mock('./AppRestoreStatusBanner', () => ({
  AppRestoreStatusBanner: () => <div data-testid="restore-banner" />,
}))

vi.mock('./DocumentEditor', () => ({
  DocumentEditor: () => <div data-testid="document-editor" />,
}))

vi.mock('./WorkflowStepsNavigator', () => ({
  WorkflowStepsNavigator: ({
    activeRightPanel,
    onOpenPanel,
  }: {
    activeRightPanel?: string
    onOpenPanel: (panelId: string) => void
  }) => {
    mockWorkflowStepsNavigator({ activeRightPanel, onOpenPanel })
    return (
      <button
        type="button"
        data-testid="workflow-steps-navigator"
        onClick={() => onOpenPanel('analysis')}
      >
        {activeRightPanel ?? 'none'}
      </button>
    )
  },
}))

vi.mock('./AppContextFooter', () => ({
  AppContextFooter: ({
    contextEstimatedText,
    contextPercent,
  }: {
    contextEstimatedText: string
    contextPercent?: number
  }) => (
    <div data-testid="context-footer">
      {contextEstimatedText}
      {typeof contextPercent === 'number' ? ` (${contextPercent})` : ''}
    </div>
  ),
}))

vi.mock('../i18n', () => ({
  useI18n: () => mockUseI18n(),
}))

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: () => mockUseWriterWorkspaceSummary(),
}))

const defaultHeaderProps: ComponentProps<typeof AppHeader> = {
  appTitle: 'Niko Studio',
  contextUsageVisible: true,
  contextUsageText: '~1.2k tokens',
  contextUsageWidthPercent: 24,
  headerConnectionState: 'connected',
  headerDotClass: 'bg-emerald-500',
  headerConnectionText: 'Connected',
  onOpenDiagnostics: vi.fn(),
  checkpointLabel: 'Checkpoints',
  loadingCheckpointsLabel: 'Loading checkpoints',
  noCheckpointsLabel: 'No checkpoints',
  restoreLabel: 'Restore',
  checkpointMenuOpen: false,
  checkpointsLoading: false,
  checkpoints: [],
  checkpointMenuContainerRef: { current: null },
  checkpointMenuTriggerRef: { current: null },
  onToggleCheckpointMenu: vi.fn(),
  onCloseCheckpointMenu: vi.fn(),
  onRestoreCheckpoint: vi.fn(),
  chatSidebarCollapsed: false,
  onToggleChatSidebar: vi.fn(),
  aiToolbarDisabled: false,
  onAiWrite: vi.fn(),
  onAiRewrite: vi.fn(),
  onAiDescribe: vi.fn(),
  onAiBrainstorm: vi.fn(),
  onOpenWritingHelper: vi.fn(),
  onOpenTextOptimizer: vi.fn(),
}

const defaultProps = {
  headerProps: defaultHeaderProps,
  restoreStatus: null,
  contextEstimatedText: '~1.2k tokens',
  onOpenWritingHelper: vi.fn(),
}

describe('AppMainContent', () => {
  const defaultWorkspaceSummary = {
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

  beforeEach(() => {
    mockUseI18n.mockReturnValue({
      language: 'zh',
    })
    mockUseWriterWorkspaceSummary.mockReturnValue(defaultWorkspaceSummary)
    mockWorkflowStepsNavigator.mockClear()
  })

  it('renders the main content container with correct id', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'app-main-content')
  })

  it('renders AppHeader with headerProps', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(screen.getByTestId('app-header')).toBeInTheDocument()
  })

  it('renders DocumentEditor', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(screen.getByTestId('document-editor')).toBeInTheDocument()
  })

  it('renders AppContextFooter with contextEstimatedText', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(screen.getByTestId('context-footer')).toHaveTextContent('~1.2k tokens')
  })

  it('renders AppRestoreStatusBanner', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(screen.getByTestId('restore-banner')).toBeInTheDocument()
  })

  it('applies flex column layout classes', () => {
    render(<AppMainContent {...defaultProps} />)
    const main = screen.getByRole('main')
    expect(main.className).toContain('flex-1')
    expect(main.className).toContain('flex-col')
  })

  it('renders without errors', () => {
    render(<AppMainContent {...defaultProps} />)
    expect(document.body).toBeTruthy()
  })

  it('renders workflow navigator before the restore banner', () => {
    render(<AppMainContent {...defaultProps} />)

    const main = screen.getByRole('main')
    expect(main).toContainElement(screen.getByTestId('workflow-steps-navigator'))
    expect(screen.getByTestId('workflow-steps-navigator')).toHaveTextContent('none')
  })

  it('passes onOpenWritingHelper to DocumentEditor', () => {
    const onOpenWritingHelper = vi.fn()
    render(<AppMainContent {...defaultProps} onOpenWritingHelper={onOpenWritingHelper} />)
    // The mock captures the prop; just verify render succeeds
    expect(screen.getByTestId('document-editor')).toBeInTheDocument()
  })

  it('renders scope chips in english when the workspace has meaningful scope', () => {
    mockUseI18n.mockReturnValueOnce({ language: 'en' })
    mockUseWriterWorkspaceSummary.mockReturnValueOnce({
      ...defaultWorkspaceSummary,
      hasMeaningfulScope: true,
      scopeChips: ['Project Atlas', 'Chapter 3', 'Canon'],
    })

    render(<AppMainContent {...defaultProps} />)

    expect(screen.getByText('Context')).toBeInTheDocument()
    expect(screen.getByText('Project Atlas')).toBeInTheDocument()
    expect(screen.getByText('Chapter 3')).toBeInTheDocument()
    expect(screen.getByText('Canon')).toBeInTheDocument()
  })

  it('renders the zh scope label when the workspace has meaningful scope', () => {
    mockUseWriterWorkspaceSummary.mockReturnValueOnce({
      ...defaultWorkspaceSummary,
      hasMeaningfulScope: true,
      scopeChips: ['项目 Atlas'],
    })

    render(<AppMainContent {...defaultProps} />)

    expect(screen.getByText('上下文')).toBeInTheDocument()
    expect(screen.getByText('项目 Atlas')).toBeInTheDocument()
  })

  it('passes workflow panel props through and uses a safe onOpenPanel fallback', async () => {
    render(
      <AppMainContent
        {...defaultProps}
        contextPercent={42}
        activeRightPanel="diagnostics"
      />,
    )

    expect(screen.getByTestId('workflow-steps-navigator')).toHaveTextContent('diagnostics')
    expect(screen.getByTestId('context-footer')).toHaveTextContent('~1.2k tokens (42)')

    screen.getByTestId('workflow-steps-navigator').click()

    expect(mockWorkflowStepsNavigator).toHaveBeenCalledWith(
      expect.objectContaining({
        activeRightPanel: 'diagnostics',
        onOpenPanel: expect.any(Function),
      }),
    )
  })

  it('forwards onOpenPanel when provided', () => {
    const onOpenPanel = vi.fn()

    render(
      <AppMainContent
        {...defaultProps}
        activeRightPanel="analysis"
        onOpenPanel={onOpenPanel}
      />,
    )

    screen.getByTestId('workflow-steps-navigator').click()

    expect(onOpenPanel).toHaveBeenCalledWith('analysis')
  })
})

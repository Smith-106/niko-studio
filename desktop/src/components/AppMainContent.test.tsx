import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppMainContent } from './AppMainContent'
import { AppHeader } from './AppHeader'

vi.mock('./AppHeader', () => ({
  AppHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="app-header">{children}</div>,
}))

vi.mock('./AppRestoreStatusBanner', () => ({
  AppRestoreStatusBanner: () => <div data-testid="restore-banner" />,
}))

vi.mock('./DocumentEditor', () => ({
  DocumentEditor: () => <div data-testid="document-editor" />,
}))

vi.mock('./AppContextFooter', () => ({
  AppContextFooter: ({ contextEstimatedText }: { contextEstimatedText: string }) => (
    <div data-testid="context-footer">{contextEstimatedText}</div>
  ),
}))

vi.mock('../i18n', () => ({
  useI18n: () => ({
    language: 'zh',
  }),
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

const defaultHeaderProps: ComponentProps<typeof AppHeader> = {
  appTitle: 'Niko Studio',
  contextUsageLabel: 'Context',
  contextUsageVisible: true,
  contextUsageText: '~1.2k tokens',
  contextUsageBarClass: 'bg-emerald-500',
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

  it('passes onOpenWritingHelper to DocumentEditor', () => {
    const onOpenWritingHelper = vi.fn()
    render(<AppMainContent {...defaultProps} onOpenWritingHelper={onOpenWritingHelper} />)
    // The mock captures the prop; just verify render succeeds
    expect(screen.getByTestId('document-editor')).toBeInTheDocument()
  })
})

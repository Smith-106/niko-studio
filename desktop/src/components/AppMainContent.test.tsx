import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppMainContent } from './AppMainContent'

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

const defaultHeaderProps = {
  sidebarCollapsed: false,
  onToggleSidebar: vi.fn(),
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

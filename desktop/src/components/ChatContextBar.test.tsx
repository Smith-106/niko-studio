import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatContextBar } from './ChatContextBar'

// Mock useWriterWorkspaceSummary to control output
vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: vi.fn(),
}))

import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'

const mockedUseWriterWorkspaceSummary = vi.mocked(useWriterWorkspaceSummary)

describe('ChatContextBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when workspace has no meaningful scope', () => {
    mockedUseWriterWorkspaceSummary.mockReturnValue({
      hasMeaningfulScope: false,
      scopeChips: [],
      meaningfulWorkspace: null,
      projectLabel: null,
      chapterLabel: null,
      storyBibleLabel: null,
      focusLabel: null,
      workspaceLabel: null,
      workflowLabel: null,
    } as any)

    const { container } = render(
      <ChatContextBar writerContextTitle="写作上下文" writerContextHint="当前工作区" />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders context bar with title and chips when workspace has scope', () => {
    mockedUseWriterWorkspaceSummary.mockReturnValue({
      hasMeaningfulScope: true,
      scopeChips: ['Chapter 1', 'Project Alpha'],
      meaningfulWorkspace: {},
      projectLabel: 'Project Alpha',
      chapterLabel: 'Chapter 1',
      storyBibleLabel: null,
      focusLabel: null,
      workspaceLabel: null,
      workflowLabel: null,
    } as any)

    render(
      <ChatContextBar writerContextTitle="写作上下文" writerContextHint="当前工作区" />
    )

    expect(screen.getByText('写作上下文')).toBeInTheDocument()
    expect(screen.getByText('Chapter 1')).toBeInTheDocument()
    expect(screen.getByText('Project Alpha')).toBeInTheDocument()
    expect(screen.getByText('当前工作区')).toBeInTheDocument()
  })
})
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useWriterWorkspaceSummaryMock = vi.hoisted(() => vi.fn())
const useSettingsStoreMock = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useWriterWorkspaceSummary', () => ({
  useWriterWorkspaceSummary: useWriterWorkspaceSummaryMock,
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: useSettingsStoreMock,
}))

import { AppContextFooter } from './AppContextFooter'

const defaultWorkspaceSummary = {
  meaningfulWorkspace: null,
  hasMeaningfulScope: false,
  projectLabel: 'default-project',
  chapterLabel: null,
  storyBibleLabel: null,
  focusLabel: null,
  workspaceLabel: null,
  workflowLabel: null,
  scopeChips: [],
}

describe('AppContextFooter', () => {
  beforeEach(() => {
    useWriterWorkspaceSummaryMock.mockReturnValue({ ...defaultWorkspaceSummary })
    useSettingsStoreMock.mockImplementation(
      (selector: (state: { settings: { defaultWorkflowLevel: string } }) => unknown) =>
        selector({ settings: { defaultWorkflowLevel: 'L3' } }),
    )
  })

  it('does not render when the estimated context text is empty', () => {
    const { container } = render(<AppContextFooter contextEstimatedText="" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the provided text when a footer summary is available', () => {
    render(<AppContextFooter contextEstimatedText="Estimated context summary" />)

    expect(screen.getByText('Estimated context summary')).toBeInTheDocument()
  })

  it('outer div does not have focus-visible or tabIndex attributes', () => {
    const { container } = render(<AppContextFooter contextEstimatedText="~2K tokens" />)
    const div = container.firstChild as HTMLElement

    expect(div).not.toHaveClass('focus-visible:ring-2')
    expect(div).not.toHaveAttribute('tabIndex')
  })

  it('renders word count and reading time', () => {
    render(<AppContextFooter contextEstimatedText="" wordCount={1200} readingTime={4} />)
    expect(screen.getByText('1200 字')).toBeVisible()
    expect(screen.getByText('约 4 分钟阅读')).toBeVisible()
  })

  it('does not render metrics when wordCount is 0', () => {
    render(<AppContextFooter contextEstimatedText="" wordCount={0} readingTime={0} />)
    expect(screen.queryByText('字')).not.toBeInTheDocument()
  })

  it('renders both text and metrics together', () => {
    render(<AppContextFooter contextEstimatedText="GPT-4o" wordCount={500} readingTime={1.7} />)
    expect(screen.getByText('GPT-4o')).toBeVisible()
    expect(screen.getByText('500 字')).toBeVisible()
    expect(screen.getByText('约 2 分钟阅读')).toBeVisible()
  })

  it('hides reading time when undefined', () => {
    render(<AppContextFooter contextEstimatedText="" wordCount={100} />)
    expect(screen.getByText('100 字')).toBeVisible()
    expect(screen.queryByText(/分钟阅读/)).not.toBeInTheDocument()
  })

  it('hides reading time when zero', () => {
    render(<AppContextFooter contextEstimatedText="" wordCount={100} readingTime={0} />)
    expect(screen.getByText('100 字')).toBeVisible()
    expect(screen.queryByText(/分钟阅读/)).not.toBeInTheDocument()
  })

  it('renders the chapter label and warning styling when workspace context is available', () => {
    useWriterWorkspaceSummaryMock.mockReturnValue({
      ...defaultWorkspaceSummary,
      chapterLabel: 'Chapter 7',
    })

    const { container } = render(
      <AppContextFooter contextEstimatedText="" contextPercent={75} />,
    )

    const footer = container.firstElementChild as HTMLElement

    expect(screen.getByText('Chapter 7')).toBeVisible()
    expect(screen.getByText('L3')).toBeVisible()
    expect(footer.className).toContain('border-amber-300')
  })

  it('falls back to the project label and critical styling for non-default projects', () => {
    useWriterWorkspaceSummaryMock.mockReturnValue({
      ...defaultWorkspaceSummary,
      projectLabel: 'novel-workspace',
    })
    useSettingsStoreMock.mockImplementation(
      (selector: (state: { settings: { defaultWorkflowLevel: string } }) => unknown) =>
        selector({ settings: { defaultWorkflowLevel: 'L5' } }),
    )

    const { container } = render(
      <AppContextFooter contextEstimatedText="" contextPercent={95} />,
    )

    const footer = container.firstElementChild as HTMLElement

    expect(screen.getByText('novel-workspace')).toBeVisible()
    expect(screen.getByText('L5')).toBeVisible()
    expect(footer.className).toContain('border-red-300')
  })
})

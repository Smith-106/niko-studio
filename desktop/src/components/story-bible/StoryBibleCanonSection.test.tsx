import type { ComponentProps } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ProjectWikiCanonPageRecord, ProjectWikiCanonPageSummary } from '../../api/wiki'
import { StoryBibleCanonSection } from './StoryBibleCanonSection'

const canonPageSummary: ProjectWikiCanonPageSummary = {
  id: 'canon-1',
  slug: 'story-bible/test-synopsis',
  title: 'Test canon',
  status: 'curated',
  file_path: 'wiki/canon/test-synopsis.md',
}

const canonPageRecord: ProjectWikiCanonPageRecord = {
  ...canonPageSummary,
  markdown: '# Test canon page',
}

function renderSection(overrides: Partial<ComponentProps<typeof StoryBibleCanonSection>> = {}) {
  const props: ComponentProps<typeof StoryBibleCanonSection> = {
    reviewHint: 'Check whether Story Bible has synced to canon.',
    reviewRefresh: 'Refresh canon',
    reviewLoading: 'Refreshing...',
    reviewEmpty: 'No canon pages yet',
    reviewSelectHint: 'Select a canon page to inspect',
    canonPages: [],
    selectedCanonSlug: null,
    selectedCanonPage: null,
    canonLoading: false,
    canonLoadingSlug: null,
    onRefresh: vi.fn(),
    onLoadPage: vi.fn(),
    ...overrides,
  }

  return {
    ...render(<StoryBibleCanonSection {...props} />),
    props,
  }
}

describe('StoryBibleCanonSection', () => {
  it('shows loading copy for the refresh button and empty state while canon pages are loading', () => {
    const { props } = renderSection({
      canonLoading: true,
    })

    expect(screen.getByRole('button', { name: props.reviewLoading })).toBeDisabled()
    expect(screen.getAllByText(props.reviewLoading)).toHaveLength(2)
  })

  it('shows the idle empty-state copy when there are no canon pages', () => {
    const { props } = renderSection()

    expect(screen.getByRole('button', { name: props.reviewRefresh })).not.toBeDisabled()
    expect(screen.getByText(props.reviewEmpty)).toBeInTheDocument()
    expect(screen.getByText(props.reviewSelectHint)).toBeInTheDocument()
  })

  it('renders canon pages, selected page detail, and loading state for the selected slug', () => {
    const onLoadPage = vi.fn()
    const { props } = renderSection({
      canonPages: [canonPageSummary],
      selectedCanonSlug: canonPageSummary.slug,
      selectedCanonPage: canonPageRecord,
      canonLoadingSlug: canonPageSummary.slug,
      onLoadPage,
    })

    const pageButton = screen.getByRole('button', { name: /Test canon/ })
    expect(pageButton.className).toContain('border-[var(--primary-cta)]/40')
    expect(screen.getAllByText(props.reviewLoading)).toHaveLength(1)
    expect(screen.getByText('wiki/canon/test-synopsis.md')).toBeInTheDocument()
    expect(screen.getByText('# Test canon page')).toBeInTheDocument()

    fireEvent.click(pageButton)

    expect(onLoadPage).toHaveBeenCalledWith('story-bible/test-synopsis')
  })

  it('renders the unselected canon page style when the slug does not match the active selection', () => {
    renderSection({
      canonPages: [canonPageSummary],
      selectedCanonSlug: 'story-bible/other-page',
    })

    const pageButton = screen.getByRole('button', { name: /Test canon/ })
    expect(pageButton.className).toContain('border-[var(--border-default)]')
    expect(pageButton.className).toContain('hover:border-[var(--primary-cta)]/30')
  })
})

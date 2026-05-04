import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppContextFooter } from './AppContextFooter'

describe('AppContextFooter', () => {
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
})

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
})

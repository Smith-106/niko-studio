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
})

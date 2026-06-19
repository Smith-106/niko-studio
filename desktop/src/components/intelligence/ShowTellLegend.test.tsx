import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ShowTellLegend } from './ShowTellLegend'

describe('ShowTellLegend', () => {
  it('renders nothing when no analysis result is available', () => {
    const { container } = render(<ShowTellLegend result={null} />)

    expect(container.firstElementChild).toBeEmptyDOMElement()
  })

  it('falls back missing ratios to zero and renders the computed tell share', () => {
    render(
      <ShowTellLegend
        result={{
          showTellRatio: undefined as unknown as number,
          showCount: 0,
          tellCount: 0,
          sensoryCoverage: {
            visual: 0,
            auditory: 0,
            tactile: 0,
            olfactory: 0,
            gustatory: 0,
            overall: 0,
          },
          abstractVsConcrete: 0,
          heatMap: [],
          suggestions: [],
        }}
      />,
    )

    expect(screen.getByText('比例：Show 0% / Tell 100%')).toBeInTheDocument()
  })
})

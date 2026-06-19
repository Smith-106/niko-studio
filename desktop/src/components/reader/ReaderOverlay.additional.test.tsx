import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReaderOverlay } from './ReaderOverlay'

describe('ReaderOverlay additional coverage', () => {
  it('falls back to raw dimension labels and renders disabled consensus styling', () => {
    render(
      <ReaderOverlay
        markers={[
          {
            id: 'mystery-marker',
            type: 'consensus',
            dimension: 'Mystery',
            severity: 'medium',
            description: 'mystery note',
            position: {},
            personaCount: 7,
            consensusStrength: 0.51,
            personaIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByText('mystery note'))

    const mysteryLabels = screen.getAllByText('Mystery')
    expect(mysteryLabels.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('+2 更多')).toBeInTheDocument()

    const consensusToggle = screen.getByRole('button', { name: /共识/i })
    fireEvent.click(consensusToggle)

    expect(consensusToggle.className).toContain('bg-zinc-800')
    expect(screen.getByText('暂无符合条件的标记')).toBeInTheDocument()
  })
})

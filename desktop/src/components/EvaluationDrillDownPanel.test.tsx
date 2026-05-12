import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { EvaluationDrillDownPanel } from './EvaluationDrillDownPanel'

describe('EvaluationDrillDownPanel', () => {
  it('renders overall score and closes through the close button', async () => {
    const onClose = vi.fn()

    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByRole('region', { name: '评估详情' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('85').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('expands a dimension accordion item to show detail text', async () => {
    render(<EvaluationDrillDownPanel onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: /character/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /character/i }))

    expect(document.getElementById('accordion-content-character')).toHaveTextContent('评估详情 — character.')
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PatternDashboardPanel } from './PatternDashboardPanel'

vi.mock('../api/analysis', () => ({
  detectPatterns: vi.fn().mockResolvedValue({
    success: true,
    data: {
      success: true,
      data: [],
    },
  }),
}))

describe('PatternDashboardPanel', () => {
  it('renders patterns and closes through the close button', async () => {
    const onClose = vi.fn()

    render(<PatternDashboardPanel onClose={onClose} />)

    expect(screen.getByRole('region', { name: '叙事模式' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Recurring Motif')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters rendered patterns by category', async () => {
    render(<PatternDashboardPanel onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Repetitive Phrasing')).toBeInTheDocument())
    expect(screen.getByText('Character Tic')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Style' }))

    expect(screen.getByText('Repetitive Phrasing')).toBeInTheDocument()
    expect(screen.queryByText('Character Tic')).not.toBeInTheDocument()
  })
})

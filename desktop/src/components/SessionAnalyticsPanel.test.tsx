import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SessionAnalyticsPanel } from './SessionAnalyticsPanel'

describe('SessionAnalyticsPanel', () => {
  it('renders summary metrics and closes through the close button', async () => {
    const onClose = vi.fn()

    render(<SessionAnalyticsPanel onClose={onClose} />)

    expect(screen.getByRole('region', { name: '会话分析' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Theme Group A')).toBeInTheDocument())

    expect(screen.getByText('12,500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders loaded cluster cards', async () => {
    render(<SessionAnalyticsPanel onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Theme Group A')).toBeInTheDocument())
    expect(screen.getByText('Character Arc B')).toBeInTheDocument()
    expect(screen.getAllByText('active').length).toBeGreaterThan(0)
  })
})

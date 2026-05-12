import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ForeshadowingTrackerPanel } from './ForeshadowingTrackerPanel'

describe('ForeshadowingTrackerPanel', () => {
  it('renders summary metrics and closes through the close button', async () => {
    const onClose = vi.fn()

    render(<ForeshadowingTrackerPanel onClose={onClose} />)

    expect(screen.getByRole('region', { name: '伏笔追踪' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('The broken mirror in the hallway')).toBeInTheDocument())

    expect(screen.getByText('4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters foreshadow items by state', async () => {
    render(<ForeshadowingTrackerPanel onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Charlie\'s hidden agenda')).toBeInTheDocument())
    expect(screen.getByText('The recurring rain motif')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'harvested' }))

    expect(screen.getByText('The recurring rain motif')).toBeInTheDocument()
    expect(screen.queryByText('Charlie\'s hidden agenda')).not.toBeInTheDocument()
  })
})

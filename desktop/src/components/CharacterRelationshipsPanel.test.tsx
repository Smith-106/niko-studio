import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CharacterRelationshipsPanel } from './CharacterRelationshipsPanel'

describe('CharacterRelationshipsPanel', () => {
  it('renders the panel title and closes through the close button', async () => {
    const onClose = vi.fn()

    render(<CharacterRelationshipsPanel onClose={onClose} />)

    expect(screen.getByRole('region', { name: '角色关系' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('filters relationships by type', async () => {
    render(<CharacterRelationshipsPanel onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getAllByText('Charlie')).toHaveLength(2))
    expect(screen.getAllByText('Bob')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'rival' }))

    expect(screen.getAllByText('Charlie')).toHaveLength(1)
    expect(screen.queryAllByText('Bob')).toHaveLength(0)
  })
})

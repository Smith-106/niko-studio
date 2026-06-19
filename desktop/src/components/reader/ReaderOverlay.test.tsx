import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ReaderOverlay } from './ReaderOverlay'

const markers = [
  {
    id: 'marker-1',
    type: 'consensus' as const,
    dimension: 'Plot',
    severity: 'critical' as const,
    description: 'plot hole',
    position: { chapterId: 'chapter-1' },
    personaCount: 6,
    consensusStrength: 0.82,
    personaIds: ['a', 'b', 'c', 'd', 'e', 'f'],
  },
  {
    id: 'marker-2',
    type: 'dissent' as const,
    dimension: 'Character',
    severity: 'medium' as const,
    description: 'unclear motive',
    position: { paragraphIndex: 2 },
    personaCount: 2,
    consensusStrength: 0.3,
    personaIds: ['hero', 'villain'],
  },
  {
    id: 'marker-3',
    type: 'consensus' as const,
    dimension: 'Style',
    severity: 'low' as const,
    description: 'good prose',
    position: {},
    personaCount: 1,
    consensusStrength: 0.6,
    personaIds: ['reader'],
  },
]

describe('ReaderOverlay', () => {
  it('hides itself when the overlay is not visible', () => {
    const { container } = render(<ReaderOverlay markers={markers} visible={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('filters markers, toggles views, and shows detail for the selected marker', () => {
    const onMarkerClick = vi.fn()

    render(<ReaderOverlay markers={markers} onMarkerClick={onMarkerClick} />)

    expect(screen.getByText('读者模拟叠加层')).toBeInTheDocument()
    expect(screen.getByText('3 / 3 标记')).toBeInTheDocument()
    expect(screen.getByText('plot hole')).toBeInTheDocument()
    expect(screen.getByText('unclear motive')).toBeInTheDocument()
    expect(screen.getByText('good prose')).toBeInTheDocument()

    fireEvent.click(screen.getByText('plot hole'))

    expect(onMarkerClick).toHaveBeenCalledWith('marker-1')
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getAllByText('critical')).toHaveLength(2)
    expect(screen.getByText('+1 更多')).toBeInTheDocument()

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'Character' } })

    expect(select.value).toBe('Character')
    expect(screen.getByText('1 / 3 标记')).toBeInTheDocument()
    expect(screen.getByText('unclear motive')).toBeInTheDocument()
    expect(screen.queryByText('good prose')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '分歧 (1)' }))

    expect(screen.getByText('暂无符合条件的标记')).toBeInTheDocument()
  })
})

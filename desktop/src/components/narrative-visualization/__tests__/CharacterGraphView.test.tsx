import { render, screen, fireEvent } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { NarrativeVisualizationCharacterData } from '../../../api/narrative-visualization'
import { CharacterGraphView } from '../CharacterGraphView'

// Mock Math.random for deterministic force layout positions
const originalRandom = Math.random
beforeAll(() => {
  Math.random = () => 0.5
})
afterAll(() => {
  Math.random = originalRandom
})

const sampleCharacterData: NarrativeVisualizationCharacterData = {
  nodes: [
    { id: 'Alice', name: 'Alice', role: 'protagonist', importance: 3, chapterCount: 2 },
    { id: 'Bob', name: 'Bob', role: 'mentor', importance: 2, chapterCount: 1 },
  ],
  edges: [
    { source: 'Alice', target: 'Bob', type: 'ally', weight: 0.8, label: 'Alice -> Bob' },
  ],
  summary: 'Test characters',
  empty: false,
}

describe('CharacterGraphView', () => {
  it('renders without crashing with valid data', () => {
    render(<CharacterGraphView data={sampleCharacterData} />)

    expect(screen.getByText('Character Graph')).toBeInTheDocument()
    expect(screen.getByText('Test characters')).toBeInTheDocument()
  })

  it('renders node circles for each character', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    // Each node renders a circle with fill "rgb(59 130 246)"
    const nodeCircles = container.querySelectorAll('circle[fill="rgb(59 130 246)"]')
    expect(nodeCircles.length).toBe(2)
  })

  it('renders node name labels', () => {
    render(<CharacterGraphView data={sampleCharacterData} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders edge lines with weight-based strokeWidth and opacity', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const lines = container.querySelectorAll('svg line')
    expect(lines.length).toBe(1)

    const line = lines[0]
    // weight=0.8 → strokeWidth = 1 + 0.8 * 2 = 2.6
    expect(line.getAttribute('stroke-width')).toBe('2.6')
    // opacity = 0.3 + 0.8 * 0.7 = 0.86 (floating point may vary)
    expect(parseFloat(line.getAttribute('opacity')!)).toBeCloseTo(0.86, 2)
  })

  it('renders edge with ally type color (green)', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const line = container.querySelector('svg line')
    expect(line).toBeInTheDocument()
    // ally → #22c55e
    expect(line!.getAttribute('stroke')).toBe('#22c55e')
  })

  it('renders edge with rival type color (red)', () => {
    const rivalData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'rival', weight: 0.5, label: 'Alice vs Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={rivalData} />)

    const line = container.querySelector('svg line')
    expect(line!.getAttribute('stroke')).toBe('#ef4444')
  })

  it('renders edge with family type color (blue)', () => {
    const familyData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'family', weight: 0.6, label: 'Alice & Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={familyData} />)

    const line = container.querySelector('svg line')
    expect(line!.getAttribute('stroke')).toBe('#3b82f6')
  })

  it('renders edge with mentor type color (purple)', () => {
    const mentorData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'mentor', weight: 0.7, label: 'Alice <- Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={mentorData} />)

    const line = container.querySelector('svg line')
    expect(line!.getAttribute('stroke')).toBe('#a855f7')
  })

  it('renders edge with other type color (gray) for unknown types', () => {
    const otherData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'unknown_type', weight: 0.5, label: 'Alice ? Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={otherData} />)

    const line = container.querySelector('svg line')
    // unknown type falls through to typeColors.other = '#9ca3af'
    expect(line!.getAttribute('stroke')).toBe('#9ca3af')
  })

  it('shows tooltip on edge hover and hides on mouse leave', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const line = container.querySelector('svg line')
    expect(line).toBeInTheDocument()

    // Before hover, no tooltip should be visible
    expect(screen.queryByText('Ally')).not.toBeInTheDocument()

    // Hover over edge
    fireEvent.mouseEnter(line!)
    expect(screen.getByText('Ally')).toBeInTheDocument()
    expect(screen.getByText('Interactions: 8')).toBeInTheDocument()

    // Leave edge
    fireEvent.mouseLeave(line!)
    expect(screen.queryByText('Ally')).not.toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    const emptyData: NarrativeVisualizationCharacterData = {
      nodes: [],
      edges: [],
      summary: 'No characters',
      empty: true,
    }

    render(<CharacterGraphView data={emptyData} />)

    expect(screen.getByText('No characters')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders SVG with correct viewBox', () => {
    render(<CharacterGraphView data={sampleCharacterData} />)

    const svg = screen.getByRole('img')
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 360')
  })

  it('renders node and edge counts', () => {
    render(<CharacterGraphView data={sampleCharacterData} />)

    expect(screen.getByText('2 nodes')).toBeInTheDocument()
    expect(screen.getByText('1 edges')).toBeInTheDocument()
  })

  it('renders text fallback with edge labels', () => {
    render(<CharacterGraphView data={sampleCharacterData} />)

    expect(screen.getByLabelText('Character graph text fallback')).toBeInTheDocument()
    expect(screen.getByText('Alice -> Bob')).toBeInTheDocument()
  })

  it('skips edges with missing source or target node', () => {
    const dataWithMissingNode: NarrativeVisualizationCharacterData = {
      nodes: [
        { id: 'Alice', name: 'Alice', role: 'protagonist', importance: 3, chapterCount: 2 },
      ],
      edges: [
        { source: 'Alice', target: 'MissingPerson', type: 'ally', weight: 0.5, label: 'Alice -> Missing' },
      ],
      summary: 'Missing node test',
      empty: false,
    }

    const { container } = render(<CharacterGraphView data={dataWithMissingNode} />)

    // Edge should not render because target node is missing
    const lines = container.querySelectorAll('svg line')
    expect(lines.length).toBe(0)
  })

  it('renders edge with weight-based strokeWidth correctly for low weight', () => {
    const lowWeightData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'ally', weight: 0.2, label: 'Alice -> Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={lowWeightData} />)

    const line = container.querySelector('svg line')
    // weight=0.2 → strokeWidth = 1 + 0.2 * 2 = 1.4
    expect(line!.getAttribute('stroke-width')).toBe('1.4')
    // opacity = 0.3 + 0.2 * 0.7 = 0.44 (floating point may vary)
    expect(parseFloat(line!.getAttribute('opacity')!)).toBeCloseTo(0.44, 2)
  })
})

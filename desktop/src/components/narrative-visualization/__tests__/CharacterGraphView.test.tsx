import { render, screen, fireEvent } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { NarrativeVisualizationCharacterData } from '../../../api/narrative-visualization'
import { CharacterGraphView } from '../CharacterGraphView'

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
    expect(line.getAttribute('stroke-width')).toBe('2.6')
    expect(parseFloat(line.getAttribute('opacity')!)).toBeCloseTo(0.86, 2)
  })

  it('renders edge with ally type color', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const line = container.querySelector('svg line')
    expect(line).toBeInTheDocument()
    expect(line!.getAttribute('stroke')).toBe('#22c55e')
  })

  it('renders edge with rival type color', () => {
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

  it('renders edge with family type color', () => {
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

  it('renders edge with mentor type color', () => {
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

  it('renders edge with fallback color for unknown types', () => {
    const otherData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'unknown_type', weight: 0.5, label: 'Alice ? Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={otherData} />)

    const line = container.querySelector('svg line')
    expect(line!.getAttribute('stroke')).toBe('#9ca3af')
  })

  it('shows tooltip on edge hover and hides on mouse leave', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const line = container.querySelector('svg line')
    expect(line).toBeInTheDocument()
    expect(screen.queryByText('Ally')).not.toBeInTheDocument()

    fireEvent.mouseEnter(line!)

    expect(screen.getByText('Ally')).toBeInTheDocument()
    expect(screen.getByText('Interactions: 8')).toBeInTheDocument()

    fireEvent.mouseLeave(line!)

    expect(screen.queryByText('Ally')).not.toBeInTheDocument()
  })

  it('shows edge tooltip when hovering the invisible hit area path', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const hitArea = container.querySelector('svg path[stroke="transparent"]')
    expect(hitArea).toBeInTheDocument()

    fireEvent.mouseEnter(hitArea!)
    expect(screen.getByText('Ally')).toBeInTheDocument()
    expect(screen.getByText('Interactions: 8')).toBeInTheDocument()

    fireEvent.mouseLeave(hitArea!)
    expect(screen.queryByText('Ally')).not.toBeInTheDocument()
  })

  it('shows a node tooltip and hover ring when hovering a character node', () => {
    const { container } = render(<CharacterGraphView data={sampleCharacterData} />)

    const nodeGroups = container.querySelectorAll('g.cursor-pointer')
    expect(nodeGroups.length).toBe(sampleCharacterData.nodes.length)

    fireEvent.mouseEnter(nodeGroups[0]!)

    expect(container.querySelector('circle[opacity="0.45"]')).toBeInTheDocument()
    expect(screen.getByText('3.00')).toBeInTheDocument()
    expect(screen.getByText('protagonist')).toBeInTheDocument()

    fireEvent.mouseLeave(nodeGroups[0]!)
    expect(screen.queryByText('3.00')).not.toBeInTheDocument()
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
    expect(line!.getAttribute('stroke-width')).toBe('1.4')
    expect(parseFloat(line!.getAttribute('opacity')!)).toBeCloseTo(0.44, 2)
    expect(line!.getAttribute('stroke-dasharray')).toBe('4,4')
  })

  it('uses the default relationship weight when weight is omitted', () => {
    const defaultWeightData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'ally', label: 'Alice -> Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={defaultWeightData} />)

    const line = container.querySelector('svg line')
    expect(line!.getAttribute('stroke-width')).toBe('2')
    expect(parseFloat(line!.getAttribute('opacity')!)).toBeCloseTo(0.65, 2)
    expect(line!.getAttribute('stroke-dasharray')).toBe('none')
  })

  it('renders role-specific node strokes for rival, ally, family, and fallback roles', () => {
    const variedRolesData: NarrativeVisualizationCharacterData = {
      nodes: [
        { id: 'Hero', name: 'Hero', role: 'hero', importance: 3, chapterCount: 3 },
        { id: 'Rival', name: 'Rival', role: 'enemy', importance: 2, chapterCount: 2 },
        { id: 'Ally', name: 'Ally', role: 'ally', importance: 2, chapterCount: 2 },
        { id: 'Family', name: 'Family', role: 'family', importance: 1, chapterCount: 1 },
        { id: 'Extra', name: 'Extra', role: 'stranger', importance: 1, chapterCount: 1 },
      ],
      edges: [],
      summary: 'Varied roles',
      empty: false,
    }

    const { container } = render(<CharacterGraphView data={variedRolesData} />)

    expect(container.querySelector('circle[stroke="#f87171"]')).toBeInTheDocument()
    expect(container.querySelector('circle[stroke="#34d399"]')).toBeInTheDocument()
    expect(container.querySelector('circle[stroke="#60a5fa"]')).toBeInTheDocument()
    expect(container.querySelector('circle[stroke="#94a3b8"]')).toBeInTheDocument()
  })

  it('renders non-ally edge tooltip labels for rival relationships', () => {
    const rivalData: NarrativeVisualizationCharacterData = {
      ...sampleCharacterData,
      edges: [
        { source: 'Alice', target: 'Bob', type: 'rival', weight: 0.5, label: 'Alice vs Bob' },
      ],
    }

    const { container } = render(<CharacterGraphView data={rivalData} />)

    const line = container.querySelector('svg line')
    expect(line).toBeInTheDocument()

    fireEvent.mouseEnter(line!)

    expect(screen.getByText('对手')).toBeInTheDocument()
    expect(screen.getAllByText('Alice vs Bob')).toHaveLength(2)
    expect(screen.getByText('Interactions: 5')).toBeInTheDocument()
  })
})

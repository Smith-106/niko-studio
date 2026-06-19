import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { NarrativeVisualizationTensionData } from '../../../api/narrative-visualization'
import { TensionCurveView } from '../TensionCurveView'

const sampleTensionDataWithReaderState: NarrativeVisualizationTensionData = {
  points: [
    {
      chapterId: 'ch-1',
      chapterIndex: 0,
      chapterNumber: 1,
      title: 'Opening',
      tension: 0.8,
      engagement: 0.7,
      dominantEmotion: 'fear',
      label: 'Ch 1',
      readerState: {
        engagement: 0.65,
        immersion: 0.5,
        suspenseTension: 0.7,
        cognitiveLoad: 0.3,
        curiosity: 0.6,
      },
    },
    {
      chapterId: 'ch-2',
      chapterIndex: 1,
      chapterNumber: 2,
      title: 'Fallout',
      tension: 0.3,
      engagement: 0.4,
      dominantEmotion: 'sadness',
      label: 'Ch 2',
      readerState: {
        engagement: 0.4,
        immersion: 0.3,
        suspenseTension: 0.2,
        cognitiveLoad: 0.1,
        curiosity: 0.3,
      },
    },
  ],
  deserts: [],
  overallArcScore: 78,
  summary: 'Test tension',
  empty: false,
  highRiskChapters: ['ch-1'],
}

const sampleTensionDataWithoutReaderState: NarrativeVisualizationTensionData = {
  points: [
    {
      chapterId: 'ch-1',
      chapterIndex: 0,
      chapterNumber: 1,
      title: 'Opening',
      tension: 0.8,
      engagement: 0.7,
      dominantEmotion: 'fear',
      label: 'Ch 1',
    },
    {
      chapterId: 'ch-2',
      chapterIndex: 1,
      chapterNumber: 2,
      title: 'Fallout',
      tension: 0.3,
      engagement: 0.4,
      dominantEmotion: 'sadness',
      label: 'Ch 2',
    },
  ],
  deserts: [],
  overallArcScore: 78,
  summary: 'Test tension without reader state',
  empty: false,
  highRiskChapters: [],
}

describe('TensionCurveView', () => {
  it('renders without crashing with valid data', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('Tension Curve')).toBeInTheDocument()
    expect(screen.getByText('Test tension')).toBeInTheDocument()
  })

  it('renders the tension curve path', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Main tension path uses stroke "rgb(59 130 246)" and strokeWidth 3
    const tensionPath = container.querySelector('path[stroke="rgb(59 130 246)"][stroke-width="3"]')
    expect(tensionPath).toBeInTheDocument()
  })

  it('renders data point circles for each chapter', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Default radius is 5 for non-selected points
    const circles = container.querySelectorAll('circle[r="5"]')
    expect(circles.length).toBe(2)
  })

  it('renders engagement and immersion paths when readerState is present', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Engagement path: stroke "#3b82f6"
    const engagementPath = container.querySelector('path[stroke="#3b82f6"]')
    expect(engagementPath).toBeInTheDocument()

    // Immersion path: stroke "#22c55e"
    const immersionPath = container.querySelector('path[stroke="#22c55e"]')
    expect(immersionPath).toBeInTheDocument()
  })

  it('does not render engagement/immersion paths when readerState is absent', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithoutReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const engagementPath = container.querySelector('path[stroke="#3b82f6"]')
    expect(engagementPath).not.toBeInTheDocument()

    const immersionPath = container.querySelector('path[stroke="#22c55e"]')
    expect(immersionPath).not.toBeInTheDocument()
  })

  it('renders only tension curve without readerState (backward compat)', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithoutReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Only the main tension path (strokeWidth=3) should exist
    const paths = container.querySelectorAll('svg path')
    expect(paths.length).toBe(1)
  })

  it('renders red diamond marker for high-risk chapters', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // High-risk diamond: polygon with fill="#ef4444"
    const diamond = container.querySelector('polygon[fill="#ef4444"]')
    expect(diamond).toBeInTheDocument()
  })

  it('does not render red diamond when no high-risk chapters', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithoutReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const diamond = container.querySelector('polygon[fill="#ef4444"]')
    expect(diamond).not.toBeInTheDocument()
  })

  it('renders legend items based on available data', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Tension legend always present
    expect(screen.getByText('tension')).toBeInTheDocument()
    // Engagement/immersion legend when readerState present
    expect(screen.getByText('engagement')).toBeInTheDocument()
    expect(screen.getByText('immersion')).toBeInTheDocument()
    // Risk legend when highRiskChapters present
    expect(screen.getByText('risk')).toBeInTheDocument()
  })

  it('does not render engagement/immersion/risk legend when data lacks them', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithoutReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('tension')).toBeInTheDocument()
    expect(screen.queryByText('engagement')).not.toBeInTheDocument()
    expect(screen.queryByText('immersion')).not.toBeInTheDocument()
    expect(screen.queryByText('risk')).not.toBeInTheDocument()
  })

  it('renders empty state when data is empty', () => {
    const emptyData: NarrativeVisualizationTensionData = {
      points: [],
      deserts: [],
      overallArcScore: 0,
      summary: 'No tension data',
      empty: true,
      highRiskChapters: [],
    }

    render(
      <TensionCurveView
        data={emptyData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('No tension data')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders selected chapter with larger circle', () => {
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId="ch-1"
        onSelectChapter={() => {}}
      />,
    )

    const selectedCircle = container.querySelector('circle[r="7"]')
    expect(selectedCircle).toBeInTheDocument()
  })

  it('shows tooltip, hover styling, and selects a chapter from the chart hit area', () => {
    const onSelectChapter = vi.fn()
    const { container } = render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={onSelectChapter}
      />,
    )

    const hitAreas = container.querySelectorAll('circle[r="16"][fill="transparent"]')
    expect(hitAreas).toHaveLength(sampleTensionDataWithReaderState.points.length)

    fireEvent.mouseEnter(hitAreas[1]!)

    expect(container.querySelector('circle[r="8"][stroke="#7240dd"]')).toBeInTheDocument()
    expect(container.querySelector('circle[r="6"][fill="#7240dd"]')).toBeInTheDocument()
    expect(screen.getByText('点击节点定位编辑器')).toBeInTheDocument()

    fireEvent.click(hitAreas[1]!)
    expect(onSelectChapter).toHaveBeenCalledWith('ch-2')

    fireEvent.mouseLeave(hitAreas[1]!)
    expect(screen.queryByText('点击节点定位编辑器')).not.toBeInTheDocument()
  })

  it('calls onSelectChapter when a chapter is clicked in the text fallback list', () => {
    const onSelectChapter = vi.fn()

    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={onSelectChapter}
      />,
    )

    const fallback = screen.getByLabelText('Tension text fallback')
    const buttons = within(fallback).getAllByRole('button')

    fireEvent.click(buttons[1]!)

    expect(onSelectChapter).toHaveBeenCalledWith('ch-2')
  })

  it('renders a non-empty shell when plotted points are absent and high-risk chapters are omitted', () => {
    const pointlessData: NarrativeVisualizationTensionData = {
      points: [],
      deserts: [],
      overallArcScore: 0,
      summary: 'No plotted points',
      empty: false,
    }

    const { container } = render(
      <TensionCurveView
        data={pointlessData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('No plotted points')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Tension curve with 0 plotted chapters')
    expect(container.querySelectorAll('circle[r="16"][fill="transparent"]')).toHaveLength(0)
    expect(screen.queryByText('risk')).not.toBeInTheDocument()
  })

  it('renders SVG with correct viewBox dimensions', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const svg = screen.getByRole('img')
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 180')
  })

  it('renders text fallback for each chapter point', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByLabelText('Tension text fallback')).toBeInTheDocument()
    expect(screen.getByText('Ch 1')).toBeInTheDocument()
    expect(screen.getByText('Ch 2')).toBeInTheDocument()
  })

  it('displays readerState details in text fallback when present', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // The first point has readerState, so immersion and curiosity should appear in text fallback
    const fallback = screen.getByLabelText('Tension text fallback')
    expect(fallback.textContent).toContain('immersion')
    expect(fallback.textContent).toContain('curiosity')
  })

  it('displays arc score and desert count', () => {
    render(
      <TensionCurveView
        data={sampleTensionDataWithReaderState}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('arc score 78')).toBeInTheDocument()
    expect(screen.getByText('0 low-tension deserts')).toBeInTheDocument()
  })
})

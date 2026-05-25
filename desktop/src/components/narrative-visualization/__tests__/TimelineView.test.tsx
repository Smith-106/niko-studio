import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { NarrativeVisualizationTimelineData } from '../../../api/narrative-visualization'
import { TimelineView } from '../TimelineView'

const sampleTimelineData: NarrativeVisualizationTimelineData = {
  chapters: [
    {
      chapterId: 'ch-1',
      chapterIndex: 0,
      chapterNumber: 1,
      title: 'Opening',
      label: 'Ch 1',
      arcPosition: 0,
      tension: 0.7,
      eventCount: 1,
    },
    {
      chapterId: 'ch-2',
      chapterIndex: 1,
      chapterNumber: 2,
      title: 'Fallout',
      label: 'Ch 2',
      arcPosition: 1,
      tension: 0.3,
      eventCount: 0,
    },
  ],
  events: [
    {
      id: 'evt-1',
      label: 'conflict',
      chapterIndex: 0,
      chapterNumber: 1,
      type: 'conflict',
      severity: 'major',
      description: 'Major conflict',
    },
  ],
  summary: 'Test timeline',
  empty: false,
}

describe('TimelineView', () => {
  it('renders without crashing with valid data', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('Timeline')).toBeInTheDocument()
    expect(screen.getByText('Test timeline')).toBeInTheDocument()
  })

  it('renders SVG with correct viewBox at default zoom', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const svg = screen.getByRole('img')
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 120')
  })

  it('renders chapter circles for each chapter', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Each chapter renders a text element with its chapter number
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders event markers for filtered events', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    // Event markers are small circles with r=4 (event circles)
    const eventCircles = container.querySelectorAll('circle[r="4"]')
    expect(eventCircles.length).toBe(1)
  })

  it('renders selected chapter highlight stroke ring', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId="ch-1"
        onSelectChapter={() => {}}
      />,
    )

    // Selected chapter gets a highlight ring: circle r=14, stroke rgb(59 130 246)
    const highlightRing = container.querySelector('circle[r="14"][stroke="rgb(59 130 246)"]')
    expect(highlightRing).toBeInTheDocument()

    // Selected chapter circle is larger (r=10)
    const selectedCircle = container.querySelector('circle[r="10"][fill="rgb(59 130 246)"]')
    expect(selectedCircle).toBeInTheDocument()
  })

  it('does not render highlight ring when no chapter is selected', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const highlightRing = container.querySelector('circle[r="14"]')
    expect(highlightRing).not.toBeInTheDocument()
  })

  it('filters out conflict events when eventFilters excludes conflict', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        eventFilters={['turning_point', 'warning']}
      />,
    )

    // No event markers should render since the only event is 'conflict'
    const eventCircles = container.querySelectorAll('circle[r="4"]')
    expect(eventCircles.length).toBe(0)

    // The "flagged events" count should reflect filtering
    expect(screen.getByText('0 flagged events')).toBeInTheDocument()
  })

  it('includes conflict events when eventFilters includes conflict', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        eventFilters={['conflict']}
      />,
    )

    const eventCircles = container.querySelectorAll('circle[r="4"]')
    expect(eventCircles.length).toBe(1)

    expect(screen.getByText('1 flagged events')).toBeInTheDocument()
  })

  it('adjusts viewBox width when zoomScale is 2', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        zoomScale={2}
      />,
    )

    const svg = screen.getByRole('img')
    // width = 640/2 = 320, height = 120/2 = 60
    expect(svg.getAttribute('viewBox')).toBe('0 0 320 60')
  })

  it('applies zoom offset to viewBox', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        zoomScale={1}
        zoomOffset={{ x: 10, y: 20 }}
      />,
    )

    const svg = screen.getByRole('img')
    expect(svg.getAttribute('viewBox')).toBe('10 20 640 120')
  })

  it('calls onZoomChange when wheel event occurs', () => {
    const onZoomChange = vi.fn()

    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        zoomScale={1}
        onZoomChange={onZoomChange}
      />,
    )

    const svg = screen.getByRole('img')
    fireEvent.wheel(svg, { deltaY: -100 })

    expect(onZoomChange).toHaveBeenCalledTimes(1)
    // Zooming in: scale should increase (1 * 1.1 = 1.1)
    expect(onZoomChange).toHaveBeenCalledWith(1.1, { x: 0, y: 0 })
  })

  it('does not call onZoomChange when handler is not provided', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const svg = screen.getByRole('img')
    // Should not throw when wheel event fires without onZoomChange
    expect(() => fireEvent.wheel(svg, { deltaY: -100 })).not.toThrow()
  })

  it('renders empty state when data is empty', () => {
    const emptyData: NarrativeVisualizationTimelineData = {
      chapters: [],
      events: [],
      summary: 'No data',
      empty: true,
    }

    render(
      <TimelineView
        data={emptyData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('calls onSelectChapter when a chapter circle is clicked', () => {
    const onSelectChapter = vi.fn()

    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={onSelectChapter}
      />,
    )

    // Click the button in the text fallback
    const button = screen.getByText('Ch 1')
    button.click()
    expect(onSelectChapter).toHaveBeenCalledWith('ch-1')
  })

  it('renders text fallback for each chapter', () => {
    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.getByLabelText('Timeline text fallback')).toBeInTheDocument()
    expect(screen.getByText('Ch 1')).toBeInTheDocument()
    expect(screen.getByText('Ch 2')).toBeInTheDocument()
  })
})

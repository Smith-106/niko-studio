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

  it('calls onSelectChapter when the chapter hit area is clicked', () => {
    const onSelectChapter = vi.fn()
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={onSelectChapter}
      />,
    )

    const chapterHitAreas = container.querySelectorAll('circle[r="16"]')
    expect(chapterHitAreas.length).toBe(sampleTimelineData.chapters.length)

    fireEvent.click(chapterHitAreas[0]!)

    expect(onSelectChapter).toHaveBeenCalledWith('ch-1')
  })

  it('shows chapter tooltip and hover styling when hovering a chapter marker', () => {
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const chapterHitAreas = container.querySelectorAll('circle[r="16"]')
    fireEvent.mouseEnter(chapterHitAreas[1]!)

    expect(container.querySelector('circle[r="9"][stroke="#7240dd"]')).toBeInTheDocument()
    expect(container.querySelector('circle[r="6"][fill="#7240dd"]')).toBeInTheDocument()
    expect(screen.getAllByText('0.30')).toHaveLength(2)

    fireEvent.mouseLeave(chapterHitAreas[1]!)

    expect(container.querySelector('circle[r="9"][stroke="#7240dd"]')).not.toBeInTheDocument()
    expect(screen.getAllByText('0.30')).toHaveLength(1)
  })

  it('shows event tooltip, hover styling, and selects chapter when an event marker is used', () => {
    const onSelectChapter = vi.fn()
    const { container } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={onSelectChapter}
      />,
    )

    const eventMarker = container.querySelector('circle[r="4"][fill="#f43f5e"]')
    expect(eventMarker).toBeInTheDocument()

    fireEvent.mouseEnter(eventMarker!)

    expect(screen.getByText('Major conflict')).toBeInTheDocument()
    expect(container.querySelector('line[stroke-width="2.5"]')).toBeInTheDocument()
    expect(container.querySelector('circle[r="5.5"][fill="#f43f5e"]')).toBeInTheDocument()

    fireEvent.click(eventMarker!)
    expect(onSelectChapter).toHaveBeenCalledWith('ch-1')

    fireEvent.mouseLeave(eventMarker!)
    expect(screen.queryByText('Major conflict')).not.toBeInTheDocument()
  })

  it('renders the turning point tooltip label for turning-point events', () => {
    const turningPointData: NarrativeVisualizationTimelineData = {
      ...sampleTimelineData,
      events: [
        {
          id: 'evt-turn',
          label: 'reversal',
          chapterIndex: 0,
          chapterNumber: 1,
          type: 'turning_point',
          severity: 'major',
          description: 'Story reversal',
        },
      ],
    }

    const { container } = render(
      <TimelineView
        data={turningPointData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const eventMarker = container.querySelector('circle[r="4"][fill="#7240dd"]')
    expect(eventMarker).toBeInTheDocument()

    fireEvent.mouseEnter(eventMarker!)

    expect(screen.getByText('转折点')).toBeInTheDocument()
    expect(screen.getByText('Story reversal')).toBeInTheDocument()
  })

  it('falls back to the default event color and skips events without a mapped chapter', () => {
    const unknownTypeData: NarrativeVisualizationTimelineData = {
      ...sampleTimelineData,
      events: [
        {
          id: 'evt-unknown',
          label: 'mystery',
          chapterIndex: 0,
          chapterNumber: 1,
          type: 'mystery',
          severity: 'minor',
          description: 'Unknown event',
        },
        {
          id: 'evt-missing',
          label: 'missing',
          chapterIndex: 99,
          chapterNumber: 100,
          type: 'warning',
          severity: 'major',
          description: 'Missing chapter',
        },
      ],
    }

    const { container } = render(
      <TimelineView
        data={unknownTypeData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const eventMarkers = container.querySelectorAll('circle[stroke="#ffffff"]')
    expect(eventMarkers.length).toBe(1)

    const unknownMarker = container.querySelector('circle[r="4"][fill="#94a3b8"]')
    expect(unknownMarker).toBeInTheDocument()

    fireEvent.mouseEnter(unknownMarker!)
    expect(screen.getByText('Unknown event')).toBeInTheDocument()
  })

  it('drops the hovered event tooltip when the hovered event no longer maps to a chapter after rerender', () => {
    const { container, rerender } = render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    const eventMarker = container.querySelector('circle[r="4"][fill="#f43f5e"]')
    expect(eventMarker).toBeInTheDocument()

    fireEvent.mouseEnter(eventMarker!)
    expect(screen.getByText('Major conflict')).toBeInTheDocument()

    const remappedData: NarrativeVisualizationTimelineData = {
      ...sampleTimelineData,
      events: [
        {
          ...sampleTimelineData.events[0],
          chapterIndex: 99,
        },
      ],
    }

    rerender(
      <TimelineView
        data={remappedData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
      />,
    )

    expect(screen.queryByText('Major conflict')).not.toBeInTheDocument()
  })

  it('zooms out and clamps to the minimum scale on positive wheel delta', () => {
    const onZoomChange = vi.fn()

    render(
      <TimelineView
        data={sampleTimelineData}
        selectedChapterId={null}
        onSelectChapter={() => {}}
        zoomScale={0.55}
        onZoomChange={onZoomChange}
      />,
    )

    fireEvent.wheel(screen.getByRole('img'), { deltaY: 100 })

    expect(onZoomChange).toHaveBeenCalledWith(0.5, { x: 0, y: 0 })
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

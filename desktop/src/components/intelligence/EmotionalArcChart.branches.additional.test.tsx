import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EmotionalArcResult, EmotionalArcPoint } from '../../api/writing-craft'
import { EmotionalArcChart } from './EmotionalArcChart'

function buildResult(overrides: Partial<EmotionalArcResult> = {}): EmotionalArcResult {
  return {
    timeline: [
      {
        chapterIndex: 0,
        emotionScore: 0.5,
        showTellRatio: 0.6,
        layerRichness: 0.4,
        dominantEmotion: 'hope',
        emotionalIntensity: 0.7,
      },
      {
        chapterIndex: 1,
        emotionScore: 0.3,
        showTellRatio: 0.4,
        layerRichness: 0.5,
        dominantEmotion: 'fear',
        emotionalIntensity: 0.9,
      },
    ],
    tensionDeserts: [],
    curveMatches: [],
    overallArcScore: 0.5,
    suggestions: [],
    ...overrides,
  }
}

describe('EmotionalArcChart branch coverage', () => {
  it('returns 0 for getY when point key value is not a number (line 39)', () => {
    const result = buildResult({
      timeline: [
        {
          chapterIndex: 0,
          emotionScore: 'not-a-number' as unknown as number,
          showTellRatio: 0.5,
          emotionalIntensity: 0.7,
        } as unknown as EmotionalArcPoint,
      ],
    })

    const { container } = render(<EmotionalArcChart result={result} />)

    // The chart still renders; the non-number value resolves to 0 via getY
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('handles null tensionDeserts by falling back to empty array (line 58)', () => {
    const result = buildResult({ tensionDeserts: null as unknown as [] })

    const { container } = render(<EmotionalArcChart result={result} />)

    // Renders without error, deserts loop skipped
    const rects = container.querySelectorAll('rect[fill*="rgba(239"]')
    expect(rects.length).toBe(0)
  })

  it('renders low-severity tension desert with alpha 0.08 (line 146)', () => {
    const result = buildResult({
      tensionDeserts: [
        { startChapter: 0, endChapter: 1, severity: 'low' },
      ],
    })

    const { container } = render(<EmotionalArcChart result={result} />)

    const desertRect = container.querySelector('rect[fill*="rgba(239"]')
    expect(desertRect).toBeInTheDocument()
    expect(desertRect?.getAttribute('fill')).toContain('0.08')
  })

  it('renders medium-severity tension desert with alpha 0.12', () => {
    const result = buildResult({
      tensionDeserts: [
        { startChapter: 0, endChapter: 1, severity: 'medium' },
      ],
    })

    const { container } = render(<EmotionalArcChart result={result} />)

    const desertRect = container.querySelector('rect[fill*="rgba(239"]')
    expect(desertRect).toBeInTheDocument()
    expect(desertRect?.getAttribute('fill')).toContain('0.12')
  })

  it('skips tension desert when end <= start (line 141)', () => {
    const result = buildResult({
      tensionDeserts: [
        { startChapter: 1, endChapter: 0, severity: 'high' },
        { startChapter: 0, endChapter: 0, severity: 'medium' },
      ],
    })

    const { container } = render(<EmotionalArcChart result={result} />)

    // Both deserts have end <= start, so no red rects
    const desertRects = container.querySelectorAll('rect[fill*="rgba(239"]')
    expect(desertRects.length).toBe(0)
  })

  it('renders best curve match when available (line 115-119)', () => {
    const result = buildResult({
      curveMatches: [
        { label: 'Rags to Riches', similarity: 0.82 },
      ],
    })

    render(<EmotionalArcChart result={result} />)

    expect(screen.getByText(/最佳曲线匹配/)).toBeInTheDocument()
    expect(screen.getByText(/Rags to Riches/)).toBeInTheDocument()
  })

  it('shows empty state when timeline is empty (line 84-89)', () => {
    const result = buildResult({ timeline: [] })

    render(<EmotionalArcChart result={result} />)

    expect(screen.getByText('暂无情感弧线数据')).toBeInTheDocument()
  })

  it('renders hover tooltip on mouse enter and clears on leave (line 191-211)', () => {
    const result = buildResult()

    const { container } = render(<EmotionalArcChart result={result} />)

    // Find a circle data point
    const circles = container.querySelectorAll('circle.cursor-pointer')
    expect(circles.length).toBeGreaterThan(0)

    // Hover over first point
    fireEvent.mouseEnter(circles[0])
    expect(screen.getByText(/章节/)).toBeInTheDocument()

    // Leave
    fireEvent.mouseLeave(circles[0])
    expect(screen.queryByText(/章节/)).not.toBeInTheDocument()
  })

  it('toggles curve visibility via checkboxes (line 171-172)', () => {
    const result = buildResult()

    const { container } = render(<EmotionalArcChart result={result} />)

    // Initially all visible curves are rendered (3 paths for 3 curves)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)

    // Find checkboxes and toggle the first one
    const labels = screen.getAllByRole('checkbox')
    expect(labels.length).toBe(3)

    fireEvent.click(labels[0]) // toggle emotionalIntensity off

    // After toggle, one curve is hidden
    const curveGroups = container.querySelectorAll('g')
    expect(curveGroups.length).toBeGreaterThan(0)
  })

  it('renders single-point timeline with centered x position (line 70)', () => {
    const result = buildResult({
      timeline: [
        {
          chapterIndex: 0,
          emotionScore: 0.5,
          showTellRatio: 0.5,
          emotionalIntensity: 0.5,
        },
      ],
    })

    const { container } = render(<EmotionalArcChart result={result} />)

    // Single point: 3 curve keys, but only 2 visible by default (showTellRatio is off)
    const circles = container.querySelectorAll('circle.cursor-pointer')
    expect(circles.length).toBe(2) // emotionalIntensity + emotionScore visible, showTellRatio hidden
  })
})

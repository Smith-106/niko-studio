import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EmotionalArcResult } from '../../api/writing-craft'
import { EmotionalArcChart } from './EmotionalArcChart'

const chartResult: EmotionalArcResult = {
  timeline: [
    {
      chapterIndex: 0,
      emotionScore: 0.25,
      showTellRatio: Number.POSITIVE_INFINITY,
      layerRichness: 0.4,
      dominantEmotion: 'fear',
      emotionalIntensity: 0.82,
    },
    {
      chapterIndex: 1,
      emotionScore: 1.4,
      showTellRatio: 0.58,
      layerRichness: 0.6,
      dominantEmotion: 'hope',
      emotionalIntensity: 0.55,
    },
    {
      chapterIndex: 2,
      emotionScore: -0.2,
      showTellRatio: 0.22,
      layerRichness: 0.2,
      dominantEmotion: 'grief',
      emotionalIntensity: 0.33,
    },
  ],
  tensionDeserts: [
    {
      startChapter: 0,
      endChapter: 2,
      length: 2,
      severity: 'high',
    },
    {
      startChapter: 2,
      endChapter: 2,
      length: 0,
      severity: 'low',
    },
  ],
  curveMatches: [
    {
      curveType: 'rise',
      label: '三幕上升',
      similarity: 0.83,
    },
  ],
  overallArcScore: 0.76,
  suggestions: ['补足第二章情绪过渡', '收束结尾张力'],
}

describe('EmotionalArcChart', () => {
  it('renders the empty state when there is no timeline data', () => {
    render(
      <EmotionalArcChart
        result={{
          timeline: [],
          tensionDeserts: [],
          curveMatches: [],
          overallArcScore: 0,
          suggestions: [],
        }}
      />,
    )

    expect(screen.getByText('暂无情感弧线数据')).toBeInTheDocument()
  })

  it('renders chart metadata, toggles curves, and shows hover details for a chapter point', () => {
    const { container } = render(<EmotionalArcChart result={chartResult} />)

    expect(screen.getByText(/三幕上升/)).toBeInTheDocument()
    expect(screen.getByText(/83%/)).toBeInTheDocument()
    expect(screen.getByText('建议：补足第二章情绪过渡；收束结尾张力')).toBeInTheDocument()

    const showTellCheckbox = screen.getByLabelText('Show 比例') as HTMLInputElement
    expect(showTellCheckbox).not.toBeChecked()

    const initialPoints = container.querySelectorAll('circle.cursor-pointer')
    expect(initialPoints).toHaveLength(6)
    expect(container.querySelectorAll('rect[fill^="rgba(239, 68, 68"]').length).toBe(1)

    fireEvent.click(showTellCheckbox)

    expect(showTellCheckbox).toBeChecked()
    expect(container.querySelectorAll('circle.cursor-pointer')).toHaveLength(9)

    const firstPoint = container.querySelector('circle.cursor-pointer') as SVGCircleElement | null
    expect(firstPoint).toBeTruthy()

    fireEvent.mouseEnter(firstPoint!)
    expect(screen.getByText('章节 1')).toBeInTheDocument()

    fireEvent.mouseLeave(firstPoint!)
    expect(screen.queryByText('章节 1')).not.toBeInTheDocument()
  })
})

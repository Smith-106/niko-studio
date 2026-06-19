import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EmotionalArcResult } from '../../api/writing-craft'
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
    ],
    tensionDeserts: [],
    curveMatches: [],
    overallArcScore: 0.5,
    suggestions: ['建议一', '建议二'],
    ...overrides,
  }
}

describe('EmotionalArcChart additional coverage (line 218)', () => {
  it('renders null when suggestions is an empty array', () => {
    const result = buildResult({ suggestions: [] })

    render(<EmotionalArcChart result={result} />)

    // The suggestions section should not render at all
    expect(screen.queryByText(/建议：/)).not.toBeInTheDocument()
  })

  it('renders null when suggestions is undefined', () => {
    const result = buildResult({ suggestions: undefined as unknown as string[] })

    render(<EmotionalArcChart result={result} />)

    expect(screen.queryByText(/建议：/)).not.toBeInTheDocument()
  })

  it('renders suggestions when exactly one suggestion exists', () => {
    const result = buildResult({ suggestions: ['仅有一条建议'] })

    render(<EmotionalArcChart result={result} />)

    // slice(0, 2) on a single-element array returns that one element
    expect(screen.getByText('建议：仅有一条建议')).toBeInTheDocument()
  })

  it('renders up to two suggestions joined by semicolon', () => {
    const result = buildResult({ suggestions: ['第一条', '第二条', '第三条'] })

    render(<EmotionalArcChart result={result} />)

    // Only first two are shown, joined by Chinese semicolon
    expect(screen.getByText('建议：第一条；第二条')).toBeInTheDocument()
    // Third suggestion should not appear
    expect(screen.queryByText('第三条')).not.toBeInTheDocument()
  })
})

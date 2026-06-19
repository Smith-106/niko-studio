import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ImmersionResult } from '../../api/writing-craft'

const analyzeReaderImmersionMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/writing-craft', () => ({
  analyzeReaderImmersion: analyzeReaderImmersionMock,
}))

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ value }: { value: number }) => <div>{`progress:${value}`}</div>,
}))

vi.mock('./IntelligenceBadge', () => ({
  IntelligenceBadge: ({
    children,
    variant,
  }: {
    children: unknown
    variant: string
  }) => <span>{`${variant}:${children}`}</span>,
}))

import { ReaderImmersionDashboard } from './ReaderImmersionDashboard'

const chapters = [{ chapterIndex: 0, content: 'chapter one' }]

function buildResult(overrides: Partial<ImmersionResult> = {}): ImmersionResult {
  return {
    chapterStates: [
      {
        chapterIndex: 0,
        state: {
          curiosity: 0.5,
          emotionalInvestment: 0.5,
          cognitiveLoad: 0.2,
          suspenseTension: 0.3,
          immersion: 0.4,
        },
        dropoutRisk: 0.25,
      },
    ],
    averageImmersion: 0.4,
    averageDropoutRisk: 0.25,
    highRiskChapters: [0],
    trajectory: 'stable',
    suggestions: ['tighten pacing'],
    ...overrides,
  }
}

describe('ReaderImmersionDashboard additional coverage', () => {
  beforeEach(() => {
    analyzeReaderImmersionMock.mockReset()
  })

  it('renders declining, volatile, and stable trajectories', async () => {
    analyzeReaderImmersionMock
      .mockResolvedValueOnce({
        success: true,
        data: buildResult({
          trajectory: 'declining',
          highRiskChapters: [],
          suggestions: [],
        }),
      })
      .mockResolvedValueOnce({
        success: true,
        data: buildResult({
          trajectory: 'volatile',
          highRiskChapters: [],
          suggestions: [],
        }),
      })
      .mockResolvedValueOnce({
        success: true,
        data: buildResult({
          trajectory: 'stable',
          highRiskChapters: [],
          suggestions: [],
        }),
      })

    const { rerender } = render(<ReaderImmersionDashboard chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('danger:下降 ↓')).toBeInTheDocument()
    })

    rerender(
      <ReaderImmersionDashboard
        chapters={[...chapters, { chapterIndex: 1, content: 'chapter two' }]}
        visible
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('warning:波动 ↕')).toBeInTheDocument()
    })

    rerender(
      <ReaderImmersionDashboard
        chapters={[...chapters, { chapterIndex: 2, content: 'chapter three' }]}
        visible
      />,
    )
    await waitFor(() => {
      expect(screen.getByText('warning:稳定 →')).toBeInTheDocument()
    })
  })

  it('omits high-risk and suggestion sections when the result is empty', async () => {
    analyzeReaderImmersionMock.mockResolvedValueOnce({
      success: true,
      data: buildResult({
        highRiskChapters: [],
        suggestions: [],
      }),
    })

    render(<ReaderImmersionDashboard chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('progress:40')).toBeInTheDocument()
    })

    expect(screen.queryByTitle(/Chapter 1:/)).toBeInTheDocument()
    expect(screen.queryByText(/高风险章节/)).not.toBeInTheDocument()
    expect(screen.queryByText(/建议：/)).not.toBeInTheDocument()
  })

  it('uses the generic backend error and unknown thrown error fallbacks', async () => {
    analyzeReaderImmersionMock
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce('boom')

    const { rerender } = render(<ReaderImmersionDashboard chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    })

    rerender(
      <ReaderImmersionDashboard
        chapters={[...chapters, { chapterIndex: 1, content: 'chapter two' }]}
        visible
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })
  })

  it('renders the medium dropout-risk color band', async () => {
    analyzeReaderImmersionMock.mockResolvedValueOnce({
      success: true,
      data: buildResult({
        chapterStates: [
          {
            chapterIndex: 0,
            state: {
              curiosity: 0.5,
              emotionalInvestment: 0.5,
              cognitiveLoad: 0.2,
              suspenseTension: 0.3,
              immersion: 0.4,
            },
            dropoutRisk: 0.45,
          },
        ],
        highRiskChapters: [],
        suggestions: [],
      }),
    })

    render(<ReaderImmersionDashboard chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByTitle('Chapter 1: 45%')).toBeInTheDocument()
    })
  })
})

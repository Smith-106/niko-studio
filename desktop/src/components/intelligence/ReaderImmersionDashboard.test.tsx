import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

const chapters = [
  { chapterIndex: 0, content: 'chapter one' },
  { chapterIndex: 1, content: 'chapter two' },
]

const immersionResult: ImmersionResult = {
  chapterStates: [
    {
      chapterIndex: 0,
      state: {
        curiosity: 0.7,
        emotionalInvestment: 0.65,
        cognitiveLoad: 0.2,
        suspenseTension: 0.61,
        immersion: 0.74,
      },
      dropoutRisk: 0.16,
    },
    {
      chapterIndex: 1,
      state: {
        curiosity: 0.48,
        emotionalInvestment: 0.52,
        cognitiveLoad: 0.44,
        suspenseTension: 0.39,
        immersion: 0.56,
      },
      dropoutRisk: 0.72,
    },
  ],
  averageImmersion: 0.65,
  averageDropoutRisk: 0.44,
  highRiskChapters: [1],
  trajectory: 'rising',
  suggestions: ['补强章节转场', '减少说明段堆叠'],
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('ReaderImmersionDashboard', () => {
  beforeEach(() => {
    analyzeReaderImmersionMock.mockReset()
  })

  it('returns null when hidden and avoids analysis for empty chapter lists', () => {
    const { container, rerender } = render(
      <ReaderImmersionDashboard chapters={chapters} visible={false} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(analyzeReaderImmersionMock).not.toHaveBeenCalled()

    rerender(<ReaderImmersionDashboard chapters={[]} visible />)

    expect(screen.getByRole('button', { name: '重新分析' })).toBeDisabled()
    expect(analyzeReaderImmersionMock).not.toHaveBeenCalled()
  })

  it('shows loading, renders a successful analysis, and supports re-analysis', async () => {
    const deferred = createDeferred<{
      success: boolean
      data?: ImmersionResult
      error?: string
    }>()

    analyzeReaderImmersionMock
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({ success: true, data: immersionResult })

    render(<ReaderImmersionDashboard chapters={chapters} visible />)

    expect(analyzeReaderImmersionMock).toHaveBeenCalledWith(chapters)
    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled()
    expect(screen.getByText('正在分析沉浸度...')).toBeInTheDocument()

    deferred.resolve({ success: true, data: immersionResult })

    await waitFor(() => {
      expect(screen.getByText('平均沉浸度')).toBeInTheDocument()
    })

    expect(screen.getByText('读者沉浸度')).toBeInTheDocument()
    expect(screen.getByText('success:上升 ↑')).toBeInTheDocument()
    expect(screen.getByText('平均流失风险')).toBeInTheDocument()
    expect(screen.getByText('progress:65')).toBeInTheDocument()
    expect(screen.getByText('progress:44')).toBeInTheDocument()
    expect(screen.getByTitle('Chapter 2: 72%')).toBeInTheDocument()
    expect(screen.getByText('warning:第 ,2, 章')).toBeInTheDocument()
    expect(screen.getByText('建议：补强章节转场；减少说明段堆叠')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))

    await waitFor(() => {
      expect(analyzeReaderImmersionMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders backend and thrown errors from the analysis flow', async () => {
    analyzeReaderImmersionMock
      .mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
      .mockRejectedValueOnce(new Error('network down'))

    const { rerender } = render(
      <ReaderImmersionDashboard chapters={chapters} visible />,
    )

    await waitFor(() => {
      expect(screen.getByText('gateway unavailable')).toBeInTheDocument()
    })

    rerender(<ReaderImmersionDashboard chapters={[...chapters, { chapterIndex: 2, content: 'chapter three' }]} visible />)

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })
  })
})

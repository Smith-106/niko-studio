import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PacingNavigatorResult } from '../../api/writing-craft'

const navigatePacingMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/writing-craft', () => ({
  navigatePacing: navigatePacingMock,
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

import { PacingPrescriptionPanel } from './PacingPrescriptionPanel'

const chapters = [
  { chapterIndex: 0, content: '第一章' },
  { chapterIndex: 1, content: '第二章' },
  { chapterIndex: 2, content: '第三章' },
]

const pacingResult: PacingNavigatorResult = {
  pacingScore: 7.4,
  suggestions: ['提前埋设线索', '收紧过渡段'],
  prescriptions: [
    {
      chapterIndex: 2,
      type: 'breathing_room',
      label: '缓冲',
      priority: 'low',
      reason: '高潮后需要留白。',
    },
    {
      chapterIndex: 0,
      type: 'turning_point',
      label: '转折',
      priority: 'high',
      reason: '开篇缺少钩子。',
    },
    {
      chapterIndex: 1,
      type: 'escalation',
      label: '升级',
      priority: 'medium',
      reason: '中段张力不足。',
    },
  ],
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

describe('PacingPrescriptionPanel', () => {
  beforeEach(() => {
    navigatePacingMock.mockReset()
  })

  it('returns null when hidden and avoids analysis for empty chapters', () => {
    const { container, rerender } = render(
      <PacingPrescriptionPanel chapters={chapters} visible={false} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(navigatePacingMock).not.toHaveBeenCalled()

    rerender(<PacingPrescriptionPanel chapters={[]} visible />)
    expect(screen.getByRole('button', { name: '重新分析' })).toBeDisabled()
    expect(navigatePacingMock).not.toHaveBeenCalled()
  })

  it('shows loading, sorts prescriptions by priority, and supports re-analysis', async () => {
    const deferred = createDeferred<{
      success: boolean
      data?: PacingNavigatorResult
      error?: string
    }>()

    navigatePacingMock
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({ success: true, data: pacingResult })

    render(<PacingPrescriptionPanel chapters={chapters} visible />)

    expect(navigatePacingMock).toHaveBeenCalledWith(chapters)
    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled()
    expect(screen.getByText('正在生成节奏处方...')).toBeInTheDocument()

    deferred.resolve({ success: true, data: pacingResult })

    await waitFor(() => {
      expect(screen.getByText('节奏评分')).toBeInTheDocument()
    })

    expect(screen.getByText('7.4 / 10')).toBeInTheDocument()
    expect(screen.getByText('progress:74')).toBeInTheDocument()
    expect(screen.getByText('建议：提前埋设线索；收紧过渡段')).toBeInTheDocument()

    const priorityBadges = screen.getAllByText(/^(danger|warning|success):/)
    expect(priorityBadges[0]).toHaveTextContent('danger:转折')
    expect(priorityBadges[1]).toHaveTextContent('danger:HIGH')
    expect(priorityBadges[2]).toHaveTextContent('warning:升级')
    expect(priorityBadges[4]).toHaveTextContent('success:缓冲')

    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))

    await waitFor(() => {
      expect(navigatePacingMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders the empty prescription state and error paths', async () => {
    navigatePacingMock
      .mockResolvedValueOnce({
        success: true,
        data: { pacingScore: 6.1, suggestions: [], prescriptions: [] },
      })
      .mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
      .mockRejectedValueOnce(new Error('network down'))

    const { rerender } = render(<PacingPrescriptionPanel chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('暂无处方建议')).toBeInTheDocument()
    })

    rerender(<PacingPrescriptionPanel chapters={[...chapters, { chapterIndex: 3, content: '第四章' }]} visible />)
    await waitFor(() => {
      expect(screen.getByText('gateway unavailable')).toBeInTheDocument()
    })

    rerender(<PacingPrescriptionPanel chapters={[...chapters, { chapterIndex: 4, content: '第五章' }]} visible />)
    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })
  })
})

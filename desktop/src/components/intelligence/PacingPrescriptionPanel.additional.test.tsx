import { render, screen, waitFor } from '@testing-library/react'
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
  }) => (
    <span data-testid="badge" data-variant={variant}>
      {String(children)}
    </span>
  ),
}))

import { PacingPrescriptionPanel } from './PacingPrescriptionPanel'

const chapters = [
  { chapterIndex: 0, content: '第一章' },
  { chapterIndex: 1, content: '第二章' },
]

describe('PacingPrescriptionPanel additional coverage', () => {
  beforeEach(() => {
    navigatePacingMock.mockReset()
  })

  it('falls back to the default rank for unexpected priorities', async () => {
    const result: PacingNavigatorResult = {
      pacingScore: 4.2,
      suggestions: ['Keep tightening the middle.'],
      prescriptions: [
        {
          chapterIndex: 1,
          type: 'escalation',
          label: 'Urgent',
          priority: 'urgent' as never,
          reason: 'Unexpected priority from backend.',
        },
        {
          chapterIndex: 0,
          type: 'turning_point',
          label: 'Medium',
          priority: 'medium',
          reason: 'Still needs a stronger turn.',
        },
      ],
    }

    navigatePacingMock.mockResolvedValueOnce({ success: true, data: result })

    render(<PacingPrescriptionPanel chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('Medium')).toBeInTheDocument()
    })

    const mediumLabel = screen.getByText('Medium')
    const urgentLabel = screen.getByText('Urgent')
    expect(mediumLabel.compareDocumentPosition(urgentLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('uses the default api error message when the backend omits error details', async () => {
    navigatePacingMock.mockResolvedValueOnce({ success: false })

    render(<PacingPrescriptionPanel chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    })
  })

  it('uses the unknown error fallback for non-Error rejections', async () => {
    navigatePacingMock.mockRejectedValueOnce('panic')

    render(<PacingPrescriptionPanel chapters={chapters} visible />)

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })
  })
})

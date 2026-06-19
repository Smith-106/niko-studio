import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PatternDashboardPanel } from './PatternDashboardPanel'

const detectPatternsMock = vi.hoisted(() => vi.fn())

vi.mock('../api/analysis', () => ({
  detectPatterns: detectPatternsMock,
}))

describe('PatternDashboardPanel error branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error when detectPatterns returns success: false', async () => {
    detectPatternsMock.mockResolvedValue({ success: false, data: null })

    render(<PatternDashboardPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败，请稍后重试。')).toBeInTheDocument()
    })
  })

  it('shows error when detectPatterns returns success: true but no data', async () => {
    detectPatternsMock.mockResolvedValue({ success: true, data: null })

    render(<PatternDashboardPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败，请稍后重试。')).toBeInTheDocument()
    })
  })

  it('shows error when detectPatterns throws', async () => {
    detectPatternsMock.mockRejectedValue(new Error('network error'))

    render(<PatternDashboardPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败，请稍后重试。')).toBeInTheDocument()
    })
  })

  it('clears loading state after error', async () => {
    detectPatternsMock.mockRejectedValue(new Error('fail'))

    render(<PatternDashboardPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败，请稍后重试。')).toBeInTheDocument()
    })

    expect(screen.queryByText('加载中...')).not.toBeInTheDocument()
  })
})

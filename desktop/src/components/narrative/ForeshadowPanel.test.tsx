import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { ForeshadowPanel } from './ForeshadowPanel'

const alerts = [
  {
    foreshadowId: 'seed-1',
    hint: '门口的旧钥匙',
    plantedAt: 2,
    currentChapter: 5,
    chaptersUntilDue: 1,
    urgency: 'due' as const,
  },
  {
    foreshadowId: 'seed-2',
    hint: '失踪的信件',
    plantedAt: 1,
    currentChapter: 6,
    chaptersUntilDue: 0,
    urgency: 'overdue' as const,
  },
  {
    foreshadowId: 'seed-3',
    hint: '陌生人的微笑',
    plantedAt: 4,
    currentChapter: 5,
    chaptersUntilDue: 3,
    urgency: 'approaching' as const,
  },
]

describe('ForeshadowPanel', () => {
  it('filters alerts by urgency and resolves selected foreshadow items', () => {
    const onResolve = vi.fn()

    render(<ForeshadowPanel alerts={alerts} onResolve={onResolve} />)

    expect(screen.getByText('伏笔追踪')).toBeInTheDocument()
    expect(screen.getByText('门口的旧钥匙')).toBeInTheDocument()
    expect(screen.getByText('失踪的信件')).toBeInTheDocument()
    expect(screen.getByText('陌生人的微笑')).toBeInTheDocument()
    expect(screen.getByText('即将到期')).toBeInTheDocument()
    expect(screen.getByText('已过期')).toBeInTheDocument()
    expect(screen.getByText('接近')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '过期' }))

    expect(screen.getByText('失踪的信件')).toBeInTheDocument()
    expect(screen.queryByText('门口的旧钥匙')).not.toBeInTheDocument()
    expect(screen.queryByText('陌生人的微笑')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '标记已回收' }))
    expect(onResolve).toHaveBeenCalledWith('seed-2')

    fireEvent.click(screen.getByRole('button', { name: '到期' }))
    expect(screen.getByText('门口的旧钥匙')).toBeInTheDocument()
    expect(screen.queryByText('失踪的信件')).not.toBeInTheDocument()
  })

  it('shows the empty state when the active filter has no alerts', () => {
    render(<ForeshadowPanel alerts={[]} onResolve={vi.fn()} />)

    expect(screen.getByText('暂无伏笔提醒')).toBeInTheDocument()
  })
})

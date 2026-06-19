import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { BrainstormPanel } from './BrainstormPanel'

const analyses = [
  {
    roleId: 'plot-architect',
    roleName: '剧情架构师',
    weightedScore: 82,
    findings: [
      {
        dimension: '结构',
        score: 88,
        issue: '中段张力不足',
        suggestion: '增加一次反转',
      },
    ],
  },
  {
    roleId: 'mystery-reader',
    roleName: '悬念读者',
    weightedScore: 48,
    findings: [
      {
        dimension: '悬念',
        score: 45,
        suggestion: '提前埋设误导信息',
      },
    ],
  },
  {
    roleId: 'reader-mentor',
    roleName: '读者导师',
    weightedScore: 55,
    findings: [
      {
        dimension: '节奏',
        score: 65,
        suggestion: '适当压缩铺垫段落',
      },
    ],
  },
]

describe('BrainstormPanel', () => {
  it('renders role cards with fallback icons and exposes detailed findings for the selected role', () => {
    const onApply = vi.fn()

    render(<BrainstormPanel analyses={analyses} onApply={onApply} />)

    expect(screen.getByText('多角色分析')).toBeInTheDocument()
    expect(screen.getByText('📐')).toBeInTheDocument()
    expect(screen.getAllByText('📝')).toHaveLength(2)
    expect(screen.getByText('82').className).toContain('text-green-400')
    expect(screen.getByText('48').className).toContain('text-red-400')
    expect(screen.queryByText('剧情架构师 详细发现')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /剧情架构师/ }))

    expect(screen.getByText('剧情架构师 详细发现')).toBeInTheDocument()
    expect(screen.getByText('⚠ 中段张力不足')).toBeInTheDocument()
    expect(screen.getByText('88/100').className).toContain('text-green-400')

    fireEvent.click(screen.getByRole('button', { name: '应用' }))

    expect(onApply).toHaveBeenCalledWith('plot-architect', '结构')
  })

  it('uses warning styling for mid-range role and finding scores', () => {
    render(<BrainstormPanel analyses={analyses} onApply={vi.fn()} />)

    expect(screen.getByText('55').className).toContain('text-yellow-400')

    fireEvent.click(screen.getByRole('button', { name: /读者导师/ }))

    expect(screen.getByText('65/100').className).toContain('text-yellow-400')
    expect(screen.getByText('💡 适当压缩铺垫段落')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /悬念读者/ }))

    expect(screen.getByText('45/100').className).toContain('text-red-400')
  })
})

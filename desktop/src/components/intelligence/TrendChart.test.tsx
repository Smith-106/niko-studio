import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrendChart } from './TrendChart'

const trendData = [
  {
    chapterLabel: '第一章',
    scores: {
      structure: 8,
      character: 6,
      suspense: 4,
      emotion: 5,
      dialogue: 7,
      webnovel: 6,
      show_tell: 3,
    },
  },
  {
    chapterLabel: '第二章',
    scores: {
      structure: 7,
      character: 8,
      suspense: 5,
      emotion: 6,
      dialogue: 8,
      webnovel: 7,
      show_tell: 4,
    },
  },
]

describe('TrendChart', () => {
  it('renders the empty state when no data exists', () => {
    render(<TrendChart data={[]} />)

    expect(screen.getByText('暂无跨章节数据，请分析多个章节后查看趋势')).toBeInTheDocument()
  })

  it('renders chapter labels, toggles dimensions, and shows hover details', () => {
    const { container } = render(<TrendChart data={trendData} />)

    expect(screen.getByText('第一章')).toBeInTheDocument()
    expect(screen.getByText('第二章')).toBeInTheDocument()
    expect(screen.getByLabelText('结构')).toBeChecked()

    fireEvent.click(screen.getByLabelText('结构'))
    expect(screen.getByLabelText('结构')).not.toBeChecked()
    fireEvent.click(screen.getByLabelText('结构'))
    expect(screen.getByLabelText('结构')).toBeChecked()

    const circles = container.querySelectorAll('circle.cursor-pointer')
    expect(circles.length).toBeGreaterThan(0)

    fireEvent.mouseEnter(circles[2] as SVGCircleElement)
    expect(screen.getByText('角色: 6')).toBeInTheDocument()

    fireEvent.mouseLeave(circles[2] as SVGCircleElement)
    expect(screen.queryByText('角色: 6')).not.toBeInTheDocument()
  })

  it('supports single-point charts and falls back to zero for missing scores', () => {
    const { container } = render(<TrendChart data={[{ chapterLabel: '终章', scores: { structure: 9 } }]} />)

    expect(screen.getByText('终章')).toBeInTheDocument()

    const circles = container.querySelectorAll('circle.cursor-pointer')
    expect(circles.length).toBeGreaterThan(1)

    fireEvent.mouseEnter(circles[1] as SVGCircleElement)
    expect(screen.getByText('角色: 0')).toBeInTheDocument()

    fireEvent.mouseLeave(circles[1] as SVGCircleElement)
    expect(screen.queryByText('角色: 0')).not.toBeInTheDocument()
  })
})

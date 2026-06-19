import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DimensionResult } from '../../api/writing-craft'
import { InlineAnnotation } from './InlineAnnotation'

const dimensions: DimensionResult[] = [
  {
    dimension: 'structure',
    label: '结构',
    score: 6,
    maxScore: 10,
    evidence: ['转折：主人公在雨夜离开'],
    suggestions: [],
    details: {},
  },
]

describe('InlineAnnotation', () => {
  it('shows the empty state when no annotations can be found', () => {
    render(<InlineAnnotation text="这里没有任何可匹配的关键词。" dimensions={dimensions} />)

    expect(screen.getByText('未检测到可标注的问题位置')).toBeInTheDocument()
  })

  it('renders annotations and toggles their detail bubble', () => {
    render(
      <InlineAnnotation
        text="第一幕的转折发生在主人公于雨夜离开之后。"
        dimensions={dimensions}
      />,
    )

    const annotation = screen.getByText('转折')
    expect(screen.getByText('共 1 处标注，点击查看详情')).toBeInTheDocument()

    fireEvent.click(annotation)
    expect(screen.getByText('[结构] 转折：主人公在雨夜离开')).toBeInTheDocument()

    fireEvent.click(annotation)
    expect(screen.queryByText('[结构] 转折：主人公在雨夜离开')).not.toBeInTheDocument()
  })
})

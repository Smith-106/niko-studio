import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CardList } from './CardList'

describe('CardList', () => {
  it('renders the empty text when there are no items', () => {
    render(<CardList items={[]} emptyText="暂无记录" />)

    expect(screen.getByText('暂无记录')).toBeInTheDocument()
  })

  it('renders item labels with fallbacks and optional descriptions', () => {
    render(
      <CardList
        emptyText="unused"
        items={[
          { id: 'item-1', name: '角色条目', description: '角色描述' },
          { id: 'item-2', title: '世界规则', content: '规则内容' },
          { id: 'item-3' },
          { content: '匿名内容' },
        ]}
      />,
    )

    expect(screen.getByText('角色条目')).toBeInTheDocument()
    expect(screen.getByText('角色描述')).toBeInTheDocument()
    expect(screen.getByText('世界规则')).toBeInTheDocument()
    expect(screen.getByText('规则内容')).toBeInTheDocument()
    expect(screen.getByText('item-3')).toBeInTheDocument()
    expect(screen.getByText('条目 4')).toBeInTheDocument()
    expect(screen.getByText('匿名内容')).toBeInTheDocument()
  })
})

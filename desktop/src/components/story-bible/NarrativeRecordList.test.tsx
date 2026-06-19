import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NarrativeRecordList } from './NarrativeRecordList'

describe('NarrativeRecordList', () => {
  it('renders the empty text when there are no narrative records', () => {
    render(
      <NarrativeRecordList
        items={[]}
        emptyText="暂无叙事记录"
        activeRecordId={null}
        activeLabel="当前激活"
        activateLabel="设为激活"
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    )

    expect(screen.getByText('暂无叙事记录')).toBeInTheDocument()
  })

  it('renders title and summary fallbacks, exposes record ids, and wires select/activate actions', () => {
    const onSelect = vi.fn()
    const onActivate = vi.fn()
    const items = [
      {
        id: 42,
        name: '命名记录',
        summary: '摘要优先',
      },
      {
        id: 'title-record',
        title: '仅标题记录',
        description: '描述回退',
      },
      {
        id: 'content-record',
        content: '内容回退',
      },
      {
        extra: 'fallback only',
      },
    ] as never[]

    render(
      <NarrativeRecordList
        items={items as never}
        emptyText="unused"
        activeRecordId="42"
        activeLabel="当前激活"
        activateLabel="设为激活"
        onSelect={onSelect}
        onActivate={onActivate}
      />,
    )

    const namedRecordButton = screen.getByRole('button', { name: /命名记录\s+摘要优先\s+42/ })
    expect(namedRecordButton).toBeInTheDocument()
    expect(screen.getByText('摘要优先')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()

    expect(screen.getByText('仅标题记录')).toBeInTheDocument()
    expect(screen.getByText('描述回退')).toBeInTheDocument()

    expect(screen.getAllByText('content-record')).toHaveLength(2)
    expect(screen.getByText('内容回退')).toBeInTheDocument()

    expect(screen.getByText('Item 4')).toBeInTheDocument()
    expect(screen.queryByText('fallback only')).not.toBeInTheDocument()

    const activeButton = screen.getByRole('button', { name: '当前激活' })
    expect(activeButton).toBeDisabled()

    fireEvent.click(namedRecordButton)
    fireEvent.click(screen.getAllByRole('button', { name: '设为激活' })[0]!)

    expect(onSelect).toHaveBeenCalledWith(items[0])
    expect(onActivate).toHaveBeenCalledWith(items[1])
  })
})

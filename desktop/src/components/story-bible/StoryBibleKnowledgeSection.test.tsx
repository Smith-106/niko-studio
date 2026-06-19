import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StoryBibleKnowledgeSection } from './StoryBibleKnowledgeSection'

describe('StoryBibleKnowledgeSection', () => {
  it('renders the loading copy while data is loading', () => {
    render(
      <StoryBibleKnowledgeSection
        items={[]}
        loading
        loadingText="正在加载知识图谱"
        emptyText="暂无条目"
      />,
    )

    expect(screen.getByText('正在加载知识图谱')).toBeInTheDocument()
  })

  it('delegates to CardList when loading is complete', () => {
    render(
      <StoryBibleKnowledgeSection
        items={[{ id: 'fact-1', name: '核心设定', description: '设定说明' }]}
        loading={false}
        loadingText="unused"
        emptyText="暂无条目"
      />,
    )

    expect(screen.getByText('核心设定')).toBeInTheDocument()
    expect(screen.getByText('设定说明')).toBeInTheDocument()
  })
})

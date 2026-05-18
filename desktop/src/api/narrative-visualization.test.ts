import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.fn()

vi.mock('./core', () => ({
  callApi: (...args: unknown[]) => callApiMock(...args),
}))

vi.mock('./workspace', async () => {
  const actual = await vi.importActual<typeof import('./workspace')>('./workspace')
  return {
    ...actual,
  }
})

import { getNarrativeVisualization } from './narrative-visualization'

describe('getNarrativeVisualization', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: { success: true, data: { meta: { hasData: false } } } })
  })

  it('posts chapters to the narrative visualization endpoint', async () => {
    await getNarrativeVisualization({
      chapters: [
        { content: 'chapter one', chapterIndex: 0, chapterNumber: 1, title: 'Opening' },
      ],
      relationshipRoot: 'Alice',
    })

    expect(callApiMock).toHaveBeenCalledWith(
      '/analysis/narrative-visualization',
      'POST',
      {
        chapters: [
          { content: 'chapter one', chapterIndex: 0, chapterNumber: 1, title: 'Opening' },
        ],
        chapterMeta: undefined,
        relationshipRoot: 'Alice',
      },
    )
  })
})

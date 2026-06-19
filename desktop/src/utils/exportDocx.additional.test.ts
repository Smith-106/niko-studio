import { describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'

vi.mock('../stores/appStore', () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      getChaptersForProject: vi.fn(() => []),
      volumesByProjectId: {},
    })),
  },
}))

vi.mock('../services/projectFileService', () => ({
  readChapterContent: vi.fn(() => Promise.resolve(null)),
}))

import { generateDocx, generateProjectDocx } from './exportDocx'

describe('exportDocx additional coverage', () => {
  it('recurses through unknown wrapper nodes and ignores unknown leaf nodes', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'unknownContainer',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nested paragraph' }] }],
        },
        {
          type: 'unknownLeaf',
        },
      ],
    }

    const blob = await generateDocx(json, 'Unknown Nodes')

    expect(blob).toBeInstanceOf(Blob)
  })

  it('covers sparse node payloads and default branches', async () => {
    const json = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading' },
        { type: 'heading', attrs: { level: 99 }, content: [{ type: 'text', text: 'Fallback heading' }] },
        { type: 'bulletList' },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem' },
            { type: 'listItem', content: [{ type: 'paragraph' }] },
          ],
        },
        { type: 'orderedList' },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem' },
            { type: 'listItem', content: [{ type: 'paragraph' }] },
          ],
        },
        { type: 'blockquote' },
        { type: 'blockquote', content: [{ type: 'paragraph' }] },
        { type: 'codeBlock' },
        { type: 'codeBlock', content: [{ type: 'text' }] },
        {
          type: 'callout',
          attrs: { variant: 'mystery' },
        },
        {
          type: 'callout',
          content: [{ type: 'paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text' }],
        },
      ],
    } as JSONContent

    const blob = await generateDocx(json, 'Sparse Nodes')

    expect(blob).toBeInstanceOf(Blob)
  })

  it('allows exporting tables even when a row omits explicit cells', async () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
            },
          ],
        },
      ],
    } as JSONContent

    await expect(generateDocx(json, 'Sparse Table')).resolves.toBeInstanceOf(Blob)
  })

  it('allows exporting tables without any rows', async () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'table',
        },
      ],
    } as JSONContent

    await expect(generateDocx(json, 'Table Without Rows')).resolves.toBeInstanceOf(Blob)
  })

  it('allows exporting tables when a cell omits nested content', async () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                },
              ],
            },
          ],
        },
      ],
    } as JSONContent

    await expect(generateDocx(json, 'Table Cell Without Content')).resolves.toBeInstanceOf(Blob)
  })

  it('handles top-level documents and nodes without required shape', async () => {
    await expect(generateDocx({ type: 'doc' } as JSONContent, 'Doc Without Content')).resolves.toBeInstanceOf(Blob)
    await expect(generateDocx({} as JSONContent, 'Missing Type')).resolves.toBeInstanceOf(Blob)
  })

  it('skips empty volumes when exporting projects', async () => {
    const { useAppStore } = await import('../stores/appStore')
    const { readChapterContent } = await import('../services/projectFileService')

    vi.mocked(useAppStore.getState).mockReturnValue({
      getChaptersForProject: vi.fn(() => [
        { id: 'ch-1', volumeId: 'vol-2', title: 'Chapter 1' },
      ]),
      volumesByProjectId: {
        'proj-2': [
          { id: 'vol-1', title: 'Empty volume' },
          { id: 'vol-2', title: 'Filled volume' },
        ],
      },
    } as never)
    vi.mocked(readChapterContent).mockResolvedValueOnce(null)

    const blob = await generateProjectDocx('proj-2', 'Sparse Project')

    expect(blob).toBeInstanceOf(Blob)
  })
})

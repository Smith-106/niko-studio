import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'

const downloadBlobMock = vi.hoisted(() => vi.fn())
const blobRegistry: Array<{ parts: string[]; type: string }> = []

vi.mock('./download', () => ({
  downloadBlob: (...args: Parameters<typeof downloadBlobMock>) =>
    downloadBlobMock(...args),
}))

import { downloadFile, exportToHtml, exportToMarkdown } from './export'

async function readDownloadedBlob(callIndex = 0) {
  const [blob, filename] = downloadBlobMock.mock.calls[callIndex] as [
    { type?: string; __mockBlobIndex?: number },
    string,
  ]
  const record = blobRegistry[blob.__mockBlobIndex ?? -1]
  return {
    filename,
    type: blob.type ?? '',
    text: record?.parts.join('') ?? '',
  }
}

describe('export additional coverage', () => {
  beforeEach(() => {
    downloadBlobMock.mockReset()
    blobRegistry.length = 0
    vi.stubGlobal(
      'Blob',
      class MockBlob {
        type: string
        __mockBlobIndex: number

        constructor(parts: unknown[], options?: { type?: string }) {
          this.type = options?.type ?? ''
          this.__mockBlobIndex = blobRegistry.push({
            parts: parts.map((part) =>
              typeof part === 'string' ? part : String(part),
            ),
            type: this.type,
          }) - 1
        }
      } as unknown as typeof Blob,
    )
  })

  it('covers markdown fallback branches for empty and rootless nodes', async () => {
    exportToMarkdown(null as unknown as JSONContent, 'empty-root')

    let result = await readDownloadedBlob()
    expect(result.filename).toBe('empty-root.md')
    expect(result.text).toBe('')

    const markdownFallbackDoc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading', content: [{ type: 'text' }] },
        { type: 'bulletList', content: [{ type: 'listItem' }] },
        { type: 'orderedList', content: [{ type: 'listItem' }] },
        { type: 'blockquote' },
        { type: 'codeBlock' },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableHeader' }, { type: 'tableCell' }],
            },
          ],
        },
        { type: 'tableRow' },
        { type: 'tableCell', content: [{ type: 'text' }] },
        { type: 'tableHeader', content: [{ type: 'text' }] },
        { type: 'mathInline' },
        { type: 'mathBlock' },
        { type: 'callout' },
        {
          type: 'customNode',
          content: [{ type: 'text', text: 'fallback child' }],
        } as JSONContent,
        { type: 'customNode' } as JSONContent,
      ],
    }

    exportToMarkdown(markdownFallbackDoc, 'fallbacks')
    result = await readDownloadedBlob(1)

    expect(result.filename).toBe('fallbacks.md')
    expect(result.text).toContain('# ')
    expect(result.text).toContain('- ')
    expect(result.text).toContain('1. ')
    expect(result.text).toContain('```\n\n```')
    expect(result.text).toContain('|  |  |')
    expect(result.text).toContain('| --- | --- |')
    expect(result.text).toContain('$undefined$')
    expect(result.text).toContain('$$\nundefined\n$$')
    expect(result.text).toContain('> [!INFO]')
  })

  it('covers html fallback branches for empty nodes, default variants, and raw cell rendering', async () => {
    exportToHtml(null as unknown as JSONContent, 'empty-root')

    let result = await readDownloadedBlob()
    expect(result.filename).toBe('empty-root.html')
    expect(result.text).toContain('<body>')
    expect(result.text).toContain('</body>')

    const htmlFallbackDoc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'heading' },
        { type: 'text' },
        { type: 'bulletList' },
        { type: 'orderedList' },
        { type: 'listItem' },
        { type: 'blockquote' },
        { type: 'codeBlock' },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableHeader' }, { type: 'tableCell' }],
            },
          ],
        },
        { type: 'tableRow' },
        { type: 'tableCell' },
        { type: 'tableHeader' },
        { type: 'mathInline' },
        { type: 'mathBlock' },
        { type: 'callout' },
        {
          type: 'customNode',
          content: [{ type: 'text', text: 'fallback child' }],
        } as JSONContent,
        { type: 'customNode' } as JSONContent,
      ],
    }

    exportToHtml(htmlFallbackDoc, 'fallbacks')
    result = await readDownloadedBlob(1)

    expect(result.filename).toBe('fallbacks.html')
    expect(result.text).toContain('<p><br></p>')
    expect(result.text).toContain('<h1></h1>')
    expect(result.text).toContain('<ul>\n\n</ul>')
    expect(result.text).toContain('<ol>\n\n</ol>')
    expect(result.text).toContain('<li></li>')
    expect(result.text).toContain('<blockquote>\n\n</blockquote>')
    expect(result.text).toContain('<pre><code></code></pre>')
    expect(result.text).toContain('<table><tr><th></th><td></td></tr></table>')
    expect(result.text).toContain('<tr></tr>')
    expect(result.text).toContain('<td></td>')
    expect(result.text).toContain('<th></th>')
    expect(result.text).toContain('class="math-inline" data-latex=""')
    expect(result.text).toContain('class="math-block" data-latex=""')
    expect(result.text).toContain('<div class="callout" data-variant="info"></div>')
    expect(result.text).toContain('fallback child')
  })

  it('covers direct downloadFile branches for default mime types and Blob passthrough', async () => {
    downloadFile('plain text', 'plain.txt')
    let result = await readDownloadedBlob()
    expect(result.filename).toBe('plain.txt')
    expect(result.type).toBe('text/plain;charset=utf-8')
    expect(result.text).toBe('plain text')

    const blob = new Blob(['payload'], {
      type: 'application/custom',
    })
    downloadFile(blob, 'payload.bin')
    const [passedBlob, passedFilename] = downloadBlobMock.mock.calls[1] as [
      Blob,
      string,
    ]
    expect(passedBlob).toBe(blob)
    expect(passedFilename).toBe('payload.bin')
  })
})

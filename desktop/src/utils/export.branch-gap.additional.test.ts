import { describe, expect, it, vi } from 'vitest'

import type { JSONContent } from '@tiptap/react'

const downloadBlobMock = vi.hoisted(() => vi.fn())
const blobRegistry: Array<{ parts: string[]; type: string }> = []

vi.mock('./download', () => ({
  downloadBlob: (...args: Parameters<typeof downloadBlobMock>) =>
    downloadBlobMock(...args),
}))

import { downloadFile, exportToHtml, exportToMarkdown, exportToPdf } from './export'

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

describe('export branch-gap additional coverage', () => {
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

  it('covers markdown codeBlock with language attribute (line 59)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [{ type: 'text', text: 'const x = 1' }],
        },
      ],
    }

    exportToMarkdown(doc, 'codeblock-lang')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('```typescript\nconst x = 1\n```')
  })

  it('covers markdown table with non-header first row (line 74 false branch)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'text', text: 'A' }] },
                { type: 'tableCell', content: [{ type: 'text', text: 'B' }] },
              ],
            },
          ],
        },
      ],
    }

    exportToMarkdown(doc, 'table-no-header')
    const result = await readDownloadedBlob()
    // No separator row since first row has tableCell, not tableHeader
    expect(result.text).toContain('| A | B |')
    expect(result.text).not.toContain('| --- |')
  })

  it('covers markdown tableHeader/tableCell direct rendering (lines 86-89)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'tableHeader', content: [{ type: 'text', text: 'H' }] },
        { type: 'tableCell', content: [{ type: 'text', text: 'C' }] },
      ],
    }

    exportToMarkdown(doc, 'direct-cells')
    const result = await readDownloadedBlob()
    // Direct tableHeader/tableCell rendering joins their content
    expect(result.text).toContain('H')
    expect(result.text).toContain('C')
  })

  it('covers markdown callout with non-default variant (line 98)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { variant: 'warning' },
          content: [{ type: 'text', text: 'Be careful' }],
        },
      ],
    }

    exportToMarkdown(doc, 'callout-variant')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('> [!WARNING]')
    expect(result.text).toContain('Be careful')
  })

  it('covers markdown default node without content (line 106 false branch)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'unknownNode' } as JSONContent,
      ],
    }

    exportToMarkdown(doc, 'no-content')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('')
  })

  it('covers html codeBlock with text children (line 166)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          content: [{ type: 'text', text: '<script>alert(1)</script>' }],
        },
      ],
    }

    exportToHtml(doc, 'html-codeblock')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>')
  })

  it('covers html callout with different variants (lines 193-196)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          attrs: { variant: 'important' },
          content: [{ type: 'text', text: 'Critical note' }],
        },
      ],
    }

    exportToHtml(doc, 'html-callout')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('data-variant="important"')
    expect(result.text).toContain('Critical note')
  })

  it('covers html default node without content (line 202 false branch)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'emptyNode' } as JSONContent,
      ],
    }

    exportToHtml(doc, 'html-no-content')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('<body>')
    expect(result.text).toContain('</body>')
  })

  it('covers downloadFile with default mime type when mimeType is omitted', async () => {
    downloadFile('test content', 'test.txt')
    const result = await readDownloadedBlob()
    expect(result.type).toBe('text/plain;charset=utf-8')
    expect(result.text).toBe('test content')
  })

  it('covers exportToMarkdown and exportToHtml with custom filename', async () => {
    exportToMarkdown({ type: 'doc', content: [{ type: 'text', text: 'hi' }] }, 'custom')
    let result = await readDownloadedBlob()
    expect(result.filename).toBe('custom.md')

    exportToHtml({ type: 'doc', content: [{ type: 'text', text: 'hi' }] }, 'custom')
    result = await readDownloadedBlob(1)
    expect(result.filename).toBe('custom.html')
  })

  it('covers exportToMarkdown and exportToHtml with default filename', async () => {
    exportToMarkdown({ type: 'doc', content: [] })
    let result = await readDownloadedBlob()
    expect(result.filename).toBe('document.md')

    exportToHtml({ type: 'doc', content: [] })
    result = await readDownloadedBlob(1)
    expect(result.filename).toBe('document.html')
  })

  it('covers markdown hardBreak node (line 66)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'line1' }] },
        { type: 'hardBreak' },
        { type: 'paragraph', content: [{ type: 'text', text: 'line2' }] },
      ],
    }

    exportToMarkdown(doc, 'hardbreak')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('  \n')
  })

  it('covers markdown horizontalRule node (line 63)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
      ],
    }

    exportToMarkdown(doc, 'hr')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('---')
  })

  it('covers html horizontalRule and hardBreak (lines 169-173)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
        { type: 'hardBreak' },
      ],
    }

    exportToHtml(doc, 'html-hr-br')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('<hr />')
    expect(result.text).toContain('<br />')
  })

  it('covers markdown text with underline mark (line 37)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'underlined',
          marks: [{ type: 'underline' }],
        },
      ],
    }

    exportToMarkdown(doc, 'underline')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('<u>underlined</u>')
  })

  it('covers markdown text with strike mark (line 38)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'struck',
          marks: [{ type: 'strike' }],
        },
      ],
    }

    exportToMarkdown(doc, 'strike')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('~~struck~~')
  })

  it('covers markdown text with code mark (line 39)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'code',
          marks: [{ type: 'code' }],
        },
      ],
    }

    exportToMarkdown(doc, 'code-mark')
    const result = await readDownloadedBlob()
    expect(result.text).toBe('`code`')
  })

  it('covers html text with multiple marks stacked (line 140-145)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'hello',
          marks: [{ type: 'bold' }, { type: 'italic' }],
        },
      ],
    }

    exportToHtml(doc, 'multi-mark')
    const result = await readDownloadedBlob()
    // Marks are applied in iteration order: italic wraps bold
    expect(result.text).toContain('<em><strong>hello</strong></em>')
  })

  it('covers html text with underline and strike marks (lines 142-143)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'text',
          marks: [{ type: 'underline' }],
        },
        {
          type: 'text',
          text: 'gone',
          marks: [{ type: 'strike' }],
        },
      ],
    }

    exportToHtml(doc, 'ul-del')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('<u>text</u>')
    expect(result.text).toContain('<del>gone</del>')
  })

  it('covers html code mark (line 144)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'text',
          text: 'fn()',
          marks: [{ type: 'code' }],
        },
      ],
    }

    exportToHtml(doc, 'code-html')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('<code>fn()</code>')
  })

  it('covers markdown table with separator row from tableHeader (line 74 true branch)', async () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'text', text: 'Name' }] },
                { type: 'tableHeader', content: [{ type: 'text', text: 'Value' }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'text', text: 'X' }] },
                { type: 'tableCell', content: [{ type: 'text', text: '1' }] },
              ],
            },
          ],
        },
      ],
    }

    exportToMarkdown(doc, 'table-with-header')
    const result = await readDownloadedBlob()
    expect(result.text).toContain('| Name | Value |')
    expect(result.text).toContain('| --- | --- |')
    expect(result.text).toContain('| X | 1 |')
  })

  it('covers exportToPdf call (line 240)', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    exportToPdf()
    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })
})

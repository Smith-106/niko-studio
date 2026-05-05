import { describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/react'

vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

import { exportToMarkdown, exportToHtml, exportToPdf } from './export'

function captureDownload() {
  const calls: Array<{ content: string; filename: string; mimeType: string }> = []
  const spy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    const a = node as HTMLAnchorElement
    calls.push({ content: '', filename: a.download, mimeType: '' })
    return node
  })
  return { calls, spy }
}

describe('edge cases', () => {
  it('handles empty doc content', () => {
    const { spy } = captureDownload()
    exportToMarkdown({ type: 'doc', content: [] })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('handles undefined content gracefully', () => {
    const { spy } = captureDownload()
    exportToMarkdown({ type: 'doc' })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports hardBreak as two trailing spaces + newline in markdown', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'line1' }] },
        { type: 'hardBreak' },
        { type: 'paragraph', content: [{ type: 'text', text: 'line2' }] },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports horizontalRule as --- in markdown', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'above' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'below' }] },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports underline mark as <u> in markdown', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'underline' }], text: 'underlined' }],
        },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports unknown node types with content fallback', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'customNode', content: [{ type: 'text', text: 'fallback' }] } as JSONContent,
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('nodeToHtml — comprehensive', () => {
  it('exports headings with correct tags', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Heading' }] },
      ],
    }
    exportToHtml(json)
    expect(spy.mock.calls[0][0]).toHaveProperty('download', 'document.html')
    spy.mockRestore()
  })

  it('exports blockquotes in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quote' }] }] },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports code blocks in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'console.log(1)' }] },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports bold/italic/strike/underline/code marks in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'b' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'i' },
            { type: 'text', marks: [{ type: 'strike' }], text: 's' },
            { type: 'text', marks: [{ type: 'underline' }], text: 'u' },
            { type: 'text', marks: [{ type: 'code' }], text: 'c' },
          ],
        },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('escapes HTML entities in text nodes', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert("xss")</script>' }] },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports horizontalRule as <hr /> in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'horizontalRule' },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports hardBreak as <br /> in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
        { type: 'hardBreak' },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports ordered lists in HTML', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }] },
          ],
        },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

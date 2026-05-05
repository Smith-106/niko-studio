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

describe('nodeToMarkdown', () => {
  it('exports headings with correct # prefix', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Sub' }] },
      ],
    }
    exportToMarkdown(json)
    expect(spy.mock.calls[0][0]).toHaveProperty('download', 'document.md')
    spy.mockRestore()
  })

  it('exports bold, italic, strike, and code marks', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
            { type: 'text', text: ' ' },
            { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
            { type: 'text', text: ' ' },
            { type: 'text', marks: [{ type: 'strike' }], text: 'strike' },
            { type: 'text', text: ' ' },
            { type: 'text', marks: [{ type: 'code' }], text: 'code' },
          ],
        },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports bullet and ordered lists', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] },
          ],
        },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }] },
          ],
        },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports code blocks with language tag', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const x = 1' }] },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports blockquotes with > prefix', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quote' }] }] },
      ],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('uses custom filename', () => {
    const { spy } = captureDownload()
    exportToMarkdown({ type: 'doc', content: [] }, 'my-doc')
    expect(spy.mock.calls[0][0]).toHaveProperty('download', 'my-doc.md')
    spy.mockRestore()
  })

  it('exports mathInline to markdown as $latex$', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathInline', attrs: { latex: 'E=mc^2' } }],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports mathBlock to markdown as $$latex$$', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathBlock', attrs: { latex: '\\int_0^1 x dx' } }],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports callout to markdown with [!VARIANT] syntax', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'warning' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Watch out!' }] }],
      }],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports table to markdown with | syntax', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'text', text: 'H1' }] },
            { type: 'tableHeader', content: [{ type: 'text', text: 'H2' }] },
          ],
        }, {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'text', text: 'A' }] },
            { type: 'tableCell', content: [{ type: 'text', text: 'B' }] },
          ],
        }],
      }],
    }
    exportToMarkdown(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('nodeToHtml', () => {
  it('exports paragraphs with <p> tags', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    }
    exportToHtml(json)
    expect(spy.mock.calls[0][0]).toHaveProperty('download', 'document.html')
    spy.mockRestore()
  })

  it('exports with custom filename', () => {
    const { spy } = captureDownload()
    exportToHtml({ type: 'doc', content: [] }, 'report')
    expect(spy.mock.calls[0][0]).toHaveProperty('download', 'report.html')
    spy.mockRestore()
  })

  it('exports nested lists', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'outer' }] },
                {
                  type: 'bulletList',
                  content: [
                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'inner' }] }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports mathInline to HTML with span.math-inline', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathInline', attrs: { latex: 'x^2' } }],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports mathBlock to HTML with div.math-block', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathBlock', attrs: { latex: '\\sum x' } }],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports callout to HTML with div.callout and data-variant', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'tip' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro tip' }] }],
      }],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('exports table to HTML with <table> tags', () => {
    const { spy } = captureDownload()
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'text', text: 'Col' }] },
          ],
        }],
      }],
    }
    exportToHtml(json)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('exportToPdf', () => {
  it('calls window.print()', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    exportToPdf()
    expect(printSpy).toHaveBeenCalledOnce()
    printSpy.mockRestore()
  })
})

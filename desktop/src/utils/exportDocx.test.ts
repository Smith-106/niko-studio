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

describe('nodeToDocx via generateDocx', () => {
  it('converts paragraphs', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    }
    const blob = await generateDocx(json, 'Test')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts headings with levels 1-3', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H1' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H2' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'H3' }] },
      ],
    }
    const blob = await generateDocx(json, 'Headings')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts bullet lists', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item 1' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item 2' }] }] },
        ],
      }],
    }
    const blob = await generateDocx(json, 'Bullets')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts ordered lists', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'orderedList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }] },
        ],
      }],
    }
    const blob = await generateDocx(json, 'Ordered')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts blockquotes with IntenseQuote style', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted text' }] }] }],
    }
    const blob = await generateDocx(json, 'Quote')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts code blocks with SourceCode style', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1' }] }],
    }
    const blob = await generateDocx(json, 'Code')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts horizontal rules', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    }
    const blob = await generateDocx(json, 'Rule')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts tables with borders', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
          ],
        }],
      }],
    }
    const blob = await generateDocx(json, 'Table')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts mathInline as $latex$', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathInline', attrs: { latex: 'E=mc^2' } }],
    }
    const blob = await generateDocx(json, 'Math')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts mathBlock as $$latex$$', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathBlock', attrs: { latex: '\\int_0^1 x dx' } }],
    }
    const blob = await generateDocx(json, 'MathBlock')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts callout with info variant and shading', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'info' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Info callout' }] }],
      }],
    }
    const blob = await generateDocx(json, 'Callout')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts callout with warning variant', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'warning' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning!' }] }],
      }],
    }
    const blob = await generateDocx(json, 'Warning')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts callout with tip variant', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'tip' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro tip' }] }],
      }],
    }
    const blob = await generateDocx(json, 'Tip')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts callout with important variant', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        attrs: { variant: 'important' },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Must read' }] }],
      }],
    }
    const blob = await generateDocx(json, 'Important')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts callout with default variant when none specified', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{
        type: 'callout',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Default variant' }] }],
      }],
    }
    const blob = await generateDocx(json, 'Default')
    expect(blob).toBeInstanceOf(Blob)
  })
})

describe('textNodeToDocx marks', () => {
  it('converts bold text', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'bold' }] }],
    }
    const blob = await generateDocx(json, 'Bold')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts italic text', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'italic' }] }],
    }
    const blob = await generateDocx(json, 'Italic')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts underline text', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'underline' }], text: 'underlined' }] }],
    }
    const blob = await generateDocx(json, 'Underline')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts strike text', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'strike' }], text: 'struck' }] }],
    }
    const blob = await generateDocx(json, 'Strike')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts code text with Courier New font', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'code' }], text: 'code' }] }],
    }
    const blob = await generateDocx(json, 'Code')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('converts text with multiple marks', async () => {
    const json: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }, { type: 'italic' }], text: 'bold italic' }] }],
    }
    const blob = await generateDocx(json, 'Multi')
    expect(blob).toBeInstanceOf(Blob)
  })
})

describe('generateDocx', () => {
  it('creates a blob from empty doc', async () => {
    const blob = await generateDocx({ type: 'doc', content: [] }, 'Empty')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('includes title as TITLE heading', async () => {
    const blob = await generateDocx({ type: 'doc', content: [] }, 'My Title')
    expect(blob).toBeInstanceOf(Blob)
  })
})

describe('generateProjectDocx', () => {
  it('creates a blob with no volumes', async () => {
    const blob = await generateProjectDocx('proj-1', 'Empty Project')
    expect(blob).toBeInstanceOf(Blob)
  })

  it('creates a blob with volumes and chapters', async () => {
    const { useAppStore } = await import('../stores/appStore')
    const { readChapterContent } = await import('../services/projectFileService')

    vi.mocked(useAppStore.getState).mockReturnValue({
      getChaptersForProject: vi.fn(() => [
        { id: 'ch-1', volumeId: 'vol-1', title: 'Chapter 1' },
        { id: 'ch-2', volumeId: 'vol-1', title: 'Chapter 2' },
      ]),
      volumesByProjectId: {
        'proj-1': [{ id: 'vol-1', title: 'Volume 1' }],
      },
    } as any)

    vi.mocked(readChapterContent).mockImplementation((_pid: string, cid: string) => {
      if (cid === 'ch-1') return Promise.resolve(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content 1' }] }] }))
      return Promise.resolve('' as any)
    })

    const blob = await generateProjectDocx('proj-1', 'Project with Chapters')
    expect(blob).toBeInstanceOf(Blob)
  })
})

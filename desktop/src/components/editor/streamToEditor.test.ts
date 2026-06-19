import type { Editor } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { insertPlainText, replaceRange, streamTextIntoEditor } from './streamToEditor'

interface PlainTextContent {
  type: 'text'
  text: string
}

type InsertPayload = string | PlainTextContent

class BaseFakeEditor {
  protected content: string
  private insertPayloads: InsertPayload[] = []

  public state: {
    selection: { from: number; to: number }
    doc: { textBetween: (from: number, to: number) => string }
  }

  constructor(initialContent: string) {
    this.content = initialContent
    this.state = {
      selection: { from: 0, to: 0 },
      doc: {
        textBetween: (from: number, to: number) => this.content.slice(from, to),
      },
    }
  }

  setSelection(from: number, to = from): void {
    this.state.selection = { from, to }
  }

  getText(): string {
    return this.content
  }

  getInsertPayloads(): InsertPayload[] {
    return [...this.insertPayloads]
  }

  chain(): FakeEditorChain {
    return new FakeEditorChain(this)
  }

  applyInsert(payload: InsertPayload): void {
    this.insertPayloads.push(payload)
    const text = typeof payload === 'string' ? payload : payload.text
    const { from, to } = this.state.selection
    this.content = `${this.content.slice(0, from)}${text}${this.content.slice(to)}`
    const cursor = from + text.length
    this.state.selection = { from: cursor, to: cursor }
  }

  applySetSelection(from: number, to: number): void {
    this.state.selection = { from, to }
  }
}

class RichFakeEditor extends BaseFakeEditor {
  public extensionManager = {}
}

class StringOnlyFakeEditor extends BaseFakeEditor {}

class FakeEditorChain {
  private operations: Array<() => void> = []

  constructor(private readonly editor: BaseFakeEditor) {}

  focus(): FakeEditorChain {
    return this
  }

  insertContent(payload: InsertPayload): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applyInsert(payload)
    })
    return this
  }

  setTextSelection(selection: { from: number; to: number }): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applySetSelection(selection.from, selection.to)
    })
    return this
  }

  run(): boolean {
    this.operations.forEach((operation) => operation())
    this.operations = []
    return true
  }
}

describe('streamToEditor', () => {
  it('ignores empty insertPlainText input and uses plain text nodes when extensionManager exists', () => {
    const editor = new RichFakeEditor('Seed')
    editor.setSelection('Seed'.length)

    insertPlainText(editor as unknown as Editor, '')
    insertPlainText(editor as unknown as Editor, '...')

    expect(editor.getText()).toBe('Seed...')
    expect(editor.getInsertPayloads()).toEqual([{ type: 'text', text: '...' }])
  })

  it('replaces ranges with string payloads and supports empty replacements', () => {
    const editor = new StringOnlyFakeEditor('Before target after')

    replaceRange(editor as unknown as Editor, 7, 'target'.length, 'rewrite')
    expect(editor.getText()).toBe('Before rewrite after')
    expect(editor.getInsertPayloads()).toContain('rewrite')

    replaceRange(editor as unknown as Editor, 7, 'rewrite'.length, '')
    expect(editor.getText()).toBe('Before  after')
  })

  it('treats empty streamed chunks as no-ops and keeps the running length stable', () => {
    const editor = new RichFakeEditor('Seed...')
    const streamer = streamTextIntoEditor(editor as unknown as Editor, 4, 3)

    streamer.append('')
    expect(editor.getText()).toBe('Seed...')

    streamer.append('fresh')

    expect(editor.getText()).toBe('Seed...fresh')
    expect(streamer.finish()).toBe(8)
  })
})

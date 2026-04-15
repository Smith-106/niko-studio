import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  streamWritingHelper: vi.fn(),
}))

import { streamWritingHelper } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from './useEditorAI'

class FakeEditor {
  private content: string

  public state: {
    selection: { from: number; to: number }
    doc: { textBetween: (from: number, to: number, blockSeparator?: string) => string }
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

  chain(): FakeEditorChain {
    return new FakeEditorChain(this)
  }

  applyInsert(text: string): void {
    const { from, to } = this.state.selection
    this.content = `${this.content.slice(0, from)}${text}${this.content.slice(to)}`
    const cursor = from + text.length
    this.state.selection = { from: cursor, to: cursor }
  }

  applyDeleteSelection(): void {
    const { from, to } = this.state.selection
    this.content = `${this.content.slice(0, from)}${this.content.slice(to)}`
    this.state.selection = { from, to: from }
  }

  applySetSelection(from: number, to: number): void {
    this.state.selection = { from, to }
  }
}

class FakeEditorChain {
  private operations: Array<() => void> = []

  constructor(private readonly editor: FakeEditor) {}

  focus(): FakeEditorChain {
    return this
  }

  insertContent(text: string): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applyInsert(text)
    })
    return this
  }

  deleteSelection(): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applyDeleteSelection()
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

function createEditorWithSelection(content: string, selectedText: string): FakeEditor {
  const from = content.indexOf(selectedText)
  if (from < 0) {
    throw new Error(`Missing selected text: ${selectedText}`)
  }

  const editor = new FakeEditor(content)
  editor.setSelection(from, from + selectedText.length)
  return editor
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

describe('useEditorAI rewrite recovery', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('restores the original selection on callback-only rewrite failure with no streamed content', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onError('stream failed')
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => 'Keep tone' }),
    )

    await act(async () => {
      await result.current.rewriteSelection('Rewrite the target')
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream failed')
    expect(result.current.isGenerating).toBe(false)
  })

  it('restores the original selection on rewrite cancel before any content arrives and keeps error state clear', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    const deferred = createDeferred<void>()

    mockStreamWritingHelper.mockImplementation(async (_payload, _callbacks, options) => {
      await deferred.promise
      if (options?.signal?.aborted) {
        return
      }
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => '' }),
    )

    let rewritePromise!: Promise<void>
    act(() => {
      rewritePromise = result.current.rewriteSelection('Rewrite the target')
    })

    act(() => {
      result.current.cancel()
    })

    deferred.resolve()

    await act(async () => {
      await rewritePromise
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })

  it('keeps partial streamed rewrite content when a callback-side error arrives late', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('draft', 0)
      callbacks.onError('stream failed')
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => 'Keep tone' }),
    )

    await act(async () => {
      await result.current.rewriteSelection('Rewrite the target')
    })

    expect(editor.getText()).toBe('Before ...draft after')
    expect(editor.getText()).not.toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream failed')
    expect(result.current.isGenerating).toBe(false)
  })

  it('builds the generate prompt with context and streams content at the cursor', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('generated', 0)
      callbacks.onContent(' ', 1)
      callbacks.onDone()
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => 'Keep tone' }),
    )

    await act(async () => {
      await result.current.generateAtCursor('Generate more')
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(mockStreamWritingHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Generate more\n\n上下文：\nBefore '),
        instruction: 'Keep tone',
      }),
      expect.any(Object),
      expect.any(Object),
    )
    expect(editor.getText()).toBe('Before ...generated after')
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })

  it('uses the continuation prompt and appends streamed content at the cursor', async () => {
    const editor = new FakeEditor('Story seed')
    editor.setSelection('Story seed'.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent(' continues', 0)
      callbacks.onDone()
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => '' }),
    )

    await act(async () => {
      await result.current.continueWriting()
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(mockStreamWritingHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('请续写以下内容，保持风格和语气一致：\n\nStory seed'),
        instruction: '',
      }),
      expect.any(Object),
      expect.any(Object),
    )
    expect(editor.getText()).toBe('Story seed... continues')
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })

  it('removes the loading placeholder for generate failures without altering surrounding content', async () => {
    const originalContent = 'Before after'
    const editor = new FakeEditor(originalContent)
    editor.setSelection('Before '.length)

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onError('stream failed')
    })

    const { result } = renderHook(() =>
      useEditorAI({ editor: editor as unknown as Editor, getStyleInstruction: () => '' }),
    )

    await act(async () => {
      await result.current.generateAtCursor('Generate more')
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream failed')
  })
})

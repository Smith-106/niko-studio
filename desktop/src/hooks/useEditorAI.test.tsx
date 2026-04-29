import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  streamWritingHelper: vi.fn(),
}))

import { streamWritingHelper } from '../api/client'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { buildEditorAIPayload, type BuildEditorAIPayloadOptions } from './editorAIPromptPolicy'
import { useEditorAI } from './useEditorAI'

interface PlainTextContent {
  type: 'text'
  text: string
}

type InsertPayload = string | PlainTextContent

class FakeEditor {
  private content: string
  private insertPayloads: InsertPayload[] = []
  public extensionManager = {}

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

  insertContent(payload: InsertPayload): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applyInsert(payload)
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

function renderEditorAI(
  editor: FakeEditor,
  language: 'zh' | 'en' = 'zh',
  getStyleRequirements: () => string | null = () => '',
) {
  return renderHook(() =>
    useEditorAI({
      editor: editor as unknown as Editor,
      language,
      getStyleRequirements,
    }),
  )
}

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

function expectLatestStreamPayload(options: BuildEditorAIPayloadOptions): void {
  const expectedPayload = buildEditorAIPayload(options)

  expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
  expect(mockStreamWritingHelper).toHaveBeenLastCalledWith(
    expect.objectContaining({
      content: expectedPayload.prompt,
      instruction: expectedPayload.styleInstruction,
    }),
    expect.any(Object),
    expect.any(Object),
  )
}

describe('useEditorAI', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge', 'dialogue-system'],
    }))
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('restores the original selection on callback-only rewrite failure with no streamed content', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onError('stream failed')
    })

    const { result } = renderEditorAI(editor, 'zh', () => 'Keep tone')

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
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

    const { result } = renderEditorAI(editor)

    let rewritePromise!: Promise<void>
    act(() => {
      rewritePromise = result.current.runRequest({ action: 'rewrite', variant: 'formal' })
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

  it('ignores overlapping requests from a different owner while a stream is active', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    const deferred = createDeferred<void>()

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks, options) => {
      await deferred.promise
      if (!options?.signal?.aborted) {
        callbacks.onDone()
      }
    })

    const { result } = renderEditorAI(editor)

    let firstRequest!: Promise<void>
    await act(async () => {
      firstRequest = result.current.runRequest(
        { action: 'generate' },
        { owner: 'slash', allowRestart: true },
      )
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)
    expect(editor.getText()).toBe('Before ...after')

    await act(async () => {
      await result.current.runRequest(
        { action: 'continue' },
        { owner: 'bubble', allowRestart: true },
      )
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('Before ...after')

    deferred.resolve()

    await act(async () => {
      await firstRequest
    })
  })

  it('restarts the active stream when the same owner reenters and ignores stale callbacks', async () => {
    const editor = new FakeEditor('Seed')
    editor.setSelection('Seed'.length)
    let firstSignal: AbortSignal | undefined

    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks, options) => {
        firstSignal = options?.signal
        await new Promise<void>((resolve) => {
          options?.signal?.addEventListener(
            'abort',
            () => {
              callbacks.onContent('stale', 0)
              callbacks.onDone()
              resolve()
            },
            { once: true },
          )
        })
      })
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onContent('fresh', 0)
        callbacks.onDone()
      })

    const { result } = renderEditorAI(editor)

    let firstRequest!: Promise<void>
    await act(async () => {
      firstRequest = result.current.runRequest(
        { action: 'generate' },
        { owner: 'slash', allowRestart: true },
      )
      await Promise.resolve()
      await result.current.runRequest(
        { action: 'continue' },
        { owner: 'slash', allowRestart: true },
      )
      await firstRequest
    })

    expect(firstSignal?.aborted).toBe(true)
    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(2)
    expect(editor.getText()).toBe('Seed...fresh')
    expect(editor.getText()).not.toContain('stale')
    expect(result.current.isGenerating).toBe(false)
  })

  it('cancels only when the active owner matches and releases the lock for the next owner', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    let activeSignal: AbortSignal | undefined

    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, _callbacks, options) => {
        activeSignal = options?.signal
        await new Promise<void>((resolve) => {
          options?.signal?.addEventListener('abort', () => resolve(), { once: true })
        })
      })
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onDone()
      })

    const { result } = renderEditorAI(editor)

    let firstRequest!: Promise<void>
    await act(async () => {
      firstRequest = result.current.runRequest(
        { action: 'generate' },
        { owner: 'bubble', allowRestart: true },
      )
      await Promise.resolve()
    })

    act(() => {
      result.current.cancel('slash')
    })

    expect(activeSignal?.aborted).toBe(false)

    await act(async () => {
      await result.current.runRequest(
        { action: 'continue' },
        { owner: 'slash', allowRestart: true },
      )
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(true)

    act(() => {
      result.current.cancel('bubble')
    })

    expect(activeSignal?.aborted).toBe(true)

    await act(async () => {
      await firstRequest
      await result.current.runRequest(
        { action: 'continue' },
        { owner: 'slash', allowRestart: true },
      )
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(2)
    expect(result.current.isGenerating).toBe(false)
  })

  it('keeps partial streamed rewrite content when a callback-side error arrives late', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('draft', 0)
      callbacks.onError('stream failed')
    })

    const { result } = renderEditorAI(editor, 'zh', () => 'Keep tone')

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'simplify' })
    })

    expect(editor.getText()).toBe('Before ...draft after')
    expect(editor.getText()).not.toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream failed')
    expect(result.current.isGenerating).toBe(false)
  })

  it('builds the generate payload from the shared policy and streams content at the cursor', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('generated', 0)
      callbacks.onContent(' ', 1)
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor, 'zh', () => 'Keep tone')

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(mockStreamWritingHelper).toHaveBeenLastCalledWith(
      expect.objectContaining({
        skill_ids: ['character-forge', 'dialogue-system'],
      }),
      expect.any(Object),
      expect.any(Object),
    )

    expect(editor.getText()).toBe('Before ...generated after')
    expect(result.current.errorMessage).toBeNull()
    expect(result.current.isGenerating).toBe(false)
  })

  it('builds the full-article payload in English from the shared policy', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor, 'en', () => 'Keep tone')

    await act(async () => {
      await result.current.runRequest({ action: 'full-article' })
    })

    expectLatestStreamPayload({
      request: { action: 'full-article' },
      language: 'en',
      contextBefore: 'Before ',
      rawStyleRequirements: 'Keep tone',
    })
  })

  it('builds the rewrite payload in English from the shared variant contract', async () => {
    const editor = createEditorWithSelection('Before target after', 'target')
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor, 'en')

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'formal' })
    })

    expectLatestStreamPayload({
      request: { action: 'rewrite', variant: 'formal' },
      language: 'en',
      selectedText: 'target',
      rawStyleRequirements: '',
    })
  })

  it('builds the continue payload from the shared policy and uses literal text-node insertion for streamed markup-like content', async () => {
    const editor = new FakeEditor('Story seed')
    editor.setSelection('Story seed'.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('<h1>unsafe</h1>', 0)
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor, 'en')

    await act(async () => {
      await result.current.runRequest({ action: 'continue' })
    })

    expectLatestStreamPayload({
      request: { action: 'continue' },
      language: 'en',
      contextBefore: 'Story seed',
      rawStyleRequirements: '',
    })
    expect(editor.getText()).toBe('Story seed...<h1>unsafe</h1>')
    expect(editor.getInsertPayloads()).toEqual(
      expect.arrayContaining([
        { type: 'text', text: '...' },
        { type: 'text', text: '<h1>unsafe</h1>' },
      ]),
    )
    expect(editor.getInsertPayloads()).not.toContain('<h1>unsafe</h1>')
  })

  it('removes the loading placeholder for generate failures without altering surrounding content', async () => {
    const originalContent = 'Before after'
    const editor = new FakeEditor(originalContent)
    editor.setSelection('Before '.length)

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onError('stream failed')
    })

    const { result } = renderEditorAI(editor)

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream failed')
  })
})

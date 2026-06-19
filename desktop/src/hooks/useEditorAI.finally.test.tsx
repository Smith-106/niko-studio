import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  streamWritingHelper: vi.fn(),
}))

import { streamWritingHelper } from '../api/client'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from './useEditorAI'

type PlainTextContent = { type: 'text'; text: string }
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

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

describe('useEditorAI — isCurrentRequest early return in finally', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', { enabled: true, apiKey: 'sk-test' })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge', 'dialogue-system'],
    }))
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('skips the finally block cleanup when a new request supersedes the current one during streaming (lines 233-234)', async () => {
    const editor = createEditorWithSelection('Before target after', 'target')
    const firstDeferred = createDeferred<void>()
    let firstStreamCallbacks: {
      onContent: (chunk: string) => void
      onDone: () => void
      onError: (err: string) => void
    } | null = null

    // First stream: waits until we resolve the deferred, then calls onDone.
    // Before we resolve, a second request from the same owner will abort the first.
    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks, options) => {
        firstStreamCallbacks = callbacks
        await firstDeferred.promise
        if (!options?.signal?.aborted) {
          callbacks.onDone()
        }
      })
      // Second stream: completes normally
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onContent('fresh rewrite', 0)
        callbacks.onDone()
      })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    // Start the first rewrite request (owner: 'slash', allowRestart)
    let firstRequest!: Promise<void>
    await act(async () => {
      firstRequest = result.current.runRequest(
        { action: 'rewrite', variant: 'polish' },
        { owner: 'slash', allowRestart: true },
      )
      await Promise.resolve() // let the stream start
    })

    expect(result.current.isGenerating).toBe(true)
    // The editor deleted the selection and inserted the loading indicator
    expect(editor.getText()).toContain('...')

    // While the first stream is still in-flight, start a second request from the same owner.
    // This will abort the first stream's controller, and then start the second stream.
    let secondRequest!: Promise<void>
    await act(async () => {
      secondRequest = result.current.runRequest(
        { action: 'continue' },
        { owner: 'slash', allowRestart: true },
      )
      // Allow the abort to propagate and the second stream to start
      await Promise.resolve()
      await Promise.resolve()
    })

    // Now resolve the first deferred so the first stream's
    // streamWritingHelper resolves. When it does, it will hit the finally
    // block. At that point, isCurrentRequest() returns false because
    // the active request is now the second one (requestId increased).
    // So lines 232-234 (if (!isCurrentRequest()) { return }) execute.
    firstDeferred.resolve()

    await act(async () => {
      await firstRequest
    })

    // Wait for the second stream to complete
    await act(async () => {
      await secondRequest
    })

    // The second stream's content ('fresh rewrite') should be in the editor.
    // The first stream's finally block early-returned, so it did NOT
    // call streamer.finish() or releaseRequest for the first request.
    expect(editor.getText()).toContain('fresh rewrite')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(2)
  })

  it('skips finally block cleanup when the active request is replaced via cancel and a new request starts (lines 233-234)', async () => {
    const editor = new FakeEditor('Seed text')
    editor.setSelection('Seed text'.length)
    const deferred = createDeferred<void>()

    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks, options) => {
        await deferred.promise
        if (!options?.signal?.aborted) {
          callbacks.onDone()
        }
      })
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onContent('new content', 0)
        callbacks.onDone()
      })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    // Start a generate request (no owner, no restart)
    let firstRequest!: Promise<void>
    await act(async () => {
      firstRequest = result.current.runRequest({ action: 'generate' })
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)

    // Cancel the first request (no owner filter, so it always cancels)
    act(() => {
      result.current.cancel()
    })

    // Wait for the first request to finish after cancellation
    deferred.resolve()
    await act(async () => {
      await firstRequest
    })

    // After cancel, isGenerating should be false
    expect(result.current.isGenerating).toBe(false)

    // Now start a new generate request — this creates a new active request
    // The old request's finally block would have hit isCurrentRequest() === false
    // because the requestId incremented.
    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(2)
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })
})

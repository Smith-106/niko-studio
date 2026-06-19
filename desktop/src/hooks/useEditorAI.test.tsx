import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  streamWritingHelper: vi.fn(),
}))

import { streamWritingHelper } from '../api/client'
import * as streamToEditor from '../components/editor/streamToEditor'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import * as editorAIPromptPolicy from './editorAIPromptPolicy'
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
    useSettingsStore.getState().updateProvider('openai', { enabled: true, apiKey: 'sk-test' })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
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

  it('swallows late rejected stream errors after rewrite cancellation once the controller is attached', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')
    const deferred = createDeferred<void>()
    let streamSignal: AbortSignal | undefined

    mockStreamWritingHelper.mockImplementation(async (_payload, _callbacks, options) => {
      streamSignal = options?.signal
      await deferred.promise
      throw new Error('late abort failure')
    })

    const { result } = renderEditorAI(editor)

    let rewritePromise!: Promise<void>
    await act(async () => {
      rewritePromise = result.current.runRequest({ action: 'rewrite', variant: 'formal' })
      await Promise.resolve()
    })

    expect(streamSignal).toBeDefined()
    expect(streamSignal?.aborted).toBe(false)

    act(() => {
      result.current.cancel()
    })

    expect(streamSignal?.aborted).toBe(true)

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
              callbacks.onError('stale error')
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
    expect(result.current.errorMessage).toBeNull()
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

  it('reports a missing provider in English and clears the error on demand', async () => {
    useSettingsStore.getState().updateProvider('openai', { enabled: false, apiKey: '' })

    const editor = new FakeEditor('Before after')
    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'en',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(onApiKeyMissing).toHaveBeenCalledTimes(1)
    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Please configure AI provider first')

    act(() => {
      result.current.clearError()
    })

    expect(result.current.errorMessage).toBeNull()
  })

  it('rethrows beforeRequestStart errors and releases the pending request lock', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor)
    let thrown: unknown

    await act(async () => {
      try {
        await result.current.runRequest(
          { action: 'generate' },
          {
            beforeRequestStart: () => {
              throw new Error('preflight failed')
            },
          },
        )
      } catch (error) {
        thrown = error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('preflight failed')
    expect(result.current.isGenerating).toBe(false)
    expect(mockStreamWritingHelper).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.runRequest({ action: 'continue' })
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(false)
  })

  it('ignores stale pending-request releases after beforeRequestStart reenters and then throws', async () => {
    const editor = new FakeEditor('Seed')
    editor.setSelection('Seed'.length)
    let followupRequest: Promise<void> | null = null

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor)
    let thrown: unknown

    await act(async () => {
      try {
        await result.current.runRequest(
          { action: 'generate' },
          {
            owner: 'slash',
            allowRestart: true,
            beforeRequestStart: () => {
              followupRequest = result.current.runRequest(
                { action: 'continue' },
                { owner: 'slash', allowRestart: true },
              )
              throw new Error('preflight failed after restart')
            },
          },
        )
      } catch (error) {
        thrown = error
      }

      await followupRequest
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toBe('preflight failed after restart')
    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('Seed...')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('skips rewrite requests when the current selection is blank', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length, 'Before '.length)

    const { result } = renderEditorAI(editor)

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'formal' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(editor.getText()).toBe('Before after')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('restarts a pending request before the stream controller is created when the same owner reenters', async () => {
    const editor = new FakeEditor('Seed')
    editor.setSelection('Seed'.length)
    let followupRequest: Promise<void> | null = null

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onContent('fresh', 0)
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor)

    const firstRequest = result.current.runRequest(
      { action: 'generate' },
      {
        owner: 'slash',
        allowRestart: true,
        beforeRequestStart: () => {
          followupRequest = result.current.runRequest(
            { action: 'continue' },
            { owner: 'slash', allowRestart: true },
          )
        },
      },
    )

    await act(async () => {
      await firstRequest
      await followupRequest
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('Seed...fresh')
    expect(result.current.isGenerating).toBe(false)
  })

  it('releases the pending request when no loading placeholder can be inserted', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)
    const insertLoadingIndicatorSpy = vi
      .spyOn(streamToEditor, 'insertLoadingIndicator')
      .mockReturnValueOnce(null)

    const { result } = renderEditorAI(editor)

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(insertLoadingIndicatorSpy).toHaveBeenCalledTimes(1)
    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(editor.getText()).toBe('Before after')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })

  it('bails out when a pending request becomes stale before callStream starts', async () => {
    const editor = new FakeEditor('Seed')
    editor.setSelection('Seed'.length)
    const originalBuild = editorAIPromptPolicy.buildEditorAIPayload
    let followupRequest: Promise<void> | null = null
    let reentered = false

    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })

    const { result } = renderEditorAI(editor)
    const payloadSpy = vi
      .spyOn(editorAIPromptPolicy, 'buildEditorAIPayload')
      .mockImplementation((options) => {
        if (!reentered && options.request.action === 'generate') {
          reentered = true
          followupRequest = result.current.runRequest(
            { action: 'continue' },
            { owner: 'slash', allowRestart: true },
          )
        }
        return originalBuild(options)
      })

    await act(async () => {
      await result.current.runRequest(
        { action: 'generate' },
        { owner: 'slash', allowRestart: true },
      )
      await followupRequest
    })

    payloadSpy.mockRestore()

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe('Seed...')
    expect(result.current.isGenerating).toBe(false)
  })

  it('surfaces thrown stream errors and removes the loading placeholder for generate requests', async () => {
    const originalContent = 'Before after'
    const editor = new FakeEditor(originalContent)
    editor.setSelection('Before '.length)
    mockStreamWritingHelper.mockRejectedValue(new Error('request blew up'))

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.generateAtCursor()
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('request blew up')
    expect(result.current.isGenerating).toBe(false)
  })

  it('treats wrapper methods and cancel as no-ops when the editor is unavailable', async () => {
    const { result } = renderHook(() =>
      useEditorAI({
        editor: null,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.generateAtCursor('full-article')
      await result.current.rewriteSelection('formal')
      await result.current.continueWriting()
    })

    act(() => {
      result.current.cancel()
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })
})

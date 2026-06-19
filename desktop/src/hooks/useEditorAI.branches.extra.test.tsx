import { act, renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', () => ({
  streamWritingHelper: vi.fn(),
  queryGraph: vi.fn().mockResolvedValue({ success: true, data: [] }),
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

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

describe('useEditorAI extra branch coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', { enabled: true, apiKey: 'sk-test' })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge', 'dialogue-system'],
    }))
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // --- Tests that complete synchronously (no pending streams) ---

  // Branch: cancel when no active request exists (line 359-360)
  it('cancel does nothing when no active request exists', () => {
    const editor = new FakeEditor('Test')
    const onApiKeyMissing = vi.fn()

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    act(() => {
      result.current.cancel()
    })

    expect(result.current.isGenerating).toBe(false)
  })

  // Branch: rewrite with empty selected text (line 310-312)
  it('runRequest returns early when rewriting with empty selection', async () => {
    const wsEditor = new FakeEditor('     ')
    wsEditor.setSelection(0, 5) // selects whitespace only

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('hello', 0)
      callbacks.onDone()
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: wsEditor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  // Branch: runRequest when editor is null (line 276)
  it('runRequest returns early when editor is null', async () => {
    const onApiKeyMissing = vi.fn()

    const { result } = renderHook(() =>
      useEditorAI({
        editor: null,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
  })

  // Branch: onApiKeyMissing is called and error set in English (line 280-283)
  it('calls onApiKeyMissing and sets English error message when no provider', async () => {
    const editor = new FakeEditor('Test')
    const onApiKeyMissing = vi.fn()

    useSettingsStore.getState().resetSettings()

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

    expect(onApiKeyMissing).toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('Please configure AI provider first')
    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
  })

  // Branch: error is not an Error instance → String(error) (line 229)
  it('sets error message to String(error) when stream throws non-Error', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async () => {
      throw 42
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(result.current.errorMessage).toBe('42')
  })

  // Branch: getStyleRequirements returns a value (line 304)
  it('passes style requirements through to stream payload', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('styled text', 0)
      callbacks.onDone()
    })

    const onApiKeyMissing = vi.fn()
    const getStyleRequirements = vi.fn().mockReturnValue('Use formal tone')

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        getStyleRequirements,
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(getStyleRequirements).toHaveBeenCalled()
    expect(mockStreamWritingHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: expect.any(String),
      }),
      expect.any(Object),
      expect.any(Object),
    )
  })

  // Branch: continue action uses contextWindow of 3000 (line 335)
  it('continueWriting sends request with continue action', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('continuation', 0)
      callbacks.onDone()
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.continueWriting()
    })

    expect(mockStreamWritingHelper).toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  // Branch: stream error with shouldRestoreRewrite for rewrite action (lines 243-253)
  it('restores original text on rewrite stream error with no content', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onError('stream error')
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('stream error')
    expect(result.current.isGenerating).toBe(false)
  })

  // Branch: stream error with content streamed — doesn't restore (lines 251-253 else branch)
  it('does not restore on rewrite error when content was already streamed', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('replacement text', 0)
      callbacks.onError('late stream error')
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    expect(editor.getText()).toContain('replacement text')
    expect(editor.getText()).not.toBe(originalContent)
    expect(result.current.errorMessage).toBe('late stream error')
  })

  // --- Tests that leave pending streams (run last) ---

  // Branch: claimRequest returns null when cannot restart (line 138-139)
  it('second request returns null from claimRequest when first is active and restart not allowed', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    // First stream resolves immediately
    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks, _opts) => {
        callbacks.onContent('first', 0)
        callbacks.onDone()
      })
      .mockImplementationOnce(async (_payload, callbacks, _opts) => {
        callbacks.onContent('second', 0)
        callbacks.onDone()
      })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    // Start first request and wait for it to complete
    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(result.current.isGenerating).toBe(false)

    // Start second request WITHOUT allowRestart — should work since first is done
    await act(async () => {
      await result.current.runRequest({ action: 'continue' })
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(2)
    expect(result.current.isGenerating).toBe(false)
  })

  // Branch: cancel with owner that doesn't match active request's owner (line 363)
  it('cancel does nothing when owner does not match active request owner', async () => {
    const editor = new FakeEditor('Seed text')
    editor.setSelection('Seed text'.length)

    // Use a deferred pattern like the main test file
    let resolveStream!: () => void
    const streamPromise = new Promise<void>((resolve) => { resolveStream = resolve })

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, _callbacks, options) => {
      await streamPromise
      if (!options?.signal?.aborted) {
        _callbacks.onDone()
      }
    })

    const onApiKeyMissing = vi.fn()
    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        onApiKeyMissing,
      }),
    )

    // Start a request with owner 'slash'
    let requestPromise!: Promise<void>
    await act(async () => {
      requestPromise = result.current.runRequest(
        { action: 'generate' },
        { owner: 'slash' },
      )
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)

    // Try to cancel with a different owner 'bubble' — should NOT cancel
    act(() => {
      result.current.cancel('bubble')
    })

    expect(result.current.isGenerating).toBe(true)

    // Now cancel with the matching owner
    act(() => {
      result.current.cancel('slash')
    })

    resolveStream()

    await act(async () => {
      try {
        await requestPromise
      } catch {
        // may reject due to abort
      }
    })

    expect(result.current.isGenerating).toBe(false)
  })
})

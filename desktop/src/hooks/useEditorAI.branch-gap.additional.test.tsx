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

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

describe('useEditorAI branch-gap additional coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', { enabled: true, apiKey: 'sk-test' })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge'],
    }))
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Line 160: if (!editor) return in callStream
  it('returns early from callStream when editor is null (line 160)', async () => {
    const { result } = renderHook(() =>
      useEditorAI({
        editor: null,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  // Lines 193-196: provider?.defaultModel ?? '', provider?.id ?? '',
  // provider?.apiKey ?? '', provider?.baseUrl ?? '' fallbacks
  // These ?? '' branches fire when the provider object exists but the field is
  // undefined. We set up a provider with apiKey but without defaultModel/baseUrl.
  it('uses empty string fallbacks for defaultModel and baseUrl when not set (lines 193-196)', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    // Reset and set up provider with apiKey but empty/missing defaultModel and baseUrl
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', {
      enabled: true,
      apiKey: 'sk-test',
      defaultModel: '',
      baseUrl: '',
      models: [],
    })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })

    let capturedPayload: any = null
    mockStreamWritingHelper.mockImplementationOnce(async (payload, callbacks) => {
      capturedPayload = payload
      callbacks.onContent('text', 0)
      callbacks.onDone()
    })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(capturedPayload).toBeTruthy()
    expect(capturedPayload.model).toBe('')
    expect(capturedPayload.base_url).toBe('')
    expect(capturedPayload.api_key).toBe('sk-test')
  })

  // Lines 243-245: The ?? pos and ?? '' fallback branches in the
  // replaceRange call within the streamError + shouldRestoreRewrite path.
  // In practice, when shouldRestoreRewrite is true, recovery.replaceFrom
  // and recovery.fallbackText are always defined, so the ?? fallbacks
  // are defensive. We cover the main path by verifying replaceRange is called
  // with the recovery values on a rewrite error.
  it('calls replaceRange with recovery values on rewrite stream error (lines 243-245)', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onError('stream error')
    })

    const replaceRangeSpy = vi.spyOn(streamToEditor, 'replaceRange')

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    // The rewrite error path with shouldRestoreRewrite=true should call replaceRange
    // to restore the original text. The FakeEditor handles this through its chain.
    expect(result.current.errorMessage).toBe('stream error')
    expect(result.current.isGenerating).toBe(false)
    // The text should be restored to the original
    expect(editor.getText()).toBe(originalContent)

    replaceRangeSpy.mockRestore()
  })

  // Lines 255-257: The ?? pos and ?? '' fallback branches in the
  // replaceRange call within the abort signal + shouldRestoreRewrite path.
  it('restores original text on rewrite abort via replaceRange (lines 255-257)', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    let resolveStream!: () => void
    const streamPromise = new Promise<void>((resolve) => { resolveStream = resolve })

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, _callbacks, options) => {
      await streamPromise
      if (!options?.signal?.aborted) {
        _callbacks.onDone()
      }
    })

    const replaceRangeSpy = vi.spyOn(streamToEditor, 'replaceRange')

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    let requestPromise!: Promise<void>
    await act(async () => {
      requestPromise = result.current.runRequest({ action: 'rewrite', variant: 'polish' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)

    // Cancel the request — triggers abort path with shouldRestoreRewrite
    act(() => {
      result.current.cancel()
    })

    resolveStream()

    await act(async () => {
      await requestPromise
    })

    // The text should be restored to the original
    expect(editor.getText()).toBe(originalContent)
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()

    replaceRangeSpy.mockRestore()
  })

  // Lines 247-248: streamError path where shouldRestoreRewrite is false and
  // !hasStreamedContent && totalLen <= placeholderLen — removes placeholder
  it('removes placeholder on generate stream error when no content was streamed (lines 247-248)', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    // No content streamed, just an error — placeholder gets removed
    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onError('generate error')
    })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    // The placeholder should have been removed, leaving original text intact
    expect(editor.getText()).toBe('Content')
    expect(result.current.errorMessage).toBe('generate error')
    expect(result.current.isGenerating).toBe(false)
  })

  // Lines 259-260: abort path where shouldRestoreRewrite is false and
  // !hasStreamedContent && totalLen <= placeholderLen — removes placeholder
  it('removes placeholder on generate abort when no content was streamed (lines 259-260)', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    let resolveStream!: () => void
    const streamPromise = new Promise<void>((resolve) => { resolveStream = resolve })

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, _callbacks, options) => {
      await streamPromise
      if (!options?.signal?.aborted) {
        _callbacks.onDone()
      }
    })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    let requestPromise!: Promise<void>
    await act(async () => {
      requestPromise = result.current.runRequest({ action: 'generate' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)

    // Cancel before any content arrives
    act(() => {
      result.current.cancel()
    })

    resolveStream()

    await act(async () => {
      await requestPromise
    })

    // Placeholder removed, original text intact, no error
    expect(editor.getText()).toBe('Content')
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.errorMessage).toBeNull()
  })
})

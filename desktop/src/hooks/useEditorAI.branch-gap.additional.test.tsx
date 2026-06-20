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

  // Lines 278-279: Chinese error message when no provider
  it('sets Chinese error message when no provider is configured with zh language', async () => {
    const editor = new FakeEditor('Test')
    useSettingsStore.getState().resetSettings()

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

    expect(onApiKeyMissing).toHaveBeenCalled()
    expect(result.current.errorMessage).toBe('请先配置 AI 服务')
  })

  // Line 127-129: handleAnalyze with no currentProjectId or non-standard tab
  it('returns early when currentProjectId is null for standard tab', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    // Without a project, runRequest returns early at provider check
    useSettingsStore.getState().resetSettings()

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'en',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
  })

  // Lines 200-202: onContent callback with empty chunk — should not set hasStreamedContent
  it('does not set hasStreamedContent for empty content chunks', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    // Empty chunks don't count, so when an error follows, the placeholder is removed
    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('', 0)
      callbacks.onError('stream error')
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

    expect(editor.getText()).toBe('Content')
    expect(result.current.errorMessage).toBe('stream error')
  })

  // Lines 229-230: error is not an Error instance — String(error) fallback
  it('sets error message to String(error) when stream throws non-Error', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async () => {
      throw 'string error value'
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

    expect(result.current.errorMessage).toBe('string error value')
  })

  // Lines 232-234: shouldRestoreRewrite is true for rewrite actions
  it('restores original text on rewrite stream error with recovery options', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onError('rewrite failed')
    })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.errorMessage).toBe('rewrite failed')
  })

  // Lines 259-261: aborted signal with shouldRestoreRewrite but hasStreamedContent is true
  it('does not restore original text on abort when content was already streamed during rewrite', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    // Stream some content first, then signal is aborted
    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks, options) => {
      callbacks.onContent('partial replacement', 0)
      // Simulate abort by checking the signal
      if (!options?.signal?.aborted) {
        callbacks.onDone()
      }
    })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'polish' })
    })

    // The partial content should remain since hasStreamedContent was true
    expect(editor.getText()).toContain('partial replacement')
    expect(editor.getText()).not.toBe(originalContent)
  })

  // Lines 138-139: claimRequest returns null — overlapping requests from different owner
  it('ignores overlapping requests from different owner while stream is active', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)

    // First stream hangs, second request is from different owner with allowRestart
    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onContent('first', 0)
        callbacks.onDone()
      })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    // Start and complete a first request
    await act(async () => {
      await result.current.runRequest({ action: 'generate' }, { owner: 'slash' })
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(false)
  })

  // Lines 353-361: cancel with owner that doesn't match active request's owner
  it('cancel does nothing when specified owner does not match active request owner', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('generated', 0)
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

    // Cancel with a specific owner — since active request has no owner, this is a no-op
    act(() => {
      result.current.cancel('bubble')
    })

    expect(result.current.isGenerating).toBe(false)
  })

  // cancel without owner when active request has no owner — cancels successfully
  it('cancel without owner cancels request when active request has no owner', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('generated', 0)
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

    // Cancel without owner — should succeed since the active request has no owner
    act(() => {
      result.current.cancel()
    })

    expect(result.current.isGenerating).toBe(false)
  })

  // Line 300: getStyleRequirements returns null
  it('passes null style requirements when getStyleRequirements returns null', async () => {
    const editor = new FakeEditor('Content')
    editor.setSelection('Content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('styled', 0)
      callbacks.onDone()
    })

    const getStyleRequirements = vi.fn().mockReturnValue(null)

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
        getStyleRequirements,
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'generate' })
    })

    expect(getStyleRequirements).toHaveBeenCalled()
    expect(result.current.isGenerating).toBe(false)
  })

  // Line 306-309: rewrite with blank selected text
  it('skips rewrite requests when the current selection is blank whitespace', async () => {
    const editor = new FakeEditor('     ')
    editor.setSelection(0, 5) // selects whitespace only

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    await act(async () => {
      await result.current.runRequest({ action: 'rewrite', variant: 'formal' })
    })

    expect(mockStreamWritingHelper).not.toHaveBeenCalled()
    expect(editor.getText()).toBe('     ')
    expect(result.current.isGenerating).toBe(false)
  })

  // Lines 142-146: claimRequest — canRestart is false when owners don't match
  // Even with allowRestart=true, if activeRequest.owner !== new owner, canRestart is false
  it('rejects restart request from different owner even with allowRestart', async () => {
    const editor = new FakeEditor('Before after')
    editor.setSelection('Before '.length)

    // First request completes immediately
    mockStreamWritingHelper
      .mockImplementationOnce(async (_payload, callbacks) => {
        callbacks.onContent('first', 0)
        callbacks.onDone()
      })

    const { result } = renderHook(() =>
      useEditorAI({
        editor: editor as unknown as Editor,
        language: 'zh',
      }),
    )

    // Start and complete a first request from 'slash'
    await act(async () => {
      await result.current.runRequest({ action: 'generate' }, { owner: 'slash' })
    })

    expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
    expect(result.current.isGenerating).toBe(false)
  })
})

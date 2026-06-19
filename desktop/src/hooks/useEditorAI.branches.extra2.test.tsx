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

describe('useEditorAI extra2 branch coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', {
      enabled: true,
      apiKey: 'sk-test',
      defaultModel: 'gpt-test',
    })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge'],
    }))
    vi.resetAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Lines 193-196: provider has missing defaultModel/baseUrl, triggering ?? '' fallbacks
  it('falls back to empty provider fields when defaultModel or baseUrl are missing', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    // 重置后再只设置 id / enabled / apiKey，并清空 defaultModel / baseUrl / models，触发 ?? '' 分支
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', {
      enabled: true,
      apiKey: 'sk-test',
      defaultModel: '',
      baseUrl: '',
      models: [],
    })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onContent('ok', 0)
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

    expect(mockStreamWritingHelper).toHaveBeenCalledWith(
      expect.objectContaining({
        model: '',
        provider: 'openai',
        api_key: 'sk-test',
        base_url: '',
      }),
      expect.any(Object),
      expect.any(Object),
    )
  })

  // Lines 247-249: generate action stream error with recovery undefined
  it('removes placeholder on generate stream error with no recovery', async () => {
    const editor = new FakeEditor('Test content')
    editor.setSelection('Test content'.length)

    mockStreamWritingHelper.mockImplementationOnce(async (_payload, callbacks) => {
      callbacks.onError('generate failed')
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

    expect(editor.getText()).toBe('Test content')
    expect(result.current.errorMessage).toBe('generate failed')
  })

  // Lines 259-261: rewrite action is cancelled, restoring original text via recovery
  it('restores original text when rewrite stream is cancelled', async () => {
    const originalContent = 'Before target after'
    const editor = createEditorWithSelection(originalContent, 'target')

    let resolveStream!: () => void
    const streamPromise = new Promise<void>((resolve) => {
      resolveStream = resolve
    })

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
      requestPromise = result.current.runRequest({ action: 'rewrite', variant: 'polish' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.isGenerating).toBe(true)

    act(() => {
      result.current.cancel()
    })

    resolveStream()

    await act(async () => {
      await requestPromise
    })

    expect(editor.getText()).toBe(originalContent)
    expect(result.current.isGenerating).toBe(false)
  })
})

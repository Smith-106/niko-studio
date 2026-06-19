import { createRef } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const useEditorMock = vi.hoisted(() => vi.fn())
const streamWritingHelperMock = vi.hoisted(() => vi.fn())

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-has-editor={String(Boolean(editor))} />
  ),
  useEditor: useEditorMock,
}))

vi.mock('./editor/SlashCommandMenu', () => ({
  SlashCommandMenu: ({
    onSelect,
  }: {
    onSelect: (item: { id: string; label: string; description: string; icon: string; type: string }) => void
  }) => (
    <div>
      <button
        data-testid="slash-ai-generate"
        onClick={() =>
          onSelect({
            id: 'ai-generate',
            label: 'Generate',
            description: '',
            icon: 'sparkles',
            type: 'ai',
          })
        }
      >
        slash-generate
      </button>
      <button
        data-testid="slash-ai-continue"
        onClick={() =>
          onSelect({
            id: 'ai-continue',
            label: 'Continue',
            description: '',
            icon: 'sparkles',
            type: 'ai',
          })
        }
      >
        slash-continue
      </button>
      <button
        data-testid="slash-ai-full-article"
        onClick={() =>
          onSelect({
            id: 'ai-full-article',
            label: 'Full article',
            description: '',
            icon: 'sparkles',
            type: 'ai',
          })
        }
      >
        slash-full-article
      </button>
    </div>
  ),
}))

vi.mock('./editor/BubbleToolbar', () => ({
  BubbleToolbar: ({
    onRewrite,
    onContinue,
  }: {
    onRewrite: (option: { id: 'formal' }) => void
    onContinue: () => void
  }) => (
    <div>
      <button data-testid="bubble-rewrite-formal" onClick={() => onRewrite({ id: 'formal' })}>
        bubble-rewrite-formal
      </button>
      <button data-testid="bubble-continue" onClick={onContinue}>
        bubble-continue
      </button>
    </div>
  ),
  REWRITE_OPTIONS: [],
}))

vi.mock('../api/client', () => ({
  streamWritingHelper: streamWritingHelperMock,
}))

vi.mock('../hooks/useStoryContext', () => ({
  useStoryContext: () => ({ getStoryContext: () => null, refreshStoryContext: vi.fn() }),
}))

import { streamWritingHelper } from '../api/client'
import {
  buildEditorAIPayload,
  type BuildEditorAIPayloadOptions,
} from '../hooks/editorAIPromptPolicy'
import { useSettingsStore } from '../stores/settingsStore'
import { getEditorHandle } from '../utils/editorHandle'
import {
  DEFAULT_WRITING_STYLE,
  getPersistedStyleRequirements,
  saveStyle,
} from './editor/WritingStyle'
import { NikoEditor, type NikoEditorHandle } from './NikoEditor'

interface PlainTextContent {
  type: 'text'
  text: string
}

type InsertPayload = string | PlainTextContent

class FakeEditor {
  private content: string

  public extensionManager = {}

  public state: {
    selection: {
      from: number
      to: number
      $from: {
        parent: { textContent: string }
        parentOffset: number
      }
    }
    doc: { textBetween: (from: number, to: number, blockSeparator?: string) => string }
  }

  public view: {
    state: FakeEditor['state']
    coordsAtPos: (pos: number) => { left: number; right: number; top: number }
    dom: HTMLDivElement
  }

  constructor(initialContent: string) {
    this.content = initialContent
    this.state = {
      selection: {
        from: 0,
        to: 0,
        $from: {
          parent: { textContent: initialContent },
          parentOffset: 0,
        },
      },
      doc: {
        textBetween: (from: number, to: number) => this.content.slice(from, to),
      },
    }

    const dom = document.createElement('div')
    dom.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 320,
        bottom: 180,
        width: 320,
        height: 180,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    this.view = {
      state: this.state,
      coordsAtPos: (pos: number) => ({
        left: pos * 8,
        right: pos * 8 + 8,
        top: 12,
      }),
      dom,
    }
  }

  setSelection(from: number, to = from): void {
    this.state.selection = {
      from,
      to,
      $from: {
        parent: { textContent: this.content },
        parentOffset: from,
      },
    }
  }

  getText(): string {
    return this.content
  }

  getJSON() {
    return { type: 'doc', content: [] }
  }

  chain(): FakeEditorChain {
    return new FakeEditorChain(this)
  }

  isActive(): boolean {
    return false
  }

  applyInsert(payload: InsertPayload): void {
    const text = typeof payload === 'string' ? payload : payload.text
    const { from, to } = this.state.selection
    this.content = `${this.content.slice(0, from)}${text}${this.content.slice(to)}`
    const cursor = from + text.length
    this.setSelection(cursor, cursor)
  }

  applyDeleteRange(from: number, to: number): void {
    this.content = `${this.content.slice(0, from)}${this.content.slice(to)}`
    this.setSelection(from, from)
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
      const { from, to } = this.editor.state.selection
      this.editor.applyDeleteRange(from, to)
    })
    return this
  }

  deleteRange(range: { from: number; to: number }): FakeEditorChain {
    this.operations.push(() => {
      this.editor.applyDeleteRange(range.from, range.to)
    })
    return this
  }

  setTextSelection(selection: { from: number; to: number }): FakeEditorChain {
    this.operations.push(() => {
      this.editor.setSelection(selection.from, selection.to)
    })
    return this
  }

  toggleHeading(): FakeEditorChain {
    return this
  }

  toggleBulletList(): FakeEditorChain {
    return this
  }

  toggleOrderedList(): FakeEditorChain {
    return this
  }

  toggleBlockquote(): FakeEditorChain {
    return this
  }

  toggleCodeBlock(): FakeEditorChain {
    return this
  }

  setHorizontalRule(): FakeEditorChain {
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

function persistWritingStyle(): void {
  saveStyle({
    ...DEFAULT_WRITING_STYLE,
    tone: 'serious',
    formality: 4,
    structure: {
      ...DEFAULT_WRITING_STYLE.structure,
      paragraphLength: 'short',
    },
    language: {
      ...DEFAULT_WRITING_STYLE.language,
      sentencePatterns: ['short, clipped lines'],
      rhetoric: ['metaphor'],
      vocabulary: {
        ...DEFAULT_WRITING_STYLE.language.vocabulary,
        preferred: ['granite'],
        avoid: ['purple prose'],
      },
    },
  })
}

function expectLatestStreamPayload(options: BuildEditorAIPayloadOptions): void {
  const expectedPayload = buildEditorAIPayload(options)
  const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

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

function openSlashMenu(editor: FakeEditor, editorConfig: any): void {
  vi.useFakeTimers()
  act(() => {
    editorConfig.editorProps.handleKeyDown(editor.view, { key: '/' } as KeyboardEvent)
    vi.runAllTimers()
  })
  vi.useRealTimers()
}

function showBubbleToolbar(editor: FakeEditor, editorConfig: any): void {
  act(() => {
    editorConfig.onSelectionUpdate({ editor: editor as unknown as Editor })
  })
}

const mockStreamWritingHelper = vi.mocked(streamWritingHelper)

describe('NikoEditor revision handle seam', () => {
  let latestEditorConfig: any

  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateProvider('openai', { enabled: true, apiKey: 'sk-test' })
    useSettingsStore.getState().updateSettings({ primaryProvider: 'openai' })
    vi.clearAllMocks()
    latestEditorConfig = null
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks) => {
      callbacks.onDone()
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes inert imperative defaults before the editor instance is ready', async () => {
    useEditorMock.mockImplementation((config) => {
      latestEditorConfig = config
      return null
    })
    const forwardedRef = createRef<NikoEditorHandle>()

    render(<NikoEditor ref={forwardedRef} onOpenWritingHelper={vi.fn()} />)

    await waitFor(() => {
      expect(forwardedRef.current).not.toBeNull()
    })

    const handle = forwardedRef.current
    expect(getEditorHandle()).toBeNull()
    expect(handle?.getSelectedText()).toBe('')
    expect(handle?.getJSON()).toEqual({ type: 'doc', content: [] })
    expect(handle?.captureSelectionSnapshot()).toBeNull()
    expect(handle?.replaceSelectionSnapshot({ from: 0, to: 0, text: '' }, 'rewrite')).toBe(false)
    expect(handle?.insertBelowSelectionSnapshot({ from: 0, to: 0, text: '' }, 'alternative')).toBe(false)
    expect(handle?.undoLastRevisionApply()).toBe(false)
    expect(() => handle?.insertText('draft')).not.toThrow()
    expect(() => handle?.triggerAIContinue()).not.toThrow()
  })

  it('registers the live editorHandle seam for capture, replace, insert-below, and undo', async () => {
    const editor = createEditorWithSelection('Before target after', 'target')
    useEditorMock.mockImplementation((config) => {
      latestEditorConfig = config
      return editor
    })
    const forwardedRef = createRef<NikoEditorHandle>()

    const { unmount } = render(<NikoEditor ref={forwardedRef} onOpenWritingHelper={vi.fn()} />)

    expect(screen.getByTestId('editor-content')).toHaveAttribute('data-has-editor', 'true')

    await waitFor(() => {
      expect(getEditorHandle()).not.toBeNull()
      expect(forwardedRef.current).not.toBeNull()
      expect(forwardedRef.current?.isGenerating).toBe(false)
    })

    const handle = forwardedRef.current
    expect(handle).not.toBeNull()
    expect(handle).toBe(getEditorHandle())
    expect(handle).toMatchObject({
      insertText: expect.any(Function),
      getSelectedText: expect.any(Function),
      getJSON: expect.any(Function),
      captureSelectionSnapshot: expect.any(Function),
      replaceSelectionSnapshot: expect.any(Function),
      insertBelowSelectionSnapshot: expect.any(Function),
      undoLastRevisionApply: expect.any(Function),
      triggerAIContinue: expect.any(Function),
      isGenerating: false,
    })
    expect(handle?.getSelectedText()).toBe('target')
    expect(handle?.getJSON()).toEqual({ type: 'doc', content: [] })
    expect(handle?.undoLastRevisionApply()).toBe(false)

    const snapshot = handle?.captureSelectionSnapshot()
    expect(snapshot).toEqual({
      from: 7,
      to: 13,
      text: 'target',
    })
    expect(
      handle?.replaceSelectionSnapshot({ from: 7, to: 13, text: 'mismatch' }, 'rewrite'),
    ).toBe(false)
    expect(
      handle?.insertBelowSelectionSnapshot({ from: 7, to: 13, text: 'mismatch' }, 'alternative'),
    ).toBe(false)

    editor.setSelection(editor.getText().length, editor.getText().length)
    handle?.insertText('!')
    expect(editor.getText()).toBe('Before target after!')
    editor.setSelection(7, 13)

    expect(handle?.replaceSelectionSnapshot(snapshot!, 'rewrite')).toBe(true)
    expect(editor.getText()).toBe('Before rewrite after!')

    expect(handle?.undoLastRevisionApply()).toBe(true)
    expect(editor.getText()).toBe('Before target after!')

    expect(handle?.insertBelowSelectionSnapshot(snapshot!, 'alternative')).toBe(true)
    expect(editor.getText()).toBe('Before target\n\nalternative after!')

    expect(handle?.undoLastRevisionApply()).toBe(true)
    expect(editor.getText()).toBe('Before target after!')

    expect(handle?.replaceSelectionSnapshot(snapshot!, 'rewrite')).toBe(true)
    ;(editor as unknown as { content: string }).content = 'Before drift after!'
    expect(handle?.undoLastRevisionApply()).toBe(false)

    editor.setSelection(7, 7)
    expect(handle?.captureSelectionSnapshot()).toBeNull()

    unmount()

    expect(getEditorHandle()).toBeNull()
  })

  it.each([
    {
      language: 'zh' as const,
      buttonId: 'slash-ai-generate',
      request: { action: 'generate' as const },
      initialContent: '前文/',
      expectedContextBefore: '前文',
    },
    {
      language: 'en' as const,
      buttonId: 'slash-ai-continue',
      request: { action: 'continue' as const },
      initialContent: 'Before /',
      expectedContextBefore: 'Before ',
    },
    {
      language: 'en' as const,
      buttonId: 'slash-ai-full-article',
      request: { action: 'full-article' as const },
      initialContent: 'Outline /',
      expectedContextBefore: 'Outline ',
    },
  ])(
    'routes $buttonId through the live component-hook seam for $language',
    async ({ language, buttonId, request, initialContent, expectedContextBefore }) => {
      persistWritingStyle()
      useSettingsStore.getState().updateSettings({ language })
      const editor = new FakeEditor(initialContent)
      editor.setSelection(initialContent.length, initialContent.length)
      useEditorMock.mockImplementation((config) => {
        latestEditorConfig = config
        return editor
      })

      render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

      openSlashMenu(editor, latestEditorConfig)
      expect(screen.getByTestId(buttonId)).toBeInTheDocument()

      await act(async () => {
        screen.getByTestId(buttonId).click()
      })

      await waitFor(() => {
        expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
      })

      expectLatestStreamPayload({
        request,
        language,
        contextBefore: expectedContextBefore,
        rawStyleRequirements: getPersistedStyleRequirements(language),
      })
      expect(screen.queryByTestId(buttonId)).not.toBeInTheDocument()
    },
  )

  it.each([
    {
      language: 'zh' as const,
      initialContent: '前文目标后文',
      selectedText: '目标',
    },
    {
      language: 'en' as const,
      initialContent: 'Before target after',
      selectedText: 'target',
    },
  ])(
    'routes bubble rewrite through the live component-hook seam for $language',
    async ({ language, initialContent, selectedText }) => {
      persistWritingStyle()
      useSettingsStore.getState().updateSettings({ language })
      const editor = createEditorWithSelection(initialContent, selectedText)
      useEditorMock.mockImplementation((config) => {
        latestEditorConfig = config
        return editor
      })

      render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

      showBubbleToolbar(editor, latestEditorConfig)
      expect(screen.getByTestId('bubble-rewrite-formal')).toBeInTheDocument()

      await act(async () => {
        screen.getByTestId('bubble-rewrite-formal').click()
      })

      await waitFor(() => {
        expect(mockStreamWritingHelper).toHaveBeenCalledTimes(1)
      })

      expectLatestStreamPayload({
        request: { action: 'rewrite', variant: 'formal' },
        language,
        selectedText,
        rawStyleRequirements: getPersistedStyleRequirements(language),
      })
    },
  )

  it('keeps the shared editor handle isGenerating state in sync with the live slash request', async () => {
    persistWritingStyle()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    const deferred = createDeferred<void>()
    const editor = new FakeEditor('前文/')
    editor.setSelection('前文/'.length, '前文/'.length)
    useEditorMock.mockImplementation((config) => {
      latestEditorConfig = config
      return editor
    })
    mockStreamWritingHelper.mockImplementation(async (_payload, callbacks, options) => {
      await deferred.promise
      if (!options?.signal?.aborted) {
        callbacks.onContent('续写', 0)
        callbacks.onDone()
      }
    })

    const forwardedRef = createRef<NikoEditorHandle>()
    render(<NikoEditor ref={forwardedRef} onOpenWritingHelper={vi.fn()} />)

    await waitFor(() => {
      expect(getEditorHandle()).toBe(forwardedRef.current)
    })

    openSlashMenu(editor, latestEditorConfig)

    await act(async () => {
      screen.getByTestId('slash-ai-generate').click()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(forwardedRef.current?.isGenerating).toBe(true)
      expect(getEditorHandle()?.isGenerating).toBe(true)
    })

    await act(async () => {
      deferred.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(forwardedRef.current?.isGenerating).toBe(false)
      expect(getEditorHandle()?.isGenerating).toBe(false)
    })
  })
})

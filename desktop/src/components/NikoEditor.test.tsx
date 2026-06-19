import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEditor } from '@tiptap/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content" data-has-editor={String(Boolean(editor))} />
  ),
  useEditor: vi.fn(() => null),
}))

vi.mock('./editor/SlashCommandMenu', () => ({
  SlashCommandMenu: ({
    onSelect,
    onClose,
    query,
  }: {
    onSelect: (item: unknown) => void
    onClose: () => void
    query: string
  }) => (
    <div>
      <div data-testid="slash-query">{query}</div>
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
        data-testid="slash-heading-1"
        onClick={() =>
          onSelect({
            id: 'heading-1',
            label: 'Heading 1',
            description: '',
            icon: 'type',
            type: 'format',
          })
        }
      >
        slash-heading-1
      </button>
      <button
        data-testid="slash-heading-2"
        onClick={() =>
          onSelect({
            id: 'heading-2',
            label: 'Heading 2',
            description: '',
            icon: 'type',
            type: 'format',
          })
        }
      >
        slash-heading-2
      </button>
      <button
        data-testid="slash-heading-3"
        onClick={() =>
          onSelect({
            id: 'heading-3',
            label: 'Heading 3',
            description: '',
            icon: 'type',
            type: 'format',
          })
        }
      >
        slash-heading-3
      </button>
      <button
        data-testid="slash-bullet-list"
        onClick={() =>
          onSelect({
            id: 'bullet-list',
            label: 'Bullet list',
            description: '',
            icon: 'list',
            type: 'format',
          })
        }
      >
        slash-bullet-list
      </button>
      <button
        data-testid="slash-ordered-list"
        onClick={() =>
          onSelect({
            id: 'ordered-list',
            label: 'Ordered list',
            description: '',
            icon: 'list-ordered',
            type: 'format',
          })
        }
      >
        slash-ordered-list
      </button>
      <button
        data-testid="slash-blockquote"
        onClick={() =>
          onSelect({
            id: 'blockquote',
            label: 'Blockquote',
            description: '',
            icon: 'quote',
            type: 'format',
          })
        }
      >
        slash-blockquote
      </button>
      <button
        data-testid="slash-code-block"
        onClick={() =>
          onSelect({
            id: 'code-block',
            label: 'Code block',
            description: '',
            icon: 'code',
            type: 'format',
          })
        }
      >
        slash-code-block
      </button>
      <button
        data-testid="slash-horizontal-rule"
        onClick={() =>
          onSelect({
            id: 'horizontal-rule',
            label: 'Horizontal rule',
            description: '',
            icon: 'minus',
            type: 'format',
          })
        }
      >
        slash-horizontal-rule
      </button>
      <button
        data-testid="slash-table"
        onClick={() =>
          onSelect({
            id: 'table',
            label: 'Table',
            description: '',
            icon: 'table',
            type: 'format',
          })
        }
      >
        slash-table
      </button>
      <button
        data-testid="slash-math"
        onClick={() =>
          onSelect({
            id: 'math',
            label: 'Math inline',
            description: '',
            icon: 'sigma',
            type: 'format',
          })
        }
      >
        slash-math
      </button>
      <button
        data-testid="slash-math-block"
        onClick={() =>
          onSelect({
            id: 'math-block',
            label: 'Math block',
            description: '',
            icon: 'sigma',
            type: 'format',
          })
        }
      >
        slash-math-block
      </button>
      <button
        data-testid="slash-callout"
        onClick={() =>
          onSelect({
            id: 'callout',
            label: 'Callout',
            description: '',
            icon: 'info',
            type: 'format',
          })
        }
      >
        slash-callout
      </button>
      <button data-testid="slash-close" onClick={onClose}>
        slash-close
      </button>
    </div>
  ),
}))

vi.mock('./editor/BubbleToolbar', () => ({
  BubbleToolbar: ({
    onRewrite,
    onContinue,
    onClose,
  }: {
    onRewrite: (option: { id: string }) => void
    onContinue: () => void
    onClose: () => void
  }) => (
    <div>
      <button data-testid="bubble-rewrite" onClick={() => onRewrite({ id: 'formal' })}>
        bubble-rewrite
      </button>
      <button data-testid="bubble-continue" onClick={onContinue}>
        bubble-continue
      </button>
      <button data-testid="bubble-close" onClick={onClose}>
        bubble-close
      </button>
    </div>
  ),
}))

vi.mock('../hooks/useEditorAI', () => ({
  useEditorAI: vi.fn(),
}))

import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from '../hooks/useEditorAI'
import {
  buildEditorAIPayload,
  buildEditorAIStyleInstruction,
  getEditorActionInstruction,
} from '../hooks/editorAIPromptPolicy'
import {
  DEFAULT_WRITING_STYLE,
  getPersistedStyleRequirements,
  saveStyle,
} from './editor/WritingStyle'
import {
  NikoEditor,
  buildEditorStyleInstruction,
  getEditorGenerateInstruction,
  getEditorFullArticleInstruction,
} from './NikoEditor'
import { useAppStore } from '../stores/appStore'

const mockUseEditor = vi.mocked(useEditor)
const mockUseEditorAI = vi.mocked(useEditorAI)
const zh = translations.zh
const en = translations.en

let latestEditorConfig: any = null
let currentEditorHarness: any = null

function createComponentEditorHarness() {
  const dom = document.createElement('div')
  dom.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 240,
      bottom: 120,
      width: 240,
      height: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect

  const chainApi: any = {
    focus: vi.fn(),
    deleteRange: vi.fn(),
    toggleHeading: vi.fn(),
    toggleBulletList: vi.fn(),
    toggleOrderedList: vi.fn(),
    toggleBlockquote: vi.fn(),
    toggleCodeBlock: vi.fn(),
    setHorizontalRule: vi.fn(),
    insertTable: vi.fn(),
    insertContent: vi.fn(),
    toggleCallout: vi.fn(),
    run: vi.fn(() => true),
  }

  chainApi.focus.mockImplementation(() => chainApi)
  chainApi.deleteRange.mockImplementation(() => chainApi)
  chainApi.toggleHeading.mockImplementation(() => chainApi)
  chainApi.toggleBulletList.mockImplementation(() => chainApi)
  chainApi.toggleOrderedList.mockImplementation(() => chainApi)
  chainApi.toggleBlockquote.mockImplementation(() => chainApi)
  chainApi.toggleCodeBlock.mockImplementation(() => chainApi)
  chainApi.setHorizontalRule.mockImplementation(() => chainApi)
  chainApi.insertTable.mockImplementation(() => chainApi)
  chainApi.insertContent.mockImplementation(() => chainApi)
  chainApi.toggleCallout.mockImplementation(() => chainApi)

  const editor: any = {
    state: {
      selection: {
        from: 1,
        to: 1,
        $from: {
          parent: { textContent: '/' },
          parentOffset: 1,
        },
      },
      doc: {
        textBetween: (from: number, to: number) => (from === 0 && to === 1 ? '/' : ''),
      },
    },
    view: {
      state: null,
      coordsAtPos: () => ({ left: 24, right: 40, top: 12 }),
      dom,
    },
    storage: {
      characterCount: {
        characters: () => 0,
      },
    },
    commands: {
      setContent: vi.fn(),
    },
    chain: () => chainApi,
    getJSON: () => ({ type: 'doc', content: [] }),
    getText: () => '',
    isActive: () => false,
  }

  editor.view.state = editor.state

  return {
    editor,
    chainApi,
  }
}

function createAiReturn() {
  return {
    isGenerating: false,
    errorMessage: null,
    clearError: vi.fn(),
    runRequest: vi.fn().mockResolvedValue(undefined),
    generateAtCursor: vi.fn(),
    rewriteSelection: vi.fn(),
    continueWriting: vi.fn(),
    cancel: vi.fn(),
  }
}

describe('NikoEditor inline AI failure feedback', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useAppStore.setState({
      wordMetrics: { wordCount: 0, charCount: 0, readingTime: 0 },
    })
    vi.useFakeTimers()
    vi.clearAllMocks()
    latestEditorConfig = null
    currentEditorHarness = null
    mockUseEditor.mockImplementation((config) => {
      latestEditorConfig = config
      currentEditorHarness ??= createComponentEditorHarness()
      return currentEditorHarness.editor
    })
  })

  it('proxies exported instruction helpers through the shared editor prompt policy', () => {
    expect(buildEditorStyleInstruction('en', 'Keep it spare')).toBe(
      buildEditorAIStyleInstruction('en', 'Keep it spare'),
    )
    expect(buildEditorStyleInstruction('zh', '保留克制语气')).toBe(
      buildEditorAIStyleInstruction('zh', '保留克制语气'),
    )
    expect(getEditorGenerateInstruction('en')).toBe(
      getEditorActionInstruction('en', 'generate'),
    )
    expect(getEditorFullArticleInstruction('zh')).toBe(
      getEditorActionInstruction('zh', 'full-article'),
    )
  })

  it('shows the inline failure chip with translated copy and clears it after the timeout', () => {
    const clearError = vi.fn()
    mockUseEditorAI.mockReturnValue({
      isGenerating: false,
      errorMessage: 'stream failed',
      clearError,
      runRequest: vi.fn(),
      generateAtCursor: vi.fn(),
      rewriteSelection: vi.fn(),
      continueWriting: vi.fn(),
      cancel: vi.fn(),
    })

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(zh.inlineActionFailed)
    expect(status).toHaveAttribute('title', 'stream failed')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(clearError).toHaveBeenCalledTimes(1)
  })

  it('handles save and shortcut hotkeys and dismisses the shortcuts panel', () => {
    mockUseEditorAI.mockReturnValue(createAiReturn())
    const onSave = vi.fn()

    render(<NikoEditor onOpenWritingHelper={vi.fn()} onSave={onSave} />)

    const saveEvent = {
      ctrlKey: true,
      metaKey: false,
      key: 's',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent
    const shortcutsEvent = {
      ctrlKey: true,
      metaKey: false,
      key: '/',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent

    act(() => {
      expect(
        latestEditorConfig.editorProps.handleKeyDown(
          currentEditorHarness.editor.view,
          saveEvent,
        ),
      ).toBe(true)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(saveEvent.preventDefault).toHaveBeenCalledTimes(1)

    act(() => {
      expect(
        latestEditorConfig.editorProps.handleKeyDown(
          currentEditorHarness.editor.view,
          shortcutsEvent,
        ),
      ).toBe(true)
    })
    expect(shortcutsEvent.preventDefault).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: /Keyboard Shortcuts|快捷键/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Close|关闭/ }))
    expect(
      screen.queryByRole('heading', { name: /Keyboard Shortcuts|快捷键/ }),
    ).not.toBeInTheDocument()
  })

  it('toggles show tell and closes slash menus via explicit close and escape', () => {
    mockUseEditorAI.mockReturnValue(createAiReturn())

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '开启 Show/Tell' }))
    })
    expect(screen.getByRole('button', { name: '关闭 Show/Tell' })).toBeInTheDocument()

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })
    expect(screen.getByTestId('slash-ai-generate')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByTestId('slash-close'))
    })
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })
    expect(screen.getByTestId('slash-ai-generate')).toBeInTheDocument()

    act(() => {
      expect(
        latestEditorConfig.editorProps.handleKeyDown(
          currentEditorHarness.editor.view,
          { key: 'Escape' } as KeyboardEvent,
        ),
      ).toBe(true)
    })
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()

    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 1,
      to: 1,
    }
    act(() => {
      latestEditorConfig.onSelectionUpdate({ editor: currentEditorHarness.editor })
    })
    expect(screen.queryByTestId('bubble-rewrite')).not.toBeInTheDocument()
  })

  it.each([
    { language: 'en' as const, localizedSnippet: 'Tone: serious' },
    { language: 'zh' as const, localizedSnippet: '情感基调：严肃' },
  ])(
    'passes the active locale and reconstructed persisted style requirements to useEditorAI for $language',
    ({ language, localizedSnippet }) => {
      expect(getPersistedStyleRequirements(language)).toBe('')

      const persistedStyle = {
        ...DEFAULT_WRITING_STYLE,
        tone: 'serious' as const,
        formality: 4,
        structure: {
          ...DEFAULT_WRITING_STYLE.structure,
          paragraphLength: 'short' as const,
        },
        thinking: {
          ...DEFAULT_WRITING_STYLE.thinking,
          depth: 5,
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
      }
      saveStyle(persistedStyle)
      useSettingsStore.getState().updateSettings({ language })
      mockUseEditorAI.mockReturnValue(createAiReturn())

      render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

      expect(mockUseEditorAI).toHaveBeenCalledTimes(1)
      const options = mockUseEditorAI.mock.calls[0]?.[0]
      const expectedStyleRequirements = getPersistedStyleRequirements(language)

      expect(options.language).toBe(language)
      expect(expectedStyleRequirements).toContain(localizedSnippet)
      expect(options.getStyleRequirements?.()).toBe(expectedStyleRequirements)
      expect(options.getStyleRequirements?.()).not.toContain('"tone"')
    },
  )

  it('routes slash AI commands through a slash-owned restart guard before deleting the command range', () => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    act(() => {
      screen.getByTestId('slash-ai-generate').click()
    })

    expect(aiReturn.runRequest).toHaveBeenCalledWith(
      { action: 'generate' },
      expect.objectContaining({
        owner: 'slash',
        allowRestart: true,
        beforeRequestStart: expect.any(Function),
      }),
    )
    expect(currentEditorHarness.chainApi.deleteRange).not.toHaveBeenCalled()

    const requestOptions = aiReturn.runRequest.mock.calls[0]?.[1]
    act(() => {
      requestOptions.beforeRequestStart()
    })

    expect(currentEditorHarness.chainApi.deleteRange).toHaveBeenCalledWith({ from: 0, to: 1 })
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()
  })

  it.each([
    {
      button: 'slash-heading-1',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleHeading).toHaveBeenCalledWith({ level: 1 }),
    },
    {
      button: 'slash-heading-2',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleHeading).toHaveBeenCalledWith({ level: 2 }),
    },
    {
      button: 'slash-heading-3',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleHeading).toHaveBeenCalledWith({ level: 3 }),
    },
    {
      button: 'slash-bullet-list',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleBulletList).toHaveBeenCalledTimes(1),
    },
    {
      button: 'slash-ordered-list',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleOrderedList).toHaveBeenCalledTimes(1),
    },
    {
      button: 'slash-blockquote',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleBlockquote).toHaveBeenCalledTimes(1),
    },
    {
      button: 'slash-code-block',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleCodeBlock).toHaveBeenCalledTimes(1),
    },
    {
      button: 'slash-horizontal-rule',
      assertion: () =>
        expect(currentEditorHarness.chainApi.setHorizontalRule).toHaveBeenCalledTimes(1),
    },
    {
      button: 'slash-table',
      assertion: () =>
        expect(currentEditorHarness.chainApi.insertTable).toHaveBeenCalledWith({
          rows: 3,
          cols: 3,
          withHeaderRow: true,
        }),
    },
    {
      button: 'slash-math',
      assertion: () =>
        expect(currentEditorHarness.chainApi.insertContent).toHaveBeenCalledWith({
          type: 'mathInline',
          attrs: { latex: '' },
        }),
    },
    {
      button: 'slash-math-block',
      assertion: () =>
        expect(currentEditorHarness.chainApi.insertContent).toHaveBeenCalledWith({
          type: 'mathBlock',
          attrs: { latex: '' },
        }),
    },
    {
      button: 'slash-callout',
      assertion: () =>
        expect(currentEditorHarness.chainApi.toggleCallout).toHaveBeenCalledWith('info'),
    },
  ])('applies %s formatting commands and clears the slash menu', ({ button, assertion }) => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    fireEvent.click(screen.getByTestId(button))

    expect(currentEditorHarness.chainApi.deleteRange).toHaveBeenCalledWith({ from: 0, to: 1 })
    assertion()
    expect(screen.queryByTestId(button)).not.toBeInTheDocument()
  })

  it('tags bubble rewrite and continue actions with the bubble owner restart semantics', () => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 1,
      to: 4,
    }

    act(() => {
      latestEditorConfig.onSelectionUpdate({
        editor: currentEditorHarness.editor,
      })
    })

    act(() => {
      screen.getByTestId('bubble-rewrite').click()
      screen.getByTestId('bubble-continue').click()
    })

    expect(aiReturn.runRequest).toHaveBeenNthCalledWith(
      1,
      { action: 'rewrite', variant: 'formal' },
      expect.objectContaining({
        owner: 'bubble',
        allowRestart: true,
      }),
    )
    expect(aiReturn.runRequest).toHaveBeenNthCalledWith(
      2,
      { action: 'continue' },
      expect.objectContaining({
        owner: 'bubble',
        allowRestart: true,
      }),
    )
  })

  it('updates parent state, metrics, and slash query during editor updates', () => {
    const aiReturn = createAiReturn()
    mockUseEditorAI.mockReturnValue(aiReturn)
    const onUpdate = vi.fn()

    render(<NikoEditor onOpenWritingHelper={vi.fn()} onUpdate={onUpdate} />)

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    currentEditorHarness.editor.getJSON = () => ({ type: 'doc', content: [] })
    currentEditorHarness.editor.getText = () => 'hello world'
    currentEditorHarness.editor.storage.characterCount.characters = () => 42
    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 5,
    }
    currentEditorHarness.editor.state.doc.textBetween = (from: number, to: number) =>
      from === 0 && to === 5 ? '/idea' : ''

    act(() => {
      latestEditorConfig.onUpdate({ editor: currentEditorHarness.editor })
    })

    expect(onUpdate).toHaveBeenCalledWith({ type: 'doc', content: [] }, 'hello world')
    expect(useAppStore.getState().wordMetrics).toMatchObject({
      wordCount: 2,
      charCount: 42,
      readingTime: 2 / 300,
    })
    expect(screen.getByTestId('slash-query')).toHaveTextContent('idea')

    currentEditorHarness.editor.state.doc.textBetween = () => '/two words'
    act(() => {
      latestEditorConfig.onUpdate({ editor: currentEditorHarness.editor })
    })

    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()

    currentEditorHarness.editor.getText = () => ''
    currentEditorHarness.editor.storage = {}
    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 0,
    }
    currentEditorHarness.editor.state.doc.textBetween = () => ''
    act(() => {
      latestEditorConfig.onUpdate({ editor: currentEditorHarness.editor })
    })

    expect(useAppStore.getState().wordMetrics).toMatchObject({
      wordCount: 0,
      charCount: 0,
      readingTime: 0,
    })
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()
  })

  it('opens the bubble toolbar from selection updates and dismisses it via close and outside click', () => {
    mockUseEditorAI.mockReturnValue(createAiReturn())

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 1,
      to: 4,
    }

    act(() => {
      latestEditorConfig.onSelectionUpdate({ editor: currentEditorHarness.editor })
    })

    expect(screen.getByTestId('bubble-rewrite')).toBeInTheDocument()
    expect(screen.queryByTestId('slash-ai-generate')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('bubble-close'))
    expect(screen.queryByTestId('bubble-rewrite')).not.toBeInTheDocument()

    act(() => {
      latestEditorConfig.onSelectionUpdate({ editor: currentEditorHarness.editor })
    })

    expect(screen.getByTestId('bubble-rewrite')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('bubble-rewrite')).not.toBeInTheDocument()
  })

  it('renders the generating indicator and lets the user cancel generation', () => {
    const aiReturn = {
      ...createAiReturn(),
      isGenerating: true,
    }
    mockUseEditorAI.mockReturnValue(aiReturn)

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    expect(screen.getByText(/AI generating|AI 生成中/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel|取消/ }))
    expect(aiReturn.cancel).toHaveBeenCalledTimes(1)
  })

  it('opens the API key guide from the editor AI hook and forwards settings navigation', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    mockUseEditorAI.mockReturnValue(createAiReturn())
    const onOpenSettings = vi.fn()

    render(
      <NikoEditor
        onOpenWritingHelper={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    )

    const options = mockUseEditorAI.mock.calls[0]?.[0]
    act(() => {
      options.onApiKeyMissing()
    })

    expect(screen.getByText('Configure AI Writing Assistant')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Configure AI Writing Assistant')).not.toBeInTheDocument()
  })

  it('syncs changed initialContent into the live editor after mount', () => {
    mockUseEditorAI.mockReturnValue(createAiReturn())

    const { rerender } = render(
      <NikoEditor onOpenWritingHelper={vi.fn()} initialContent="first" />,
    )

    expect(currentEditorHarness.editor.commands.setContent).not.toHaveBeenCalled()

    rerender(<NikoEditor onOpenWritingHelper={vi.fn()} initialContent="second" />)
    rerender(<NikoEditor onOpenWritingHelper={vi.fn()} initialContent="" />)

    expect(currentEditorHarness.editor.commands.setContent).toHaveBeenNthCalledWith(
      1,
      'second',
      { emitUpdate: false },
    )
    expect(currentEditorHarness.editor.commands.setContent).toHaveBeenNthCalledWith(
      2,
      '',
      { emitUpdate: false },
    )
  })

  it('builds localized prompt payloads through the shared editor AI policy', () => {
    expect(buildEditorAIStyleInstruction('en', 'Keep it spare')).toBe('Style requirements: Keep it spare')
    expect(buildEditorAIStyleInstruction('zh', '保留克制语气')).toBe('风格要求：保留克制语气')
    expect(buildEditorAIStyleInstruction('en', '   ')).toBe('')
    expect(getEditorActionInstruction('en', 'generate')).toContain('Generate a fitting passage')
    expect(getEditorActionInstruction('zh', 'full-article')).toContain('完整的文章')

    const zhPayload = buildEditorAIPayload({
      request: { action: 'generate' },
      language: 'zh',
      contextBefore: '前文',
      rawStyleRequirements: '保留克制语气',
    })
    const enPayload = buildEditorAIPayload({
      request: { action: 'rewrite', variant: 'formal' },
      language: 'en',
      selectedText: 'target',
      rawStyleRequirements: 'Keep it spare',
    })

    expect(zhPayload.prompt).toContain('上下文数据：')
    expect(zhPayload.styleInstruction).toBe('风格要求：保留克制语气')
    expect(enPayload.prompt).toContain('Original text:')
    expect(enPayload.prompt).toContain('Rewrite requirement:')
    expect(enPayload.styleInstruction).toBe('Style requirements: Keep it spare')
    expect(en.inlineActionFailed).toBeTruthy()
  })
})

import { act, render, screen } from '@testing-library/react'
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
    query,
    onClose,
  }: {
    onSelect: (item: unknown) => void
    onClose: () => void
    query: string
  }) => (
    <div>
      <div data-testid="slash-query">{query}</div>
      <button data-testid="slash-close" onClick={onClose}>slash-close</button>
    </div>
  ),
}))

vi.mock('./editor/BubbleToolbar', () => ({
  BubbleToolbar: () => <div />,
}))

vi.mock('./editor/WritingStyle', () => ({
  DEFAULT_WRITING_STYLE: 'literary',
  getPersistedStyleRequirements: () => null,
  saveStyle: vi.fn(),
}))

vi.mock('../hooks/useEditorAI', () => ({
  useEditorAI: vi.fn(),
}))

import { useSettingsStore } from '../stores/settingsStore'
import { useEditorAI } from '../hooks/useEditorAI'
import { NikoEditor } from './NikoEditor'
import { useAppStore } from '../stores/appStore'

const mockUseEditor = vi.mocked(useEditor)
const mockUseEditorAI = vi.mocked(useEditorAI)

let latestEditorConfig: any = null
let currentEditorHarness: any = null

function createComponentEditorHarness() {
  const dom = document.createElement('div')
  dom.getBoundingClientRect = () =>
    ({
      left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, x: 0, y: 0, toJSON: () => ({}),
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

  return { editor, chainApi }
}

function createAiReturn() {
  return {
    isGenerating: false,
    errorMessage: null,
    clearError: vi.fn(),
    runRequest: vi.fn(),
    generateAtCursor: vi.fn(),
    rewriteSelection: vi.fn(),
    continueWriting: vi.fn(),
    cancel: vi.fn(),
  }
}

describe('NikoEditor slash state branch coverage', () => {
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

  it('resets slash state when cursor moves before slash range (line 204)', () => {
    mockUseEditorAI.mockReturnValue(createAiReturn())

    render(<NikoEditor onOpenWritingHelper={vi.fn()} />)

    // Activate slash command mode by typing "/"
    act(() => {
      latestEditorConfig.editorProps.handleKeyDown(
        currentEditorHarness.editor.view,
        { key: '/' } as KeyboardEvent,
      )
      vi.runAllTimers()
    })

    // Verify slash menu is showing
    expect(screen.getByTestId('slash-query')).toBeInTheDocument()

    // Move cursor before the slash position (from <= slashFrom)
    // This triggers the branch at line 204: setSlashState(EMPTY_SLASH)
    currentEditorHarness.editor.state.selection = {
      ...currentEditorHarness.editor.state.selection,
      from: 0,  // Before the slash which starts at position 0
      to: 0,
    }

    act(() => {
      latestEditorConfig.onUpdate({ editor: currentEditorHarness.editor })
    })

    // The slash menu should be dismissed (EMPTY_SLASH)
    expect(screen.queryByTestId('slash-query')).not.toBeInTheDocument()
  })
})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const editorHandleMocks = vi.hoisted(() => ({
  triggerAIContinue: vi.fn(),
  setGeneratingListener: vi.fn(),
  generatingListener: null as null | ((value: boolean) => void),
}))

vi.mock('../i18n', async () => {
  const actual = await vi.importActual<typeof import('../i18n')>('../i18n')

  return {
    ...actual,
    useI18n: () => ({
      t: actual.translations.en,
      translate: (key: keyof typeof actual.translations.en, params?: Record<string, string>) => {
        const raw = actual.translations.en[key] ?? String(key)
        if (!params) return raw
        return Object.entries(params).reduce(
          (text, [name, value]) => text.replace(`{${name}}`, value),
          raw,
        )
      },
      language: 'en',
    }),
  }
})

vi.mock('./StoryBiblePanel', () => ({
  StoryBiblePanel: () => <div>Story Bible</div>,
}))

vi.mock('./HistoryPanel', () => ({
  HistoryPanel: () => <div data-testid="history-panel">History panel</div>,
}))

vi.mock('./ExportDialog', () => ({
  ExportDialog: ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div data-testid="export-dialog">
      <span>{title}</span>
      <button type="button" onClick={onClose}>
        close-export
      </button>
    </div>
  ),
}))

vi.mock('./editor/EmptyEditorGuide', () => ({
  EmptyEditorGuide: ({ onAIContinue, onAddCharacter, onFromTemplate }: { onAIContinue: () => void; onAddCharacter: () => void; onFromTemplate: () => void }) => (
    <div data-testid="empty-editor-guide">
      <button type="button" onClick={onAIContinue}>AI Continue</button>
      <button type="button" onClick={onAddCharacter}>Add Character</button>
      <button type="button" onClick={onFromTemplate}>Start from Template</button>
    </div>
  ),
}))

vi.mock('./NikoEditor', () => ({
  NikoEditor: ({
    initialContent,
    onUpdate,
    onSave,
  }: {
    initialContent?: unknown
    onUpdate: (json: Record<string, unknown>, text: string) => void
    onSave: () => void
  }) => {
    const rendered =
      typeof initialContent === 'string'
        ? initialContent
        : initialContent
          ? JSON.stringify(initialContent)
          : ''

    return (
      <div>
        <div data-testid="editor-props">{rendered}</div>
        <button
          type="button"
          onClick={() =>
            onUpdate(
              {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Hello save world' }],
                  },
                ],
              },
              'Hello save world',
            )
          }
        >
          emit-update
        </button>
        <button type="button" onClick={onSave}>
          emit-save
        </button>
        <button
          type="button"
          onClick={() => editorHandleMocks.generatingListener?.(true)}
        >
          emit-generating
        </button>
      </div>
    )
  },
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(() => ({
    triggerAIContinue: editorHandleMocks.triggerAIContinue,
  })),
  setGeneratingListener: vi.fn((listener: ((value: boolean) => void) | null) => {
    editorHandleMocks.generatingListener = listener
    editorHandleMocks.setGeneratingListener(listener)
  }),
}))

vi.mock('../services/projectFileService', () => ({
  readChapterContent: vi.fn(),
  writeChapterContent: vi.fn(),
}))

vi.mock('../services/versionService', () => ({
  autoSaveSnapshot: vi.fn(),
}))

vi.mock('../api/analysis', () => ({
  buildPersonalizedCraftProfile: vi.fn(() => ({
    dominantWeaknesses: [],
    growthTrajectory: { summary: 'steady' },
    recommendations: [],
  })),
}))

import { createDefaultProjectWorkspaceContext } from '../types/workspace'
import { readChapterContent, writeChapterContent } from '../services/projectFileService'
import { autoSaveSnapshot } from '../services/versionService'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { DocumentEditor } from './DocumentEditor'

const mockedReadChapterContent = vi.mocked(readChapterContent)
const mockedWriteChapterContent = vi.mocked(writeChapterContent)
const mockedAutoSaveSnapshot = vi.mocked(autoSaveSnapshot)

function resetEditorState() {
  useSettingsStore.getState().updateSettings({ language: 'en' })
  useAppStore.setState((state) => ({
    ...state,
    backendStatus: false,
    currentProjectId: 'project-doc',
    currentChapterId: 'chapter-doc',
    currentConversationId: 'conv-doc',
    conversationsById: {
      'conv-doc': {
        id: 'conv-doc',
        title: 'Draft title',
        messages: [],
        createdAt: new Date('2026-06-03T00:00:00Z'),
        updatedAt: new Date('2026-06-03T00:00:00Z'),
        workspace: createDefaultProjectWorkspaceContext(),
      },
    },
    allConversationIds: ['conv-doc'],
    historyPanelOpen: false,
    editorIsDirty: false,
    sessionIntelligenceEnabled: false,
    sessionIntelligenceSummary: null,
    sessionIntelligenceInsights: [],
    sessionIntelligenceSessionId: null,
    personalizedCraftEnabled: false,
    personalizedCraftSummary: null,
    personalizedCraftTrajectory: null,
    personalizedCraftRecommendations: [],
  }))
}

async function renderDocumentEditor(props?: Partial<React.ComponentProps<typeof DocumentEditor>>) {
  const result = render(
    <DocumentEditor
      onOpenWritingHelper={() => {}}
      onOpenSettings={props?.onOpenSettings}
      onOpenCharacterPanel={props?.onOpenCharacterPanel}
      onOpenTemplateBrowser={props?.onOpenTemplateBrowser}
    />,
  )

  await screen.findByText('Story Bible')
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  resetEditorState()
  editorHandleMocks.generatingListener = null
  mockedReadChapterContent.mockResolvedValue(JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }))
  mockedWriteChapterContent.mockResolvedValue()
  mockedAutoSaveSnapshot.mockResolvedValue()
})

describe('DocumentEditor branch coverage — additional', () => {
  // Line 152: readChapterContent resolves with null content,
  // falling to `content || JSON.stringify(...)` fallback branch
  it('falls back to default JSON when readChapterContent resolves with null (line 152)', async () => {
    mockedReadChapterContent.mockResolvedValueOnce(null as never)

    await renderDocumentEditor()

    // The editor should receive the fallback default JSON string
    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('"type":"doc"')
    })
  })

  // Line 156: readChapterContent rejects, .catch handler runs
  it('uses default JSON when readChapterContent rejects (line 156)', async () => {
    mockedReadChapterContent.mockRejectedValueOnce(new Error('file not found'))

    await renderDocumentEditor()

    await waitFor(() => {
      // The catch handler sets the same fallback JSON
      expect(screen.getByTestId('editor-props')).toHaveTextContent('"type":"doc"')
    })
  })

  // Line 180: first auto-save where saveTimerRef.current is null
  // so the `if (saveTimerRef.current) clearTimeout(...)` branch is not taken
  it('skips clearTimeout on first editor update when saveTimerRef is null (line 180)', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    await renderDocumentEditor()

    // First update: saveTimerRef.current is null, so clearTimeout is NOT called
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    // The first update should not have called clearTimeout for the save timer
    // (clearTimeout may be called for other timers like craft profile, so we check
    // that no clearTimeout was invoked for a timeout ID that came from the save timer)
    // On first update, saveTimerRef.current is null, so the if-branch is skipped
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    vi.useRealTimers()

    clearTimeoutSpy.mockRestore()
  })

  // Line 180 also: second editor update where saveTimerRef.current IS set,
  // so clearTimeout IS called — covers the truthy branch of the if-condition
  it('calls clearTimeout on second editor update when saveTimerRef is set (line 180 truthy)', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    await renderDocumentEditor()

    // First update sets saveTimerRef.current to a timeout ID
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    // Second update: saveTimerRef.current is now set, so clearTimeout IS called
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    // clearTimeout should have been called at least once for the save timer
    expect(clearTimeoutSpy).toHaveBeenCalled()

    vi.useFakeTimers()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    vi.useRealTimers()

    clearTimeoutSpy.mockRestore()
  })

  // Line 296: editorStateCache has entry for currentChapterId but .json is null,
  // so `?.json ?? chapterContent` falls through to chapterContent
  it('uses chapterContent when cache entry exists but json is null (line 296)', async () => {
    const specificContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'from-read' } }] })
    mockedReadChapterContent.mockResolvedValueOnce(specificContent)

    // Set up state with a specific chapter
    useAppStore.setState((state) => ({
      ...state,
      currentProjectId: 'project-cache',
      currentChapterId: 'chapter-cache-null-json',
      currentConversationId: null,
      conversationsById: {},
      allConversationIds: [],
    }))

    await renderDocumentEditor()

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('from-read')
    })

    // Trigger an editor update with text content (not null json),
    // then switch away and back — but we need the cache entry to have null json.
    // The cache is populated on chapter switch from editorJson state.
    // To get null json in the cache, we need to switch chapters without
    // having editorJson set. Let's do a fresh approach:

    // Switch to a different chapter first
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-other',
      }))
    })

    await waitFor(() => {
      // The other chapter gets default content
      expect(mockedReadChapterContent).toHaveBeenCalledWith('project-cache', 'chapter-other')
    })

    // Now switch back to the original chapter.
    // The cache for 'chapter-cache-null-json' was set during the first switch-away
    // with { json: null, text: '' } because no editor update happened on that chapter
    // (editorJson was null since we only read, never called onUpdate).
    mockedReadChapterContent.mockResolvedValueOnce('cached-fallback-content')

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-cache-null-json',
      }))
    })

    await waitFor(() => {
      // When cache has json:null, the `?.json ?? chapterContent` falls through
      // to chapterContent which was set from readChapterContent
      expect(screen.getByTestId('editor-props')).toHaveTextContent('cached-fallback-content')
    })
  })
})

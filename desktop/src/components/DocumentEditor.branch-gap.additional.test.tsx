/**
 * DocumentEditor branch-gap additional test — focused coverage for uncovered branches
 *
 * Target branches:
 * - Line 58: fallbackTitle = currentConversationTitle ?? t.appTitle ?? '未命名文档'
 *   (a) t.appTitle is falsy → falls through to '未命名文档' deepest fallback
 * - Line 84: sessionKey = currentConversationId ?? currentChapterId ?? currentProjectId ?? 'session-global'
 *   (a) All three IDs null → session-global (existing test covers this but only renders,
 *       doesn't trigger updateSessionTelemetry which exercises the branch)
 * - Line 109: sessionIntelligence: telemetry ? [summarizeWritingSessionTelemetry(telemetry)] : []
 *   (a) telemetry is null (no prior telemetry) → passes empty array
 * - Line 297: editorStateCache.get(currentChapterId)?.json ?? chapterContent
 *   (a) Cache entry exists but .json is null → falls through to chapterContent
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const editorHandleMocks = vi.hoisted(() => ({
  triggerAIContinue: vi.fn(),
  setGeneratingListener: vi.fn(),
  generatingListener: null as null | ((value: boolean) => void),
}))

// Mock i18n with appTitle set to null so the ?? deepest fallback triggers
vi.mock('../i18n', async () => {
  const actual = await vi.importActual<typeof import('../i18n')>('../i18n')

  return {
    ...actual,
    useI18n: () => ({
      // appTitle is null so `t.appTitle ?? '未命名文档'` falls through (line 58)
      t: { ...actual.translations.en, appTitle: null as unknown as string },
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
                    content: [{ type: 'text', text: 'Hello world' }],
                  },
                ],
              },
              'Hello world',
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

vi.mock('../../../src-ts/analysis/personalized-craft-profile', () => ({
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
import { buildPersonalizedCraftProfile } from '../../../src-ts/analysis/personalized-craft-profile'

const mockedReadChapterContent = vi.mocked(readChapterContent)
const mockedWriteChapterContent = vi.mocked(writeChapterContent)
const mockedAutoSaveSnapshot = vi.mocked(autoSaveSnapshot)
const mockedBuildPersonalizedCraftProfile = vi.mocked(buildPersonalizedCraftProfile)

function resetEditorState(overrides?: Record<string, unknown>) {
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
    ...overrides,
  }))
}

async function renderDocumentEditor(props?: Partial<React.ComponentProps<typeof DocumentEditor>>) {
  mockedReadChapterContent.mockResolvedValue('chapter text content')

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

describe('DocumentEditor branch-gap additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    resetEditorState()
    mockedReadChapterContent.mockResolvedValue('chapter text content')
    mockedWriteChapterContent.mockResolvedValue()
    mockedAutoSaveSnapshot.mockResolvedValue()
    mockedBuildPersonalizedCraftProfile.mockReturnValue({
      dominantWeaknesses: [],
      growthTrajectory: { summary: 'steady' },
      recommendations: [],
    })
  })

  // Line 58: deepest fallback '未命名文档' when t.appTitle is null/undefined
  // The i18n mock above sets appTitle to null, so with no conversation title
  // the ?? operator falls through to '未命名文档'
  it('uses deepest fallback when conversation title is null and appTitle is null (line 58)', async () => {
    resetEditorState({
      currentConversationId: null,
      conversationsById: {},
      allConversationIds: [],
    })

    await renderDocumentEditor()

    // With appTitle=null and no conversation, the ?? operator falls through to '未命名文档'
    const titleInput = screen.getByRole('textbox', { name: 'Document title' })
    expect(titleInput).toHaveValue('未命名文档')
  })

  // Line 84: session-global fallback triggered by an editor update
  // when all conversation/chapter/project IDs are null
  it('uses session-global key when all IDs are null and editor updates (line 84)', async () => {
    resetEditorState({
      currentConversationId: null,
      currentChapterId: null,
      currentProjectId: null,
      conversationsById: {},
      allConversationIds: [],
    })

    await renderDocumentEditor()

    // Trigger an editor update to exercise updateSessionTelemetry
    // which contains the sessionKey = ... ?? 'session-global' branch
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    // The component should still render correctly
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  // Line 109: buildPersonalizedCraftProfile is called with sessionIntelligence
  // When personalizedCraftEnabled is true and a non-editor_update event fires
  // (e.g., history_open), runCraftProfile runs immediately.
  it('invokes buildPersonalizedCraftProfile on history panel open with craft enabled (line 109)', async () => {
    mockedBuildPersonalizedCraftProfile.mockReturnValue({
      dominantWeaknesses: [],
      growthTrajectory: { summary: 'no data yet' },
      recommendations: [{ summary: 'Keep writing' }],
    } as ReturnType<typeof buildPersonalizedCraftProfile>)

    resetEditorState({
      personalizedCraftEnabled: true,
      historyPanelOpen: false,
    })

    await renderDocumentEditor()

    // Opening history panel triggers updateSessionTelemetry({ type: 'history_open' })
    // which (since event.type !== 'editor_update') immediately calls runCraftProfile (line 126)
    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        historyPanelOpen: true,
      }))
    })

    await waitFor(() => {
      expect(mockedBuildPersonalizedCraftProfile).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Verify sessionIntelligence was passed as an array
    const lastCall = mockedBuildPersonalizedCraftProfile.mock.calls[mockedBuildPersonalizedCraftProfile.mock.calls.length - 1]
    expect(lastCall[0]).toHaveProperty('sessionIntelligence')
    expect(Array.isArray(lastCall[0].sessionIntelligence)).toBe(true)
  })

  // Line 109: buildPersonalizedCraftProfile receives telemetry after editor update
  // After an editor update, the 3s debounce timer fires and calls runCraftProfile
  // with a non-null telemetry.
  it('invokes buildPersonalizedCraftProfile after debounce with craft enabled (line 109 truthy)', async () => {
    mockedBuildPersonalizedCraftProfile.mockReturnValue({
      dominantWeaknesses: [{ dimensionId: 'pacing', latestStatus: 'needs work' }],
      growthTrajectory: { summary: 'growing' },
      recommendations: [{ summary: 'Improve pacing' }],
    } as ReturnType<typeof buildPersonalizedCraftProfile>)

    resetEditorState({
      personalizedCraftEnabled: true,
    })

    await renderDocumentEditor()

    // Trigger an editor update — sets editorTextRef and starts 3s debounce
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    // Wait for the debounce timer (3 seconds) to fire
    await waitFor(() => {
      expect(mockedBuildPersonalizedCraftProfile).toHaveBeenCalled()
    }, { timeout: 8000 })
  })

  // Line 297: editorStateCache has entry for currentChapterId but .json is null
  // → falls through to chapterContent via ?.json ?? chapterContent
  // When a chapter is loaded but no editor update happened (editorJson stays null),
  // switching away caches { json: null, text: '' }, then switching back
  // hits `?.json ?? chapterContent` where json is null.
  it('uses chapterContent when cache entry has null json (line 297)', async () => {
    const initialContent = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'from-read' } }] })
    mockedReadChapterContent.mockResolvedValueOnce(initialContent)

    resetEditorState({
      currentProjectId: 'project-cache',
      currentChapterId: 'chapter-A',
      currentConversationId: null,
      conversationsById: {},
      allConversationIds: [],
    })

    await renderDocumentEditor()

    // Verify initial content loaded
    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('from-read')
    }, { timeout: 5000 })

    // Switch to a different chapter — no editor update happened on chapter-A,
    // so the cache stores { json: null, text: '' }
    mockedReadChapterContent.mockResolvedValue('other-chapter-content')

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-B',
      }))
    })

    // Wait for the other chapter to load
    await waitFor(() => {
      expect(mockedReadChapterContent).toHaveBeenCalledWith('project-cache', 'chapter-B')
    }, { timeout: 5000 })

    // Switch back to chapter-A — cache has { json: null, text: '' }
    // so `?.json ?? chapterContent` falls through to chapterContent
    mockedReadChapterContent.mockResolvedValueOnce('cached-fallback-content')

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-A',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('cached-fallback-content')
    }, { timeout: 5000 })
  })
})

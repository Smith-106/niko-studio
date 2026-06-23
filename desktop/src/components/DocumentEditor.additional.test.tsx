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
import { buildPersonalizedCraftProfile } from '../api/analysis'

const mockedReadChapterContent = vi.mocked(readChapterContent)
const mockedWriteChapterContent = vi.mocked(writeChapterContent)
const mockedAutoSaveSnapshot = vi.mocked(autoSaveSnapshot)
const mockedBuildPersonalizedCraftProfile = vi.mocked(buildPersonalizedCraftProfile)

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

describe('DocumentEditor additional coverage', () => {
  it('loads chapter content, shows the empty guide, and routes guide actions', async () => {
    const onOpenCharacterPanel = vi.fn()
    const onOpenTemplateBrowser = vi.fn()

    mockedReadChapterContent.mockResolvedValueOnce(
      JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    )

    await renderDocumentEditor({ onOpenCharacterPanel, onOpenTemplateBrowser })

    expect(mockedReadChapterContent).toHaveBeenCalledWith('project-doc', 'chapter-doc')
    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('"type":"doc"')
    })

    fireEvent.click(screen.getByRole('button', { name: /AI Continue/i }))
    expect(editorHandleMocks.triggerAIContinue).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Add Character/i }))
    expect(onOpenCharacterPanel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Start from Template/i }))
    expect(onOpenTemplateBrowser).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(useAppStore.getState().historyPanelOpen).toBe(true)
  })

  it('auto-saves editor updates, toggles dirty state, and opens export dialog', async () => {
    await renderDocumentEditor()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(useAppStore.getState().editorIsDirty).toBe(true)
    expect(screen.getByText('Words: 3')).toBeInTheDocument()
    expect(screen.getByText(/Chars:\s*16/)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    vi.useRealTimers()

    await waitFor(() => {
      expect(mockedWriteChapterContent).toHaveBeenCalledWith(
        'project-doc',
        'chapter-doc',
        JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello save world' }],
            },
          ],
        }),
      )
    })

    expect(mockedAutoSaveSnapshot).toHaveBeenCalledWith('project-doc', 'chapter-doc')
    expect(useAppStore.getState().editorIsDirty).toBe(false)
    expect(screen.getByText(/Saved at/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Export Document'))
    expect(screen.getByTestId('export-dialog')).toBeInTheDocument()
    expect(screen.getByText('Draft title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'close-export' }))
    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'emit-generating' }))
    expect(screen.getByText(/AI generating/)).toBeInTheDocument()
  })

  it('surfaces save errors for manual saves and keeps snapshot attempt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedWriteChapterContent.mockRejectedValueOnce(new Error('disk full'))

    await renderDocumentEditor()

    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))
    fireEvent.click(screen.getByRole('button', { name: 'emit-save' }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })

    expect(mockedWriteChapterContent).toHaveBeenCalledTimes(1)
    expect(mockedAutoSaveSnapshot).toHaveBeenCalledWith('project-doc', 'chapter-doc')
    errorSpy.mockRestore()
  })

  it('falls back on read failure and restores cached chapter state after switching chapters', async () => {
    mockedReadChapterContent.mockImplementation(async (_projectId, chapterId) => {
      if (chapterId === 'chapter-cache-1') {
        return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'remote-1' } }] })
      }
      if (chapterId === 'chapter-cache-2') {
        throw new Error('missing file')
      }
      return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
    })

    useAppStore.setState((state) => ({
      ...state,
      currentProjectId: 'project-cache',
      currentChapterId: 'chapter-cache-1',
      currentConversationId: null,
      conversationsById: {},
      allConversationIds: [],
    }))

    await renderDocumentEditor()

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('remote-1')
    })

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    vi.useRealTimers()

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-cache-2',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('"type":"doc"')
    })

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-cache-1',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('editor-props')).toHaveTextContent('Hello save world')
    })
  })

  it('updates session intelligence, personalized craft, and title fallback branches', async () => {
    mockedBuildPersonalizedCraftProfile.mockReturnValue({
      dominantWeaknesses: [{ dimensionId: 'pacing', latestStatus: 'needs-work' }],
      growthTrajectory: { summary: 'recovering' },
      recommendations: [{ summary: 'Tighten scene transitions.' }],
    } as never)

    useAppStore.setState((state) => ({
      ...state,
      currentConversationId: null,
      conversationsById: {},
      allConversationIds: [],
      currentProjectId: null,
      currentChapterId: 'chapter-craft',
      currentConversationTitle: null,
      sessionIntelligenceEnabled: true,
      personalizedCraftEnabled: true,
    }))

    await renderDocumentEditor()

    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('Novel Writing Assistant')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    vi.useRealTimers()

    await waitFor(() => {
      expect(useAppStore.getState().sessionIntelligenceSessionId).toBe('chapter-craft')
    })
    expect(useAppStore.getState().sessionIntelligenceSummary).toBeTruthy()
    expect(useAppStore.getState().sessionIntelligenceInsights.length).toBeGreaterThan(0)
    expect(useAppStore.getState().personalizedCraftSummary).toContain('pacing')
    expect(useAppStore.getState().personalizedCraftTrajectory).toBe('recovering')
    expect(useAppStore.getState().personalizedCraftRecommendations).toEqual(['Tighten scene transitions.'])
    expect(mockedBuildPersonalizedCraftProfile).toHaveBeenCalled()
  })

  it('clears craft timers when switching chapters before debounce completes', async () => {
    useAppStore.setState((state) => ({
      ...state,
      personalizedCraftEnabled: true,
    }))

    await renderDocumentEditor()

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'emit-update' }))

    act(() => {
      useAppStore.setState((state) => ({
        ...state,
        currentChapterId: 'chapter-timer-2',
      }))
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    vi.useRealTimers()

    expect(mockedBuildPersonalizedCraftProfile).toHaveBeenCalledTimes(1)
  })
})

import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshCanonPagesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const loadCanonPageMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const handleImportDraftMock = vi.hoisted(() => vi.fn())
const controllerMessages = vi.hoisted(() => ({
  draftMessage: null as null | { type: 'success' | 'error'; text: string },
  canonMessage: null as null | { type: 'success' | 'error'; text: string },
}))

vi.mock('./CollapsibleSection', () => ({
  CollapsibleSection: ({ title, content }: { title: string; content: ReactNode }) => (
    <section>
      <h4>{title}</h4>
      {content}
    </section>
  ),
}))

vi.mock('./StoryBibleDraftSection', () => ({
  StoryBibleDraftSection: () => <div data-testid="draft-section" />,
}))

vi.mock('./StoryBibleKnowledgeSection', () => ({
  StoryBibleKnowledgeSection: () => <div data-testid="knowledge-section" />,
}))

vi.mock('./StoryBibleNarrativeSection', () => ({
  StoryBibleNarrativeSection: () => <div data-testid="narrative-section" />,
}))

vi.mock('./StoryBibleCanonSection', () => ({
  StoryBibleCanonSection: ({
    onRefresh,
    onLoadPage,
  }: {
    onRefresh: () => void
    onLoadPage: (slug: string) => void
  }) => (
    <div>
      <button type="button" onClick={onRefresh}>
        refresh canon
      </button>
      <button type="button" onClick={() => onLoadPage('story-bible/test-synopsis')}>
        load canon page
      </button>
    </div>
  ),
}))

vi.mock('./useStoryBiblePanelController', () => ({
  useStoryBiblePanelController: () => ({
    t: {
      storyBibleStyleTried: 'Tried',
      storyBibleStyleTriedDesc: 'Keep current voice',
      storyBibleStyleMatchMy: 'Match my style',
      storyBibleStyleMatchMyDesc: 'Match prior samples',
      storyBibleStyleSoundsLike: 'Sounds like',
      storyBibleStyleSoundsLikeDesc: 'Match a reference',
      storyBibleStyleCustom: 'Custom',
      storyBibleStyleCustomDesc: 'Custom settings',
      storyBibleBraindump: 'Braindump',
      storyBibleBraindumpHint: 'Drop notes',
      storyBibleGenre: 'Genre',
      storyBibleGenrePlaceholder: 'Add genre',
      storyBibleSynopsis: 'Synopsis',
      storyBibleSynopsisPlaceholder: 'Synopsis placeholder',
      storyBibleOutline: 'Outline',
      storyBibleTitle: 'Story Bible',
      storyBibleDesc: 'Story Bible description',
      storyBiblePersistenceTitle: 'Persistence',
      storyBibleExportDraft: 'Export draft',
      storyBibleImportDraft: 'Import draft',
      storyBibleResetDraft: 'Reset draft',
      storyBibleCharacters: 'Characters',
      storyBibleWorldbuilding: 'Worldbuilding',
      storyBibleLoading: 'Loading',
      storyBibleEmpty: 'Empty',
      storyBibleStyleTitle: 'Style',
    },
    currentWorkspace: {
      authority: {
        activeSceneId: null,
        activeEventId: null,
        activeTimelineId: null,
      },
    },
    fileInputRef: {
      current: null,
    },
    characters: [],
    locations: [],
    sceneRecords: [],
    eventRecords: [],
    timelineRecords: [],
    braindump: '',
    genres: [],
    genreInput: '',
    synopsis: '',
    outline: '',
    selectedStyle: 'tried',
    sceneDraft: {},
    eventDraft: {},
    timelineDraft: {},
    sceneSaving: false,
    eventSaving: false,
    timelineSaving: false,
    draftMessage: controllerMessages.draftMessage,
    canonMessage: controllerMessages.canonMessage,
    canonPages: [],
    selectedCanonSlug: null,
    selectedCanonPage: null,
    canonLoading: false,
    canonLoadingSlug: null,
    canonPromoting: false,
    loading: false,
    workspaceNotice: ['workspace notice'],
    syncCopy: 'sync copy',
    canonCopy: {
      promoteSynopsis: 'Promote synopsis',
      reviewLoading: 'Review loading',
      reviewTitle: 'Canon Review',
      reviewHint: 'Review hint',
      reviewRefresh: 'Refresh review',
      reviewEmpty: 'No canon pages',
      reviewSelectHint: 'Select a page',
    },
    narrativeCopy: {
      scene: { sectionTitle: 'Scenes' },
      event: { sectionTitle: 'Events' },
      timeline: { sectionTitle: 'Timelines' },
    },
    genrePresets: ['Fantasy'],
    canPromoteSynopsis: false,
    synopsisPromotionHint: 'Add synopsis first',
    setBraindump: vi.fn(),
    setGenreInput: vi.fn(),
    setSynopsis: vi.fn(),
    setOutline: vi.fn(),
    setSelectedStyle: vi.fn(),
    setSceneDraft: vi.fn(),
    setEventDraft: vi.fn(),
    setTimelineDraft: vi.fn(),
    toggleGenre: vi.fn(),
    addCustomGenre: vi.fn(),
    handleExportDraft: vi.fn(),
    handleImportDraft: handleImportDraftMock,
    handleResetDraft: vi.fn(),
    handlePromoteSynopsis: vi.fn().mockResolvedValue(undefined),
    refreshCanonPages: refreshCanonPagesMock,
    loadCanonPage: loadCanonPageMock,
    selectSceneRecord: vi.fn(),
    selectEventRecord: vi.fn(),
    selectTimelineRecord: vi.fn(),
    activateNarrativeRecord: vi.fn(),
    handleSaveSceneRecord: vi.fn().mockResolvedValue(undefined),
    handleSaveEventRecord: vi.fn().mockResolvedValue(undefined),
    handleSaveTimelineRecord: vi.fn().mockResolvedValue(undefined),
  }),
}))

import { StoryBiblePanel } from './StoryBiblePanelContent'

describe('StoryBiblePanelContent shallow coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    controllerMessages.draftMessage = null
    controllerMessages.canonMessage = null
  })

  it('wires canon refresh and import button clicks through the panel shell', () => {
    const inputClickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})

    render(<StoryBiblePanel />)

    fireEvent.click(screen.getByRole('button', { name: 'refresh canon' }))
    expect(refreshCanonPagesMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'load canon page' }))
    expect(loadCanonPageMock).toHaveBeenCalledWith('story-bible/test-synopsis')

    fireEvent.click(screen.getByTitle('Import draft'))
    expect(inputClickSpy).toHaveBeenCalledTimes(1)

    inputClickSpy.mockRestore()
  })

  it('renders draft and canon messages with their respective text styles', () => {
    controllerMessages.draftMessage = { type: 'success', text: 'Draft saved' }
    controllerMessages.canonMessage = { type: 'error', text: 'Canon sync failed' }

    render(<StoryBiblePanel />)

    expect(screen.getByText('Draft saved')).toHaveClass('text-green-600')
    expect(screen.getByText('Canon sync failed')).toHaveClass('text-red-600')
  })
})

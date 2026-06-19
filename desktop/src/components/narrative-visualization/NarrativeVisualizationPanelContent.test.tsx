import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NarrativeVisualizationBundle } from '../../api/narrative-visualization'
import { getNarrativeVisualization } from '../../api/narrative-visualization'
import { readChapterContent } from '../../services/projectFileService'
import { NarrativeVisualizationPanel } from './NarrativeVisualizationPanelContent'

const useAppStoreMock = vi.hoisted(() =>
  vi.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      currentProjectId: 'project-1',
      currentWorkspace: {
        identity: {
          workspaceId: 'workspace-1',
          projectId: 'project-1',
          projectName: 'Atlas',
          workspaceRoot: '/tmp/atlas',
        },
      },
      getChaptersForProject: () => [
        { id: 'chapter-1', title: 'Opening' },
        { id: 'chapter-2', title: 'Fallout' },
      ],
    }
    return selector ? selector(state) : state
  }),
)

vi.mock('../../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../../services/projectFileService', () => ({
  readChapterContent: vi.fn(),
  extractText: (content: string) => content,
}))

vi.mock('../../api/narrative-visualization', async () => {
  const actual = await vi.importActual<typeof import('../../api/narrative-visualization')>('../../api/narrative-visualization')
  return {
    ...actual,
    getNarrativeVisualization: vi.fn(),
  }
})

const sampleBundle: NarrativeVisualizationBundle = {
  timeline: {
    chapters: [
      {
        chapterId: 'chapter-1',
        chapterIndex: 0,
        chapterNumber: 1,
        title: 'Opening',
        label: 'Chapter 1: Opening',
        arcPosition: 0,
        tension: 0.7,
        eventCount: 1,
      },
      {
        chapterId: 'chapter-2',
        chapterIndex: 1,
        chapterNumber: 2,
        title: 'Fallout',
        label: 'Chapter 2: Fallout',
        arcPosition: 1,
        tension: 0.35,
        eventCount: 0,
      },
    ],
    events: [
      {
        id: 'evt-1',
        label: 'event_order',
        chapterIndex: 0,
        chapterNumber: 1,
        type: 'conflict',
        severity: 'major',
        description: 'Event ordering warning',
      },
    ],
    summary: 'Timeline summary',
    empty: false,
  },
  tension: {
    points: [
      {
        chapterId: 'chapter-1',
        chapterIndex: 0,
        chapterNumber: 1,
        title: 'Opening',
        tension: 0.8,
        engagement: 0.7,
        dominantEmotion: 'fear',
        label: 'Chapter 1: Opening',
      },
      {
        chapterId: 'chapter-2',
        chapterIndex: 1,
        chapterNumber: 2,
        title: 'Fallout',
        tension: 0.3,
        engagement: 0.4,
        dominantEmotion: 'sadness',
        label: 'Chapter 2: Fallout',
      },
    ],
    deserts: [],
    overallArcScore: 78,
    summary: 'Tension summary',
    empty: false,
    highRiskChapters: [],
  },
  characterGraph: {
    nodes: [
      { id: 'Alice', name: 'Alice', role: 'protagonist', importance: 3, chapterCount: 2 },
      { id: 'Bob', name: 'Bob', role: 'mentor', importance: 2, chapterCount: 1 },
    ],
    edges: [
      { source: 'Alice', target: 'Bob', type: 'ally', weight: 0.8, label: 'Alice -> Bob' },
    ],
    summary: 'Character graph summary',
    empty: false,
  },
  meta: {
    chapterCount: 2,
    generatedAt: new Date().toISOString(),
    hasData: true,
    source: 'existing-analysis',
  },
}

function mockAppState(overrides: Record<string, unknown> = {}) {
  const state = {
    currentProjectId: 'project-1',
    currentWorkspace: {
      identity: {
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        projectName: 'Atlas',
        workspaceRoot: '/tmp/atlas',
      },
    },
    getChaptersForProject: () => [
      { id: 'chapter-1', title: 'Opening' },
      { id: 'chapter-2', title: 'Fallout' },
    ],
    ...overrides,
  }

  useAppStoreMock.mockImplementation((selector?: (state: Record<string, unknown>) => unknown) => {
    return selector ? selector(state) : state
  })
}

describe('NarrativeVisualizationPanelContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAppState()
    vi.mocked(readChapterContent).mockResolvedValue('chapter text')
    vi.mocked(getNarrativeVisualization).mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: sampleBundle,
      },
    })
  })

  it('renders the timeline view and its text fallback from DTO data', () => {
    render(<NarrativeVisualizationPanel data={sampleBundle} />)

    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeInTheDocument()
    expect(screen.getByText('Timeline summary')).toBeInTheDocument()
    expect(screen.getByText('Chapter 1: Opening')).toBeInTheDocument()
    expect(screen.getByLabelText('Timeline text fallback')).toBeInTheDocument()
  })

  it('switches to the tension view through toolbar state', async () => {
    const user = userEvent.setup()
    render(<NarrativeVisualizationPanel data={sampleBundle} />)

    await user.click(screen.getByRole('button', { name: 'Tension' }))

    expect(screen.getByText('Tension Curve')).toBeInTheDocument()
    expect(screen.getByText('Tension summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Tension text fallback')).toBeInTheDocument()
  })

  it('renders empty-state copy when no visualization data is present', () => {
    render(<NarrativeVisualizationPanel data={null} skipAutoLoad />)

    expect(screen.getByText('No timeline data available.')).toBeInTheDocument()
  })

  it('switches to the character graph view and renders text fallback', async () => {
    const user = userEvent.setup()
    render(<NarrativeVisualizationPanel data={sampleBundle} />)

    await user.click(screen.getByRole('button', { name: 'Character Graph' }))

    expect(screen.getByRole('heading', { name: 'Character Graph' })).toBeInTheDocument()
    expect(screen.getByText('Character graph summary')).toBeInTheDocument()
    expect(screen.getByLabelText('Character graph text fallback')).toBeInTheDocument()
    expect(screen.getByText('Alice -> Bob')).toBeInTheDocument()
  })

  it('loads visualization data from the current project when explicit data is not provided', async () => {
    render(<NarrativeVisualizationPanel />)

    await waitFor(() => {
      expect(getNarrativeVisualization).toHaveBeenCalledWith(
        expect.objectContaining({
          chapters: [
            { content: 'chapter text', chapterIndex: 0, chapterNumber: 1, title: 'Opening' },
            { content: 'chapter text', chapterIndex: 1, chapterNumber: 2, title: 'Fallout' },
          ],
        }),
      )
    })

    expect(await screen.findByText('Timeline summary')).toBeInTheDocument()
  })

  it('does not auto-load when no project is selected', () => {
    mockAppState({ currentProjectId: null })
    render(<NarrativeVisualizationPanel />)

    expect(screen.getByText('No timeline data available.')).toBeInTheDocument()
    expect(getNarrativeVisualization).not.toHaveBeenCalled()
  })

  it('does not auto-load when the selected project has no chapters', () => {
    mockAppState({ getChaptersForProject: () => [] })
    render(<NarrativeVisualizationPanel />)

    expect(screen.getByText('No timeline data available.')).toBeInTheDocument()
    expect(getNarrativeVisualization).not.toHaveBeenCalled()
  })

  it('shows remote loading errors and invokes the close handler', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    vi.mocked(getNarrativeVisualization).mockResolvedValueOnce({
      success: false,
      error: 'remote visualization failed',
    })

    render(<NarrativeVisualizationPanel onClose={onClose} />)

    expect(await screen.findByText('remote visualization failed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the default visualization error when chapter reading fails', async () => {
    vi.mocked(readChapterContent).mockRejectedValueOnce(new Error('read failed'))

    render(<NarrativeVisualizationPanel />)

    expect(await screen.findByText('Failed to load narrative visualization.')).toBeInTheDocument()
    expect(getNarrativeVisualization).not.toHaveBeenCalled()
  })
})

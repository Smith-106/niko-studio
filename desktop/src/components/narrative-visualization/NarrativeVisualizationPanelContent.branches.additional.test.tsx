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
    events: [],
    summary: 'Timeline summary',
    empty: false,
  },
  tension: {
    points: [],
    deserts: [],
    overallArcScore: 78,
    summary: 'Tension summary',
    empty: false,
    highRiskChapters: [],
  },
  characterGraph: {
    nodes: [],
    edges: [],
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

describe('NarrativeVisualizationPanelContent branch coverage', () => {
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

  it('falls back to workspaceId when projectName is empty (line 107)', async () => {
    mockAppState({
      currentWorkspace: {
        identity: {
          workspaceId: 'workspace-fallback',
          projectId: 'project-1',
          projectName: '',
          workspaceRoot: '/tmp/atlas',
        },
      },
    })

    render(<NarrativeVisualizationPanel />)

    await waitFor(() => {
      expect(getNarrativeVisualization).toHaveBeenCalledWith(
        expect.objectContaining({
          relationshipRoot: 'workspace-fallback',
        }),
      )
    })
  })

  it('surfaces the default error when response.success is true but data.success is false (line 112)', async () => {
    vi.mocked(getNarrativeVisualization).mockResolvedValueOnce({
      success: true,
      data: {
        success: false,
        data: null,
      },
    })

    render(<NarrativeVisualizationPanel />)

    expect(await screen.findByText('Failed to load narrative visualization.')).toBeInTheDocument()
  })

  it('uses default error message when response.error is empty string (line 113)', async () => {
    vi.mocked(getNarrativeVisualization).mockResolvedValueOnce({
      success: false,
      error: '',
    })

    render(<NarrativeVisualizationPanel />)

    // error is '' which is falsy, so || fallback triggers
    expect(await screen.findByText('Failed to load narrative visualization.')).toBeInTheDocument()
  })

  it('renders Select sample chapter when no chapter is selected, then Clear after click (line 209)', async () => {
    const user = userEvent.setup()
    render(<NarrativeVisualizationPanel data={sampleBundle} />)

    // Initially no chapter is selected
    expect(screen.getByText('Select sample chapter')).toBeInTheDocument()
    expect(screen.queryByText('Clear selected chapter')).not.toBeInTheDocument()

    // Click to select
    await user.click(screen.getByText('Select sample chapter'))

    // Now it shows the clear option
    expect(screen.getByText('Clear selected chapter')).toBeInTheDocument()
  })
})

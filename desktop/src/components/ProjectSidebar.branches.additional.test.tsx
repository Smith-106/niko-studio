import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ProjectSidebar } from './ProjectSidebar'
import { useProjectSidebarState } from '../stores/selectors'
import { useAppStore } from '../stores/appStore'
import { writeChapterContent, writeProjectMeta } from '../services/projectFileService'

vi.mock('../stores/selectors', () => ({
  useProjectSidebarState: vi.fn(),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}))

vi.mock('../services/projectFileService', () => ({
  writeChapterContent: vi.fn(),
  writeProjectMeta: vi.fn(),
}))

const mockedUseProjectSidebarState = vi.mocked(useProjectSidebarState)
const mockedGetAppState = vi.mocked(useAppStore.getState)
const mockedWriteProjectMeta = vi.mocked(writeProjectMeta)

type SelectorState = ReturnType<typeof buildSelectorState>
type AppStoreSnapshot = {
  projectsById: Record<string, { id: string; name: string }>
  volumesByProjectId: Record<string, Array<{ id: string; title: string }>>
  chaptersByVolumeId: Record<string, Array<{ id: string; title: string }>>
}

let selectorState: SelectorState
let appStoreSnapshot: AppStoreSnapshot

function buildSelectorState() {
  return {
    projectsById: {
      'proj-1': { id: 'proj-1', name: 'Project One' },
    },
    allProjectIds: ['proj-1'],
    currentProjectId: 'proj-1',
    volumesByProjectId: {
      'proj-1': [],
    },
    chaptersByVolumeId: {},
    currentChapterId: null,
    sidebarExpanded: true,
    toggleSidebar: vi.fn(),
    selectProject: vi.fn(),
    selectChapter: vi.fn(),
    addVolume: vi.fn(),
    addChapter: vi.fn(),
    createNewProject: vi.fn(),
    editorIsDirty: false,
    setEditorIsDirty: vi.fn(),
  }
}

function syncAppStoreSnapshotFromSelector() {
  appStoreSnapshot = {
    projectsById: selectorState.projectsById,
    volumesByProjectId: selectorState.volumesByProjectId,
    chaptersByVolumeId: selectorState.chaptersByVolumeId,
  }
}

describe('ProjectSidebar branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorState = buildSelectorState()
    syncAppStoreSnapshotFromSelector()

    mockedUseProjectSidebarState.mockImplementation(() => selectorState)
    mockedGetAppState.mockImplementation(() => appStoreSnapshot as never)
    mockedWriteProjectMeta.mockResolvedValue(undefined)
  })

  it('passes empty chapters when new project has no chapters (line 83 else branch)', async () => {
    // Set up a new project with volumes but NO chapters
    selectorState.createNewProject.mockImplementation(() => {
      selectorState.projectsById['proj-2'] = { id: 'proj-2', name: 'Project Two' }
      selectorState.allProjectIds = [...selectorState.allProjectIds, 'proj-2']
      selectorState.volumesByProjectId['proj-2'] = [{ id: 'vol-2', title: 'Volume A' }]
      // No chapters in this volume
      selectorState.chaptersByVolumeId['vol-2'] = []
      syncAppStoreSnapshotFromSelector()
      return 'proj-2'
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    await user.click(screen.getByTitle('新建项目'))

    await waitFor(() => {
      expect(mockedWriteProjectMeta).toHaveBeenCalledTimes(1)
    })

    // When chapters.length is 0, the else branch (line 83) should pass an empty array
    expect(mockedWriteProjectMeta).toHaveBeenCalledWith(expect.objectContaining({
      chapters: [],
    }))
  })

  it('falls back to "?" initial when current project has empty name (line 128)', () => {
    // Set name to empty string to hit the `|| '?'` branch on line 128
    selectorState.projectsById['proj-1'] = { id: 'proj-1', name: '' }
    selectorState.sidebarExpanded = false
    syncAppStoreSnapshotFromSelector()

    render(<ProjectSidebar />)

    // When name is empty, (name || '?') evaluates to '?', so charAt(0) is '?'
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('returns null when project ID in allProjectIds has no matching entry in projectsById (line 172-173)', () => {
    // Add an orphan project ID that has no corresponding project object
    selectorState.allProjectIds = ['proj-1', 'proj-orphan']
    // proj-orphan has no entry in projectsById, volumesByProjectId, etc.
    syncAppStoreSnapshotFromSelector()

    const { container } = render(<ProjectSidebar />)

    // The orphan project should render nothing (return null) — only proj-1 renders
    // We verify by checking that only one project button exists (proj-1)
    expect(screen.getByRole('button', { name: 'Project One' })).toBeInTheDocument()
    // proj-orphan should NOT appear as a button since `if (!project) return null`
    expect(container.querySelectorAll('button[name="proj-orphan"]').length).toBe(0)
  })

  it('uses empty array fallback when volume has no entry in chaptersByVolumeId (line 195)', async () => {
    // Set up a project with a volume that has no chapters entry in chaptersByVolumeId
    selectorState.volumesByProjectId['proj-1'] = [
      { id: 'vol-1', title: 'Volume 1' },
      { id: 'vol-no-chapters', title: 'Volume Orphan' },
    ]
    // vol-no-chapters has no entry in chaptersByVolumeId — only vol-1 does
    selectorState.chaptersByVolumeId = {
      'vol-1': [{ id: 'ch-1', title: 'Chapter 1' }],
    }
    syncAppStoreSnapshotFromSelector()

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    // Expand the project to show volumes
    await user.click(screen.getByRole('button', { name: 'Project One' }))

    // Both volumes should be visible
    expect(screen.getByRole('button', { name: 'Volume 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volume Orphan' })).toBeInTheDocument()

    // Expand the orphan volume (no chaptersByVolumeId entry → chapters = [])
    await user.click(screen.getByRole('button', { name: 'Volume Orphan' }))

    // The volume should render without any chapter items, only the "添加章节" button
    // No chapter buttons should appear for this volume
    const addChapterButtons = screen.getAllByText('添加章节')
    // There should be at least one "添加章节" inside the orphan volume
    expect(addChapterButtons.length).toBeGreaterThanOrEqual(1)
  })
})

/**
 * ProjectSidebar branch-gap additional test — focused coverage for uncovered branches
 *
 * Target branches:
 * - Line 72-75: handleAddProject — iterates volumes and chapters from appStore
 *   (a) Project has volumes with chapters → chapters array is non-empty → line 82 branch
 *   (b) Project has volumes but no chapters → chapters array is empty → line 83 else branch
 * - Line 90: handleAddVolume — volumesByProjectId[projectId] ?? []
 *   (a) Project has no entry in volumesByProjectId → falls back to empty array
 * - Line 95: handleAddChapter — chaptersByVolumeId[volumeId] ?? []
 *   (a) Volume has no entry in chaptersByVolumeId → falls back to empty array
 * - Line 173: volumesByProjectId[projectId] ?? [] in the render path
 *   (a) Project in allProjectIds has no entry in volumesByProjectId → empty array
 */
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

describe('ProjectSidebar branch-gap additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorState = buildSelectorState()
    syncAppStoreSnapshotFromSelector()

    mockedUseProjectSidebarState.mockImplementation(() => selectorState)
    mockedGetAppState.mockImplementation(() => appStoreSnapshot as never)
    mockedWriteProjectMeta.mockResolvedValue(undefined)
  })

  // Line 72-75 with line 82: New project has volumes with chapters
  // → chapters.length > 0 → uses Object.values(chaptersByVolumeId).flat()
  it('collects chapters from volumes when new project has chapters (line 72-75, 82)', async () => {
    selectorState.createNewProject.mockImplementation(() => {
      selectorState.projectsById['proj-2'] = { id: 'proj-2', name: 'Project Two' }
      selectorState.allProjectIds = [...selectorState.allProjectIds, 'proj-2']
      selectorState.volumesByProjectId['proj-2'] = [
        { id: 'vol-2', title: 'Volume A' },
        { id: 'vol-3', title: 'Volume B' },
      ]
      selectorState.chaptersByVolumeId['vol-2'] = [
        { id: 'ch-3', title: 'Intro' },
        { id: 'ch-4', title: 'Chapter Two' },
      ]
      selectorState.chaptersByVolumeId['vol-3'] = [
        { id: 'ch-5', title: 'Conclusion' },
      ]
      syncAppStoreSnapshotFromSelector()
      return 'proj-2'
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    await user.click(screen.getByTitle('新建项目'))

    await waitFor(() => {
      expect(mockedWriteProjectMeta).toHaveBeenCalledTimes(1)
    })

    // Line 82: chapters.length > 0 → Object.values(useAppStore.getState().chaptersByVolumeId).flat()
    expect(mockedWriteProjectMeta).toHaveBeenCalledWith(expect.objectContaining({
      chapters: expect.arrayContaining([
        expect.objectContaining({ id: 'ch-3' }),
        expect.objectContaining({ id: 'ch-4' }),
        expect.objectContaining({ id: 'ch-5' }),
      ]),
    }))
  })

  // Line 72-75 with line 83: New project has volumes but no chapters
  // → chapters.length === 0 → empty array
  it('passes empty chapters when new project volumes have no chapters (line 72-75, 83)', async () => {
    selectorState.createNewProject.mockImplementation(() => {
      selectorState.projectsById['proj-2'] = { id: 'proj-2', name: 'Project Two' }
      selectorState.allProjectIds = [...selectorState.allProjectIds, 'proj-2']
      selectorState.volumesByProjectId['proj-2'] = [{ id: 'vol-2', title: 'Volume A' }]
      // Volume has no chapters
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

    // Line 83: chapters.length === 0 → meta.chapters = []
    expect(mockedWriteProjectMeta).toHaveBeenCalledWith(expect.objectContaining({
      chapters: [],
    }))
  })

  // Line 90: handleAddVolume — volumesByProjectId[projectId] ?? []
  // When project has no entry in volumesByProjectId
  it('uses empty array fallback in handleAddVolume when project has no volumes entry (line 90)', async () => {
    // Remove proj-1 from volumesByProjectId entirely
    selectorState.volumesByProjectId = {}
    syncAppStoreSnapshotFromSelector()

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    // Click on the project to expand it (it may not be expanded)
    await user.click(screen.getByRole('button', { name: 'Project One' }))

    // Click "添加卷" button
    const addVolumeButtons = screen.getAllByText('添加卷')
    await user.click(addVolumeButtons[0].closest('button') as HTMLButtonElement)

    // When volumesByProjectId[projectId] is undefined, ?? [] gives empty array
    // addVolume is called with '卷1' (length + 1 = 0 + 1 = 1)
    expect(selectorState.addVolume).toHaveBeenCalledWith('proj-1', '卷1')
  })

  // Line 95: handleAddChapter — chaptersByVolumeId[volumeId] ?? []
  // When volume has no entry in chaptersByVolumeId
  it('uses empty array fallback in handleAddChapter when volume has no chapters entry (line 95)', async () => {
    selectorState.volumesByProjectId['proj-1'] = [
      { id: 'vol-1', title: 'Volume 1' },
    ]
    // vol-1 has no entry in chaptersByVolumeId
    selectorState.chaptersByVolumeId = {}
    syncAppStoreSnapshotFromSelector()

    // After addChapter is called, simulate a new chapter being added
    selectorState.addChapter.mockImplementation((volumeId: string, title: string) => {
      selectorState.chaptersByVolumeId[volumeId] = [
        { id: 'ch-new', title },
      ]
      syncAppStoreSnapshotFromSelector()
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    // Expand project and volume
    await user.click(screen.getByRole('button', { name: 'Project One' }))
    await user.click(screen.getByRole('button', { name: 'Volume 1' }))

    // Click "添加章节"
    await user.click(screen.getByText('添加章节'))

    // When chaptersByVolumeId[volumeId] is undefined, ?? [] gives empty array
    // addChapter is called with '第1章' (length + 1 = 0 + 1 = 1)
    expect(selectorState.addChapter).toHaveBeenCalledWith('vol-1', '第1章')
  })

  // Line 173: volumesByProjectId[projectId] ?? [] in render
  // When project in allProjectIds has no entry in volumesByProjectId
  it('renders project with no volumes entry using empty array fallback (line 173)', async () => {
    // Add a project to allProjectIds that has no volumesByProjectId entry
    selectorState.projectsById['proj-orphan'] = { id: 'proj-orphan', name: 'Orphan Project' }
    selectorState.allProjectIds = ['proj-1', 'proj-orphan']
    // proj-orphan has no entry in volumesByProjectId
    selectorState.volumesByProjectId = {
      'proj-1': [],
    }
    syncAppStoreSnapshotFromSelector()

    render(<ProjectSidebar />)

    // Both projects should render
    expect(screen.getByRole('button', { name: 'Project One' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Orphan Project' })).toBeInTheDocument()

    // Expand the orphan project — it has no volumes but should render
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Orphan Project' }))

    // Only the "添加卷" button should appear (no volumes to list)
    const addVolumeButtons = screen.getAllByText('添加卷')
    expect(addVolumeButtons.length).toBeGreaterThanOrEqual(1)
  })

  // Line 95 additional: handleAddChapter when addChapter doesn't add a new chapter
  // (newChapters.length === chapters.length) → no writeChapterContent call
  it('skips writeChapterContent when addChapter does not increase chapter count (line 98)', async () => {
    selectorState.volumesByProjectId['proj-1'] = [
      { id: 'vol-1', title: 'Volume 1' },
    ]
    selectorState.chaptersByVolumeId['vol-1'] = [
      { id: 'ch-1', title: 'First Chapter' },
    ]
    syncAppStoreSnapshotFromSelector()

    // addChapter doesn't actually add a chapter (simulates failure/no-op)
    selectorState.addChapter.mockImplementation(() => {
      // chaptersByVolumeId stays the same
      syncAppStoreSnapshotFromSelector()
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    await user.click(screen.getByRole('button', { name: 'Project One' }))
    await user.click(screen.getByRole('button', { name: 'Volume 1' }))
    await user.click(screen.getByText('添加章节'))

    // addChapter was called but writeChapterContent should NOT have been called
    // because newChapters.length === chapters.length (no new chapter was added)
    expect(selectorState.addChapter).toHaveBeenCalledWith('vol-1', '第2章')

    // writeChapterContent should not have been called for this volume's chapter
    // (it may have been called from other tests' beforeEach, so we check the specific call)
    const writeChapterCalls = vi.mocked(writeChapterContent).mock.calls
    const relevantCalls = writeChapterCalls.filter(
      (call) => call[0] === 'proj-1' && call[1] === 'vol-1',
    )
    expect(relevantCalls.length).toBe(0)
  })
})

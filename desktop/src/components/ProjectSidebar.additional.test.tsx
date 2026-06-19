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
const mockedWriteChapterContent = vi.mocked(writeChapterContent)
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
      'proj-1': [
        { id: 'vol-1', title: 'Volume 1' },
      ],
    },
    chaptersByVolumeId: {
      'vol-1': [
        { id: 'ch-1', title: 'First Chapter' },
        { id: 'ch-2', title: 'Second Chapter' },
      ],
    },
    currentChapterId: 'ch-1',
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

describe('ProjectSidebar additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorState = buildSelectorState()
    syncAppStoreSnapshotFromSelector()

    mockedUseProjectSidebarState.mockImplementation(() => selectorState)
    mockedGetAppState.mockImplementation(() => appStoreSnapshot as never)
    mockedWriteChapterContent.mockResolvedValue(undefined)
    mockedWriteProjectMeta.mockResolvedValue(undefined)
  })

  it('renders collapsed state with project and chapter initials and reopens sidebar', async () => {
    selectorState.sidebarExpanded = false

    render(<ProjectSidebar />)

    expect(screen.getByTitle('展开项目面板')).toBeInTheDocument()
    expect(screen.getByText('P')).toBeInTheDocument()
    expect(screen.getByText('F')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('展开项目面板'))

    expect(selectorState.toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('expands project tree, selects chapters, and handles dirty-switch confirmation', async () => {
    selectorState.editorIsDirty = true
    const user = userEvent.setup()

    render(<ProjectSidebar />)

    await user.click(screen.getByRole('button', { name: 'Project One' }))
    expect(selectorState.selectProject).toHaveBeenCalledWith('proj-1')

    await user.click(screen.getByRole('button', { name: 'Volume 1' }))
    await user.click(screen.getByRole('button', { name: 'Second Chapter' }))

    expect(selectorState.selectChapter).not.toHaveBeenCalled()
    expect(screen.getByText('当前章节有未保存的修改，切换将丢弃。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByText('当前章节有未保存的修改，切换将丢弃。')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Second Chapter' }))
    await user.click(screen.getByRole('button', { name: '放弃并切换' }))

    expect(selectorState.setEditorIsDirty).toHaveBeenCalledWith(false)
    expect(selectorState.selectChapter).toHaveBeenCalledWith('ch-2')
  })

  it('adds projects, volumes, and chapters while persisting metadata and empty chapter documents', async () => {
    selectorState.createNewProject.mockImplementation(() => {
      selectorState.projectsById['proj-2'] = { id: 'proj-2', name: 'Project Two' }
      selectorState.allProjectIds = [...selectorState.allProjectIds, 'proj-2']
      selectorState.volumesByProjectId['proj-2'] = [{ id: 'vol-2', title: 'Volume A' }]
      selectorState.chaptersByVolumeId['vol-2'] = [{ id: 'ch-3', title: 'Intro' }]
      syncAppStoreSnapshotFromSelector()
      return 'proj-2'
    })

    selectorState.addChapter.mockImplementation((volumeId: string, title: string) => {
      selectorState.chaptersByVolumeId[volumeId] = [
        ...selectorState.chaptersByVolumeId[volumeId],
        { id: 'ch-4', title },
      ]
      syncAppStoreSnapshotFromSelector()
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    await user.click(screen.getByTitle('新建项目'))

    await waitFor(() => {
      expect(selectorState.createNewProject).toHaveBeenCalledWith('新项目')
      expect(mockedWriteProjectMeta).toHaveBeenCalledTimes(1)
    })

    expect(mockedWriteProjectMeta).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({ id: 'proj-2', name: 'Project Two' }),
      volumes: [{ id: 'vol-2', title: 'Volume A' }],
      chapters: expect.arrayContaining([
        expect.objectContaining({ id: 'ch-3', title: 'Intro' }),
      ]),
    }))

    await user.click(screen.getByRole('button', { name: 'Project One' }))
    await user.click(screen.getAllByText('添加卷')[0].closest('button') as HTMLButtonElement)
    expect(selectorState.addVolume).toHaveBeenCalledWith('proj-1', '卷2')

    await user.click(screen.getByRole('button', { name: 'Volume 1' }))
    await user.click(screen.getByText('添加章节'))

    expect(selectorState.addChapter).toHaveBeenCalledWith('vol-1', '第3章')
    await waitFor(() => {
      expect(mockedWriteChapterContent).toHaveBeenCalledWith(
        'proj-1',
        'ch-4',
        JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
      )
    })
  })

  it('calls selectChapter directly when editorIsDirty is false (line 56)', async () => {
    selectorState.editorIsDirty = false
    const user = userEvent.setup()

    render(<ProjectSidebar />)

    // Expand project and volume to reveal chapters
    await user.click(screen.getByRole('button', { name: 'Project One' }))
    await user.click(screen.getByRole('button', { name: 'Volume 1' }))

    // Click a different chapter — since editorIsDirty is false, selectChapter is called directly
    await user.click(screen.getByRole('button', { name: 'Second Chapter' }))

    expect(selectorState.selectChapter).toHaveBeenCalledWith('ch-2')
    // No unsaved toast should appear
    expect(screen.queryByText('当前章节有未保存的修改，切换将丢弃。')).not.toBeInTheDocument()
  })

  it('flattens all chapters via Object.values when new project has chapters (line 83)', async () => {
    // Set up createNewProject to return a project with chapters in its volume
    selectorState.createNewProject.mockImplementation(() => {
      selectorState.projectsById['proj-2'] = { id: 'proj-2', name: 'Project Two' }
      selectorState.allProjectIds = [...selectorState.allProjectIds, 'proj-2']
      selectorState.volumesByProjectId['proj-2'] = [{ id: 'vol-2', title: 'Volume A' }]
      selectorState.chaptersByVolumeId['vol-2'] = [{ id: 'ch-3', title: 'Intro' }]
      syncAppStoreSnapshotFromSelector()
      return 'proj-2'
    })

    const user = userEvent.setup()
    render(<ProjectSidebar />)

    await user.click(screen.getByTitle('新建项目'))

    await waitFor(() => {
      expect(mockedWriteProjectMeta).toHaveBeenCalledTimes(1)
    })

    // The meta.chapters should be the flattened result of Object.values(chaptersByVolumeId)
    // which includes chapters from vol-1 (ch-1, ch-2) and vol-2 (ch-3)
    expect(mockedWriteProjectMeta).toHaveBeenCalledWith(expect.objectContaining({
      chapters: expect.arrayContaining([
        expect.objectContaining({ id: 'ch-1' }),
        expect.objectContaining({ id: 'ch-2' }),
        expect.objectContaining({ id: 'ch-3' }),
      ]),
    }))
  })

  it('returns null for currentChapterTitle when currentChapterId is not in any volume (line 114)', async () => {
    // Set currentChapterId to a value that does not exist in chaptersByVolumeId
    selectorState.currentChapterId = 'ch-orphan'
    selectorState.sidebarExpanded = false

    render(<ProjectSidebar />)

    // The collapsed sidebar should show the expand button and project initial
    expect(screen.getByTitle('展开项目面板')).toBeInTheDocument()
    expect(screen.getByText('P')).toBeInTheDocument()
    // But no chapter initial button should appear since currentChapterTitle is null
    // (The button with the chapter first letter only renders when currentChapterTitle is truthy)
    expect(screen.queryByText('F')).not.toBeInTheDocument()
  })
})

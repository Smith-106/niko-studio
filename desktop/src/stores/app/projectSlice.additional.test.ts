import { describe, expect, it } from 'vitest'

import { emptyProjectMeta, type ProjectMeta } from '../../types/project'
import { createProjectSlice, type ProjectSlice } from './projectSlice'

type SetFn = Parameters<typeof createProjectSlice>[0]

function createStore(): ProjectSlice {
  let state: ProjectSlice = {
    projectsById: {},
    allProjectIds: [],
    currentProjectId: null,
    volumesByProjectId: {},
    chaptersByVolumeId: {},
    currentChapterId: null,
    currentChapterContent: '',
    loadProjectMeta: () => {},
    createNewProject: () => '',
    createNewProjectFromTemplate: () => '',
    selectProject: () => {},
    deleteProject: () => {},
    renameProject: () => {},
    addVolume: () => {},
    renameVolume: () => {},
    deleteVolume: () => {},
    addChapter: () => {},
    selectChapter: () => {},
    renameChapter: () => {},
    deleteChapter: () => {},
    setCurrentChapterContent: () => {},
    getChaptersForProject: () => [],
  }

  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createProjectSlice(set as never, get as never, {} as never)
  state = { ...state, ...slice }
  return state
}

function getLiveStore() {
  let state = createStore()
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state as never) : partial
    state = { ...state, ...next }
  }
  const get = () => state
  const slice = createProjectSlice(set as never, get as never, {} as never)
  Object.assign(state, slice)
  return { getState: () => state }
}

describe('projectSlice additional coverage', () => {
  it('keeps the active chapter when deleting a different project', () => {
    const store = getLiveStore()
    const projectA = store.getState().createNewProject('Alpha')
    const volumeA = store.getState().volumesByProjectId[projectA][0].id
    const chapterA = store.getState().chaptersByVolumeId[volumeA][0].id
    const projectB = store.getState().createNewProject('Beta')

    store.getState().selectProject(projectA)
    store.getState().selectChapter(chapterA)
    store.getState().deleteProject(projectB)

    expect(store.getState().currentProjectId).toBe(projectA)
    expect(store.getState().currentChapterId).toBe(chapterA)
  })

  it('no-ops missing renames and seeds the editor when adding a templated chapter into an empty selection', () => {
    const store = getLiveStore()
    const projectId = store.getState().createNewProject('Atlas')
    const volumeId = store.getState().volumesByProjectId[projectId][0].id
    const existingVolumeTitle = store.getState().volumesByProjectId[projectId][0].title

    store.getState().renameVolume('missing-volume', 'Ignored')
    expect(store.getState().volumesByProjectId[projectId][0].title).toBe(existingVolumeTitle)

    const initialChapterId = store.getState().chaptersByVolumeId[volumeId][0].id
    store.getState().deleteChapter(initialChapterId)
    expect(store.getState().currentChapterId).toBeNull()

    store.getState().addChapter(volumeId, 'Recovered Chapter', '<p>templated content</p>')
    const recoveredChapter = store.getState().chaptersByVolumeId[volumeId][0]

    expect(recoveredChapter.title).toBe('Recovered Chapter')
    expect(store.getState().currentChapterId).toBe(recoveredChapter.id)
    expect(store.getState().currentChapterContent).toBe('<p>templated content</p>')

    const snapshot = store.getState().chaptersByVolumeId[volumeId].map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
    }))
    store.getState().renameChapter('missing-chapter', 'Ignored')

    expect(
      store.getState().chaptersByVolumeId[volumeId].map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
      })),
    ).toEqual(snapshot)
  })

  it('loads populated project metadata and keeps id ordering stable when the project already exists', () => {
    const store = getLiveStore()
    const meta: ProjectMeta = emptyProjectMeta()
    meta.project.id = 'project-meta-1'
    meta.project.name = 'Loaded Project'
    meta.volumes = [
      {
        id: 'volume-meta-1',
        projectId: 'project-meta-1',
        title: 'Volume One',
        order: 0,
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    ]
    meta.chapters = [
      {
        id: 'chapter-meta-1',
        volumeId: 'volume-meta-1',
        title: 'Chapter One',
        order: 0,
        createdAt: '2026-06-07T00:00:00.000Z',
        updatedAt: '2026-06-07T00:00:00.000Z',
      },
    ]

    store.getState().loadProjectMeta(meta)
    store.getState().loadProjectMeta(meta)

    expect(store.getState().allProjectIds).toEqual(['project-meta-1'])
    expect(store.getState().chaptersByVolumeId['volume-meta-1']).toEqual([
      expect.objectContaining({ id: 'chapter-meta-1' }),
    ])
  })
})

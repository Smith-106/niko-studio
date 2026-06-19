import { describe, expect, it } from 'vitest'

import type { NovelTemplate } from '../../services/templates/novelTemplates'
import { mysteryDetective } from '../../services/templates/novelTemplates'
import { createProjectSlice, type ProjectSlice } from './projectSlice'

type SetFn = Parameters<typeof createProjectSlice>[0]

function createHarness() {
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

  return {
    getState: () => state,
    patchState: (partial: Partial<ProjectSlice> | ((current: ProjectSlice) => Partial<ProjectSlice>)) => {
      const next = typeof partial === 'function' ? partial(state) : partial
      state = { ...state, ...next }
    },
  }
}

describe('projectSlice branch coverage', () => {
  it('falls back to the english template name and keeps the editor empty when a template has no outlines', () => {
    const store = createHarness()
    const template: NovelTemplate = {
      ...mysteryDetective,
      nameZh: '',
      chapterOutlines: [],
    }

    const projectId = store.getState().createNewProjectFromTemplate(template)
    const project = store.getState().projectsById[projectId]
    const volumeId = store.getState().volumesByProjectId[projectId][0].id

    expect(project.name).toBe(mysteryDetective.name)
    expect(store.getState().chaptersByVolumeId[volumeId]).toEqual([])
    expect(store.getState().currentChapterId).toBeNull()
    expect(store.getState().currentChapterContent).toBe('')
  })

  it('handles deleting unknown projects and projects whose volume chapters are missing from the map', () => {
    const store = createHarness()
    const seedProjectId = store.getState().createNewProject('Seed')
    const seedProject = store.getState().projectsById[seedProjectId]
    const seedVolume = store.getState().volumesByProjectId[seedProjectId][0]
    const orphanProjectId = 'project-orphan'
    const orphanVolumeId = 'volume-orphan'

    const beforeIds = store.getState().allProjectIds.slice()
    store.getState().deleteProject('project-missing')
    expect(store.getState().allProjectIds).toEqual(beforeIds)

    store.patchState((current) => ({
      projectsById: {
        ...current.projectsById,
        [orphanProjectId]: {
          ...seedProject,
          id: orphanProjectId,
          name: 'Orphan',
        },
      },
      allProjectIds: [...current.allProjectIds, orphanProjectId],
      volumesByProjectId: {
        ...current.volumesByProjectId,
        [orphanProjectId]: [
          {
            ...seedVolume,
            id: orphanVolumeId,
            projectId: orphanProjectId,
          },
        ],
      },
      chaptersByVolumeId: Object.fromEntries(
        Object.entries(current.chaptersByVolumeId).filter(([id]) => id !== orphanVolumeId),
      ),
      currentChapterId: 'external-chapter',
    }))

    store.getState().deleteProject(orphanProjectId)

    expect(store.getState().projectsById[orphanProjectId]).toBeUndefined()
    expect(store.getState().currentChapterId).toBe('external-chapter')
  })

  it('creates missing volume and chapter buckets for loose project and volume ids', () => {
    const store = createHarness()

    store.getState().addVolume('project-loose', 'Loose volume')
    expect(store.getState().volumesByProjectId['project-loose']).toHaveLength(1)

    store.patchState({ currentChapterId: 'keep-current' })
    store.getState().addChapter('volume-loose', 'Loose chapter')

    expect(store.getState().chaptersByVolumeId['volume-loose']).toEqual([
      expect.objectContaining({
        title: 'Loose chapter',
        volumeId: 'volume-loose',
      }),
    ])
    expect(store.getState().currentChapterId).toBe('keep-current')
  })

  it('preserves the empty selection when deleting an unknown volume and keeps the current chapter when deleting a different one', () => {
    const store = createHarness()
    const projectId = store.getState().createNewProject('Keep')
    const volumeId = store.getState().volumesByProjectId[projectId][0].id
    const firstChapterId = store.getState().chaptersByVolumeId[volumeId][0].id

    store.patchState({ currentChapterId: null })
    store.getState().deleteVolume('missing-volume')
    expect(store.getState().currentChapterId).toBeNull()

    store.getState().addChapter(volumeId, 'Second chapter')
    const secondChapterId = store.getState().chaptersByVolumeId[volumeId][1].id
    store.getState().selectChapter(firstChapterId)
    store.getState().deleteChapter(secondChapterId)

    expect(store.getState().currentChapterId).toBe(firstChapterId)
  })

  it('returns chapters from volumes that still have buckets when one project volume has no chapter list', () => {
    const store = createHarness()
    const projectId = store.getState().createNewProject('Aggregated')

    store.getState().addVolume(projectId, 'Second volume')
    const volumes = store.getState().volumesByProjectId[projectId]
    const firstVolumeId = volumes[0].id
    const secondVolumeId = volumes[1].id

    store.getState().addChapter(secondVolumeId, 'Second volume chapter')
    const expected = store.getState().chaptersByVolumeId[secondVolumeId]

    store.patchState((current) => ({
      chaptersByVolumeId: {
        [secondVolumeId]: current.chaptersByVolumeId[secondVolumeId],
      },
    }))

    expect(store.getState().chaptersByVolumeId[firstVolumeId]).toBeUndefined()
    expect(store.getState().getChaptersForProject(projectId)).toEqual(expected)
  })
})

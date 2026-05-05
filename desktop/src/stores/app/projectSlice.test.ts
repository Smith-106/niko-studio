import { describe, expect, it, vi } from 'vitest'
import type { ProjectMeta } from '../../types/project'
import { emptyProjectMeta } from '../../types/project'
import { createProjectSlice, type ProjectSlice } from './projectSlice'
import type { AppStore } from '../appStore'

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
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
  }
  const get = () => state

  const slice = createProjectSlice(set as never, get as never, {} as AppStore)
  state = { ...state, ...slice }
  return state
}

function getLiveStore() {
  let state = createStore()
  const set: SetFn = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial
    state = { ...state, ...next }
  }
  const get = () => state
  const slice = createProjectSlice(set as never, get as never, {} as AppStore)
  Object.assign(state, slice)
  return { getState: () => state }
}

describe('projectSlice', () => {
  describe('createNewProject', () => {
    it('creates project with volume and chapter atomically', () => {
      const store = getLiveStore()
      const projectId = store.getState().createNewProject('测试项目')

      const s = store.getState()
      expect(projectId).toBeTruthy()
      expect(s.allProjectIds).toContain(projectId)
      expect(s.currentProjectId).toBe(projectId)
      expect(s.currentChapterId).not.toBeNull()
      expect(s.currentChapterContent).toBe('')

      const volumes = s.volumesByProjectId[projectId]
      expect(volumes).toHaveLength(1)
      expect(volumes[0].projectId).toBe(projectId)

      const chapters = s.chaptersByVolumeId[volumes[0].id]
      expect(chapters).toHaveLength(1)
    })
  })

  describe('selectProject / deleteProject', () => {
    it('selects a project', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('A')
      store.getState().createNewProject('B')
      expect(store.getState().currentProjectId).not.toBe(pid)

      store.getState().selectProject(pid)
      expect(store.getState().currentProjectId).toBe(pid)
    })

    it('deletes project and clears related volumes/chapters', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('ToDelete')
      const volumes = store.getState().volumesByProjectId[pid]
      const vid = volumes[0].id

      store.getState().deleteProject(pid)

      const s = store.getState()
      expect(s.allProjectIds).not.toContain(pid)
      expect(s.projectsById[pid]).toBeUndefined()
      expect(s.volumesByProjectId[pid]).toBeUndefined()
      expect(s.chaptersByVolumeId[vid]).toBeUndefined()
      expect(s.currentProjectId).toBeNull()
    })

    it('does not clear currentProjectId when deleting other project', () => {
      const store = getLiveStore()
      const pidA = store.getState().createNewProject('A')
      const pidB = store.getState().createNewProject('B')
      store.getState().selectProject(pidA)

      store.getState().deleteProject(pidB)
      expect(store.getState().currentProjectId).toBe(pidA)
    })
  })

  describe('renameProject', () => {
    it('renames project and updates updatedAt', () => {
      vi.useFakeTimers()
      const store = getLiveStore()
      const pid = store.getState().createNewProject('Old')
      const before = store.getState().projectsById[pid].updatedAt

      vi.advanceTimersByTime(10)
      store.getState().renameProject(pid, 'New')
      const p = store.getState().projectsById[pid]
      expect(p.name).toBe('New')
      expect(p.updatedAt).not.toBe(before)
      vi.useRealTimers()
    })

    it('no-ops for non-existent project', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('Exists')
      const before = { ...store.getState().projectsById[pid] }

      store.getState().renameProject('nonexistent', 'X')
      expect(store.getState().projectsById[pid]).toEqual(before)
    })
  })

  describe('volume operations', () => {
    it('adds volume to project', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')

      store.getState().addVolume(pid, '卷二')
      const volumes = store.getState().volumesByProjectId[pid]
      expect(volumes).toHaveLength(2)
      expect(volumes[1].title).toBe('卷二')
    })

    it('renames volume', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id

      store.getState().renameVolume(vid, 'New Volume')
      expect(store.getState().volumesByProjectId[pid][0].title).toBe('New Volume')
    })

    it('deletes volume and its chapters', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      store.getState().addVolume(pid, 'V2')
      const volumes = store.getState().volumesByProjectId[pid]
      const v2id = volumes[1].id
      store.getState().addChapter(v2id, 'Ch1')

      store.getState().deleteVolume(v2id)

      const s = store.getState()
      expect(s.volumesByProjectId[pid]).toHaveLength(1)
      expect(s.chaptersByVolumeId[v2id]).toBeUndefined()
    })

    it('clears currentChapterId when deleting volume containing current chapter', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id
      const chid = store.getState().chaptersByVolumeId[vid][0].id
      store.getState().selectChapter(chid)
      expect(store.getState().currentChapterId).toBe(chid)

      store.getState().deleteVolume(vid)
      expect(store.getState().currentChapterId).toBeNull()
    })
  })

  describe('chapter operations', () => {
    it('adds chapter to volume', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id

      store.getState().addChapter(vid, '第二章')
      expect(store.getState().chaptersByVolumeId[vid]).toHaveLength(2)
    })

    it('selects chapter and clears content', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id
      store.getState().addChapter(vid, 'Ch2')
      const ch2 = store.getState().chaptersByVolumeId[vid][1].id

      store.getState().setCurrentChapterContent('some content')
      store.getState().selectChapter(ch2)

      expect(store.getState().currentChapterId).toBe(ch2)
      expect(store.getState().currentChapterContent).toBe('')
    })

    it('renames chapter', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id
      const chid = store.getState().chaptersByVolumeId[vid][0].id

      store.getState().renameChapter(chid, 'New Title')
      expect(store.getState().chaptersByVolumeId[vid][0].title).toBe('New Title')
    })

    it('deletes chapter and clears currentChapterId if it was selected', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      const vid = store.getState().volumesByProjectId[pid][0].id
      const chid = store.getState().chaptersByVolumeId[vid][0].id

      store.getState().selectChapter(chid)
      store.getState().deleteChapter(chid)

      expect(store.getState().currentChapterId).toBeNull()
      expect(store.getState().chaptersByVolumeId[vid]).toHaveLength(0)
    })
  })

  describe('loadProjectMeta', () => {
    it('loads full project meta into store', () => {
      const store = getLiveStore()
      const meta: ProjectMeta = emptyProjectMeta()
      meta.project.name = 'Loaded'
      store.getState().loadProjectMeta(meta)

      const s = store.getState()
      expect(s.projectsById[meta.project.id].name).toBe('Loaded')
      expect(s.allProjectIds).toContain(meta.project.id)
      expect(s.volumesByProjectId[meta.project.id]).toHaveLength(meta.volumes.length)
    })
  })

  describe('getChaptersForProject', () => {
    it('returns all chapters across volumes', () => {
      const store = getLiveStore()
      const pid = store.getState().createNewProject('P')
      store.getState().addVolume(pid, 'V2')
      const v1 = store.getState().volumesByProjectId[pid][0].id
      const v2 = store.getState().volumesByProjectId[pid][1].id
      store.getState().addChapter(v1, 'Ch2')
      store.getState().addChapter(v2, 'Ch1')

      const chapters = store.getState().getChaptersForProject(pid)
      expect(chapters).toHaveLength(3) // 1 default + 1 added + 1 in V2
    })

    it('returns empty array for unknown project', () => {
      const store = getLiveStore()
      expect(store.getState().getChaptersForProject('unknown')).toEqual([])
    })
  })
})

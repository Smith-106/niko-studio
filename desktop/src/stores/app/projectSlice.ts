import type { AppSlice } from '../appStore'
import type { Chapter, Project, ProjectMeta, Volume } from '../../types/project'
import { createChapter, createProject, createVolume } from '../../types/project'

export interface ProjectSlice {
  projectsById: Record<string, Project>
  allProjectIds: string[]
  currentProjectId: string | null

  volumesByProjectId: Record<string, Volume[]>
  chaptersByVolumeId: Record<string, Chapter[]>
  currentChapterId: string | null

  currentChapterContent: string

  loadProjectMeta: (meta: ProjectMeta) => void
  createNewProject: (name: string) => string
  selectProject: (id: string) => void
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void

  addVolume: (projectId: string, title: string) => void
  renameVolume: (volumeId: string, title: string) => void
  deleteVolume: (volumeId: string) => void

  addChapter: (volumeId: string, title: string, templateContent?: string) => void
  selectChapter: (id: string) => void
  renameChapter: (chapterId: string, title: string) => void
  deleteChapter: (chapterId: string) => void
  setCurrentChapterContent: (content: string) => void

  getChaptersForProject: (projectId: string) => Chapter[]
}

export const createProjectSlice: AppSlice<ProjectSlice> = (set, get) => ({
  projectsById: {},
  allProjectIds: [],
  currentProjectId: null,

  volumesByProjectId: {},
  chaptersByVolumeId: {},
  currentChapterId: null,

  currentChapterContent: '',

  loadProjectMeta: (meta) => {
    const { project, volumes, chapters } = meta
    const volumeMap: Record<string, Volume[]> = { [project.id]: volumes }
    const chapterMap: Record<string, Chapter[]> = {}
    for (const vol of volumes) {
      chapterMap[vol.id] = chapters.filter((ch) => ch.volumeId === vol.id)
    }
    set((state) => ({
      projectsById: { ...state.projectsById, [project.id]: project },
      allProjectIds: state.allProjectIds.includes(project.id)
        ? state.allProjectIds
        : [project.id, ...state.allProjectIds],
      volumesByProjectId: { ...state.volumesByProjectId, ...volumeMap },
      chaptersByVolumeId: { ...state.chaptersByVolumeId, ...chapterMap },
    }))
  },

  createNewProject: (name) => {
    const project = createProject(name)
    const volume = createVolume(project.id, '卷一', 0)
    const chapter = createChapter(volume.id, '第一章', 0)
    set((state) => ({
      projectsById: { ...state.projectsById, [project.id]: project },
      allProjectIds: [project.id, ...state.allProjectIds],
      volumesByProjectId: { ...state.volumesByProjectId, [project.id]: [volume] },
      chaptersByVolumeId: { ...state.chaptersByVolumeId, [volume.id]: [chapter] },
      currentProjectId: project.id,
      currentChapterId: chapter.id,
      currentChapterContent: '',
    }))
    return project.id
  },

  selectProject: (id) => {
    set({ currentProjectId: id })
  },

  deleteProject: (id) => {
    set((state) => {
      const volumes = state.volumesByProjectId[id] ?? []
      const volumeIds = volumes.map((v) => v.id)
      const { [id]: _p, ...restProjects } = state.projectsById
      const { [id]: _v, ...restVolumes } = state.volumesByProjectId
      const newChapterMap = { ...state.chaptersByVolumeId }
      for (const vid of volumeIds) {
        delete newChapterMap[vid]
      }
      return {
        projectsById: restProjects,
        allProjectIds: state.allProjectIds.filter((pid) => pid !== id),
        volumesByProjectId: restVolumes,
        chaptersByVolumeId: newChapterMap,
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        currentChapterId:
          state.currentChapterId && volumeIds.some((vid) =>
            (state.chaptersByVolumeId[vid] ?? []).some((ch) => ch.id === state.currentChapterId)
          )
            ? null
            : state.currentChapterId,
      }
    })
  },

  renameProject: (id, name) => {
    set((state) => {
      const project = state.projectsById[id]
      if (!project) return state
      return {
        projectsById: {
          ...state.projectsById,
          [id]: { ...project, name, updatedAt: new Date().toISOString() },
        },
      }
    })
  },

  addVolume: (projectId, title) => {
    const volumes = get().volumesByProjectId[projectId] ?? []
    const volume = createVolume(projectId, title, volumes.length)
    set((state) => ({
      volumesByProjectId: {
        ...state.volumesByProjectId,
        [projectId]: [...(state.volumesByProjectId[projectId] ?? []), volume],
      },
      chaptersByVolumeId: { ...state.chaptersByVolumeId, [volume.id]: [] },
    }))
  },

  renameVolume: (volumeId, title) => {
    set((state) => {
      for (const projectId of Object.keys(state.volumesByProjectId)) {
        const volumes = state.volumesByProjectId[projectId]
        const idx = volumes.findIndex((v) => v.id === volumeId)
        if (idx !== -1) {
          const updated = [...volumes]
          updated[idx] = { ...updated[idx], title, updatedAt: new Date().toISOString() }
          return {
            volumesByProjectId: { ...state.volumesByProjectId, [projectId]: updated },
          }
        }
      }
      return state
    })
  },

  deleteVolume: (volumeId) => {
    set((state) => {
      const newVolMap = { ...state.volumesByProjectId }
      const newChMap = { ...state.chaptersByVolumeId }
      const chapters = newChMap[volumeId] ?? []
      const chapterIds = new Set(chapters.map((c) => c.id))
      delete newChMap[volumeId]

      for (const pid of Object.keys(newVolMap)) {
        newVolMap[pid] = newVolMap[pid].filter((v) => v.id !== volumeId)
      }

      return {
        volumesByProjectId: newVolMap,
        chaptersByVolumeId: newChMap,
        currentChapterId: chapterIds.has(state.currentChapterId ?? '') ? null : state.currentChapterId,
      }
    })
  },

  addChapter: (volumeId, title, templateContent) => {
    const chapters = get().chaptersByVolumeId[volumeId] ?? []
    const chapter = createChapter(volumeId, title, chapters.length)
    set((state) => ({
      chaptersByVolumeId: {
        ...state.chaptersByVolumeId,
        [volumeId]: [...(state.chaptersByVolumeId[volumeId] ?? []), chapter],
      },
      ...(templateContent != null && state.currentChapterId === null
        ? { currentChapterId: chapter.id, currentChapterContent: templateContent }
        : {}),
    }))
  },

  selectChapter: (id) => {
    set({ currentChapterId: id, currentChapterContent: '' })
  },

  renameChapter: (chapterId, title) => {
    set((state) => {
      for (const volId of Object.keys(state.chaptersByVolumeId)) {
        const chapters = state.chaptersByVolumeId[volId]
        const idx = chapters.findIndex((c) => c.id === chapterId)
        if (idx !== -1) {
          const updated = [...chapters]
          updated[idx] = { ...updated[idx], title, updatedAt: new Date().toISOString() }
          return {
            chaptersByVolumeId: { ...state.chaptersByVolumeId, [volId]: updated },
          }
        }
      }
      return state
    })
  },

  deleteChapter: (chapterId) => {
    set((state) => {
      const newChMap = { ...state.chaptersByVolumeId }
      for (const volId of Object.keys(newChMap)) {
        newChMap[volId] = newChMap[volId].filter((c) => c.id !== chapterId)
      }
      return {
        chaptersByVolumeId: newChMap,
        currentChapterId: state.currentChapterId === chapterId ? null : state.currentChapterId,
      }
    })
  },

  setCurrentChapterContent: (content) => {
    set({ currentChapterContent: content })
  },

  getChaptersForProject: (projectId) => {
    const { volumesByProjectId, chaptersByVolumeId } = get()
    const volumes = volumesByProjectId[projectId] ?? []
    const all: Chapter[] = []
    for (const v of volumes) {
      all.push(...(chaptersByVolumeId[v.id] ?? []))
    }
    return all
  },
})

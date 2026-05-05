export interface Chapter {
  id: string
  volumeId: string
  title: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Volume {
  id: string
  projectId: string
  title: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectMeta {
  project: Project
  volumes: Volume[]
  chapters: Chapter[]
}

export interface Snapshot {
  id: string
  chapterId: string
  timestamp: string
  label?: string
  contentHash: string
  content: string
  textContent: string
  fileSize: number
}

export interface DiffResult {
  type: 'added' | 'removed' | 'unchanged'
  lineNumber: number
  content: string
}

export interface SnapshotIndex {
  snapshots: Snapshot[]
}

function generateId(): string {
  return crypto.randomUUID().slice(0, 8)
}

export function createProject(name: string): Project {
  const now = new Date().toISOString()
  return { id: generateId(), name, createdAt: now, updatedAt: now }
}

export function createVolume(projectId: string, title: string, order: number): Volume {
  const now = new Date().toISOString()
  return { id: generateId(), projectId, title, order, createdAt: now, updatedAt: now }
}

export function createChapter(volumeId: string, title: string, order: number): Chapter {
  const now = new Date().toISOString()
  return { id: generateId(), volumeId, title, order, createdAt: now, updatedAt: now }
}

export function emptyProjectMeta(): ProjectMeta {
  return {
    project: createProject('未命名项目'),
    volumes: [],
    chapters: [],
  }
}

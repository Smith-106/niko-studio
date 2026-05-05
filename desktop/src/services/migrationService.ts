import { writeProjectMeta, writeChapterContent, readChapterContent } from './projectFileService'
import { useAppStore } from '../stores/appStore'
import { createProject, createVolume, createChapter, type ProjectMeta } from '../types/project'

const DRAFT_PREFIX = 'niko.draft:'
const BACKUP_PREFIX = 'niko.draft.backup:'
const MIGRATION_FLAG = 'niko.migrated'

function getDraftKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(DRAFT_PREFIX)) {
      keys.push(key)
    }
  }
  return keys
}

export function isMigrated(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true'
}

export function backupLocalStorage(): number {
  let count = 0
  const keys = getDraftKeys()
  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value) {
      const backupKey = key.replace(DRAFT_PREFIX, BACKUP_PREFIX)
      localStorage.setItem(backupKey, value)
      count++
    }
  }
  return count
}

export function restoreFromBackup(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(BACKUP_PREFIX)) {
        const value = localStorage.getItem(key)
        const originalKey = key.replace(BACKUP_PREFIX, DRAFT_PREFIX)
        if (value) localStorage.setItem(originalKey, value)
      }
    }
    localStorage.removeItem(MIGRATION_FLAG)
    return true
  } catch {
    return false
  }
}

function getDraftText(key: string): string {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return ''
    const entry = JSON.parse(raw) as { text: string; timestamp: number }
    return entry.text ?? ''
  } catch {
    return ''
  }
}

export function plainTextToTipTap(text: string): string {
  if (!text.trim()) {
    return JSON.stringify({ type: 'doc', content: [] })
  }
  const paragraphs = text.split('\n').map((line) => {
    if (!line) {
      return { type: 'paragraph' }
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    }
  })
  return JSON.stringify({ type: 'doc', content: paragraphs })
}

async function validateMigration(
  projectId: string,
  chapterIds: string[],
): Promise<boolean> {
  for (const chapterId of chapterIds) {
    const content = await readChapterContent(projectId, chapterId)
    if (!content) return false
  }
  return true
}

export interface MigrationResult {
  success: boolean
  projectId: string
  chaptersMigrated: number
  error?: string
}

export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  if (isMigrated()) {
    return { success: true, projectId: '', chaptersMigrated: 0 }
  }

  const draftKeys = getDraftKeys()
  if (draftKeys.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, 'true')
    return { success: true, projectId: '', chaptersMigrated: 0 }
  }

  try {
    backupLocalStorage()

    const project = createProject('我的项目')
    const volume = createVolume(project.id, '卷一', 0)
    const chapterIds: string[] = []
    const chapters = draftKeys.map((key, index) => {
      const convId = key.slice(DRAFT_PREFIX.length)
      const text = getDraftText(key)
      const chapter = createChapter(volume.id, `第${index + 1}章`, index)
      chapterIds.push(chapter.id)
      return { chapter, text, convId }
    })

    const meta: ProjectMeta = {
      project,
      volumes: [volume],
      chapters: chapters.map((c) => c.chapter),
    }
    await writeProjectMeta(meta)

    for (const { chapter, text } of chapters) {
      const tipTapJson = plainTextToTipTap(text)
      await writeChapterContent(project.id, chapter.id, tipTapJson)
    }

    const valid = await validateMigration(project.id, chapterIds)
    if (!valid) {
      throw new Error('Validation failed — some chapter files could not be read back')
    }

    const store = useAppStore.getState()
    store.loadProjectMeta(meta)
    if (chapterIds.length > 0) {
      store.selectProject(project.id)
      store.selectChapter(chapterIds[0])
    }

    localStorage.setItem(MIGRATION_FLAG, 'true')
    return { success: true, projectId: project.id, chaptersMigrated: chapterIds.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, projectId: '', chaptersMigrated: 0, error: message }
  }
}

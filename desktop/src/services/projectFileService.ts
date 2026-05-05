import { mkdir, readTextFile, writeTextFile, exists, readDir, remove } from '@tauri-apps/plugin-fs'
import type { ProjectMeta, SnapshotIndex } from '../types/project'

const PROJECTS_ROOT = 'projects'

function projectDir(projectId: string): string {
  return `${PROJECTS_ROOT}/${projectId}`
}

function chapterDir(projectId: string, chapterId: string): string {
  return `${PROJECTS_ROOT}/${projectId}/chapters/${chapterId}`
}

function metaPath(projectId: string): string {
  return `${projectDir(projectId)}/meta.json`
}

function contentPath(projectId: string, chapterId: string): string {
  return `${chapterDir(projectId, chapterId)}/content.json`
}

function versionsDir(projectId: string, chapterId: string): string {
  return `${chapterDir(projectId, chapterId)}/versions`
}

function versionIndexPath(projectId: string, chapterId: string): string {
  return `${versionsDir(projectId, chapterId)}/index.json`
}

function snapshotPath(projectId: string, chapterId: string, snapshotId: string): string {
  return `${versionsDir(projectId, chapterId)}/${snapshotId}.json`
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

export async function projectExists(projectId: string): Promise<boolean> {
  return exists(metaPath(projectId))
}

export async function readProjectMeta(projectId: string): Promise<ProjectMeta | null> {
  try {
    const raw = await readTextFile(metaPath(projectId))
    return JSON.parse(raw) as ProjectMeta
  } catch {
    return null
  }
}

export async function writeProjectMeta(meta: ProjectMeta): Promise<void> {
  const dir = projectDir(meta.project.id)
  await ensureDir(dir)
  await writeTextFile(metaPath(meta.project.id), JSON.stringify(meta, null, 2))
}

export async function listProjectIds(): Promise<string[]> {
  try {
    if (!(await exists(PROJECTS_ROOT))) return []
    const entries = await readDir(PROJECTS_ROOT)
    return entries
      .filter((e) => !e.name.startsWith('.') && e.isDirectory)
      .map((e) => e.name)
  } catch {
    return []
  }
}

export async function readChapterContent(projectId: string, chapterId: string): Promise<string> {
  try {
    return await readTextFile(contentPath(projectId, chapterId))
  } catch {
    return ''
  }
}

export async function writeChapterContent(
  projectId: string,
  chapterId: string,
  content: string,
): Promise<void> {
  const dir = chapterDir(projectId, chapterId)
  await ensureDir(dir)
  await writeTextFile(contentPath(projectId, chapterId), content)
}

export async function deleteChapterDir(projectId: string, chapterId: string): Promise<void> {
  const dir = chapterDir(projectId, chapterId)
  if (await exists(dir)) {
    await remove(dir, { recursive: true })
  }
}

export async function createSnapshot(
  projectId: string,
  chapterId: string,
  content: string,
  label?: string,
): Promise<string> {
  const dir = versionsDir(projectId, chapterId)
  await ensureDir(dir)

  const timestamp = Date.now()
  const id = `v-${timestamp.toString(36)}`
  const textContent = extractText(content)
  const snapshot = {
    id,
    chapterId,
    timestamp: new Date().toISOString(),
    label,
    contentHash: await hashContent(content),
    content,
    textContent,
    fileSize: new Blob([content]).size,
  }

  await writeTextFile(snapshotPath(projectId, chapterId, id), JSON.stringify(snapshot, null, 2))

  const indexPath = versionIndexPath(projectId, chapterId)
  let index: SnapshotIndex = { snapshots: [] }
  try {
    index = JSON.parse(await readTextFile(indexPath)) as SnapshotIndex
  } catch {
    // first snapshot
  }
  index.snapshots.unshift(snapshot)
  await writeTextFile(indexPath, JSON.stringify(index, null, 2))

  return id
}

export async function listSnapshots(
  projectId: string,
  chapterId: string,
): Promise<SnapshotIndex> {
  try {
    const raw = await readTextFile(versionIndexPath(projectId, chapterId))
    return JSON.parse(raw) as SnapshotIndex
  } catch {
    return { snapshots: [] }
  }
}

export async function getSnapshot(
  projectId: string,
  chapterId: string,
  snapshotId: string,
) {
  try {
    const raw = await readTextFile(snapshotPath(projectId, chapterId, snapshotId))
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function restoreSnapshot(
  projectId: string,
  chapterId: string,
  snapshotId: string,
): Promise<string | null> {
  const snap = await getSnapshot(projectId, chapterId, snapshotId)
  if (!snap) return null
  await writeChapterContent(projectId, chapterId, snap.content)
  return snap.content
}

function extractText(content: string): string {
  try {
    const json = JSON.parse(content)
    return extractTextFromTipTap(json)
  } catch {
    return content
  }
}

function extractTextFromTipTap(node: Record<string, unknown>): string {
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  const content = node.content
  if (!Array.isArray(content)) return ''
  return content.map((child: Record<string, unknown>) => extractTextFromTipTap(child)).join('')
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

export async function shouldAutoSave(lastSnapshotTime: string | null): Promise<boolean> {
  if (!lastSnapshotTime) return true
  const elapsed = Date.now() - new Date(lastSnapshotTime).getTime()
  return elapsed > 5 * 60 * 1000
}

export async function enforceRetentionPolicy(
  projectId: string,
  chapterId: string,
  maxSnapshots = 50,
): Promise<number> {
  const index = await listSnapshots(projectId, chapterId)
  if (index.snapshots.length <= maxSnapshots) return 0

  const sorted = [...index.snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const unnamed = sorted.filter((s) => !s.label)

  const excess = index.snapshots.length - maxSnapshots
  const toRemove = unnamed.slice(0, Math.min(excess, unnamed.length))

  for (const snap of toRemove) {
    const path = snapshotPath(projectId, chapterId, snap.id)
    if (await exists(path)) {
      await remove(path)
    }
  }

  const remaining = sorted.filter((s) => !toRemove.some((r) => r.id === s.id))
  await writeTextFile(
    versionIndexPath(projectId, chapterId),
    JSON.stringify({ snapshots: remaining }, null, 2),
  )

  return toRemove.length
}

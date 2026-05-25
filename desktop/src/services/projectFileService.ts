import { mkdir, readTextFile, writeTextFile, exists, readDir, remove, stat } from '@tauri-apps/plugin-fs'
import type { ProjectMeta, SnapshotIndex } from '../types/project'

// ---------------------------------------------------------------------------
// 章节内容缓存 — 避免重复文件读取
// ---------------------------------------------------------------------------

/** 缓存最大条目数 */
const CHAPTER_CACHE_MAX_SIZE = 500

interface ChapterCacheEntry {
  content: string
  /** 文件修改时间（毫秒时间戳），用于校验缓存是否过期 */
  mtime: number
}

/**
 * 章节内容 LRU 缓存
 *
 * - 以 `${projectId}/${chapterId}` 为 key
 * - 通过文件 mtime 校验缓存有效性：mtime 不变则命中，否则视为过期
 * - Map 保持插入顺序，最早插入的条目最先被淘汰（LRU）
 * - 最大 500 条，超出时淘汰最久未使用的条目
 */
class ChapterContentCache {
  private _cache = new Map<string, ChapterCacheEntry>()

  /**
   * 生成缓存 key
   */
  private _key(projectId: string, chapterId: string): string {
    return `${projectId}/${chapterId}`
  }

  /**
   * 获取缓存内容。返回 null 表示未命中或已过期。
   * 命中时将条目移到 Map 末尾（标记为最近使用）。
   */
  get(projectId: string, chapterId: string, currentMtime: number): string | null {
    const key = this._key(projectId, chapterId)
    const entry = this._cache.get(key)
    if (!entry) return null

    // mtime 校验：不一致则缓存过期
    if (entry.mtime !== currentMtime) {
      this._cache.delete(key)
      return null
    }

    // 命中：移到末尾（LRU 更新）
    this._cache.delete(key)
    this._cache.set(key, entry)
    return entry.content
  }

  /**
   * 写入缓存。超过上限时淘汰最久未使用的条目。
   */
  set(projectId: string, chapterId: string, content: string, mtime: number): void {
    const key = this._key(projectId, chapterId)

    // 已存在则先删除（重新插入到末尾）
    this._cache.delete(key)

    // LRU 淘汰
    while (this._cache.size >= CHAPTER_CACHE_MAX_SIZE) {
      const firstKey = this._cache.keys().next().value
      if (firstKey === undefined) break
      this._cache.delete(firstKey)
    }

    this._cache.set(key, { content, mtime })
  }

  /**
   * 使指定章节的缓存失效
   */
  invalidate(projectId: string, chapterId: string): void {
    const key = this._key(projectId, chapterId)
    this._cache.delete(key)
  }

  /**
   * 清空全部缓存
   */
  clear(): void {
    this._cache.clear()
  }

  /** 当前缓存条目数 */
  get size(): number {
    return this._cache.size
  }
}

/** 全局章节内容缓存实例 */
const chapterContentCache = new ChapterContentCache()

// ---------------------------------------------------------------------------
// 文件路径辅助函数
// ---------------------------------------------------------------------------

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
  const path = contentPath(projectId, chapterId)

  // 尝试获取文件 mtime 用于缓存校验
  let currentMtime: number | null = null
  try {
    const fileInfo = await stat(path)
    // fileInfo.mtime 是 Date | null，转换为毫秒时间戳
    currentMtime = fileInfo.mtime ? fileInfo.mtime.getTime() : null
  } catch {
    // 文件不存在，直接返回空字符串
    return ''
  }

  // mtime 校验缓存命中
  if (currentMtime !== null) {
    const cached = chapterContentCache.get(projectId, chapterId, currentMtime)
    if (cached !== null) return cached
  }

  // 缓存未命中，从文件系统读取
  try {
    const content = await readTextFile(path)
    // 写入缓存（mtime 已获取）
    if (currentMtime !== null) {
      chapterContentCache.set(projectId, chapterId, content, currentMtime)
    }
    return content
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
  // 写入后使缓存失效，下次读取时重新加载并缓存
  chapterContentCache.invalidate(projectId, chapterId)
}

export async function deleteChapterDir(projectId: string, chapterId: string): Promise<void> {
  // 删除前使缓存失效
  chapterContentCache.invalidate(projectId, chapterId)
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

export function extractText(content: string): string {
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

// ---------------------------------------------------------------------------
// 缓存操作导出（供测试和外部失效使用）
// ---------------------------------------------------------------------------

/** 使指定章节的内容缓存失效 */
export function invalidateChapterContentCache(projectId: string, chapterId: string): void {
  chapterContentCache.invalidate(projectId, chapterId)
}

/** 清空全部章节内容缓存 */
export function clearChapterContentCache(): void {
  chapterContentCache.clear()
}

/** 获取当前缓存条目数（调试用） */
export function getChapterContentCacheSize(): number {
  return chapterContentCache.size
}

import * as Diff from 'diff'
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  restoreSnapshot,
  shouldAutoSave,
  enforceRetentionPolicy,
  readChapterContent,
} from './projectFileService'
import type { DiffResult, SnapshotIndex } from '../types/project'

export { createSnapshot, listSnapshots, getSnapshot, restoreSnapshot, shouldAutoSave, enforceRetentionPolicy }

export async function diffSnapshots(
  projectId: string,
  chapterId: string,
  fromId: string,
  toId: string,
): Promise<DiffResult[]> {
  const fromSnap = await getSnapshot(projectId, chapterId, fromId)
  const toSnap = await getSnapshot(projectId, chapterId, toId)
  if (!fromSnap || !toSnap) return []

  const fromText = fromSnap.textContent || ''
  const toText = toSnap.textContent || ''

  const changes = Diff.diffLines(fromText, toText)
  const result: DiffResult[] = []
  let lineNumber = 1

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n')
    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'added', lineNumber, content: line })
      } else if (change.removed) {
        result.push({ type: 'removed', lineNumber, content: line })
      } else {
        result.push({ type: 'unchanged', lineNumber, content: line })
      }
      lineNumber++
    }
  }

  return result
}

export async function autoSaveSnapshot(
  projectId: string,
  chapterId: string,
): Promise<string | null> {
  const index: SnapshotIndex = await listSnapshots(projectId, chapterId)
  const lastTime = index.snapshots.length > 0 ? index.snapshots[0].timestamp : null

  if (!(await shouldAutoSave(lastTime))) return null

  const content = await readChapterContent(projectId, chapterId)
  if (!content) return null

  const id = await createSnapshot(projectId, chapterId, content)
  await enforceRetentionPolicy(projectId, chapterId)
  return id
}

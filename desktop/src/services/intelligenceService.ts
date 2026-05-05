import { exists, mkdir, readTextFile, writeTextFile, remove } from '@tauri-apps/plugin-fs'
import { readChapterContent } from './projectFileService'
import { callAnalysisAgent, type AnalysisModule } from '../api/intelligence'

export interface AnalysisResult {
  module: AnalysisModule
  projectId: string
  chaptersAnalyzed: string[]
  result: Record<string, unknown>
  createdAt: string
  contentHashes: Record<string, string>
}

interface AnalysisCacheEntry {
  module: AnalysisModule
  result: AnalysisResult
  contentHashes: Record<string, string>
  updatedAt: string
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

function analysisPath(projectId: string, module: AnalysisModule): string {
  return `projects/${projectId}/analysis/${module}.json`
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true })
  }
}

export async function getCachedAnalysis(
  projectId: string,
  module: AnalysisModule,
): Promise<AnalysisCacheEntry | null> {
  try {
    const raw = await readTextFile(analysisPath(projectId, module))
    return JSON.parse(raw) as AnalysisCacheEntry
  } catch {
    return null
  }
}

export async function invalidateAnalysis(projectId: string): Promise<void> {
  const dir = `projects/${projectId}/analysis`
  if (await exists(dir)) {
    await remove(dir, { recursive: true })
  }
}

export async function analyzeProject(
  projectId: string,
  module: AnalysisModule,
  chapterIds: string[],
  forceRefresh = false,
  onProgress?: (processed: number, total: number) => void,
): Promise<AnalysisResult> {
  const contents: Record<string, string> = {}
  const hashes: Record<string, string> = {}

  for (const chId of chapterIds) {
    const content = await readChapterContent(projectId, chId)
    contents[chId] = content
    hashes[chId] = await hashContent(content)
  }

  let cached: AnalysisCacheEntry | null = null
  if (!forceRefresh) {
    cached = await getCachedAnalysis(projectId, module)
    if (cached) {
      const unchanged = chapterIds.every(
        (id) => hashes[id] === cached!.result.contentHashes[id],
      )
      if (unchanged) {
        return cached.result
      }
    }
  }

  const chaptersToAnalyze =
    cached && !forceRefresh
      ? chapterIds.filter((id) => hashes[id] !== cached!.result.contentHashes[id])
      : chapterIds

  const total = chaptersToAnalyze.length
  let processed = 0
  const perChapterResults: Record<string, unknown>[] = []

  for (const chId of chaptersToAnalyze) {
    const response = await callAnalysisAgent(module, contents[chId])
    if (response.success && response.data) {
      perChapterResults.push({ chapterId: chId, analysis: response.data })
    }
    processed++
    onProgress?.(processed, total)
  }

  const mergedResult: Record<string, unknown> = {
    chapters: perChapterResults,
    totalAnalyzed: perChapterResults.length,
    module,
  }

  const result: AnalysisResult = {
    module,
    projectId,
    chaptersAnalyzed: chapterIds,
    result: mergedResult,
    createdAt: new Date().toISOString(),
    contentHashes: hashes,
  }

  const dir = `projects/${projectId}/analysis`
  await ensureDir(dir)
  await writeTextFile(
    analysisPath(projectId, module),
    JSON.stringify({ module, result, contentHashes: hashes, updatedAt: new Date().toISOString() } satisfies AnalysisCacheEntry, null, 2),
  )

  return result
}

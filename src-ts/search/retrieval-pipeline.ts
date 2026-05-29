import { LocalEmbeddingProvider } from '../knowledge/providers/local-embedding-v2'
import { VectorSearchV2 } from '../search/vector-search-v2'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface RetrievalResult {
  id: string
  content: string
  score: number
  source: string
  metadata: Record<string, unknown>
}

export class RetrievalPipeline extends EventEmitter {
  private embedding: LocalEmbeddingProvider
  private search: VectorSearchV2
  private chunkSize = 1000
  private chunkOverlap = 200

  constructor(embedding: LocalEmbeddingProvider, search: VectorSearchV2) {
    super()
    this.embedding = embedding
    this.search = search
  }

  async indexNote(notePath: string, content: string): Promise<void> {
    const chunks = this.chunkContent(content)
    const embeddings = await this.embedding.embedBatch(chunks)

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = this.computeChunkId(notePath, i)
      this.search.upsert(chunkId, chunks[i], {
        source: notePath,
        chunkIndex: i,
        totalChunks: chunks.length,
      }, embeddings[i].embedding)
    }

    this.emit('index:note-complete', { path: notePath, chunks: chunks.length })
  }

  async searchNotes(query: string, topK = 10): Promise<RetrievalResult[]> {
    const queryEmbedding = await this.embedding.embed(query)

    if (this.embedding.isReady) {
      const results = this.search.hybridSearch(queryEmbedding.embedding, query, topK)
      return results.map((r) => ({
        id: r.id,
        content: r.metadata.content as string || '',
        score: r.score,
        source: r.metadata.source as string || '',
        metadata: r.metadata,
      }))
    }

    // Fallback: FTS-only search
    const ftsResults = this.search.ftsSearch(query, topK)
    return ftsResults.map((r) => ({
      id: r.id,
      content: r.metadata.content as string || '',
      score: r.score,
      source: r.metadata.source as string || '',
      metadata: r.metadata,
    }))
  }

  async getContextForWriting(editorContent: string, maxTokens = 4000): Promise<RetrievalResult[]> {
    const query = this.extractKeywords(editorContent).join(' ')
    if (!query) return []

    const results = await this.searchNotes(query, 20)

    // MMR-like diversity filtering
    const selected: RetrievalResult[] = []
    let totalTokens = 0

    for (const result of results) {
      const tokenCount = Math.ceil(result.content.length / 4)
      if (totalTokens + tokenCount > maxTokens) break

      const isDiverse = selected.every(
        (s) => this.computeSimilarity(s.content, result.content) < 0.8,
      )

      if (isDiverse) {
        selected.push(result)
        totalTokens += tokenCount
      }
    }

    return selected
  }

  private chunkContent(content: string): string[] {
    const chunks: string[] = []
    const lines = content.split('\n')
    let current = ''
    let heading = ''

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
      if (headingMatch) {
        if (current.length >= this.chunkSize) {
          chunks.push(current.trim())
          current = heading + '\n'
        }
        heading = line
      }

      current += line + '\n'

      if (current.length >= this.chunkSize + this.chunkOverlap) {
        chunks.push(current.trim())
        current = heading + '\n'
      }
    }

    if (current.trim()) {
      chunks.push(current.trim())
    }

    return chunks.length > 0 ? chunks : [content]
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
      'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
      'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
    ])

    return text
      .toLowerCase()
      .split(/[\s,.\-!?;:，。！？；：、""''（）()]+/)
      .filter((w) => w.length > 1 && !stopWords.has(w))
      .slice(0, 20)
  }

  private computeSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/))
    const setB = new Set(b.toLowerCase().split(/\s+/))
    const intersection = [...setA].filter((x) => setB.has(x)).length
    const union = new Set([...setA, ...setB]).size
    return union === 0 ? 0 : intersection / union
  }

  private computeChunkId(notePath: string, chunkIndex: number): string {
    return crypto
      .createHash('sha256')
      .update(`${notePath}:${chunkIndex}`)
      .digest('hex')
      .substring(0, 16)
  }
}

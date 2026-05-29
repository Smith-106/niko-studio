import Database from 'better-sqlite3'
import path from 'path'

const EMBEDDING_DIM = 384

export interface VectorSearchResult {
  id: string
  score: number
  metadata: Record<string, unknown>
}

export class VectorSearchV2 {
  private db: Database.Database
  private useVecExtension = false

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.init()
  }

  private init() {
    // Try to load sqlite-vec extension
    try {
      this.db.loadExtension(path.join(__dirname, 'vec0'))
      this.useVecExtension = true
    } catch {
      console.warn('[vector-search] sqlite-vec not available, falling back to brute-force cosine search')
    }

    if (this.useVecExtension) {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
          embedding float[${EMBEDDING_DIM}]
        );
      `)
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_items (
        id TEXT PRIMARY KEY,
        content TEXT,
        metadata TEXT,
        embedding BLOB,
        created_at REAL NOT NULL DEFAULT (strftime('%s','now'))
      );

      CREATE INDEX IF NOT EXISTS idx_vector_items_content ON vector_items(content);
    `)

    // FTS5 for keyword search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_items USING fts5(
        id UNINDEXED,
        content,
        metadata,
        tokenize='unicode61'
      );
    `)
  }

  upsert(id: string, content: string, metadata: Record<string, unknown>, embedding: number[]) {
    const embeddingBuffer = this.embeddingToBuffer(embedding)

    this.db.prepare(
      `INSERT INTO vector_items (id, content, metadata, embedding)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content = excluded.content, metadata = excluded.metadata, embedding = excluded.embedding`,
    ).run(id, content, JSON.stringify(metadata), embeddingBuffer)

    this.db.prepare(
      `INSERT OR REPLACE INTO fts_items (id, content, metadata) VALUES (?, ?, ?)`,
    ).run(id, content, JSON.stringify(metadata))

    if (this.useVecExtension) {
      this.db.prepare(
        `INSERT OR REPLACE INTO vec_items (rowid, embedding) VALUES (?, ?)`,
      ).run(this.idToRowId(id), this.embeddingToBuffer(embedding))
    }
  }

  deleteItem(id: string) {
    this.db.prepare('DELETE FROM vector_items WHERE id = ?').run(id)
    this.db.prepare('DELETE FROM fts_items WHERE id = ?').run(id)
    if (this.useVecExtension) {
      this.db.prepare('DELETE FROM vec_items WHERE rowid = ?').run(this.idToRowId(id))
    }
  }

  vectorSearch(queryEmbedding: number[], topK = 20): VectorSearchResult[] {
    if (this.useVecExtension) {
      return this.vecSearch(queryEmbedding, topK)
    }
    return this.bruteForceSearch(queryEmbedding, topK)
  }

  ftsSearch(query: string, topK = 20): VectorSearchResult[] {
    const results = this.db
      .prepare(
        `SELECT id, content, metadata, rank
         FROM fts_items
         WHERE fts_items MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(query, topK) as Array<{ id: string; content: string; metadata: string; rank: number }>

    return results.map((r) => ({
      id: r.id,
      score: -r.rank,
      metadata: JSON.parse(r.metadata || '{}'),
    }))
  }

  hybridSearch(queryEmbedding: number[], queryText: string, topK = 20): VectorSearchResult[] {
    const vecResults = this.vectorSearch(queryEmbedding, topK)
    const ftsResults = this.ftsSearch(queryText, topK)
    return this.rrfFuse(vecResults, ftsResults, topK)
  }

  private vecSearch(queryEmbedding: number[], topK: number): VectorSearchResult[] {
    const results = this.db
      .prepare(
        `SELECT v.rowid, v.distance, vi.id, vi.metadata
         FROM vec_items v
         JOIN vector_items vi ON vi.rowid = v.rowid
         WHERE v.embedding MATCH ?
         ORDER BY v.distance
         LIMIT ?`,
      )
      .all(this.embeddingToBuffer(queryEmbedding), topK) as Array<{
      rowid: number
      distance: number
      id: string
      metadata: string
    }>

    return results.map((r) => ({
      id: r.id,
      score: 1 / (1 + r.distance),
      metadata: JSON.parse(r.metadata || '{}'),
    }))
  }

  private bruteForceSearch(queryEmbedding: number[], topK: number): VectorSearchResult[] {
    const items = this.db
      .prepare('SELECT id, embedding, metadata FROM vector_items')
      .all() as Array<{ id: string; embedding: Buffer; metadata: string }>

    const scored = items.map((item) => ({
      id: item.id,
      score: this.cosineSimilarity(queryEmbedding, this.bufferToEmbedding(item.embedding)),
      metadata: JSON.parse(item.metadata || '{}'),
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  private rrfFuse(vecResults: VectorSearchResult[], ftsResults: VectorSearchResult[], topK: number, k = 60): VectorSearchResult[] {
    const scores = new Map<string, number>()

    for (let i = 0; i < vecResults.length; i++) {
      const id = vecResults[i].id
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1))
    }

    for (let i = 0; i < ftsResults.length; i++) {
      const id = ftsResults[i].id
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1))
    }

    return Array.from(scores.entries())
      .map(([id, score]) => {
        const vecItem = vecResults.find((r) => r.id === id)
        const ftsItem = ftsResults.find((r) => r.id === id)
        return { id, score, metadata: vecItem?.metadata ?? ftsItem?.metadata ?? {} }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }

  private embeddingToBuffer(embedding: number[]): Buffer {
    const buffer = Buffer.alloc(embedding.length * 4)
    for (let i = 0; i < embedding.length; i++) {
      buffer.writeFloatLE(embedding[i], i * 4)
    }
    return buffer
  }

  private bufferToEmbedding(buffer: Buffer): number[] {
    const embedding: number[] = []
    for (let i = 0; i < buffer.length; i += 4) {
      embedding.push(buffer.readFloatLE(i))
    }
    return embedding
  }

  private idToRowId(id: string): number {
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
    }
    return Math.abs(hash) + 1
  }

  close() {
    this.db.close()
  }
}

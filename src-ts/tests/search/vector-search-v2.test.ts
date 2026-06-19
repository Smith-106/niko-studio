import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('search/VectorSearchV2', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('better-sqlite3')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('better-sqlite3')
  })

  it('falls back to brute-force search, supports FTS and hybrid fusion, and deletes indexed items', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { VectorSearchV2 } = await import('../../search/vector-search-v2.js')
    const search = new VectorSearchV2(':memory:')

    try {
      search.upsert(
        'alpha-top',
        'alpha rain gate',
        { source: 'alpha.md', content: 'alpha rain gate', lane: 'vector' },
        [1, 0, 0],
      )
      search.upsert(
        'beta-shared',
        'beta gate clue',
        { source: 'beta.md', content: 'beta gate clue', lane: 'hybrid' },
        [0.8, 0.2, 0],
      )
      search.upsert(
        'beta-only',
        'beta echo',
        { source: 'gamma.md', content: 'beta echo', lane: 'fts' },
        [0, 1, 0],
      )

      expect(warnSpy).toHaveBeenCalledWith(
        '[vector-search] sqlite-vec not available, falling back to brute-force cosine search',
      )

      const vectorResults = search.vectorSearch([1, 0, 0], 2)
      expect(vectorResults.map((result) => result.id)).toEqual(['alpha-top', 'beta-shared'])
      expect(vectorResults[0]?.metadata).toMatchObject({
        source: 'alpha.md',
        lane: 'vector',
      })

      const ftsResults = search.ftsSearch('beta', 5)
      expect(ftsResults.map((result) => result.id)).toEqual(
        expect.arrayContaining(['beta-shared', 'beta-only']),
      )
      expect(ftsResults.find((result) => result.id === 'beta-shared')?.metadata).toMatchObject({
        source: 'beta.md',
      })

      const hybridResults = search.hybridSearch([1, 0, 0], 'beta', 3)
      expect(hybridResults[0]?.id).toBe('beta-shared')
      expect(hybridResults.map((result) => result.id)).toEqual(
        expect.arrayContaining(['alpha-top', 'beta-only']),
      )

      search.deleteItem('beta-shared')

      expect(search.vectorSearch([1, 0, 0], 5).map((result) => result.id)).not.toContain('beta-shared')
      expect(search.ftsSearch('beta', 5).map((result) => result.id)).not.toContain('beta-shared')
    } finally {
      search.close()
    }
  })

  it('round-trips vector buffers and keeps helper methods stable on edge cases', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { VectorSearchV2 } = await import('../../search/vector-search-v2.js')
    const search = new VectorSearchV2(':memory:')

    try {
      const vector = [1.25, -2.5, 0, 9.75]
      const buffer = (search as any).embeddingToBuffer(vector) as Buffer
      const roundTrip = (search as any).bufferToEmbedding(buffer) as number[]

      expect(roundTrip).toHaveLength(vector.length)
      roundTrip.forEach((value, index) => {
        expect(value).toBeCloseTo(vector[index], 5)
      })

      expect((search as any).cosineSimilarity([0, 0], [1, 1])).toBe(0)
      expect((search as any).cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6)

      const rowId = (search as any).idToRowId('stable-id') as number
      expect(rowId).toBeGreaterThan(0)
      expect((search as any).idToRowId('stable-id')).toBe(rowId)
      expect((search as any).idToRowId('other-id')).not.toBe(rowId)

      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      search.close()
    }
  })

  it('uses sqlite-vec tables and rowid-based mutations when the extension loads successfully', async () => {
    const runSpies = {
      upsertVectorItem: vi.fn(),
      upsertFtsItem: vi.fn(),
      upsertVecItem: vi.fn(),
      deleteVectorItem: vi.fn(),
      deleteFtsItem: vi.fn(),
      deleteVecItem: vi.fn(),
    }

    const mockDb = {
      pragma: vi.fn(),
      loadExtension: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn((sql: string) => {
        if (sql.includes('INSERT INTO vector_items')) {
          return { run: runSpies.upsertVectorItem }
        }
        if (sql.includes('INSERT OR REPLACE INTO fts_items')) {
          return { run: runSpies.upsertFtsItem }
        }
        if (sql.includes('INSERT OR REPLACE INTO vec_items')) {
          return { run: runSpies.upsertVecItem }
        }
        if (sql.includes('DELETE FROM vector_items')) {
          return { run: runSpies.deleteVectorItem }
        }
        if (sql.includes('DELETE FROM fts_items')) {
          return { run: runSpies.deleteFtsItem }
        }
        if (sql.includes('DELETE FROM vec_items')) {
          return { run: runSpies.deleteVecItem }
        }
        if (sql.includes('SELECT v.rowid, v.distance, vi.id, vi.metadata')) {
          return {
            all: vi.fn(() => [
              {
                rowid: 11,
                distance: 0.25,
                id: 'vec-doc',
                metadata: JSON.stringify({ source: 'vec.md', mode: 'vec' }),
              },
            ]),
          }
        }
        throw new Error(`Unexpected SQL in mock database: ${sql}`)
      }),
      close: vi.fn(),
    }

    const DatabaseMock = vi.fn(() => mockDb)

    vi.doMock('better-sqlite3', () => ({
      __esModule: true,
      default: DatabaseMock,
    }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { VectorSearchV2 } = await import('../../search/vector-search-v2.js')
    const search = new VectorSearchV2('mock.db')

    try {
      expect(DatabaseMock).toHaveBeenCalledWith('mock.db')
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL')
      expect(mockDb.loadExtension).toHaveBeenCalledTimes(1)
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining('CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0'),
      )
      expect(warnSpy).not.toHaveBeenCalled()

      search.upsert('vec-doc', 'vector content', { source: 'vec.md', content: 'vector content' }, [0.5, 0.25])

      expect(runSpies.upsertVectorItem).toHaveBeenCalledTimes(1)
      expect(runSpies.upsertFtsItem).toHaveBeenCalledTimes(1)
      expect(runSpies.upsertVecItem).toHaveBeenCalledTimes(1)

      const results = search.vectorSearch([0.5, 0.25], 1)
      expect(results).toEqual([
        {
          id: 'vec-doc',
          score: 0.8,
          metadata: { source: 'vec.md', mode: 'vec' },
        },
      ])

      search.deleteItem('vec-doc')
      expect(runSpies.deleteVectorItem).toHaveBeenCalledWith('vec-doc')
      expect(runSpies.deleteFtsItem).toHaveBeenCalledWith('vec-doc')
      expect(runSpies.deleteVecItem).toHaveBeenCalledTimes(1)
    } finally {
      search.close()
      expect(mockDb.close).toHaveBeenCalledTimes(1)
    }
  })
})

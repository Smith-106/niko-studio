import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('search/VectorSearchV2 additional coverage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('better-sqlite3')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.doUnmock('better-sqlite3')
  })

  it('falls back to empty metadata in FTS and brute-force rows when the database returns blanks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const embedding = Buffer.alloc(8)
    embedding.writeFloatLE(1, 0)
    embedding.writeFloatLE(0, 4)

    const mockDb = {
      pragma: vi.fn(),
      loadExtension: vi.fn(() => {
        throw new Error('vec unavailable')
      }),
      exec: vi.fn(),
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT id, content, metadata, rank')) {
          return {
            all: vi.fn(() => [
              {
                id: 'fts-empty',
                content: 'keyword hit',
                metadata: '',
                rank: -3,
              },
            ]),
          }
        }
        if (sql.includes('SELECT id, embedding, metadata FROM vector_items')) {
          return {
            all: vi.fn(() => [
              {
                id: 'brute-empty',
                embedding,
                metadata: '',
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

    const { VectorSearchV2 } = await import('../../search/vector-search-v2.js')
    const search = new VectorSearchV2('mock.db')

    try {
      expect(search.ftsSearch('keyword', 5)).toEqual([
        {
          id: 'fts-empty',
          score: 3,
          metadata: {},
        },
      ])
      expect(search.vectorSearch([1, 0], 5)).toEqual([
        {
          id: 'brute-empty',
          score: 1,
          metadata: {},
        },
      ])
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      search.close()
      expect(mockDb.close).toHaveBeenCalledTimes(1)
    }
  })

  it('falls back to empty metadata in vec mode and covers duplicate-id fusion branches', async () => {
    const mockDb = {
      pragma: vi.fn(),
      loadExtension: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn((sql: string) => {
        if (sql.includes('SELECT v.rowid, v.distance, vi.id, vi.metadata')) {
          return {
            all: vi.fn(() => [
              {
                rowid: 7,
                distance: 1,
                id: 'vec-empty',
                metadata: '',
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

    const { VectorSearchV2 } = await import('../../search/vector-search-v2.js')
    const search = new VectorSearchV2('vec.db')

    try {
      expect(search.vectorSearch([0.5, 0.25], 1)).toEqual([
        {
          id: 'vec-empty',
          score: 0.5,
          metadata: {},
        },
      ])

      const fused = (search as any).rrfFuse(
        [
          { id: 'shared', score: 0.9, metadata: { source: 'vec' } },
          { id: 'shared', score: 0.8, metadata: { source: 'vec-duplicate' } },
          { id: 'vec-only', score: 0.7, metadata: undefined },
        ],
        [
          { id: 'shared', score: 0.6, metadata: { source: 'fts' } },
          { id: 'fts-only', score: 0.5, metadata: { source: 'fts-only' } },
        ],
        10,
      ) as Array<{ id: string; score: number; metadata: Record<string, unknown> }>

      expect(fused.map((item) => item.id)).toEqual(
        expect.arrayContaining(['shared', 'vec-only', 'fts-only']),
      )
      expect(fused.find((item) => item.id === 'shared')?.metadata).toEqual({ source: 'vec' })
      expect(fused.find((item) => item.id === 'fts-only')?.metadata).toEqual({ source: 'fts-only' })
      expect(fused.find((item) => item.id === 'vec-only')?.metadata).toEqual({})
    } finally {
      search.close()
      expect(mockDb.close).toHaveBeenCalledTimes(1)
    }
  })
})

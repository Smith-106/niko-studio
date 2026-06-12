import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

import {
  SearchMode,
  SmartSearch,
  type DatabaseConnection,
  type SmartSearchResult,
  type VectorIndexInterface,
} from '../../search/smart-search';

type SmartSearchPrivate = SmartSearch & {
  fts5Search(query: string, options?: { topK?: number; typeFilter?: string }): Promise<SmartSearchResult[]>;
  likeSearch(query: string, options?: { topK?: number; typeFilter?: string }): Promise<SmartSearchResult[]>;
  parseMetadata(metadataStr: string | null): Record<string, unknown>;
  ripgrepAvailable: boolean;
  ripgrepChecked: boolean;
  ripgrepSearch(query: string, options?: { topK?: number; typeFilter?: string }): Promise<SmartSearchResult[]>;
  rrfMerge(semanticResults: SmartSearchResult[], fuzzyResults: SmartSearchResult[]): SmartSearchResult[];
};

function mockExecFileOnce(options: {
  error?: NodeJS.ErrnoException & { code?: string | number };
  stdout?: string;
  stderr?: string;
}): void {
  execFileMock.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      error: NodeJS.ErrnoException | null,
      stdout: string,
      stderr: string
    ) => void;
    callback(options.error ?? null, options.stdout ?? '', options.stderr ?? '');
  });
}

function result(overrides: Partial<SmartSearchResult> = {}): SmartSearchResult {
  return {
    id: 'doc-1',
    content: 'alpha content',
    score: 0.9,
    type: 'chunk',
    metadata: { extra: {} },
    source: 'semantic',
    mode_used: 'semantic',
    snapshot_query: 'alpha',
    ...overrides,
  };
}

function createVectorIndex(searchResults: SmartSearchResult[] = []): VectorIndexInterface {
  return {
    search: vi.fn().mockResolvedValue(searchResults),
    upsert: vi.fn(),
    delete: vi.fn().mockReturnValue(true),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SmartSearch additional mode coverage', () => {
  it('covers default options, invalid string modes, long auto-semantic, and hybrid defaults', async () => {
    const search = new SmartSearch();
    const hybridSpy = vi
      .spyOn(search, 'hybridSearch')
      .mockResolvedValueOnce([result({ id: 'default-hybrid', score: 0.7, source: 'hybrid', mode_used: 'hybrid' })])
      .mockResolvedValueOnce([result({ id: 'invalid-mode', score: 0.8, source: 'hybrid', mode_used: 'hybrid' })]);
    const semanticSpy = vi
      .spyOn(search, 'semanticSearch')
      .mockResolvedValueOnce([result({ id: 'long-semantic', source: 'semantic', mode_used: 'semantic' })]);

    await expect(search.search('the hero')).resolves.toEqual([
      expect.objectContaining({
        id: 'default-hybrid',
        mode_used: 'hybrid',
      }),
    ]);
    expect(hybridSpy).toHaveBeenNthCalledWith(1, 'the hero', {
      topK: 10,
      typeFilter: undefined,
    });

    await expect(search.search('alpha', { mode: 'not-a-mode', topK: 1 })).resolves.toEqual([
      expect.objectContaining({
        id: 'invalid-mode',
        mode_used: 'hybrid',
      }),
    ]);

    await expect(
      search.search('story memory archive clue ritual shadow', { mode: SearchMode.AUTO, topK: 1 })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'long-semantic',
        mode_used: 'semantic',
      }),
    ]);
    expect(semanticSpy).toHaveBeenCalledWith('story memory archive clue ritual shadow', {
      topK: 2,
      typeFilter: undefined,
    });
  });

  it('uses default vector index type and returns empty semantic results without an index', async () => {
    const vectorIndex = createVectorIndex();
    const configured = new SmartSearch({ vectorIndex });
    const unconfigured = new SmartSearch();

    await configured.index('doc-default', 'default body');
    expect(vectorIndex.upsert).toHaveBeenCalledWith('doc-default', 'default body', undefined, 'chunk');

    await expect(unconfigured.semanticSearch('alpha')).resolves.toEqual([]);
  });
});

describe('SmartSearch additional database coverage', () => {
  it('covers FTS defaults, type filters, LIKE guards, and null metadata parsing', async () => {
    const dbConnection: DatabaseConnection = {
      query: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'fts-filtered',
            content: 'alpha note',
            metadata: null,
            type: 'note',
            rank: -2,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'like-filtered',
            content: 'alpha beta note',
            metadata: '{"path":"docs/alpha.md","custom":"value"}',
            type: 'note',
          },
        ]),
      close: vi.fn(),
    };
    const search = new SmartSearch({ dbConnection });

    await expect((search as unknown as SmartSearchPrivate).fts5Search('   ')).resolves.toEqual([]);

    const ftsResults = await (search as unknown as SmartSearchPrivate).fts5Search('alpha', {
      topK: 3,
      typeFilter: 'note',
    });
    expect(ftsResults).toEqual([
      expect.objectContaining({
        id: 'fts-filtered',
        score: 1 / 3,
        metadata: { extra: {} },
      }),
    ]);
    expect(dbConnection.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND vi.type = ?'),
      ['"alpha"', 'note', 3]
    );

    await expect((new SmartSearch() as unknown as SmartSearchPrivate).likeSearch('alpha')).resolves.toEqual([]);
    await expect((search as unknown as SmartSearchPrivate).likeSearch('   ')).resolves.toEqual([]);

    const likeResults = await (search as unknown as SmartSearchPrivate).likeSearch('alpha beta', {
      topK: 1,
      typeFilter: 'note',
    });
    expect(likeResults).toEqual([
      expect.objectContaining({
        id: 'like-filtered',
        score: 1,
        metadata: {
          path: 'docs/alpha.md',
          extra: { custom: 'value' },
        },
      }),
    ]);
    expect(dbConnection.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND type = ?'),
      ['%alpha%', '%beta%', 'note']
    );
    expect((search as unknown as SmartSearchPrivate).parseMetadata(null)).toEqual({});
  });
});

describe('SmartSearch additional ripgrep coverage', () => {
  function ripgrepReady(search: SmartSearch): SmartSearchPrivate {
    const privateSearch = search as unknown as SmartSearchPrivate;
    privateSearch.ripgrepChecked = true;
    privateSearch.ripgrepAvailable = true;
    return privateSearch;
  }

  it('covers empty ripgrep queries and parser skip paths before returning valid matches', async () => {
    const search = ripgrepReady(new SmartSearch({ ripgrepPaths: ['src'] }));

    await expect(search.ripgrepSearch('   ')).resolves.toEqual([]);

    mockExecFileOnce({
      stdout: [
        'not-json',
        JSON.stringify({ type: 'summary', data: {} }),
        JSON.stringify({ type: 'match', data: {} }),
        JSON.stringify({
          type: 'match',
          data: {
            path: { text: 'src/invalid.ts' },
            lines: { text: 'alpha invalid\n' },
            line_number: 0,
          },
        }),
        JSON.stringify({
          type: 'match',
          data: {
            path: { text: 'src/story.ts' },
            lines: { text: 'alpha beta line\n' },
            line_number: '12',
            submatches: 'not-an-array',
          },
        }),
        '',
      ].join('\n'),
    });

    const results = await search.ripgrepSearch('alpha beta', { topK: 5, typeFilter: 'scene' });

    expect(results).toEqual([
      expect.objectContaining({
        id: 'ripgrep:src/story.ts:12',
        content: 'alpha beta line',
        type: 'scene',
        score: 1,
        metadata: expect.objectContaining({
          path: 'src/story.ts',
          extra: { submatch_count: 0 },
        }),
      }),
    ]);
  });

  it('marks ripgrep unavailable when the search command disappears and handles other errors', async () => {
    const missingSearch = ripgrepReady(new SmartSearch({ ripgrepPaths: ['src'] }));
    mockExecFileOnce({ error: Object.assign(new Error('spawn rg ENOENT'), { code: 'ENOENT' }) });

    await expect(missingSearch.ripgrepSearch('alpha')).resolves.toEqual([]);
    expect(missingSearch.ripgrepAvailable).toBe(false);
    expect(missingSearch.ripgrepChecked).toBe(true);

    const genericFailure = ripgrepReady(new SmartSearch({ ripgrepPaths: ['src'] }));
    mockExecFileOnce({ error: Object.assign(new Error('rg failed'), { code: 2 }) });

    await expect(genericFailure.ripgrepSearch('alpha')).resolves.toEqual([]);
  });
});

describe('SmartSearch additional fusion coverage', () => {
  it('keeps the highest fuzzy duplicate and fills hybrid loc/snapshot fallbacks', async () => {
    const search = new SmartSearch({ rrfK: 1 });
    vi.spyOn(search as unknown as SmartSearchPrivate, 'fts5Search').mockResolvedValueOnce([
      result({ id: 'dup', score: 0.2, source: 'fts5', mode_used: 'fuzzy' }),
    ]);
    vi.spyOn(search as unknown as SmartSearchPrivate, 'ripgrepSearch').mockResolvedValueOnce([
      result({ id: 'dup', score: 0.9, source: 'ripgrep', mode_used: 'fuzzy' }),
    ]);

    await expect(search.fuzzySearch('alpha')).resolves.toEqual([
      expect.objectContaining({
        id: 'dup',
        score: 0.9,
      }),
    ]);

    const merged = (search as unknown as SmartSearchPrivate).rrfMerge(
      [],
      [
        result({
          id: 'fuzzy-only',
          source: 'fts5',
          mode_used: 'fuzzy',
          loc: undefined,
          metadata: { loc: { kind: 'line', start: 4, end: 4 }, extra: {} },
          snapshot_query: undefined,
        }),
      ]
    );

    expect(merged).toEqual([
      expect.objectContaining({
        id: 'fuzzy-only',
        source: 'hybrid',
        loc: { kind: 'line', start: 4, end: 4 },
        snapshot_query: 'search_result_sample_query',
      }),
    ]);
  });
});

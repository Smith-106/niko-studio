import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

function mockExecFileOnce(options: {
  error?: NodeJS.ErrnoException & { code?: string | number };
  stdout?: string;
  stderr?: string;
}) {
  execFileMock.mockImplementationOnce((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      error: NodeJS.ErrnoException | null,
      stdout: string,
      stderr: string,
    ) => void;
    callback(
      options.error ?? null,
      options.stdout ?? '',
      options.stderr ?? '',
    );
  });
}

describe('SmartSearch ripgrep integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns ripgrep-backed fuzzy matches when filesystem paths are configured', async () => {
    mockExecFileOnce({ stdout: 'ripgrep 14.1.0\n' });
    mockExecFileOnce({
      stdout: [
        JSON.stringify({
          type: 'match',
          data: {
            path: { text: 'src/example.ts' },
            lines: { text: 'const alpha = beta + 1;\n' },
            line_number: 12,
            submatches: [{ match: { text: 'alpha' }, start: 6, end: 11 }],
          },
        }),
        JSON.stringify({ type: 'summary', data: { elapsed_total: { human: '0.001s' } } }),
        '',
      ].join('\n'),
    });

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({
      ripgrepPaths: ['src'],
    });

    const results = await search.fuzzySearch('alpha beta', { topK: 5 });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'ripgrep:src/example.ts:12',
      content: 'const alpha = beta + 1;',
      source: 'ripgrep',
      mode_used: 'fuzzy',
      metadata: {
        path: 'src/example.ts',
        loc: {
          kind: 'line',
          start: 12,
          end: 12,
        },
      },
      loc: {
        kind: 'line',
        start: 12,
        end: 12,
      },
      snapshot_query: 'alpha beta',
    });
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('gracefully skips ripgrep when the binary is unavailable and caches the probe result', async () => {
    const missingBinary = Object.assign(new Error('spawn rg ENOENT'), {
      code: 'ENOENT',
    });
    mockExecFileOnce({ error: missingBinary });

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({
      ripgrepPaths: ['src'],
    });

    await expect(search.fuzzySearch('alpha', { topK: 5 })).resolves.toEqual([]);
    await expect(search.fuzzySearch('beta', { topK: 5 })).resolves.toEqual([]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('treats ripgrep exit code 1 as a clean no-match result', async () => {
    mockExecFileOnce({ stdout: 'ripgrep 14.1.0\n' });
    const noMatchError = Object.assign(new Error('no matches'), { code: 1 });
    mockExecFileOnce({ error: noMatchError });

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({
      ripgrepPaths: ['src'],
    });

    await expect(search.fuzzySearch('missing-token', { topK: 5 })).resolves.toEqual([]);
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
});

describe('SmartSearch core behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('supports semantic fallback, auto mode selection, result rounding, and factory creation', async () => {
    const dbConnection = {
      query: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'fts-1',
            content: 'hero quest fallback',
            metadata: '{"path":"docs/story.md","loc":{"kind":"line","start":8,"end":8},"surface":"story"}',
            type: 'note',
            rank: -0.5,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'shared-1',
            content: 'shared clue from fuzzy',
            metadata: '{"doc_id":"doc-7","chunk_index":2}',
            type: 'chunk',
            rank: -1,
          },
        ]),
      close: vi.fn(),
    };
    const vectorIndex = {
      search: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'semantic-1',
            content: 'semantic answer',
            score: 0.923456,
            type: 'memory',
            metadata: { path: 'memory.md' },
            loc: { kind: 'line', start: 3, end: 3 },
            snapshot_query: 'what happened',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'shared-1',
            content: 'shared clue from semantic',
            score: 0.8,
            type: 'chunk',
            metadata: { doc_id: 'doc-7', chunk_index: 2 },
            loc: { kind: 'char', start: 1, end: 9 },
            snapshot_query: '"shared clue"',
          },
        ]),
      upsert: vi.fn(),
      delete: vi.fn().mockReturnValue(true),
    };

    const { SearchMode, SmartSearch, createSmartSearch } = await import('../../search/smart-search.js');
    const search = createSmartSearch({
      dbConnection,
      vectorIndex,
      ripgrepPaths: [],
      rrfK: 1,
      semanticWeight: 0.6,
      fuzzyWeight: 0.4,
    });

    expect(search).toBeInstanceOf(SmartSearch);

    const semanticFallback = await search.search('hero quest', {
      mode: 'semantic',
      topK: 1,
      minScore: 0.5,
    });
    expect(semanticFallback).toEqual([
      {
        id: 'fts-1',
        content: 'hero quest fallback',
        score: 0.6667,
        type: 'note',
        source: 'fts5',
        mode_used: 'semantic',
        metadata: {
          path: 'docs/story.md',
          doc_id: undefined,
          surface: 'story',
          loc: { kind: 'line', start: 8, end: 8 },
          chunk_index: undefined,
          extra: {},
        },
        loc: { kind: 'line', start: 8, end: 8 },
        snapshot_query: 'search_result_sample_query',
      },
    ]);

    const autoSemantic = await search.search('what happened to the narrator here', {
      mode: SearchMode.AUTO,
      topK: 1,
    });
    expect(autoSemantic).toEqual([
      expect.objectContaining({
        id: 'semantic-1',
        score: 0.9235,
        source: 'semantic',
        mode_used: 'semantic',
      }),
    ]);

    const autoHybrid = await search.search('"shared clue"', {
      mode: SearchMode.AUTO,
      topK: 1,
    });
    expect(autoHybrid).toEqual([
      expect.objectContaining({
        id: 'shared-1',
        source: 'hybrid',
        mode_used: 'hybrid',
        loc: { kind: 'char', start: 1, end: 9 },
      }),
    ]);

    const autoFuzzy = await search.search('artifact', {
      mode: SearchMode.AUTO,
      topK: 1,
      minScore: 0.9,
    });
    expect(autoFuzzy).toEqual([]);
  });

  it('falls back from FTS5 to LIKE search and tolerates invalid metadata', async () => {
    const dbConnection = {
      query: vi
        .fn()
        .mockRejectedValueOnce(new Error('fts unavailable'))
        .mockRejectedValueOnce(new Error('vector_items missing'))
        .mockResolvedValueOnce([
          {
            id: 'item-1',
            content: 'Alpha beta gamma',
            metadata: 'not-json',
            type: 'note',
          },
        ]),
      close: vi.fn(),
    };

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({ dbConnection, ripgrepPaths: [] });

    const results = await search.fuzzySearch('Alpha beta', { topK: 2 });

    expect(results).toEqual([
      {
        id: 'item-1',
        content: 'Alpha beta gamma',
        score: 1,
        type: 'note',
        metadata: {
          path: undefined,
          doc_id: undefined,
          surface: undefined,
          loc: undefined,
          chunk_index: undefined,
          extra: {},
        },
        source: 'like',
        mode_used: 'fuzzy',
        loc: undefined,
        snapshot_query: 'search_result_sample_query',
      },
    ]);
    expect(dbConnection.query).toHaveBeenCalledTimes(3);
  });

  it('indexes and deletes through the vector index while guarding missing configuration', async () => {
    const vectorIndex = {
      search: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn().mockReturnValue(true),
    };

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({ vectorIndex });
    const unconfigured = new SmartSearch();

    await search.index('doc-1', 'Body', {
      metadata: { chapter: 3 },
      type: 'scene',
    });
    expect(vectorIndex.upsert).toHaveBeenCalledWith('doc-1', 'Body', { chapter: 3 }, 'scene');
    await expect(search.delete('doc-1')).resolves.toBe(true);
    await expect(unconfigured.index('doc-2', 'Missing')).rejects.toThrow(
      'No vector index available for indexing',
    );
    await expect(unconfigured.delete('doc-2')).rejects.toThrow(
      'No vector index available for deletion',
    );
  });

  it('returns empty arrays when semantic or hybrid search branches fail internally', async () => {
    const vectorIndex = {
      search: vi.fn().mockRejectedValueOnce(new Error('embedding offline')),
      upsert: vi.fn(),
      delete: vi.fn(),
    };

    const { SmartSearch } = await import('../../search/smart-search.js');
    const search = new SmartSearch({ vectorIndex, ripgrepPaths: [] });

    await expect(search.semanticSearch('alpha')).resolves.toEqual([]);

    const fuzzySpy = vi.spyOn(search, 'fuzzySearch').mockRejectedValueOnce(new Error('fuzzy failed'));
    const semanticSpy = vi
      .spyOn(search, 'semanticSearch')
      .mockRejectedValueOnce(new Error('semantic failed'));

    await expect(search.hybridSearch('alpha beta')).resolves.toEqual([]);

    fuzzySpy.mockRestore();
    semanticSpy.mockRestore();
  });
});

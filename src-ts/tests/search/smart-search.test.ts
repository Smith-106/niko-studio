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

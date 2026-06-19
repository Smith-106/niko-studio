import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

import { SmartSearch, type SmartSearchResult } from '../../search/smart-search';

type SmartSearchPrivate = SmartSearch & {
  ripgrepAvailable: boolean;
  ripgrepChecked: boolean;
  ripgrepSearch(
    query: string,
    options?: { topK?: number; typeFilter?: string },
  ): Promise<SmartSearchResult[]>;
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
      stderr: string,
    ) => void;
    callback(options.error ?? null, options.stdout ?? '', options.stderr ?? '');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SmartSearch branch-gap coverage', () => {
  it('returns an empty list for ripgrep failures without an error code', async () => {
    const search = new SmartSearch({
      ripgrepPaths: ['src'],
    }) as SmartSearchPrivate;
    search.ripgrepChecked = true;
    search.ripgrepAvailable = true;

    mockExecFileOnce({
      error: new Error('rg failed') as NodeJS.ErrnoException,
    });

    await expect(search.ripgrepSearch('alpha')).resolves.toEqual([]);
    expect(search.ripgrepAvailable).toBe(true);
    expect(search.ripgrepChecked).toBe(true);
  });
});

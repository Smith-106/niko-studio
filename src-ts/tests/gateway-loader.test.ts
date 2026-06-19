import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock ts-node/esm.mjs before importing the loader
vi.mock('ts-node/esm.mjs', () => ({
  resolve: vi.fn(async (specifier, _context, nextResolve) => {
    if (nextResolve) {
      return nextResolve(specifier);
    }
    return { url: specifier, format: 'module' };
  }),
  load: vi.fn(async (url, _context, nextLoad) => {
    if (nextLoad) {
      return nextLoad(url);
    }
    return { source: '', format: 'module' };
  }),
  getFormat: vi.fn(() => 'module'),
  transformSource: vi.fn((source) => source),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => path.endsWith('.ts') || path.endsWith('.js')),
  statSync: vi.fn((path: string) => {
    if (path.includes('directory')) {
      return { isDirectory: () => true };
    }
    throw new Error('not a directory');
  }),
}));

// Mock node:path
vi.mock('node:path', () => ({
  dirname: vi.fn(() => '/mock/parent/dir'),
  relative: vi.fn((_from: string, to: string) => to.replace('/mock/parent/dir/', '')),
}));

// Mock node:url
vi.mock('node:url', () => ({
  fileURLToPath: vi.fn((url: unknown) => {
    const urlStr = typeof url === 'string' ? url : String(url);
    if (urlStr.startsWith('file:')) {
      return urlStr.replace('file://', '');
    }
    return urlStr;
  }),
}));

describe('gateway-loader.mjs', () => {
  it('exports resolve, load, getFormat, and transformSource', async () => {
    const { resolve, load, getFormat, transformSource } = await import('../../src-ts/gateway-loader.mjs');

    expect(typeof resolve).toBe('function');
    expect(typeof load).toBe('function');
    expect(typeof getFormat).toBe('function');
    expect(typeof transformSource).toBe('function');
  });

  it('resolve delegates to ts-node.resolve for normal specifiers', async () => {
    const { resolve } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    const result = await resolve('./test-module', { parentURL: 'file:///mock/parent/dir/index.ts' }, vi.fn());

    expect(tsNode.resolve).toHaveBeenCalled();
  });

  it('resolve falls back to tryExtensionless when ts-node.resolve throws', async () => {
    const { resolve } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    // Make ts-node.resolve throw
    vi.mocked(tsNode.resolve).mockRejectedValueOnce(new Error('Cannot resolve'));

    const result = await resolve('./test-module', { parentURL: 'file:///mock/parent/dir/index.ts' }, vi.fn());

    // Should have called ts-node.resolve again with the candidate path
    expect(tsNode.resolve).toHaveBeenCalledTimes(2);
  });

  it('resolve falls back to directory index candidates', async () => {
    const { resolve } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');
    const { existsSync, statSync } = await import('node:fs');

    vi.mocked(tsNode.resolve).mockRejectedValueOnce(new Error('Cannot resolve'));
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(existsSync).mockImplementation(
      (path: string) => path.endsWith('/index.ts') || path.endsWith('/index.js'),
    );

    const result = await resolve('./mydir', { parentURL: 'file:///mock/parent/dir/index.ts' }, vi.fn());

    expect(tsNode.resolve).toHaveBeenCalledTimes(2);
    expect(tsNode.resolve).toHaveBeenLastCalledWith(
      './mydir/index.ts',
      { parentURL: 'file:///mock/parent/dir/index.ts' },
      expect.any(Function),
    );
  });

  it('resolve rethrows when no extensionless candidate is found', async () => {
    const { resolve } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');
    const { existsSync } = await import('node:fs');

    vi.mocked(tsNode.resolve).mockRejectedValueOnce(new Error('original error'));
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(resolve('./missing', { parentURL: 'file:///mock/parent/dir/index.ts' }, vi.fn())).rejects.toThrow('original error');
  });

  it('resolve rethrows for non-relative specifiers that have no fallback', async () => {
    const { resolve } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    vi.mocked(tsNode.resolve).mockRejectedValueOnce(new Error('package error'));

    await expect(resolve('some-package', { parentURL: 'file:///mock/parent/dir/index.ts' }, vi.fn())).rejects.toThrow('package error');
  });

  it('load delegates to ts-node.load', async () => {
    const { load } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    const result = await load('file:///mock/test.ts', { format: 'module' }, vi.fn());

    expect(tsNode.load).toHaveBeenCalledWith('file:///mock/test.ts', { format: 'module' }, expect.any(Function));
  });

  it('getFormat returns ts-node.getFormat result', async () => {
    const { getFormat } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    const result = getFormat();

    expect(result).toBe('module');
    expect(tsNode.getFormat).toHaveBeenCalled();
  });

  it('transformSource returns ts-node.transformSource result', async () => {
    const { transformSource } = await import('../../src-ts/gateway-loader.mjs');
    const tsNode = await import('ts-node/esm.mjs');

    const source = 'const x = 1;';
    const result = transformSource(source);

    expect(result).toBe(source);
    expect(tsNode.transformSource).toHaveBeenCalledWith(source);
  });
});

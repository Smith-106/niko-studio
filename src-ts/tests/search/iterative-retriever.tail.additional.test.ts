import { afterEach, describe, expect, it, vi } from 'vitest';

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('search/iterative-retriever tail additional coverage', () => {
  it('covers elastic success, metadata fallback, file read failures, and empty chapter references', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-tail-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });
    const brokenFile = join(tempRoot, 'broken.txt');
    const goodFile = join(tempRoot, 'good.txt');
    writeFileSync(brokenFile, 'alpha hidden in broken file', 'utf8');
    writeFileSync(goodFile, 'alpha visible in working file', 'utf8');

    try {
      const actualFsPromises = await vi.importActual<typeof import('node:fs/promises')>(
        'node:fs/promises',
      );
      vi.doMock('node:fs/promises', () => ({
        ...actualFsPromises,
        readFile: vi.fn(
          async (
            path: Parameters<typeof actualFsPromises.readFile>[0],
            encoding?: Parameters<typeof actualFsPromises.readFile>[1],
          ) => {
            if (String(path) === brokenFile) {
              throw new Error('broken read');
            }
            return actualFsPromises.readFile(path, encoding as never);
          },
        ),
      }));

      const { IterativeRetriever } = await import('../../search/iterative-retriever.js');
      type PrivateRetriever = InstanceType<typeof IterativeRetriever> & Record<string, (...args: any[]) => any>;

      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: {
          search: vi.fn().mockResolvedValue([]),
        },
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(),
          getForeshadows: vi.fn(),
        },
        elasticsearchEnabled: true,
        elasticAdapter: {
          search: vi.fn().mockResolvedValue([
            {
              id: 'elastic-1',
              content: 'elastic branch hit',
              score: 0.88,
              metadata: ['unexpected-array'],
            },
            {
              id: 'elastic-2',
              content: 'elastic object metadata',
              score: 0.91,
              metadata: { lane: 'elastic-object' },
            },
          ]),
        },
      });

      const elasticResults = await retriever.hybridSearch(
        'elastic success',
        'all',
        5,
        undefined,
        undefined,
        undefined,
        false,
        'elastic',
        50,
      );
      expect(elasticResults).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'elastic-1',
            source: 'elastic',
            metadata: {},
          }),
          expect.objectContaining({
            id: 'elastic-2',
            source: 'elastic',
            metadata: { lane: 'elastic-object' },
          }),
        ]),
      );

      const privateRetriever = retriever as unknown as PrivateRetriever;
      const fileResults = await privateRetriever.searchFiles('alpha', 10);
      expect(fileResults).toEqual([
        expect.objectContaining({
          id: 'good.txt',
          source: 'file',
        }),
      ]);

      expect(await privateRetriever.resolveReference('chapter', '404')).toBeNull();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { IterativeRetriever } from '../../search/iterative-retriever.js';

type PrivateRetriever = IterativeRetriever & Record<string, (...args: any[]) => any>;

describe('search/iterative-retriever more additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when no foreshadow matches the requested reference', async () => {
    const retriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([]),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn(),
        getForeshadows: vi.fn().mockResolvedValue([
          { name: 'Bell Omen', properties: { status: 'pending' } },
        ]),
      },
    });

    const privateRetriever = retriever as unknown as PrivateRetriever;

    await expect(privateRetriever.resolveReference('foreshadow', 'missing')).resolves.toBeNull();
  });

  it('returns a trimmed snippet from the beginning when the earliest keyword is at the file head', async () => {
    const tempRoot = join(tmpdir(), `niko-iterative-more-${randomUUID()}`);
    mkdirSync(tempRoot, { recursive: true });
    writeFileSync(
      join(tempRoot, 'opening.md'),
      `needle ${'x'.repeat(260)}`,
      'utf8',
    );

    try {
      const retriever = new IterativeRetriever({
        projectRoot: tempRoot,
        memoryEngine: { search: vi.fn().mockResolvedValue([]) },
        graphEngine: {
          searchEntitiesByName: vi.fn().mockResolvedValue([]),
          getCharacter: vi.fn(),
          getForeshadows: vi.fn(),
        },
      });

      const privateRetriever = retriever as unknown as PrivateRetriever;
      const results = await privateRetriever.searchFiles('needle', 5);

      expect(results).toEqual([
        expect.objectContaining({
          id: 'opening.md',
          metadata: expect.objectContaining({
            extension: '.md',
            matchCount: 1,
          }),
        }),
      ]);
      expect(results[0]?.content.startsWith('needle')).toBe(true);
      expect(results[0]?.content.startsWith('...')).toBe(false);
      expect(results[0]?.content.endsWith('...')).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns null for unresolved character, scene, memory, and timeline references', async () => {
    const retriever = new IterativeRetriever({
      memoryEngine: {
        search: vi.fn().mockResolvedValue([]),
      },
      graphEngine: {
        searchEntitiesByName: vi.fn().mockResolvedValue([]),
        getCharacter: vi.fn().mockResolvedValue({ error: 'missing' }),
        getForeshadows: vi.fn().mockResolvedValue([]),
      },
    });

    const privateRetriever = retriever as unknown as PrivateRetriever;

    await expect(privateRetriever.resolveReference('character', 'missing')).resolves.toBeNull();
    await expect(privateRetriever.resolveReference('scene', 'missing')).resolves.toBeNull();
    await expect(privateRetriever.resolveReference('memory', 'missing')).resolves.toBeNull();
    await expect(privateRetriever.resolveReference('timeline', 'missing')).resolves.toBeNull();
    await expect(privateRetriever.resolveReference('foreshadow', 'missing')).resolves.toBeNull();
  });
});

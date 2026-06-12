import { describe, expect, it, vi } from 'vitest';

import { WikiCompatLayer } from '../../services/wiki-compat-layer.js';

describe('services/wiki-compat-layer additional coverage', () => {
  it('tolerates an online bridge without optional wiki api methods', async () => {
    const layer = new WikiCompatLayer({
      isOnline: () => true,
    } as never);

    await expect(layer.listPages('atlas')).resolves.toEqual([]);
    await expect(layer.getPage('atlas')).resolves.toBeNull();
    await expect(layer.promotePage('Atlas', 'content')).resolves.toBe('');
  });

  it('tolerates an api object that omits list, get, and promote methods', async () => {
    const layer = new WikiCompatLayer({
      isOnline: () => true,
      api: {},
    } as never);

    await expect(layer.listPages('atlas')).resolves.toEqual([]);
    await expect(layer.getPage('atlas')).resolves.toBeNull();
    await expect(layer.promotePage('Atlas', 'content')).resolves.toBe('');
  });

  it('applies field fallbacks and default values when crystals are partially populated', async () => {
    const api = {
      listCrystals: vi.fn(async () => [
        {
          slug: 'atlas-page',
          title: 'Atlas',
        },
      ]),
      getCrystal: vi.fn(async () => ({
        id: 'crystal-2',
        name: 'Fallback title',
      })),
    };
    const layer = new WikiCompatLayer({
      isOnline: () => true,
      api,
    } as never);

    await expect(layer.listPages()).resolves.toEqual([
      expect.objectContaining({
        slug: 'atlas-page',
        title: 'Atlas',
        content: '',
        tags: [],
        sources: [],
      }),
    ]);

    await expect(layer.getPage('crystal-2')).resolves.toEqual(
      expect.objectContaining({
        slug: 'crystal-2',
        title: 'Fallback title',
        content: '',
        tags: [],
        sources: [],
      }),
    );
  });

  it('falls back to id and name when list pages omit slug and title', async () => {
    const api = {
      listCrystals: vi.fn(async () => [
        {
          id: 'fallback-id',
          name: 'Fallback title',
        },
      ]),
    };
    const layer = new WikiCompatLayer({
      isOnline: () => true,
      api,
    } as never);

    await expect(layer.listPages()).resolves.toEqual([
      expect.objectContaining({
        slug: 'fallback-id',
        title: 'Fallback title',
        content: '',
        tags: [],
        sources: [],
      }),
    ]);
  });

  it('forwards query and promotion payloads when optional methods return undefined', async () => {
    const api = {
      listCrystals: vi.fn(async (_input: { query?: string }) => undefined),
      getCrystal: vi.fn(async (_slug: string) => undefined),
      addMemory: vi.fn(async (_payload: Record<string, unknown>) => undefined),
    };
    const layer = new WikiCompatLayer({
      isOnline: () => true,
      api,
    } as never);

    await expect(layer.listPages('hero')).resolves.toEqual([]);
    expect(api.listCrystals).toHaveBeenCalledWith({ query: 'hero' });

    await expect(layer.getPage('hero')).resolves.toBeNull();
    expect(api.getCrystal).toHaveBeenCalledWith('hero');

    await expect(layer.promotePage('Atlas', 'content')).resolves.toBe('');
    expect(api.addMemory).toHaveBeenCalledWith({
      content: 'content',
      labels: [],
      importance: 0.7,
    });
  });
});

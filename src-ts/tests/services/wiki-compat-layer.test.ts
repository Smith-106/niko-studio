import { describe, expect, it } from 'vitest';

import { WikiCompatLayer } from '../../services/wiki-compat-layer.js';

describe('services/wiki-compat-layer', () => {
  it('returns empty or null when the bridge is offline', async () => {
    const bridge = {
      isOnline: () => false,
    };
    const layer = new WikiCompatLayer(bridge as never);

    await expect(layer.listPages('hero')).resolves.toEqual([]);
    await expect(layer.getPage('hero')).resolves.toBeNull();
    await expect(layer.promotePage('Atlas', 'content')).rejects.toThrow('Knowledge layer offline');
  });

  it('maps crystal data and promotion requests through the bridge api', async () => {
    const api = {
      listCrystals: async () => [
        {
          id: 'crystal-1',
          name: 'Atlas',
          content: 'world state',
          tags: ['world'],
          sources: ['doc-1'],
        },
      ],
      getCrystal: async () => ({
        slug: 'atlas-page',
        title: 'Atlas',
        content: 'detail',
        tags: ['canon'],
        sources: ['doc-2'],
      }),
      addMemory: async () => 'mem-9',
    };
    const bridge = {
      isOnline: () => true,
      api,
    };
    const layer = new WikiCompatLayer(bridge as never);

    const listed = await layer.listPages('atlas');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      slug: 'crystal-1',
      title: 'Atlas',
      content: 'world state',
      tags: ['world'],
      sources: ['doc-1'],
    });
    expect(typeof listed[0].updatedAt).toBe('number');

    const page = await layer.getPage('atlas-page');
    expect(page).toMatchObject({
      slug: 'atlas-page',
      title: 'Atlas',
      content: 'detail',
      tags: ['canon'],
      sources: ['doc-2'],
    });

    await expect(layer.promotePage('Atlas', 'content', ['world'])).resolves.toBe('mem-9');
  });
});

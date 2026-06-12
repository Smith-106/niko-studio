import { describe, expect, it } from 'vitest';

import {
  BaseMemoryLayer,
  EphemeralLayer,
  LayerConfig,
  LayerManager,
  LayerType,
} from '../../memory/memory-layers';

class InspectableMemoryLayer extends BaseMemoryLayer {
  async evictOldestNow(): Promise<void> {
    await this._evictOldest();
  }
}

describe('memory/memory-layers branch-gap coverage', () => {
  it('returns early when evicting from an empty layer', async () => {
    const layer = new InspectableMemoryLayer(
      new LayerConfig({ layerType: LayerType.USER }),
    );

    await layer.evictOldestNow();

    const stats = await layer.stats();
    expect(stats.totalEntries).toBe(0);
  });

  it('uses the one-hour fallback when ephemeral config has no default ttl', async () => {
    const layer = new EphemeralLayer(
      new LayerConfig({
        layerType: LayerType.EPHEMERAL,
        defaultTtlSeconds: null,
      }),
    );

    const before = Date.now();
    const entry = await layer.store('ephemeral-fallback', 'content');
    const expiresAt = entry.expiresAt?.getTime() ?? 0;

    expect(entry.expiresAt).not.toBeNull();
    expect(expiresAt - before).toBeGreaterThanOrEqual(3599_000);
    expect(expiresAt - before).toBeLessThanOrEqual(3601_000);
  });

  it('throws on store for an unknown layer type', async () => {
    const manager = new LayerManager();

    await expect(
      manager.store('bogus' as LayerType, 'id', 'content'),
    ).rejects.toThrow('Unknown layer type: bogus');
  });

  it('returns null when retrieving through an unknown explicit layer or across all layers without a match', async () => {
    const manager = new LayerManager();

    await expect(manager.retrieve('missing', 'bogus' as LayerType)).resolves.toBeNull();
    await expect(manager.retrieve('missing')).resolves.toBeNull();
  });

  it('retrieves from an explicitly selected valid layer', async () => {
    const manager = new LayerManager();
    await manager.store(LayerType.USER, 'explicit-hit', 'content');

    await expect(manager.retrieve('explicit-hit', LayerType.USER)).resolves.toMatchObject({
      id: 'explicit-hit',
      content: 'content',
    });
  });
});

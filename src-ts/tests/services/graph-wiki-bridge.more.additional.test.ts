import { describe, expect, it, vi } from 'vitest';

import { GraphWikiLinkBridgeImpl } from '../../services/graph-wiki-bridge.js';

class EventBusStub {
  publish = vi.fn();
  subscribe = vi.fn();
}

class ObsidianStub {
  files = ['broken.md', 'healthy.md'];
  readNote = vi.fn(async () => '');
  search = vi.fn(() => []);
  getFiles = vi.fn(() => this.files);
}

class GraphEngineStub {
  getNode = vi.fn(async () => null);
  traverse = vi.fn(async () => []);
}

describe('services/graph-wiki-bridge more additional coverage', () => {
  it('swallows per-file orphan scan failures and continues with the remaining files', async () => {
    const bridge = new GraphWikiLinkBridgeImpl({
      graphEngine: new GraphEngineStub() as never,
      obsidianService: new ObsidianStub() as never,
      eventBus: new EventBusStub() as never,
      vaultPath: '/vault',
    });

    vi.spyOn(bridge, 'resolveWikiLinks')
      .mockRejectedValueOnce(new Error('broken file'))
      .mockResolvedValueOnce([]);

    await expect(bridge.detectOrphanedLinks()).resolves.toEqual([]);
    expect(bridge.resolveWikiLinks).toHaveBeenCalledTimes(2);
  });
});

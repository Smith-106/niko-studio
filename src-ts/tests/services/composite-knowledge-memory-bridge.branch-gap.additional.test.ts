import { describe, expect, it, vi } from 'vitest';

import { CompositeKnowledgeMemoryBridge } from '../../services/composite-knowledge-memory-bridge';
import type { KnowledgeMemoryEngineAdapter } from '../../protocols/knowledge';

describe('CompositeKnowledgeMemoryBridge branch-gap coverage', () => {
  it('falls back when optional primary methods are absent', async () => {
    const primary: KnowledgeMemoryEngineAdapter = {
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    const bridge = new CompositeKnowledgeMemoryBridge(primary);

    await expect(bridge.add({ content: 'atlas note' })).resolves.toEqual({});
    await expect(bridge.addToLibrary(['C:/tmp/atlas.md'])).resolves.toEqual([]);
    await expect(bridge.searchLibrary('atlas', { limit: 3 })).resolves.toEqual([]);
  });
});

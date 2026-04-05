import { describe, expect, it, vi } from 'vitest';

import { SearchEngineAdapter } from '../../container/adapters';

describe('SearchEngineAdapter', () => {
  it('returns indexed documents through the generic search-engine contract', async () => {
    const retriever = {
      hybridSearch: vi.fn().mockResolvedValue([]),
    };
    const adapter = new SearchEngineAdapter(retriever);

    await adapter.index({
      id: 'doc-1',
      content: 'Architectural planning notes for chapter one',
      metadata: { type: 'plan' },
    });

    const results = await adapter.search('planning chapter', {
      limit: 5,
      filters: { type: 'plan' },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('doc-1');
    expect(results[0]?.content).toContain('Architectural planning');
  });

  it('falls back to retriever results when no indexed document matches', async () => {
    const retriever = {
      hybridSearch: vi.fn().mockResolvedValue([
        {
          id: 'memory-1',
          content: 'Retrieved memory-backed context',
          score: 0.82,
          metadata: { layer: 'memory' },
        },
      ]),
    };
    const adapter = new SearchEngineAdapter(retriever);

    const results = await adapter.search('memory-backed query', { limit: 3, threshold: 0.5 });

    expect(retriever.hybridSearch).toHaveBeenCalledWith(
      'memory-backed query',
      'all',
      3,
      undefined,
      0.5,
      undefined,
      false,
      'hybrid',
      300,
    );
    expect(results).toEqual([
      {
        id: 'memory-1',
        content: 'Retrieved memory-backed context',
        score: 0.82,
        metadata: { layer: 'memory' },
      },
    ]);
  });

  it('clears indexed documents', async () => {
    const adapter = new SearchEngineAdapter({
      hybridSearch: vi.fn().mockResolvedValue([]),
    });

    await adapter.index({ id: 'doc-1', content: 'Temporary content' });
    await adapter.clear();

    const results = await adapter.search('Temporary', { limit: 5 });
    expect(results).toEqual([]);
  });
});

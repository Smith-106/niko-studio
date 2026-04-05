import { afterEach, describe, expect, it } from 'vitest';

import { getContainer, resetContainer } from '../../container/ServiceContainer';
import { getSearchEngine } from '../../mcp/engine';

describe('Search engine integration', () => {
  afterEach(() => {
    resetContainer();
  });

  it('uses the generic search engine through the service container', async () => {
    const container = getContainer();

    await container.search.index({
      id: 'search-doc-1',
      content: 'Coordinator planning notes for retrieval routing',
      metadata: { type: 'plan' },
    });

    const results = await container.search.search('planning retrieval', {
      limit: 5,
      filters: { type: 'plan' },
    });

    expect(results.some((result) => result.id === 'search-doc-1')).toBe(true);
    expect(results.find((result) => result.id === 'search-doc-1')?.content).toContain(
      'Coordinator planning notes',
    );
  });

  it('returns the same working search engine through MCP engine accessor', async () => {
    const engine = getSearchEngine();

    await engine.index({
      id: 'search-doc-2',
      content: 'MCP engine search bridge test content',
      metadata: { type: 'memory' },
    });

    const results = await engine.search('bridge test', { limit: 3 });

    expect(results.some(result => result.id === 'search-doc-2')).toBe(true);
  });
});

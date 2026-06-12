import { afterEach, describe, expect, it, vi } from 'vitest';

import { NowledgeMemHTTPClient } from '../../services/nowledge-mem-http-client.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('services/nowledge-mem-http-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('checks health against the server root and tracks success and failure state', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new NowledgeMemHTTPClient({ host: '10.0.0.8', port: 3210 });

    await expect(client.checkHealth()).resolves.toBe(true);
    expect(client.isHealthy).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.8:3210/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await expect(client.checkHealth()).resolves.toBe(false);
    expect(client.isHealthy).toBe(false);
  });

  it('posts addMemory payloads with default JSON headers', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ id: 'mem-1', content: 'atlas', labels: ['hero'], importance: 0.8 }),
    ));
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient({ host: '127.0.0.2', port: 2112 });
    const result = await client.addMemory('atlas', { labels: ['hero'], importance: 0.8 });

    expect(result).toMatchObject({ id: 'mem-1', content: 'atlas' });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.2:2112/api/v1/memories',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'atlas', labels: ['hero'], importance: 0.8 }),
        headers: { 'Content-Type': 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('retries transient server failures before succeeding', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('temporary failure', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'mem-2', content: 'retry ok' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient({ retryCount: 1, retryDelay: 25 });
    const request = client.addMemory('retry ok');

    await vi.runAllTimersAsync();

    await expect(request).resolves.toMatchObject({ id: 'mem-2', content: 'retry ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries rejected requests through the catch path before succeeding', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('socket reset'))
      .mockResolvedValueOnce(jsonResponse({ id: 'mem-3', content: 'network retry ok' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient({ retryCount: 1, retryDelay: 25 });
    const request = client.addMemory('network retry ok');

    await vi.runAllTimersAsync();

    await expect(request).resolves.toMatchObject({
      id: 'mem-3',
      content: 'network retry ok',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.isHealthy).toBe(true);
  });

  it('marks the client unhealthy when the final request attempt fails', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('missing', { status: 404 })));
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient({ retryCount: 0 });
    await Promise.resolve();
    expect(client.isHealthy).toBe(true);

    await expect(client.getMemory('missing-id')).rejects.toThrow('Nowledge Mem API 404: missing');
    expect(client.isHealthy).toBe(false);
  });

  it('routes the remaining endpoint helpers to their expected paths', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = String(input);

      if (url.endsWith('/memories/search')) {
        return Promise.resolve(jsonResponse({ memories: [{ id: 'm1', content: 'hero' }], total: 1, query: 'hero' }));
      }
      if (url.endsWith('/memories/m1')) {
        return Promise.resolve(jsonResponse({}, { status: 200 }));
      }
      if (url.endsWith('/crystals')) {
        return Promise.resolve(jsonResponse([{ slug: 'atlas', title: 'Atlas', tags: ['hero'] }]));
      }
      if (url.endsWith('/crystals/atlas')) {
        return Promise.resolve(jsonResponse({ slug: 'atlas', title: 'Atlas', content: 'body', tags: [], sources: [] }));
      }
      if (url.endsWith('/entities')) {
        return Promise.resolve(jsonResponse([{ id: 'e1', entity_type: 'character', name: 'Alice', description: 'Lead', aliases: ['Al'] }]));
      }
      if (url.endsWith('/graph/search')) {
        return Promise.resolve(jsonResponse([{ id: 'g1', name: 'Alice', score: 0.9, path: ['start'] }]));
      }
      if (url.endsWith('/memories/temporal')) {
        return Promise.resolve(jsonResponse([{ id: 't1', content: 'event', event_time: '2026-01-01', recorded_at: '2026-01-02' }]));
      }
      if (url.endsWith('/intelligence/contradictions')) {
        return Promise.resolve(jsonResponse([{ memory_a: 'a', memory_b: 'b', description: 'conflict' }]));
      }
      if (url.endsWith('/entities/e1/evolutions')) {
        return Promise.resolve(jsonResponse([{ memory_id: 'm1', evolves_kind: 'Enriches', strength: 0.8 }]));
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient();

    await expect(client.searchMemories('hero', { limit: 2 })).resolves.toMatchObject({
      total: 1,
      memories: [{ id: 'm1', content: 'hero' }],
    });
    await expect(client.deleteMemory('m1')).resolves.toBe(true);
    await expect(client.listCrystals({ query: 'atlas' })).resolves.toEqual([
      { slug: 'atlas', title: 'Atlas', tags: ['hero'] },
    ]);
    await expect(client.getCrystal('atlas')).resolves.toMatchObject({ slug: 'atlas', title: 'Atlas' });
    await expect(client.getEntities({ type: 'character' })).resolves.toEqual([
      { id: 'e1', entity_type: 'character', name: 'Alice', description: 'Lead', aliases: ['Al'] },
    ]);
    await expect(client.graphSearch('alice', { depth: 2 })).resolves.toEqual([
      { id: 'g1', name: 'Alice', score: 0.9, path: ['start'] },
    ]);
    await expect(client.temporalQuery({ fuzzy: true })).resolves.toEqual([
      { id: 't1', content: 'event', event_time: '2026-01-01', recorded_at: '2026-01-02' },
    ]);
    await expect(client.getContradictions()).resolves.toEqual([
      { memory_a: 'a', memory_b: 'b', description: 'conflict' },
    ]);
    await expect(client.getEvolutionChains('e1')).resolves.toEqual([
      { memory_id: 'm1', evolves_kind: 'Enriches', strength: 0.8 },
    ]);

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls).toEqual(expect.arrayContaining([
      'http://127.0.0.1:19828/api/v1/memories/search',
      'http://127.0.0.1:19828/api/v1/memories/m1',
      'http://127.0.0.1:19828/api/v1/crystals',
      'http://127.0.0.1:19828/api/v1/crystals/atlas',
      'http://127.0.0.1:19828/api/v1/entities',
      'http://127.0.0.1:19828/api/v1/graph/search',
      'http://127.0.0.1:19828/api/v1/memories/temporal',
      'http://127.0.0.1:19828/api/v1/intelligence/contradictions',
      'http://127.0.0.1:19828/api/v1/entities/e1/evolutions',
    ]));
  });
});

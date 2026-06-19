import { afterEach, describe, expect, it, vi } from 'vitest';

import { NowledgeMemHTTPClient } from '../../services/nowledge-mem-http-client.js';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('services/nowledge-mem-http-client additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('posts empty payload objects when crystal and entity options are omitted', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ slug: 'atlas', title: 'Atlas', tags: [] }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 'e1', entity_type: 'character', name: 'Alice', description: 'Lead', aliases: [] }]));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient();

    await expect(client.listCrystals()).resolves.toEqual([
      { slug: 'atlas', title: 'Atlas', tags: [] },
    ]);
    await expect(client.getEntities()).resolves.toEqual([
      { id: 'e1', entity_type: 'character', name: 'Alice', description: 'Lead', aliases: [] },
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:19828/api/v1/crystals',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:19828/api/v1/entities',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
      }),
    );
  });

  it('throws the terminal unreachable error when retryCount is negative', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(NowledgeMemHTTPClient.prototype, 'checkHealth').mockResolvedValue(true);

    const client = new NowledgeMemHTTPClient({ retryCount: -1 });

    await Promise.resolve();

    await expect(client.getContradictions()).rejects.toThrow('unreachable');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

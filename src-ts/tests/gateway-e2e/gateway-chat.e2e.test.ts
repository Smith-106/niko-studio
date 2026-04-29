import { afterEach, describe, expect, it } from 'vitest';

import { startE2EServer, stopAllServers, fetchJSON } from './helpers';

describe('E2E: POST /chat validation', () => {
  let baseUrl: string;

  afterEach(async () => {
    await stopAllServers();
  });

  it('rejects request with missing body', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/chat`,
      { method: 'POST', body: '' },
    );

    expect(status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('rejects request with non-array messages', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({ messages: 'not an array' }),
      },
    );

    expect(status).toBe(400);
    expect((data.error as string).toLowerCase()).toContain('messages');
  });

  it('rejects request with invalid message role', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'invalid', content: 'hello' }],
        }),
      },
    );

    expect(status).toBe(400);
    expect((data.error as string).toLowerCase()).toContain('role');
  });

  it('rejects request with missing content', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user' }],
        }),
      },
    );

    expect(status).toBe(400);
    expect((data.error as string).toLowerCase()).toContain('content');
  });
});

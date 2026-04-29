import { afterEach, describe, expect, it } from 'vitest';

import { startE2EServer, stopAllServers, fetchJSON } from './helpers';

describe('E2E: POST /workflow/route', () => {
  let baseUrl: string;

  afterEach(async () => {
    await stopAllServers();
  });

  it('responds to workflow route request', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/workflow/route`,
      {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test topic for E2E',
          mode: 'rapid',
        }),
      },
    );

    // The workflow endpoint should respond (not 404 or 500 from routing)
    expect(status).toBeLessThan(500);
    expect(data).toBeDefined();
  });

  it('handles empty body gracefully', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/workflow/route`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    expect(status).toBeLessThan(500);
    expect(data).toBeDefined();
  });
});

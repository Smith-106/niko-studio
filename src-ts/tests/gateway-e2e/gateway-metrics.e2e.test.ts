import { afterEach, describe, expect, it } from 'vitest';

import { startE2EServer, stopAllServers, fetchJSON } from './helpers';

describe('E2E: GET /metrics', () => {
  let baseUrl: string;

  afterEach(async () => {
    await stopAllServers();
  });

  it('returns metrics data or disabled status', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/metrics`,
    );

    // Metrics are either ok (200) or disabled (404)
    expect([200, 404]).toContain(status);
    expect(data).toHaveProperty('status');
  });

  it('returns valid response shape when metrics are enabled', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/metrics`,
    );

    if (status === 200) {
      expect(data.status).toBe('ok');
      expect(data).toHaveProperty('metrics');
    } else {
      expect(data.status).toBe('disabled');
    }
  });
});

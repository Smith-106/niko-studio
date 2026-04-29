import { afterEach, describe, expect, it } from 'vitest';

import { startE2EServer, stopAllServers, fetchJSON } from './helpers';

describe('E2E: GET /tools', () => {
  let baseUrl: string;

  afterEach(async () => {
    await stopAllServers();
  });

  it('returns tool listing grouped by category', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, string[]>>(
      `${baseUrl}/tools`,
    );

    expect(status).toBe(200);
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('graph');
    expect(data).toHaveProperty('search');
    expect(data).toHaveProperty('workflow');
    expect(data).toHaveProperty('critic');
    expect(data).toHaveProperty('agent');
    expect(data).toHaveProperty('skills');
    expect(data).toHaveProperty('writing_helper');
  });

  it('lists expected memory tools', async () => {
    baseUrl = await startE2EServer();

    const { data } = await fetchJSON<Record<string, string[]>>(
      `${baseUrl}/tools`,
    );

    expect(data.memory).toContain('memory_add');
    expect(data.memory).toContain('memory_search');
  });

  it('lists expected workflow tools including checkpoints', async () => {
    baseUrl = await startE2EServer();

    const { data } = await fetchJSON<Record<string, string[]>>(
      `${baseUrl}/tools`,
    );

    expect(data.workflow).toContain('workflow_route');
    expect(data.workflow).toContain('checkpoint_create');
    expect(data.workflow).toContain('checkpoint_restore');
  });
});

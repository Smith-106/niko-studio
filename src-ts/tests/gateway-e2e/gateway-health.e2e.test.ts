import { afterEach, describe, expect, it, vi } from 'vitest';

import { startE2EServer, stopAllServers, fetchJSON } from './helpers';

vi.mock('../../skills/index', () => ({
  listSkills: vi.fn(() => ['writing', 'critic', 'worldbuilding', 'character', 'plot', 'research']),
}));

describe('E2E: GET /health', () => {
  let baseUrl: string;

  afterEach(async () => {
    await stopAllServers();
    vi.restoreAllMocks();
  });

  it('returns healthy status with version and services', async () => {
    baseUrl = await startE2EServer();

    const { status, data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/health`,
    );

    expect(status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(data.status);
    expect(data).toHaveProperty('version');
    expect(typeof data.version).toBe('string');
    expect(data).toHaveProperty('services');
    expect(typeof data.services).toBe('object');
  });

  it('includes engine_health for core services', async () => {
    baseUrl = await startE2EServer();

    const { data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/health`,
    );

    const engineHealth = data.engine_health as Record<string, unknown>;
    expect(engineHealth).toBeDefined();
    expect(engineHealth).toHaveProperty('memory');
    expect(engineHealth).toHaveProperty('graph');
    expect(engineHealth).toHaveProperty('search');
    expect(engineHealth).toHaveProperty('workflow');
    expect(engineHealth).toHaveProperty('critic');
  });

  it('includes agents list and skills_count', async () => {
    baseUrl = await startE2EServer();

    const { data } = await fetchJSON<Record<string, unknown>>(
      `${baseUrl}/health`,
    );

    const agents = data.agents as string[];
    expect(Array.isArray(agents)).toBe(true);
    expect(agents).toContain('writer');
    expect(agents).toContain('critic');

    expect(data).toHaveProperty('skills_count');
    expect(typeof data.skills_count).toBe('number');
    expect(data.skills_count as number).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { NullNowledgeMemAPI } from '../../services/null-nowledge-mem-api.js';

describe('services/null-nowledge-mem-api', () => {
  it('reports offline state and returns empty results for read-only helpers', async () => {
    const api = new NullNowledgeMemAPI();

    expect(api.isHealthy).toBe(false);
    await expect(api.checkHealth()).resolves.toBe(false);
    await expect(api.getMemory('mem-1')).resolves.toBeNull();
    await expect(api.searchMemories('hero')).resolves.toEqual({ memories: [] });
    await expect(api.listCrystals()).resolves.toEqual([]);
    await expect(api.getCrystal()).resolves.toBeNull();
    await expect(api.getEntities()).resolves.toEqual([]);
    await expect(api.graphSearch()).resolves.toEqual([]);
    await expect(api.temporalQuery()).resolves.toEqual([]);
    await expect(api.getContradictions()).resolves.toEqual([]);
    await expect(api.getEvolutionChains()).resolves.toEqual([]);
  });

  it('throws on write attempts while offline', async () => {
    const api = new NullNowledgeMemAPI();

    await expect(api.addMemory('hero')).rejects.toThrow('Nowledge Mem offline');
    await expect(api.deleteMemory('mem-1')).rejects.toThrow('Nowledge Mem offline');
  });
});

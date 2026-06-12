import { describe, expect, it, vi } from 'vitest';

import { WorldbuildingAgent } from '../../agents/worldbuilding';

describe('WorldbuildingAgent additional coverage', () => {
  it('covers engine accessors and default scene fields', async () => {
    const agent = new WorldbuildingAgent();
    const memoryEngine = { search: vi.fn() };
    const graphEngine = { query: vi.fn() };

    expect(agent.memoryEngine).toBeNull();
    expect(agent.graphEngine).toBeNull();

    agent.memoryEngine = memoryEngine as never;
    agent.graphEngine = graphEngine as never;

    expect(agent.memoryEngine).toBe(memoryEngine);
    expect(agent.graphEngine).toBe(graphEngine);

    const context = await agent.getContext({});

    expect(context).toMatchObject({
      settings: [],
      activeRules: [],
      locationDetails: {},
      timePeriod: '',
      atmosphere: '中性',
    });
  });

  it('swallows top-level location and rule query failures in getContext', async () => {
    const agent = new WorldbuildingAgent({
      graphEngine: { query: vi.fn() } as never,
      memoryEngine: { search: vi.fn() } as never,
    });
    const logSpy = vi.spyOn(agent, 'logActivity');

    vi.spyOn(agent as any, 'queryLocation').mockRejectedValue(new Error('graph exploded'));
    vi.spyOn(agent as any, 'queryRules').mockRejectedValue(new Error('memory exploded'));

    const context = await agent.getContext({
      location: '断桥',
      time: '深夜',
    });

    expect(context.settings).toEqual([]);
    expect(context.activeRules).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Location query failed: Error: graph exploded'),
      'WARNING',
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rules query failed: Error: memory exploded'),
      'WARNING',
    );
  });

  it('hits validation keyword match and environmental fallback branch', async () => {
    const agent = new WorldbuildingAgent();

    const validation = await agent.validateConsistency('The ward obeys the ancient law.', {
      settings: [],
      activeRules: ['ancient law applies'],
      locationDetails: {},
      timePeriod: '',
      atmosphere: '中性',
    });

    const response = await agent.generateEnvironmentalResponse(
      '普通行走',
      '平原',
      [{ term: '海潮', nature: 'geography', detail: '与当前场景无关', source: 'Ch.3' }] as any,
    );

    expect(validation).toMatchObject({
      isValid: true,
      checkedRules: 1,
      issues: [],
      suggestions: [],
    });
    expect(response).toContain('No specific worldview constraints apply.');
  });

  it('generates stimulus events without active tensions or world constraints', async () => {
    const agent = new WorldbuildingAgent();

    const event = await agent.generateStimulusEvent(
      [],
      [{ term: '灵力', nature: 'magic_system', detail: '灵力流动异常', source: 'Ch.5' }] as any,
    );

    expect(event).toContain('No active character tensions.');
    expect(event).not.toContain('World constraints:');
  });

  it('covers queryLocation no-graph, default-node and catch branches', async () => {
    const noGraphAgent = new WorldbuildingAgent();
    await expect((noGraphAgent as any).queryLocation('无名城')).resolves.toBeNull();

    const defaultNodeAgent = new WorldbuildingAgent({
      graphEngine: {
        query: vi.fn().mockResolvedValue([{}]),
      } as never,
    });

    await expect((defaultNodeAgent as any).queryLocation('空港')).resolves.toEqual({
      name: '空港',
      description: '',
      rules: [],
      nearby: [],
      inhabitants: [],
    });

    const failingAgent = new WorldbuildingAgent({
      graphEngine: {
        query: vi.fn().mockRejectedValue(new Error('db offline')),
      } as never,
    });
    const logSpy = vi.spyOn(failingAgent, 'logActivity');

    await expect((failingAgent as any).queryLocation('裂谷')).resolves.toBeNull();
    expect(logSpy).toHaveBeenCalledWith(
      'Location query failed',
      expect.objectContaining({
        detail: expect.any(Error),
      }),
    );
  });

  it('covers queryRules empty-engine and dual catch branches', async () => {
    const noMemoryAgent = new WorldbuildingAgent();
    await expect((noMemoryAgent as any).queryRules('旧港', '黎明')).resolves.toEqual([]);

    const failingAgent = new WorldbuildingAgent({
      memoryEngine: {
        search: vi
          .fn()
          .mockRejectedValueOnce(new Error('location lookup failed'))
          .mockRejectedValueOnce(new Error('time lookup failed')),
      } as never,
    });
    const logSpy = vi.spyOn(failingAgent, 'logActivity');

    await expect((failingAgent as any).queryRules('旧港', '黎明')).resolves.toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      'Location rules query failed',
      expect.objectContaining({
        detail: expect.any(Error),
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      'Time-period rules query failed',
      expect.objectContaining({
        detail: expect.any(Error),
      }),
    );
  });

  it('covers bright and dawn atmosphere hints', () => {
    const agent = new WorldbuildingAgent();

    const atmosphere = (agent as any).determineAtmosphere(
      { description: '明亮而繁华的街区' },
      '黎明前',
    );

    expect(atmosphere).toContain('活跃');
    expect(atmosphere).toContain('希望');
  });
});

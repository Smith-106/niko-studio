import { describe, expect, it, vi } from 'vitest';

import { WorldbuildingAgent } from '../../agents/worldbuilding';

describe('WorldbuildingAgent', () => {
  it('builds world context from mocked graph and memory seams', async () => {
    const graphEngine = {
      query: vi.fn().mockResolvedValue([
        {
          l: {
            description: '古老而黑暗的旧城区',
            rules: ['夜间禁止出行'],
          },
          nearby: ['钟楼'],
          inhabitants: ['林岚'],
        },
      ]),
    };
    const memoryEngine = {
      search: vi
        .fn()
        .mockResolvedValueOnce([{ content: 'world rules 旧城区: 夜间禁止出行' }])
        .mockResolvedValueOnce([{ content: 'world rules 深夜: 灯火稀少' }]),
    };
    const agent = new WorldbuildingAgent({
      graphEngine: graphEngine as never,
      memoryEngine: memoryEngine as never,
    });

    const context = await agent.getContext({
      location: '旧城区',
      time: '深夜',
    });

    expect(context.settings[0]).toMatchObject({
      category: 'geography',
      name: '旧城区',
      relatedLocations: ['钟楼'],
      relatedCharacters: ['林岚'],
    });
    expect(context.activeRules).toHaveLength(2);
    expect(context.atmosphere).toContain('压抑');
    expect(context.atmosphere).toContain('紧张');
  });

  it('validates consistency and reports checked rule count', async () => {
    const agent = new WorldbuildingAgent();

    const validation = await agent.validateConsistency('角色在旧城区行动。', {
      settings: [],
      activeRules: ['夜间 禁止 出行', '灯火 稀少'],
      locationDetails: {},
      timePeriod: '深夜',
      atmosphere: '压抑、紧张',
    });

    expect(validation.isValid).toBe(true);
    expect(validation.checkedRules).toBe(2);
    expect(validation.issues).toEqual([]);
  });

  it('falls back to neutral empty context and exposes run() alias', async () => {
    const agent = new WorldbuildingAgent();

    const context = await agent.run({
      location: '未知地点',
      time: '白天',
    });

    expect(context.settings).toEqual([]);
    expect(context.activeRules).toEqual([]);
    expect(context.atmosphere).toBe('中性');
  });
});

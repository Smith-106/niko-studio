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

  // ── M11: BookWorld integration ─────────────────────────────

  it('generates environmental response from worldview settings', async () => {
    const agent = new WorldbuildingAgent();

    const settings = [
      { term: '灵力', nature: 'magic_system', detail: '灵力是修仙的基础', source: 'Ch.1' },
      { term: '禁止出行', nature: 'social_norm', detail: '夜间禁止出行', source: 'Ch.1' },
    ];

    const response = await agent.generateEnvironmentalResponse(
      '使用灵力',
      '灵山',
      settings as any,
    );

    expect(response).toContain('灵力');
    expect(response).toContain('Environment Response');
  });

  it('generates stimulus event with character tensions', async () => {
    const agent = new WorldbuildingAgent();

    const settings = [
      { term: '势力冲突', nature: 'political', detail: '两大门派争夺资源', source: 'Ch.2' },
    ];

    const event = await agent.generateStimulusEvent(
      ['林岚: 内心挣扎', '周谨: 警惕'],
      settings as any,
    );

    expect(event).toContain('Stimulus Event');
    expect(event).toContain('林岚');
  });

  it('creates temporary NPC description', () => {
    const agent = new WorldbuildingAgent();
    const npc = agent.createTempNPC('一位白发老者，拄着拐杖');
    expect(npc).toContain('Temporary NPC');
    expect(npc).toContain('白发老者');
  });

  it('creates default NPC when no description given', () => {
    const agent = new WorldbuildingAgent();
    const npc = agent.createTempNPC('');
    expect(npc).toContain('Temporary NPC');
    expect(npc).toContain('unnamed');
  });
});

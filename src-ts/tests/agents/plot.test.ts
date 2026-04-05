import { describe, expect, it, vi } from 'vitest';

import { ForeshadowStatus, PlotAgent } from '../../agents/plot';

describe('PlotAgent', () => {
  it('builds plot context from mocked memory and graph seams', async () => {
    const memoryEngine = {
      search: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'event-1',
            content: '主角得知怀表的来历',
            scene_id: 'CH01-SC01',
            characters: ['林岚'],
            is_key: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            content: '最终揭晓真凶',
          },
        ]),
    };
    const graphEngine = {
      query: vi.fn().mockResolvedValue([
        {
          f: {
            id: 'foreshadow-1',
            description: '旧怀表',
            planted_at: 'CH01-SC01',
            harvested_at: '',
            status: 'planted',
            importance: 'high',
            characters: ['林岚'],
            hints: ['CH01-SC02'],
          },
        },
      ]),
    };
    const agent = new PlotAgent({
      memoryEngine: memoryEngine as never,
      graphEngine: graphEngine as never,
    });

    const context = await agent.getContext({
      scene_id: 'CH02-SC03',
      structural_function: 'Climax',
      foreshadows_to_plant: ['新线索'],
      foreshadows_to_harvest: ['旧怀表'],
    });

    expect(context.currentPosition).toBe('CH02-SC03');
    expect(context.structuralFunction).toBe('Climax');
    expect(context.previousEvents).toHaveLength(1);
    expect(context.upcomingEvents).toEqual(['最终揭晓真凶']);
    expect(context.activeForeshadows[0]).toMatchObject({
      foreshadowId: 'foreshadow-1',
      status: ForeshadowStatus.PLANTED,
    });
    expect(context.foreshadowsToHarvest).toEqual(['旧怀表']);
    expect(typeof context.tensionLevel).toBe('number');
  });

  it('tracks foreshadow transitions through the graph engine and reports missing graph access', async () => {
    const graphEngine = {
      query: vi.fn().mockResolvedValue([]),
    };
    const agent = new PlotAgent({
      graphEngine: graphEngine as never,
    });

    const hinted = await agent.trackForeshadow('foreshadow-2', 'hint', 'CH02-SC04');
    const harvested = await agent.trackForeshadow('foreshadow-2', 'harvest', 'CH02-SC05');
    const noGraph = await new PlotAgent().trackForeshadow('foreshadow-3', 'plant');

    expect(hinted).toMatchObject({
      success: true,
      newStatus: ForeshadowStatus.HINTED,
    });
    expect(harvested).toMatchObject({
      success: true,
      newStatus: ForeshadowStatus.HARVESTED,
    });
    expect(graphEngine.query).toHaveBeenCalledTimes(2);
    expect(noGraph).toMatchObject({
      success: false,
      error: 'No graph engine',
    });
  });

  it('validates timeline consistency and exposes run() as a context alias', async () => {
    const agent = new PlotAgent();

    const validation = await agent.validateTimeline(
      '她提前知道最终揭晓真凶的内容，但本段没有回收任何旧线索。',
      {
        currentPosition: 'CH02-SC03',
        structuralFunction: 'Rising',
        previousEvents: [],
        upcomingEvents: ['最终揭晓真凶'],
        activeForeshadows: [],
        foreshadowsToPlant: [],
        foreshadowsToHarvest: ['旧怀表'],
        tensionLevel: 7,
        tensionTrend: 'rising',
      },
    );

    expect(validation.isValid).toBe(false);
    expect(validation.issues[0]).toContain('not yet occurred');
    expect(validation.suggestions[0]).toContain('旧怀表');

    const emptyContext = await agent.run({
      scene_id: 'CH01-SC01',
      structural_function: 'Opening',
    });

    expect(emptyContext.currentPosition).toBe('CH01-SC01');
    expect(emptyContext.previousEvents).toEqual([]);
    expect(emptyContext.activeForeshadows).toEqual([]);
  });
});

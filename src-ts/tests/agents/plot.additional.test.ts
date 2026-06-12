import { describe, expect, it, vi } from 'vitest';

import { ForeshadowStatus, PlotAgent } from '../../agents/plot';

describe('PlotAgent additional coverage', () => {
  it('covers engine accessors and default context inputs', async () => {
    const agent = new PlotAgent();
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
      currentPosition: 'CH01-SC01',
      structuralFunction: 'Rising',
      previousEvents: [],
      upcomingEvents: [],
      activeForeshadows: [],
      foreshadowsToPlant: [],
      foreshadowsToHarvest: [],
      tensionLevel: 5,
      tensionTrend: 'rising',
    });
  });

  it('covers fallback and catch branches in trackForeshadow', async () => {
    const unknownActionAgent = new PlotAgent({
      graphEngine: { query: vi.fn().mockResolvedValue([]) } as never,
    });
    const fallback = await unknownActionAgent.trackForeshadow('fs-1', 'mystery', 'CH03-SC01');

    expect(fallback).toMatchObject({
      success: true,
      newStatus: ForeshadowStatus.PLANTED,
    });

    const failingAgent = new PlotAgent({
      graphEngine: { query: vi.fn().mockRejectedValue(new Error('neo4j down')) } as never,
    });
    const failed = await failingAgent.trackForeshadow('fs-2', 'abandon', 'CH03-SC02');

    expect(failed).toMatchObject({
      success: false,
      error: 'Error: neo4j down',
    });
  });

  it('covers previous-events fallback chapter parsing and default mapped fields', async () => {
    const search = vi.fn().mockResolvedValue([
      {},
      null,
    ]);
    const agent = new PlotAgent({
      memoryEngine: { search } as never,
    });

    const events = await (agent as any).getPreviousEvents('SC');

    expect(search).toHaveBeenCalledWith('key event chapter before 1', { limit: 10 });
    expect(events).toEqual([
      {
        eventId: '',
        description: '',
        sceneId: '',
        charactersInvolved: [],
        consequences: [],
        isKeyEvent: false,
      },
    ]);
  });

  it('covers previous-events query failure branch', async () => {
    const agent = new PlotAgent({
      memoryEngine: {
        search: vi.fn().mockRejectedValue(new Error('search failed')),
      } as never,
    });
    const logSpy = vi.spyOn(agent, 'logActivity');

    await expect((agent as any).getPreviousEvents('CH09-SC01')).resolves.toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      'Event query failed: Error: search failed',
      'WARNING',
    );
  });

  it('covers upcoming-events failure branch', async () => {
    const agent = new PlotAgent({
      memoryEngine: {
        search: vi.fn().mockRejectedValue(new Error('future lookup failed')),
      } as never,
    });
    const logSpy = vi.spyOn(agent, 'logActivity');

    await expect((agent as any).getUpcomingEvents('CH09-SC01')).resolves.toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      'Upcoming events query failed',
      expect.objectContaining({
        detail: expect.any(Error),
      }),
    );
  });

  it('covers active-foreshadow default mapping when graph rows are sparse', async () => {
    const agent = new PlotAgent({
      graphEngine: {
        query: vi.fn().mockResolvedValue([
          {},
          {
            f: {
              id: 'fs-9',
              description: '残缺线索',
              planted_at: 'CH01-SC02',
              status: 'mystery',
            },
          },
        ]),
      } as never,
    });

    const foreshadows = await (agent as any).getActiveForeshadows('CH02-SC02');

    expect(foreshadows).toEqual([
      {
        foreshadowId: '',
        description: '',
        plantedAt: '',
        harvestedAt: '',
        status: ForeshadowStatus.PLANTED,
        importance: 'medium',
        relatedCharacters: [],
        hints: [],
      },
      {
        foreshadowId: 'fs-9',
        description: '残缺线索',
        plantedAt: 'CH01-SC02',
        harvestedAt: '',
        status: ForeshadowStatus.PLANTED,
        importance: 'medium',
        relatedCharacters: [],
        hints: [],
      },
    ]);
  });

  it('covers active-foreshadow query failure branch', async () => {
    const agent = new PlotAgent({
      graphEngine: {
        query: vi.fn().mockRejectedValue(new Error('graph timeout')),
      } as never,
    });
    const logSpy = vi.spyOn(agent, 'logActivity');

    await expect((agent as any).getActiveForeshadows('CH02-SC02')).resolves.toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      'Foreshadow query failed: Error: graph timeout',
      'WARNING',
    );
  });
});

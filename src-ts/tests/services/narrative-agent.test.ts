import { afterEach, describe, expect, it, vi } from 'vitest';

const aggregateWritingContextMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/writing-context-aggregator', () => ({
  aggregateWritingContext: aggregateWritingContextMock,
}));

import { NarrativeAgent } from '../../services/narrative-agent.js';

describe('services/narrative-agent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates writing-context collection to the shared aggregator', async () => {
    aggregateWritingContextMock.mockResolvedValueOnce({ snapshot: true });

    const engine = { id: 'engine' };
    const bridge = { id: 'bridge' };
    const agent = new NarrativeAgent(engine as never, bridge as never);

    await expect(agent.getWritingContext(7, 'tail text')).resolves.toEqual({ snapshot: true });
    expect(aggregateWritingContextMock).toHaveBeenCalledWith(engine, bridge, 7, 'tail text');
  });

  it('suggests plot actions from overdue foreshadows, contradictions, and low quality scores', async () => {
    aggregateWritingContextMock.mockResolvedValueOnce({
      pendingForeshadows: [
        { foreshadowId: 'f-due', hint: 'ring the bell', plantedAt: 3, urgency: 'due' },
        { foreshadowId: 'f-overdue', hint: 'open the vault', plantedAt: 2, urgency: 'overdue' },
        { foreshadowId: 'f-later', hint: 'not yet', plantedAt: 9, urgency: 'soon' },
      ],
      contradictions: [{ description: 'Character age mismatch' }],
      lastQualityScore: 55,
    });

    const agent = new NarrativeAgent({} as never, {} as never);
    const suggestions = await agent.suggestPlot('continue', 8);

    expect(suggestions).toEqual([
      {
        action: '回收伏笔: ring the bell',
        reason: '第3章埋设的伏笔已到期',
        affectedEntities: ['f-due'],
        foreshadowOpportunities: ['f-due'],
      },
      {
        action: '回收伏笔: open the vault',
        reason: '第2章埋设的伏笔已过期',
        affectedEntities: ['f-overdue'],
        foreshadowOpportunities: ['f-overdue'],
      },
      {
        action: '解决矛盾: Character age mismatch',
        reason: '知识层检测到叙事矛盾',
        affectedEntities: [],
      },
      {
        action: '提升本章质量',
        reason: '当前质量评分 55/100',
        affectedEntities: [],
      },
    ]);
  });

  it('reports continuity issues for overdue foreshadows and contradictions', async () => {
    aggregateWritingContextMock.mockResolvedValueOnce({
      pendingForeshadows: [
        { foreshadowId: 'f-overdue', hint: 'open the vault', urgency: 'overdue', chaptersUntilDue: -2 },
      ],
      contradictions: [{ description: 'Timeline drift detected' }],
    });

    const agent = new NarrativeAgent({} as never, {} as never);
    const issues = await agent.checkContinuity(10);

    expect(issues).toEqual([
      {
        type: 'foreshadow_gap',
        description: '伏笔 "open the vault" 已过期 2 章未回收',
        severity: 'warning',
        suggestion: '考虑在近期章节回收或显式放弃该伏笔',
      },
      {
        type: 'worldview_violation',
        description: 'Timeline drift detected',
        severity: 'warning',
      },
    ]);
  });
});

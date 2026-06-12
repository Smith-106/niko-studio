import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EnhancedForeshadowingManager,
  foreshadowFromDict,
  ForeshadowingManager,
} from '../../narrative/foreshadowing';

afterEach(() => {
  vi.useRealTimers();
});

describe('Foreshadowing branch gap coverage', () => {
  it('covers empty hint payloads and missing hint-index fallbacks', () => {
    const restored = foreshadowFromDict({
      id: 'no-hints',
      description: 'no hints clue',
      planted_at: 'scene-1',
      planted_time: '2026-01-01T00:00:00.000Z',
    });

    expect(restored.hints).toEqual([]);

    const manager = new ForeshadowingManager();
    const hintlessIndex = manager.plant('missing index clue', 'scene-1', 6);
    (manager as unknown as { foreshadowHints: Map<string, string[]> }).foreshadowHints.delete(hintlessIndex.id);

    const hinted = manager.hint(hintlessIndex.id, 'scene-2', 'patched index');
    expect(hinted?.hints).toHaveLength(1);

    const deleteFallback = manager.plant('delete fallback clue', 'scene-3', 4);
    (manager as unknown as { foreshadowHints: Map<string, string[]> }).foreshadowHints.delete(deleteFallback.id);
    expect(manager.delete(deleteFallback.id)).toBe(true);
  });

  it('covers default thresholds, urgency fallback ordering, planted scene lookup, and tie-break sorting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-20T00:00:00.000Z'));

    const thresholdManager = new ForeshadowingManager();
    const oddThreshold = thresholdManager.plant('odd threshold clue', 'scene-1', 5);
    oddThreshold.plantedTime = '2026-01-01T00:00:00.000Z';
    (oddThreshold as unknown as { importance: number | undefined }).importance = undefined;

    const thresholdReminders = thresholdManager.getOverdue();
    expect(thresholdReminders).toHaveLength(1);
    expect(thresholdReminders[0]?.foreshadow.id).toBe(oddThreshold.id);

    const urgencyHelper = thresholdManager as unknown as {
      calculateUrgency(scenesSince: number, maxScenes: number): string;
    };
    expect(urgencyHelper.calculateUrgency(1, 0)).toBe('medium');

    const emptyStats = new ForeshadowingManager().getStats() as Record<string, unknown>;
    expect(emptyStats['avg_hints_per_foreshadow']).toBe(0);
    expect(emptyStats['harvest_rate']).toBe(0);

    const searchManager = new ForeshadowingManager();
    const first = searchManager.plant('tie clue', 'scene-lookup', 5, ['blue']);
    const second = searchManager.plant('tie clue', 'scene-lookup', 5, ['blue']);
    first.plantedTime = '2026-01-01T00:00:00.000Z';
    second.plantedTime = '2026-01-02T00:00:00.000Z';

    expect(searchManager.getForeshadowsAtScene('scene-lookup').planted.map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(searchManager.search('tie clue').map((item) => item.id)).toEqual([second.id, first.id]);

    const fallbackSortManager = new ForeshadowingManager();
    const high = fallbackSortManager.plant('fallback high', 'scene-high', 9);
    const low = fallbackSortManager.plant('fallback low', 'scene-low', 3);
    high.plantedTime = '2026-01-01T00:00:00.000Z';
    low.plantedTime = '2026-01-01T00:00:00.000Z';

    const sortHelper = fallbackSortManager as unknown as {
      calculateUrgency(scenesSince: number, maxScenes: number): string;
    };
    sortHelper.calculateUrgency = () => 'mystery';

    const fallbackSorted = fallbackSortManager.getOverdue(1);
    expect(fallbackSorted.map((item) => item.foreshadow.id)).toEqual([high.id, low.id]);
  });

  it('covers enhanced manager graph-sync, rule fallback ordering, and recommendation branches', () => {
    const graphManager = {
      getEntity: vi.fn(() => null),
      createEntity: vi.fn(),
      updateEntity: vi.fn(),
      createRelationship: vi.fn(),
      findRelatedEntities: vi.fn(() => []),
      getSubgraph: vi.fn(() => ({ entities: [], relationships: [] })),
    };

    const manager = new EnhancedForeshadowingManager(graphManager as never);
    const harvested = manager.plant('sync on harvest', 'scene-1', 5, [], undefined, false);
    manager.harvest(harvested.id, 'scene-2');
    expect(graphManager.createEntity).toHaveBeenCalled();

    const firstPending = manager.plant('rule pending high', 'unregistered-a', 9, [], undefined, false);
    const secondPending = manager.plant('rule pending medium', 'unregistered-b', 7, [], undefined, false);

    manager.ruleEngine.evaluate = vi.fn((foreshadow) => ([
      {
        foreshadow,
        reason: 'first fallback',
        urgency: 'mystery',
        scenesSincePlant: 0,
        suggestion: 'first',
      },
      {
        foreshadow,
        reason: 'second fallback',
        urgency: 'unknown',
        scenesSincePlant: 0,
        suggestion: 'second',
      },
    ]));

    const reminders = manager.getRemindersWithRules();
    expect(reminders.map((item) => item.foreshadow.id)).toEqual([firstPending.id, secondPending.id]);

    const needy = new EnhancedForeshadowingManager();
    needy.plant('high pending clue', 'scene-1', 9, [], undefined, false);
    const health = needy.analyzeForeshadowHealth() as Record<string, unknown>;
    expect(health['recommendations']).toEqual(expect.arrayContaining([
      '回收率较低，建议加快伏笔回收节奏',
      '暗示率较低，建议为埋设的伏笔添加更多暗示',
      '平均暗示次数不足，考虑强化伏笔的读者印象',
      '有 1 个高重要性伏笔待处理',
    ]));

    const patched = new EnhancedForeshadowingManager();
    (patched as unknown as {
      getStats(): Record<string, unknown>;
      getPending(): Array<{ importance: number }>;
    }).getStats = () => ({
      total: 0,
      by_state: {},
      avg_hints_per_foreshadow: 0,
    });
    (patched as unknown as {
      getPending(): Array<{ importance: number }>;
    }).getPending = () => [];

    const patchedHealth = patched.analyzeForeshadowHealth() as Record<string, unknown>;
    expect(patchedHealth['metrics']).toEqual({
      harvest_rate: 100,
      hint_rate: 100,
      avg_hints: 0,
    });
  });
});

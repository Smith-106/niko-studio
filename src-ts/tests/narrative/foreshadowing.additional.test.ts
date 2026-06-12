import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ChapterBoundaryRule,
  EnhancedForeshadowingManager,
  ForeshadowGraphIntegration,
  foreshadowFromDict,
  ForeshadowingManager,
  ForeshadowState,
  HighImportanceRule,
  NoHintRule,
  SceneCountRule,
  type Foreshadow,
} from '../../narrative/foreshadowing';

afterEach(() => {
  vi.useRealTimers();
});

function makeForeshadow(overrides: Partial<Foreshadow> = {}): Foreshadow {
  return {
    id: 'fs-seed',
    description: 'seed clue',
    state: ForeshadowState.PLANTED,
    plantedAt: 'scene-1',
    plantedTime: '2026-01-01T00:00:00.000Z',
    hints: [],
    harvestedAt: null,
    harvestedTime: null,
    importance: 5,
    tags: [],
    metadata: {},
    ...overrides,
  };
}

function createGraphManagerMock(overrides: Record<string, unknown> = {}) {
  return {
    getEntity: vi.fn(() => null),
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    createRelationship: vi.fn(),
    findRelatedEntities: vi.fn(() => []),
    getSubgraph: vi.fn(() => ({ entities: [], relationships: [] })),
    ...overrides,
  };
}

describe('Foreshadowing additional branch coverage', () => {
  it('applies serialization defaults and manager guard branches', () => {
    const restored = foreshadowFromDict({
      id: 'minimal',
      description: 'minimal clue',
      planted_at: 'scene-x',
      planted_time: '2026-01-02T00:00:00.000Z',
      hints: [{}],
    });

    expect(restored).toMatchObject({
      id: 'minimal',
      state: ForeshadowState.PLANTED,
      harvestedAt: null,
      harvestedTime: null,
      importance: 5,
      tags: [],
      metadata: {},
    });
    expect(restored.hints[0]).toMatchObject({ id: '', sceneId: undefined });

    const manager = new ForeshadowingManager();
    const low = manager.plant('low clamp', 'scene-1', 0);
    const high = manager.plant('high clamp', 'scene-2', 99);
    expect(low.importance).toBe(1);
    expect(high.importance).toBe(10);

    expect(manager.hint('missing', 'scene-3')).toBeNull();
    expect(manager.harvest('missing', 'scene-3')).toBeNull();
    expect(manager.getLifecycleSummary('missing')).toBeNull();

    const defaultHint = manager.hint(low.id, 'scene-4');
    expect(defaultHint?.hints[0]?.description).toBe('Hint at scene scene-4');
    const harvested = manager.harvest(low.id, 'scene-5');
    expect(manager.hint(low.id, 'scene-6')).toBeNull();
    expect(manager.harvest(low.id, 'scene-7')).toBe(harvested);

    expect(manager.getAll(ForeshadowState.PLANTED).map((item) => item.id)).toEqual([high.id]);
    expect(manager.search('', undefined, undefined, 10).map((item) => item.id)).toContain(high.id);
  });

  it('uses date fallback for overdue reminders and covers reason/suggestion variants', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-20T00:00:00.000Z'));

    const manager = new ForeshadowingManager();
    const planted = manager.plant('forgotten planted clue', 'scene-plain', 4);
    const hinted = manager.plant('waiting hinted clue', 'scene-plain', 8);
    const critical = manager.plant('critical clue', 'scene-plain', 10);

    manager.hint(hinted.id, 'scene-hint', 'small reminder');

    for (const item of [planted, hinted, critical]) {
      item.plantedTime = '2026-01-01T00:00:00.000Z';
    }

    const reminders = manager.getOverdue(20);

    expect(reminders.map((item) => item.foreshadow.id)).toEqual([critical.id, hinted.id, planted.id]);
    expect(reminders[0]?.urgency).toBe('high');
    expect(reminders[1]?.reason).toContain('1 次暗示');
    expect(reminders[1]?.suggestion).toContain('尽快');
    expect(reminders[2]?.reason).toContain('无任何暗示');
  });

  it('covers reminder rule false paths and threshold boundaries', () => {
    const planted = makeForeshadow({ importance: 8, metadata: { planted_chapter: 1, current_chapter: 1 } });
    const hinted = makeForeshadow({ state: ForeshadowState.HINTED, importance: 8 });
    const lowImportance = makeForeshadow({ importance: 3 });

    expect(new SceneCountRule(1).evaluate(planted, 2, 1)).toBeNull();
    expect(new SceneCountRule(0.5).evaluate(makeForeshadow({ importance: 5, state: ForeshadowState.HINTED }), 11, 1)?.urgency).toBe('medium');
    expect(new SceneCountRule(0.5).evaluate(makeForeshadow({ importance: 5 }), 16, 1)?.urgency).toBe('high');
    expect(new SceneCountRule(0.5).evaluate(makeForeshadow({ importance: 42 }), 12, 1)?.scenesSincePlant).toBe(11);

    expect(new NoHintRule(5).evaluate(hinted, 20, 1)).toBeNull();
    expect(new NoHintRule(5).evaluate(planted, 3, 1)).toBeNull();
    expect(new NoHintRule(5).evaluate(planted, 8, 1)?.urgency).toBe('high');

    expect(new HighImportanceRule(8, 3).evaluate(lowImportance, 20, 1)).toBeNull();
    expect(new HighImportanceRule(8, 3).evaluate(planted, 3, 1)).toBeNull();
    expect(new HighImportanceRule(8, 3).evaluate(planted, 4, 1)?.urgency).toBe('medium');

    expect(new ChapterBoundaryRule(2).evaluate(planted, 9, 2)).toBeNull();
    expect(new ChapterBoundaryRule(1).evaluate(makeForeshadow({ metadata: {} }), 9, 2)).toBeNull();
  });

  it('handles graph integration catch paths and filters related foreshadows', () => {
    const manager = new ForeshadowingManager();
    const known = manager.plant('known graph clue', 'scene-1', 7);
    const graph = new ForeshadowGraphIntegration(manager);

    graph.setGraphManager(createGraphManagerMock({
      getEntity: vi.fn(() => {
        throw new Error('entity lookup failed');
      }),
    }) as never);
    expect(graph.syncForeshadowToGraph(known)).toBeNull();

    graph.setGraphManager(createGraphManagerMock({
      createRelationship: vi.fn(() => {
        throw new Error('relationship failed');
      }),
    }) as never);
    expect(graph.linkForeshadowToEntity(known.id, 'character-1')).toBe(false);

    graph.setGraphManager(createGraphManagerMock({
      findRelatedEntities: vi.fn(() => {
        throw new Error('related failed');
      }),
    }) as never);
    expect(graph.findRelatedForeshadows('character-1')).toEqual([]);

    graph.setGraphManager(createGraphManagerMock({
      findRelatedEntities: vi.fn(() => [
        { id: 'character-1', properties: { foreshadow_id: known.id } },
        { id: 'foreshadow_missing-prop', properties: {} },
        { id: 'foreshadow_unknown', properties: { foreshadow_id: 'unknown' } },
        { id: `foreshadow_${known.id}`, properties: { foreshadow_id: known.id } },
      ]),
      getSubgraph: vi.fn(() => ({
        entities: [{ id: `foreshadow_${known.id}`, name: 'known graph clue', type: 'CONCEPT' }],
        relationships: [{ source_id: 'a', target_id: 'b', type: 'RELATED_TO', properties: { weight: 1 } }],
      })),
    }) as never);

    expect(graph.findRelatedForeshadows('character-1')).toEqual([known]);
    expect(graph.getForeshadowNetwork(known.id)).toMatchObject({
      center: known.id,
      relationships: [{ source: 'a', target: 'b', type: 'RELATED_TO', properties: { weight: 1 } }],
    });
  });

  it('covers enhanced health, fair-play, asymmetry, and interval edge branches', () => {
    const manager = new EnhancedForeshadowingManager();

    const clean = manager.plant('clean loop', 'scene-1', 5, [], undefined, false);
    manager.hint(clean.id, 'scene-2', 'clean hint', false);
    manager.harvest(clean.id, 'scene-3', false);

    expect(manager.analyzeForeshadowHealth().recommendations).toEqual(['\u4F0F\u7B14\u7BA1\u7406\u72B6\u6001\u826F\u597D']);
    expect(manager.checkFairPlayRules()).toMatchObject({
      fairPlayScore: 100,
      harvestedWithClues: 1,
      harvestedWithoutClues: 0,
    });

    const readerAhead = manager.analyzeInformationAsymmetry([
      { chapterIndex: 1, content: '\u5176\u5B9E \u6697\u5730\u91CC \u5B9E\u9645\u4E0A \u79D8\u5BC6' },
      { chapterIndex: 2, content: '\u5176\u5B9E \u6697\u5730\u91CC \u5B9E\u9645\u4E0A' },
    ]);
    expect(readerAhead.suggestions[0]).toContain('\u8BFB\u8005');

    const characterAhead = manager.analyzeInformationAsymmetry([
      { chapterIndex: 1, content: '\u5176\u5B9E \u79D8\u5BC6 \u9690\u7792 \u4E0D\u544A\u8BC9' },
      { chapterIndex: 2, content: '\u79D8\u5BC6 \u9690\u7792 \u4E0D\u544A\u8BC9' },
    ]);
    expect(characterAhead.suggestions[0]).toContain('\u89D2\u8272');

    const intervalManager = new EnhancedForeshadowingManager();
    const high = intervalManager.plant('high wait', 'scene-1', 9, [], undefined, false);
    const medium = intervalManager.plant('medium wait', 'scene-5', 5, [], undefined, false);
    const low = intervalManager.plant('low wait', 'scene-plain', 3, [], undefined, false);
    const harvested = intervalManager.plant('done wait', 'scene-2', 10, [], undefined, false);
    intervalManager.harvest(harvested.id, 'scene-9', false);

    expect(intervalManager.suggestHarvestIntervals(15).map((item) => ({
      id: item.foreshadowId,
      urgency: item.urgency,
      max: item.maxRecommendedScenes,
      elapsed: item.elapsedScenes,
    }))).toEqual([
      { id: high.id, urgency: 'overdue', max: 10, elapsed: 14 },
      { id: medium.id, urgency: 'medium', max: 20, elapsed: 10 },
      { id: low.id, urgency: 'medium', max: 30, elapsed: 15 },
    ]);
  });
});

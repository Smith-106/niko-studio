import { describe, expect, it, vi } from 'vitest';

import {
  ChapterBoundaryRule,
  EnhancedForeshadowingManager,
  foreshadowFromDict,
  foreshadowToDict,
  ForeshadowingManager,
  ForeshadowState,
  HighImportanceRule,
  NoHintRule,
  ReminderRuleEngine,
  SceneCountRule,
} from '../../narrative/foreshadowing';

function createGraphManagerMock() {
  const entities = new Map<string, Record<string, unknown>>();
  const relationships: Array<Record<string, unknown>> = [];

  return {
    getEntity: vi.fn((id: string) => entities.get(id) ?? null),
    createEntity: vi.fn((entity: Record<string, unknown>) => {
      entities.set(String(entity.id), entity);
      return entity;
    }),
    updateEntity: vi.fn((entity: Record<string, unknown>) => {
      entities.set(String(entity.id), entity);
      return entity;
    }),
    createRelationship: vi.fn((relationship: Record<string, unknown>) => {
      relationships.push(relationship);
      return relationship;
    }),
    findRelatedEntities: vi.fn(() => Array.from(entities.values())),
    getSubgraph: vi.fn(() => ({
      entities: Array.from(entities.values()),
      relationships,
    })),
    _entities: entities,
    _relationships: relationships,
  };
}

describe('ForeshadowingManager', () => {
  it('tracks plant -> hint -> harvest lifecycle and summary', () => {
    const manager = new ForeshadowingManager();

    const planted = manager.plant('watch clue payoff', 'scene-1', 8, ['identity']);
    const hinted = manager.hint(planted.id, 'scene-2', 'watch appears again');
    const harvested = manager.harvest(planted.id, 'scene-3');
    const summary = manager.getLifecycleSummary(planted.id);

    expect(planted.state).toBe(ForeshadowState.HARVESTED);
    expect(hinted?.state).toBe(ForeshadowState.HARVESTED);
    expect(harvested?.harvestedAt).toBe('scene-3');
    expect(summary?.current_state).toBe(ForeshadowState.HARVESTED);
    expect((summary?.lifecycle as Array<Record<string, unknown>>).map((item) => item.event)).toEqual([
      'planted',
      'hinted',
      'harvested',
    ]);
  });

  it('produces overdue reminders using registered scene order', () => {
    const manager = new ForeshadowingManager();
    const foreshadow = manager.plant('doorstep clue reveal', 'scene-1', 10);

    manager.registerScene('story-1', 'scene-1', 1);
    manager.registerScene('story-1', 'scene-12', 12);

    const reminders = manager.getOverdue(undefined, 'scene-12', 'story-1');

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.foreshadow.id).toBe(foreshadow.id);
    expect(reminders[0]?.urgency).toBe('critical');
  });

  it('supports serialization, grouping, stats, search, and deletion helpers', () => {
    const manager = new ForeshadowingManager();
    const planted = manager.plant('hidden seal clue', 'scene-12', 9, ['mystery', 'seal']);
    const hinted = manager.plant('letter clue', 'scene-2', 6, ['mystery', 'letter']);
    const harvested = manager.plant('harvested clue', 'scene-2', 4, ['resolved']);

    manager.hint(hinted.id, 'scene-5', 'repeat the letter image');
    manager.harvest(harvested.id, 'scene-9');

    const dict = foreshadowToDict(hinted);
    const roundTrip = foreshadowFromDict(dict);
    const fallback = foreshadowFromDict({ ...dict, state: 'unknown-state' });

    expect(roundTrip.hints[0]?.sceneId).toBe('scene-5');
    expect(fallback.state).toBe(ForeshadowState.PLANTED);

    const pending = manager.getPending();
    expect(pending.map((item) => item.id)).toEqual([planted.id, hinted.id]);

    const hintedAtScene = manager.getForeshadowsAtScene('scene-5');
    expect(hintedAtScene.hinted[0]?.id).toBe(hinted.id);

    const harvestedAtScene = manager.getForeshadowsAtScene('scene-9');
    expect(harvestedAtScene.harvested[0]?.id).toBe(harvested.id);

    const stats = manager.getStats() as Record<string, unknown>;
    expect(stats.total).toBe(3);
    expect((stats.by_state as Record<string, number>).harvested).toBe(1);
    expect(stats.total_hints).toBe(1);

    const searchResults = manager.search('clue', undefined, ['mystery'], 1);
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.id).toBe(planted.id);

    expect(manager.delete(hinted.id)).toBe(true);
    expect(manager.get(hinted.id)).toBeNull();
    expect(manager.delete('missing-id')).toBe(false);
  });

  it('uses reminder rules to flag scene-count, no-hint, importance, and chapter-boundary cases', () => {
    const planted = new ForeshadowingManager().plant(
      'critical setup',
      'scene-1',
      9,
      [],
      { planted_chapter: 1, current_chapter: 4 },
    );

    const sceneCountReminder = new SceneCountRule(0.5).evaluate(planted, 8, 1);
    const noHintReminder = new NoHintRule(5).evaluate(planted, 6, 1);
    const highImportanceReminder = new HighImportanceRule(8, 3).evaluate(planted, 7, 1);
    const chapterBoundaryReminder = new ChapterBoundaryRule(2).evaluate(planted, 7, 1);

    expect(sceneCountReminder?.urgency).toBe('critical');
    expect(noHintReminder?.urgency).toBe('medium');
    expect(highImportanceReminder?.urgency).toBe('high');
    expect(chapterBoundaryReminder?.urgency).toBe('high');
  });

  it('manages custom reminder rules and skips disabled rules', () => {
    const manager = new ForeshadowingManager();
    const foreshadow = manager.plant('custom rule clue', 'scene-1', 5);
    const engine = new ReminderRuleEngine();

    const customRule = {
      name: 'custom',
      description: 'custom reminder',
      priority: 20,
      enabled: true,
      evaluate: vi.fn(() => ({
        foreshadow,
        reason: 'custom',
        urgency: 'high',
        scenesSincePlant: 4,
        suggestion: 'custom suggestion',
      })),
    };

    engine.addRule(customRule);
    expect(engine.rules[0]?.name).toBe('custom');

    const reminders = engine.evaluate(foreshadow, 5, 1);
    expect(customRule.evaluate).toHaveBeenCalledWith(foreshadow, 5, 1);
    expect(reminders.some((item) => item.reason === 'custom')).toBe(true);

    customRule.enabled = false;
    expect(engine.evaluate(foreshadow, 5, 1).some((item) => item.reason === 'custom')).toBe(false);
    expect(engine.removeRule('custom')).toBe(true);
    expect(engine.removeRule('missing-rule')).toBe(false);
  });
});

describe('EnhancedForeshadowingManager', () => {
  it('applies reminder rules and prioritizes high urgency reminders', () => {
    const manager = new EnhancedForeshadowingManager();
    const high = manager.plant('high priority clue', 'scene-1', 9, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('normal clue', 'scene-2', 5, [], { planted_chapter: 1, current_chapter: 2 }, false);

    manager.registerScene('story-1', 'scene-1', 1);
    manager.registerScene('story-1', 'scene-2', 2);
    manager.registerScene('story-1', 'scene-8', 8);

    const reminders = manager.getRemindersWithRules('scene-8', 'story-1');

    expect(reminders.length).toBeGreaterThan(0);
    expect(reminders[0]?.foreshadow.id).toBe(high.id);
  });

  it('syncs foreshadows to graph and links related entities', () => {
    const graphManager = createGraphManagerMock();
    const manager = new EnhancedForeshadowingManager(graphManager as never);

    const foreshadow = manager.plant('mysterious letter motive', 'scene-1', 7);
    const entityId = `foreshadow_${foreshadow.id}`;

    expect(graphManager.createEntity).toHaveBeenCalled();
    expect(graphManager.getEntity(entityId)).toBeTruthy();

    const linked = manager.graphIntegration.linkForeshadowToEntity(foreshadow.id, 'character_linlan');
    const related = manager.graphIntegration.findRelatedForeshadows('character_linlan');

    expect(linked).toBe(true);
    expect(graphManager.createRelationship).toHaveBeenCalled();
    expect(related.some((item) => item.id === foreshadow.id)).toBe(true);
  });

  it('reports foreshadow health metrics and recommendations', () => {
    const manager = new EnhancedForeshadowingManager();
    const foreshadow = manager.plant('cracked wall symbol', 'scene-1', 8, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.registerScene('story-1', 'scene-1', 1);
    manager.registerScene('story-1', 'scene-6', 6);
    manager.hint(foreshadow.id, 'scene-3', 'the crack appears again', false);

    const health = manager.analyzeForeshadowHealth();

    expect(Number(health['health_score'])).toBeGreaterThanOrEqual(0);
    expect(Number(health['pending_count'])).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(health['recommendations'])).toBe(true);
  });

  it('handles graph integration fallback, updates, and network traversal helpers', () => {
    const graphManager = createGraphManagerMock();
    const manager = new EnhancedForeshadowingManager();
    const foreshadow = manager.plant('graph fallback clue', 'scene-1', 8, [], undefined, false);

    expect(manager.graphIntegration.syncForeshadowToGraph(foreshadow)).toBeNull();
    expect(manager.graphIntegration.linkForeshadowToEntity(foreshadow.id, 'entity-x')).toBe(false);
    expect(manager.graphIntegration.findRelatedForeshadows('entity-x')).toEqual([]);
    expect(manager.graphIntegration.getForeshadowNetwork(foreshadow.id)).toEqual({ error: 'GraphManager not set' });

    manager.setGraphManager(graphManager as never);
    const entityId = manager.graphIntegration.syncForeshadowToGraph(foreshadow);
    expect(entityId).toBe(`foreshadow_${foreshadow.id}`);
    expect(graphManager.createEntity).toHaveBeenCalledTimes(1);

    manager.hint(foreshadow.id, 'scene-2', 'graph update hint');
    expect(graphManager.updateEntity).toHaveBeenCalled();

    const network = manager.graphIntegration.getForeshadowNetwork(foreshadow.id) as Record<string, unknown>;
    expect(network.center).toBe(foreshadow.id);
    expect(Array.isArray(network.entities)).toBe(true);

    graphManager.getSubgraph.mockImplementationOnce(() => {
      throw new Error('subgraph failed');
    });
    const errored = manager.graphIntegration.getForeshadowNetwork(foreshadow.id) as Record<string, unknown>;
    expect(String(errored.error)).toContain('subgraph failed');
  });

  it('checks fair-play rules, asymmetry patterns, and harvest interval suggestions', () => {
    const manager = new EnhancedForeshadowingManager();
    const withHint = manager.plant('fair clue', 'scene-1', 8, [], { planted_chapter: 1, current_chapter: 1 }, false);
    const withoutHint = manager.plant('hidden twist', 'scene-3', 7, [], { planted_chapter: 1, current_chapter: 1 }, false);
    const pendingA = manager.plant('pending A', 'scene-5', 8, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('pending B', 'scene-6', 8, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('pending C', 'scene-7', 9, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('pending D', 'scene-8', 10, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('pending mid', 'scene-14', 5, [], { planted_chapter: 2, current_chapter: 4 }, false);

    manager.hint(withHint.id, 'scene-2', 'visible repeat', false);
    manager.harvest(withHint.id, 'scene-9', false);
    manager.harvest(withoutHint.id, 'scene-10', false);

    const fairPlay = manager.checkFairPlayRules();
    expect(fairPlay.harvestedWithClues).toBe(1);
    expect(fairPlay.harvestedWithoutClues).toBe(1);
    expect(fairPlay.violations.length).toBeGreaterThanOrEqual(2);
    expect(fairPlay.fairPlayScore).toBe(50);

    const asymmetry = manager.analyzeInformationAsymmetry([
      { chapterIndex: 1, content: '\u5176\u5B9E\u4ED6\u5DF2\u7ECF\u770B\u89C1\u4E86\u7B54\u6848' },
      { chapterIndex: 2, content: '\u4ED6\u51B3\u5B9A\u4E0D\u544A\u8BC9\u4EFB\u4F55\u4EBA\u8FD9\u4E2A\u79D8\u5BC6' },
    ]);
    expect(asymmetry.readerAheadCount).toBe(1);
    expect(asymmetry.characterAheadCount).toBe(2);
    expect(asymmetry.timeline).toHaveLength(3);

    const noAsymmetry = manager.analyzeInformationAsymmetry([
      { chapterIndex: 3, content: 'plain chapter without flagged patterns' },
    ]);
    expect(noAsymmetry.suggestions.length).toBeGreaterThan(0);

    const suggestions = manager.suggestHarvestIntervals(25);
    expect(suggestions[0]?.foreshadowId).toBe(pendingA.id);
    expect(suggestions[0]?.urgency).toBe('overdue');
    expect(suggestions.some((item) => item.urgency === 'medium')).toBe(true);
  });
});

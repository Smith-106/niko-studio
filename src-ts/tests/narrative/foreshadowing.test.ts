import { describe, expect, it, vi } from 'vitest';

import {
  EnhancedForeshadowingManager,
  ForeshadowState,
  ForeshadowGraphIntegration,
  ForeshadowingManager,
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
    _entities: entities,
    _relationships: relationships,
  };
}

describe('ForeshadowingManager', () => {
  it('tracks plant -> hint -> harvest lifecycle and summary', () => {
    const manager = new ForeshadowingManager();

    const planted = manager.plant('旧怀表会在后文揭示身份', 'scene-1', 8, ['identity']);
    const hinted = manager.hint(planted.id, 'scene-2', '怀表再次出现');
    const harvested = manager.harvest(planted.id, 'scene-3');
    const summary = manager.getLifecycleSummary(planted.id);

    expect(planted.state).toBe(ForeshadowState.HARVESTED);
    expect(hinted?.state).toBe(ForeshadowState.HARVESTED);
    expect(harvested?.harvestedAt).toBe('scene-3');
    expect(summary?.current_state).toBe(ForeshadowState.HARVESTED);
    expect((summary?.lifecycle as Array<Record<string, unknown>>).map(item => item.event)).toEqual([
      'planted',
      'hinted',
      'harvested',
    ]);
  });

  it('produces overdue reminders using registered scene order', () => {
    const manager = new ForeshadowingManager();
    const foreshadow = manager.plant('门后的脚步声将揭示真凶', 'scene-1', 10);

    manager.registerScene('story-1', 'scene-1', 1);
    manager.registerScene('story-1', 'scene-12', 12);

    const reminders = manager.getOverdue(undefined, 'scene-12', 'story-1');

    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.foreshadow.id).toBe(foreshadow.id);
    expect(reminders[0]?.urgency).toBe('critical');
  });
});

describe('EnhancedForeshadowingManager', () => {
  it('applies reminder rules and prioritizes high urgency reminders', () => {
    const manager = new EnhancedForeshadowingManager();
    const high = manager.plant('高优先级伏笔', 'scene-1', 9, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.plant('普通伏笔', 'scene-2', 5, [], { planted_chapter: 1, current_chapter: 2 }, false);

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

    const foreshadow = manager.plant('陌生来信将在后文解释动机', 'scene-1', 7);
    const entityId = `foreshadow_${foreshadow.id}`;

    expect(graphManager.createEntity).toHaveBeenCalled();
    expect(graphManager.getEntity(entityId)).toBeTruthy();

    const linked = manager.graphIntegration.linkForeshadowToEntity(foreshadow.id, 'character_linlan');
    const related = manager.graphIntegration.findRelatedForeshadows('character_linlan');

    expect(linked).toBe(true);
    expect(graphManager.createRelationship).toHaveBeenCalled();
    expect(related.some(item => item.id === foreshadow.id)).toBe(true);
  });

  it('reports foreshadow health metrics and recommendations', () => {
    const manager = new EnhancedForeshadowingManager();
    const foreshadow = manager.plant('墙上的裂缝象征关系破裂', 'scene-1', 8, [], { planted_chapter: 1, current_chapter: 4 }, false);
    manager.registerScene('story-1', 'scene-1', 1);
    manager.registerScene('story-1', 'scene-6', 6);
    manager.hint(foreshadow.id, 'scene-3', '裂缝再次出现', false);

    const health = manager.analyzeForeshadowHealth();

    expect(Number(health['health_score'])).toBeGreaterThanOrEqual(0);
    expect(Number(health['pending_count'])).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(health['recommendations'])).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import {
  EnhancedForeshadowingManager,
  ForeshadowingManager,
  ForeshadowState,
} from '../../narrative/foreshadowing';

describe('Foreshadowing tail branch coverage', () => {
  it('covers unordered retrieval and state-filtered search branches', () => {
    const manager = new ForeshadowingManager();
    const first = manager.plant('needle first', 'scene-1', 3, ['blue']);
    const second = manager.plant('needle second', 'scene-2', 9, ['red']);
    first.plantedTime = '2026-01-01T00:00:00.000Z';
    second.plantedTime = '2026-01-02T00:00:00.000Z';

    manager.hint(second.id, 'scene-3', 'state changes to hinted');

    expect(manager.getAll().map((item) => item.id)).toEqual([first.id, second.id]);
    expect(manager.search('needle', ForeshadowState.HINTED).map((item) => item.id)).toEqual([second.id]);
  });

  it('covers medium and low urgency reminder suggestion branches', () => {
    const manager = new ForeshadowingManager();
    const planted = manager.plant('medium planted clue', 'scene-1', 5);
    const hinted = manager.plant('medium hinted clue', 'scene-1', 5);
    manager.hint(hinted.id, 'scene-2', 'small hint');

    manager.registerScene('story', 'scene-1', 1);
    manager.registerScene('story', 'scene-11', 11);

    const reminders = manager.getOverdue(10, 'scene-11', 'story');
    const plantedReminder = reminders.find((item) => item.foreshadow.id === planted.id);
    const hintedReminder = reminders.find((item) => item.foreshadow.id === hinted.id);

    expect(plantedReminder?.urgency).toBe('medium');
    expect(plantedReminder?.suggestion).toContain('\u8003\u8651');
    expect(hintedReminder?.urgency).toBe('medium');
    expect(hintedReminder?.suggestion).toContain('\u9ad8\u6f6e');

    const helper = manager as unknown as {
      calculateUrgency(scenesSince: number, maxScenes: number): string;
    };
    expect(helper.calculateUrgency(1, 10)).toBe('low');
  });

  it('covers empty fair-play and high/low harvest interval branches', () => {
    const manager = new EnhancedForeshadowingManager();
    expect(manager.checkFairPlayRules()).toMatchObject({
      fairPlayScore: 100,
      harvestedWithClues: 0,
      harvestedWithoutClues: 0,
    });

    const high = manager.plant('almost due high clue', 'scene-3', 8, [], undefined, false);
    const low = manager.plant('fresh low clue', 'scene-10', 4, [], undefined, false);

    const intervals = manager.suggestHarvestIntervals(11);
    const highInterval = intervals.find((item) => item.foreshadowId === high.id);
    const lowInterval = intervals.find((item) => item.foreshadowId === low.id);

    expect(highInterval).toMatchObject({
      urgency: 'high',
      elapsedScenes: 8,
      maxRecommendedScenes: 10,
    });
    expect(highInterval?.suggestion).toContain('\u63a5\u8fd1');
    expect(lowInterval).toMatchObject({
      urgency: 'low',
      elapsedScenes: 1,
      maxRecommendedScenes: 30,
    });
  });
});

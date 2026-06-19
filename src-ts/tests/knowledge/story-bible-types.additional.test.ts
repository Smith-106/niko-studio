import { describe, expect, it } from 'vitest';

import {
  CharacterArchetype,
  PlotThreadStatus,
  TimelineEventType,
  WorldRuleCategory,
  createCharacterProfile,
  createPlotThread,
  createTimelineEvent,
  createWorldRule,
  getEntityType,
} from '../../knowledge/entities/story-bible-types.js';

describe('knowledge/entities/story-bible-types additional coverage', () => {
  it('returns the discriminated entity type for each story-bible entity factory', () => {
    const character = createCharacterProfile({
      name: 'Lin',
      archetype: CharacterArchetype.PROTAGONIST,
    });
    const worldRule = createWorldRule({
      name: 'No steel after sunset',
      category: WorldRuleCategory.CULTURAL,
    });
    const plotThread = createPlotThread({
      name: 'Recover the ledger',
      status: PlotThreadStatus.DEVELOPING,
    });
    const timelineEvent = createTimelineEvent({
      name: 'Bridge collapse',
      eventType: TimelineEventType.INCIDENT,
    });

    expect(getEntityType(character)).toBe('character');
    expect(getEntityType(worldRule)).toBe('world-rule');
    expect(getEntityType(plotThread)).toBe('plot-thread');
    expect(getEntityType(timelineEvent)).toBe('timeline-event');
  });
});

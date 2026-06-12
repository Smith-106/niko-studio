import { describe, expect, it } from 'vitest';

import { DimensionType } from '../../memory/six-dimensional-memory';
import { DimensionalMemoryMapper } from '../../services/mappers/dimensional-memory-mapper';

describe('services/mappers/dimensional-memory-mapper additional coverage', () => {
  it('adds entity and chapter labels for timeline memories', () => {
    const mapper = new DimensionalMemoryMapper();

    expect(
      mapper.toNowledge({
        dimension: DimensionType.TIMELINE,
        content: 'The battle ends at dawn.',
        entityId: 'hero-1',
        chapter: 12,
      }),
    ).toEqual({
      content: 'The battle ends at dawn.',
      unitType: 'event',
      labels: ['dimension:timeline', 'char:hero-1', 'chapter:12'],
      importance: undefined,
      temporalContext: 'past',
      eventStart: undefined,
      eventEnd: undefined,
    });
  });

  it('falls back to unitType mapping and then context when no dimension label is present', () => {
    const mapper = new DimensionalMemoryMapper();

    expect(
      mapper.fromNowledge({
        unitType: 'event',
        labels: ['chapter:12'],
      }),
    ).toBe(DimensionType.TIMELINE);

    expect(
      mapper.fromNowledge({
        unitType: 'unknown',
        labels: [],
      }),
    ).toBe(DimensionType.CONTEXT);
  });
});

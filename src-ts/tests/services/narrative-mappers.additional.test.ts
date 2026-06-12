import { describe, expect, it } from 'vitest';

import { EntityType } from '../../graph/graph-manager.js';
import {
  NarrativeEntityMapper,
} from '../../services/mappers/narrative-entity-mapper.js';
import {
  NarrativeRelationMapper,
  NarrativeRelationType,
} from '../../services/mappers/narrative-relation-mapper.js';

describe('services/mappers additional coverage', () => {
  it('maps narrative entities to nowledge entities with metadata and foreshadow labels', () => {
    const mapper = new NarrativeEntityMapper();

    const mapped = mapper.toNowledge({
      type: EntityType.CONCEPT,
      name: 'Broken Seal',
      description: 'An omen tied to the city gate.',
      aliases: ['Seal'],
      role: 'symbol',
      firstAppearance: 3,
      foreshadowMaxDistance: 5,
      reminderThreshold: 2,
    });

    expect(mapped).toEqual({
      id: '',
      entity_type: 'concept',
      name: 'Broken Seal',
      description: 'An omen tied to the city gate.',
      aliases: ['Seal'],
      metadata: {
        role: 'symbol',
        first_chapter: 3,
        foreshadow_max_distance: 5,
        reminder_threshold: 2,
        labels: ['foreshadow', 'narrative-device'],
      },
    });
  });

  it('defaults aliases to an empty array and falls back to concept on unknown reverse mappings', () => {
    const mapper = new NarrativeEntityMapper();

    expect(mapper.toNowledge({
      type: EntityType.LOCATION,
      name: 'Old Dock',
      description: 'Fog-bound harbor.',
    }).aliases).toEqual([]);

    expect(mapper.fromNowledge({
      id: 'entity-1',
      entity_type: 'mystery-type',
      name: 'Unknown',
      description: 'Unknown',
      aliases: [],
      metadata: { source: 'fallback' },
    })).toEqual({
      type: EntityType.CONCEPT,
      metadata: { source: 'fallback' },
    });
  });

  it('maps narrative relations to nowledge relations and preserves unknown relation types', () => {
    const mapper = new NarrativeRelationMapper();

    expect(mapper.toNowledge(NarrativeRelationType.FORESHADOWS)).toEqual({
      type: 'EVOLVES',
      evolvesKind: 'Enriches',
      strength: 0.5,
      metadata: {
        narrative_type: 'foreshadows',
      },
    });

    expect(mapper.toNowledge(NarrativeRelationType.OPPOSES, 0.9)).toEqual({
      type: 'EVOLVES',
      evolvesKind: 'Challenges',
      strength: 0.9,
      metadata: {
        narrative_type: 'opposes',
      },
    });

    expect(mapper.toNowledge(NarrativeRelationType.RESOLVES)).toEqual({
      type: 'EVOLVES',
      evolvesKind: 'Confirms',
      strength: 0.5,
      metadata: {
        narrative_type: 'resolves',
      },
    });

    expect(mapper.toNowledge('ALLY_OF', 0.3)).toEqual({
      type: 'RELATED',
      metadata: {
        narrative_type: 'ALLY_OF',
      },
    });
  });

  it('maps nowledge relations back through evolvesKind, metadata, and fallback relation types', () => {
    const mapper = new NarrativeRelationMapper();

    expect(mapper.fromNowledge({
      type: 'EVOLVES',
      evolvesKind: 'Confirms',
    })).toBe(NarrativeRelationType.RESOLVES);

    expect(mapper.fromNowledge({
      type: 'RELATED',
      metadata: {
        narrative_type: 'foreshadows',
      },
    })).toBe(NarrativeRelationType.FORESHADOWS);

    expect(mapper.fromNowledge({
      type: 'PART_OF',
    })).toBe(NarrativeRelationType.LOCATED_IN);

    expect(mapper.fromNowledge({
      type: 'UNKNOWN',
    })).toBe(NarrativeRelationType.RELATED_TO);
  });
});

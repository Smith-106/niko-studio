import { describe, expect, it, vi } from 'vitest';

import {
  createNarrativePatternDetector,
  NarrativePatternDetector,
  type NarrativeStoreProvider,
} from '../../analysis/narrative-pattern-detector.js';

describe('analysis/narrative-pattern-detector', () => {
  it('returns an empty result when the store has no narrative entities', async () => {
    const store: NarrativeStoreProvider = {
      getEntitiesByTypes: vi.fn().mockResolvedValue([]),
    };

    const detector = createNarrativePatternDetector(store);

    await expect(detector.detectAll()).resolves.toEqual([]);
    await expect(detector.detectByCategory('structure')).resolves.toEqual([]);
    expect(store.getEntitiesByTypes).toHaveBeenCalledWith([
      'Scene',
      'Chapter',
      'Event',
    ]);
  });

  it('detects recurring structure patterns and keeps the strongest cluster', async () => {
    const store: NarrativeStoreProvider = {
      getEntitiesByTypes: vi.fn().mockResolvedValue([
        {
          id: 'scene-1',
          name: 'Setup Plant',
          observations: [
            'A foreshadow plant points toward a later payoff and harvest.',
          ],
        },
        {
          id: 'scene-2',
          name: 'Bridge Echo',
          observations: [
            'Another foreshadow plant reinforces the payoff and harvest.',
          ],
        },
        {
          id: 'scene-3',
          name: 'Final Harvest',
          observations: [
            'The foreshadow plant resolves into payoff and harvest.',
          ],
        },
        {
          id: 'scene-4',
          name: 'Mirror Pair',
          observations: ['A foil mirror contrast appears but never repeats.'],
        },
      ]),
    };

    const detector = new NarrativePatternDetector(store);
    const patterns = await detector.detectAll();
    const structurePatterns = await detector.detectByCategory('structure');

    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]).toMatchObject({
      name: 'foreshadow-payoff',
      category: 'structure',
      occurrences: expect.arrayContaining([
        expect.objectContaining({ entityId: 'scene-1' }),
        expect.objectContaining({ entityId: 'scene-2' }),
        expect.objectContaining({ entityId: 'scene-3' }),
      ]),
    });
    expect(patterns[0]!.confidence).toBeGreaterThan(0.7);
    expect(patterns[0]!.avgSimilarity).toBeGreaterThan(0.7);
    expect(structurePatterns.every((pattern) => pattern.category === 'structure')).toBe(
      true,
    );
  });

  it('drops candidates when the similarity threshold prevents clustering', async () => {
    const store: NarrativeStoreProvider = {
      getEntitiesByTypes: vi.fn().mockResolvedValue([
        {
          id: 'scene-1',
          name: 'Setup Plant',
          observations: ['foreshadow plant payoff harvest'],
        },
        {
          id: 'scene-2',
          name: 'Bridge Echo',
          observations: ['foreshadow plant payoff harvest'],
        },
        {
          id: 'scene-3',
          name: 'Final Harvest',
          observations: ['foreshadow plant payoff harvest'],
        },
      ]),
    };

    const detector = createNarrativePatternDetector(store, {
      similarityThreshold: 1.1,
    });

    await expect(detector.detectAll()).resolves.toEqual([]);
  });
});

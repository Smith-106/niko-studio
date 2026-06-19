import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContradictionType,
  SceneCoherenceDetector,
  SceneSeverity,
} from '../../narrative/scene-coherence';

function createSnapshot(
  sceneId: string,
  entityId: string,
  entityType: 'character' | 'object',
  entityName: string,
  properties: Record<string, unknown>,
) {
  return {
    sceneId,
    entityId,
    entityType,
    entityName,
    properties,
    timestamp: '2026-06-08T00:00:00.000Z',
  };
}

describe('SceneCoherenceDetector whitebox additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers default scene metadata and missing-scene validator branches', () => {
    const detector = new SceneCoherenceDetector();

    const defaultsOnly = detector.createScene('scene-1', 'Defaults', 'Body', 1, {}, {});
    expect(defaultsOnly.timeMarker).toMatchObject({
      relativeTime: null,
      timeOfDay: null,
      duration: null,
    });
    expect(defaultsOnly.locationMarker).toMatchObject({
      locationName: '',
      locationType: '',
      parentLocation: '',
      travelTimeFromPrev: null,
    });

    detector.createScene(
      'scene-2',
      'Known',
      'Known scene',
      2,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
      ['char-lin'],
    );

    detector.recordState('scene-2', 'char-lin', 'character', 'Lin', {
      status: 'alive',
    });
    detector.recordState('missing-scene', 'char-lin', 'character', 'Lin', {
      status: 'alive',
    });
    detector.recordState('scene-2', 'obj-key', 'object', 'Key', {
      owner: 'Lin',
    });
    detector.recordState('missing-scene', 'obj-key', 'object', 'Key', {
      owner: 'Lin',
    });

    (detector as any).stateRegistry.set('single-snapshot', [
      createSnapshot('missing-only', 'single-snapshot', 'character', 'Solo', {
        status: 'alive',
      }),
    ]);

    expect(detector.detectStateContradictions()).toEqual([]);
    expect(detector.validateCharacterPresence('char-lin')).toEqual([]);
    expect(detector.validateCharacterPresence('missing-char')).toEqual([]);
    expect(detector.validateObjectTracking('obj-key')).toEqual([]);
    expect(detector.validateObjectTracking('missing-obj')).toEqual([]);
  });

  it('covers causality no-entity skips and llm deepAnalysis default scene selection', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({ ok: true }),
    };
    const detector = new SceneCoherenceDetector(llmClient as never);

    detector.createScene('scene-2', 'Second', 'No named person returns here.', 2);
    detector.createScene('scene-1', 'First', 'A死亡了，但这里没有可识别的人名。', 1);

    expect(detector.detectCausalityContradictions()).toEqual([]);

    const result = await detector.deepAnalysis();
    expect(result).toEqual({ ok: true });
    expect(llmClient.generateJson).toHaveBeenCalledWith(
      expect.stringContaining('场景1: First'),
    );
  });

  it('covers helper fallbacks for durations, summaries, unknown periods, and empty quality dimensions', () => {
    const detector = new SceneCoherenceDetector();

    expect((detector as any).isValidTimeProgression('sunrise-ish', 'morning')).toBe(true);
    expect((detector as any).isTravelTimeInsufficient('unknown', '2 hours')).toBe(false);
    expect((detector as any).parseDurationToMinutes(undefined)).toBeNull();
    expect((detector as any).parseDurationToMinutes('1 day')).toBe(1440);
    expect((detector as any).parseDurationToMinutes('parsecs only')).toBeNull();

    const prevScene = detector.createScene('scene-prev', 'Prev', 'Body', 1);
    const currScene = detector.createScene('scene-curr', 'Curr', 'Body', 2);
    const periodSpy = vi.spyOn(detector as any, 'extractTimePeriod');
    periodSpy.mockReturnValueOnce('mystery').mockReturnValueOnce('morning');
    expect((detector as any).checkContentTimeContradiction(prevScene, currScene)).toBeNull();
    periodSpy.mockRestore();

    expect(
      (detector as any).checkStateTransition(
        createSnapshot('scene-1', 'char-lin', 'character', 'Lin', {
          status: 'dead',
        }),
        createSnapshot('scene-2', 'char-lin', 'character', 'Lin', {}),
      ),
    ).toMatchObject({
      type: ContradictionType.CHARACTER_STATE,
      severity: SceneSeverity.CRITICAL,
      actualValue: 'unknown',
    });

    expect((detector as any).getEntityContext('no matching entity here', 'Lin')).toBe('');
    expect(
      (detector as any).generateSummary(
        [{ severity: SceneSeverity.MAJOR }] as Array<{ severity: SceneSeverity }>,
        76.5,
      ),
    ).toContain('主要矛盾');

    const originalMap = Array.prototype.map;
    const mapSpy = vi.spyOn(Array.prototype, 'map').mockImplementation(function mockMap(
      callback: Parameters<typeof originalMap>[0],
      thisArg?: Parameters<typeof originalMap>[1],
    ) {
      const values = this as unknown[];
      if (
        values.length === 5 &&
        typeof values[0] === 'object' &&
        values[0] !== null &&
        'dimension' in (values[0] as Record<string, unknown>)
      ) {
        return [];
      }
      return originalMap.call(values, callback, thisArg);
    });

    const quality = detector.assessSceneQuality([{ content: 'stillness only', sceneIndex: 1 }]);
    expect(quality.dimensions).toEqual([]);
    expect(quality.overallScore).toBe(0);

    mapSpy.mockRestore();
  });
});

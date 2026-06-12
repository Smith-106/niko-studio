import { afterEach, describe, expect, it, vi } from 'vitest';

import { SceneCoherenceDetector } from '../../narrative/scene-coherence';

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
    timestamp: '2026-06-10T00:00:00.000Z',
  };
}

describe('SceneCoherenceDetector sort fallback branch coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses fallback ordering when state contradiction scenes are missing', () => {
    const detector = new SceneCoherenceDetector();

    (detector as any).stateRegistry.set('ghost-entity', [
      createSnapshot('missing-b', 'ghost-entity', 'character', 'Ghost', { status: 'alive' }),
      createSnapshot('missing-a', 'ghost-entity', 'character', 'Ghost', { status: 'alive' }),
    ]);
    (detector as any).scenes.get = vi.fn(() => undefined);

    expect(detector.detectStateContradictions()).toEqual([]);
  });

  it('uses fallback ordering when validating character presence without registered scenes', () => {
    const detector = new SceneCoherenceDetector();

    detector.recordState('missing-b', 'char-ghost', 'character', 'Ghost', { status: 'alive' });
    detector.recordState('missing-a', 'char-ghost', 'character', 'Ghost', { status: 'alive' });
    (detector as any).scenes.get = vi.fn(() => undefined);

    expect(detector.validateCharacterPresence('char-ghost')).toEqual([]);
  });

  it('uses fallback ordering when validating object tracking without registered scenes', () => {
    const detector = new SceneCoherenceDetector();

    detector.recordState('missing-b', 'obj-ghost', 'object', 'Ghost Key', { owner: 'Lin' });
    detector.recordState('missing-a', 'obj-ghost', 'object', 'Ghost Key', { owner: 'Qiao' });
    (detector as any).scenes.get = vi.fn(() => undefined);

    expect(detector.validateObjectTracking('obj-ghost')).toEqual([]);
  });

  it('returns true when normalized time labels map to an unknown index', () => {
    const detector = new SceneCoherenceDetector();
    const normalizeSpy = vi.spyOn(detector as any, 'normalizeTimeOfDay');
    normalizeSpy.mockReturnValueOnce('morning').mockReturnValueOnce('mystery');

    expect((detector as any).isValidTimeProgression('prev', 'curr')).toBe(true);
  });

  it('treats unknown current periods as non-contradictory in content checks', () => {
    const detector = new SceneCoherenceDetector();
    const prevScene = detector.createScene('scene-prev', 'Prev', 'Morning scene', 1);
    const currScene = detector.createScene('scene-curr', 'Curr', 'Odd follow-up scene', 2);
    const extractSpy = vi.spyOn(detector as any, 'extractTimePeriod');
    extractSpy.mockReturnValueOnce('morning').mockReturnValueOnce('mystery');

    expect((detector as any).checkContentTimeContradiction(prevScene, currScene)).toBeNull();
  });

  it('falls through to null when no location interval fallback is available', () => {
    const detector = new SceneCoherenceDetector();

    detector.createScene(
      'scene-1',
      'Archive',
      'The search starts in the archive.',
      1,
      { timeOfDay: 'morning' },
      { name: 'Archive', type: 'room' },
    );
    detector.createScene(
      'scene-2',
      'Harbor',
      'They arrive at the harbor without any explicit travel interval.',
      2,
      { timeOfDay: 'morning' },
      { name: 'Harbor', type: 'dock' },
    );
    detector.setTravelTime('Archive', 'Harbor', '2 hours');

    expect(detector.detectLocationContradictions()).toEqual([]);
  });

  it('returns mock deep analysis output when no llm client is configured', async () => {
    const detector = new SceneCoherenceDetector();

    await expect(detector.deepAnalysis()).resolves.toMatchObject({
      contradictions_found: 2,
      suggestions: expect.any(Array),
    });
  });
});

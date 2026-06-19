import { describe, expect, it } from 'vitest';

import { SceneCoherenceDetector } from '../../narrative/scene-coherence';

describe('SceneCoherenceDetector more additional coverage', () => {
  it('returns null when no nearby entity match can be extracted', () => {
    const detector = new SceneCoherenceDetector();

    const entity = (detector as any).extractEntityNearMatch(
      'plain background text without nearby entity markers',
      4,
    );

    expect(entity).toBeNull();
  });

  it('assesses low-quality scenes and emits dimension-level suggestions', () => {
    const detector = new SceneCoherenceDetector();

    const result = detector.assessSceneQuality([
      {
        sceneIndex: 1,
        content: '平静。无事。正常。',
      },
    ]);

    expect(result.overallScore).toBe(0);
    expect(result.dimensions).toHaveLength(5);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.dimensions.every((item) => item.score === 0)).toBe(true);
  });

  it('assesses high-quality scenes and emits the high-score summary suggestion', () => {
    const detector = new SceneCoherenceDetector();

    const result = detector.assessSceneQuality([
      {
        sceneIndex: 1,
        content: [
          '她看到火光，听到脚步，闻到焦味，感觉寒意，触摸到冰冷的栏杆。',
          '对抗、冲突、争论、危机、紧张同时爆发。',
          '突然改变，发现真相，意识到危险，震惊于意外转折，不同于之前，也不再沉默。',
          '与此同时，之后，回到旧楼，镜头一转，转场来到楼顶。',
          '他说道之后站起来，转身，抓住对方，随后喊道。',
        ].join(''),
      },
    ]);

    expect(result.overallScore).toBeGreaterThanOrEqual(7);
    expect(result.suggestions).toHaveLength(1);
    expect(result.dimensions.every((item) => item.score >= 6)).toBe(true);
  });

  it('returns null for unknown time-of-day labels and non-contradictory state transitions', () => {
    const detector = new SceneCoherenceDetector();

    expect((detector as any).normalizeTimeOfDay('sunrise-ish ???')).toBeNull();
    expect(
      (detector as any).checkStateTransition(
        {
          sceneId: 'scene-1',
          entityId: 'obj-door',
          entityType: 'object',
          entityName: 'Door',
          properties: { destroyed: false },
          timestamp: '2026-06-06T00:00:00.000Z',
        },
        {
          sceneId: 'scene-2',
          entityId: 'obj-door',
          entityType: 'object',
          entityName: 'Door',
          properties: { exists: true },
          timestamp: '2026-06-06T00:05:00.000Z',
        },
      ),
    ).toBeNull();
  });
});

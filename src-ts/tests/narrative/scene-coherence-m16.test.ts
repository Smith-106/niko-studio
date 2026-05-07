import { describe, expect, it } from 'vitest';

import { SceneCoherenceDetector } from '../../narrative/scene-coherence';

describe('SceneCoherenceDetector — M16 scene quality', () => {
  const detector = new SceneCoherenceDetector();

  describe('assessSceneQuality()', () => {
    it('scores 5 dimensions', () => {
      const scenes = [
        { content: '她感觉到冰冷的刀锋贴着脖颈，闻到了刺鼻的血腥味。突然发现了真相。', sceneIndex: 0 },
      ];
      const result = detector.assessSceneQuality(scenes);

      expect(result.dimensions).toHaveLength(5);
      expect(typeof result.overallScore).toBe('number');
    });

    it('scores high for immersive scenes with conflict', () => {
      const scenes = [
        {
          content: '她感觉到冰冷的地面，闻到刺鼻的烟味。对抗升级，冲突爆发。'
            + '突然意识到一个致命的矛盾。他说道，转身抓住对方的手。',
          sceneIndex: 0,
        },
      ];
      const result = detector.assessSceneQuality(scenes);
      expect(result.overallScore).toBeGreaterThan(3);
    });

    it('scores low for flat scenes', () => {
      const scenes = [
        { content: '一切正常，平静无事。', sceneIndex: 0 },
      ];
      const result = detector.assessSceneQuality(scenes);
      expect(result.overallScore).toBeLessThan(5);
    });

    it('generates suggestions for weak dimensions', () => {
      const scenes = [{ content: '他走了。', sceneIndex: 0 }];
      const result = detector.assessSceneQuality(scenes);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});

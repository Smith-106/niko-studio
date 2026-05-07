import { describe, expect, it } from 'vitest';

import { DescriptionQualityDimension, assessDescriptionQuality } from '../../narrative/writing-craft/emotion-craft';

describe('EmotionCraft — M15 description quality', () => {
  describe('DescriptionQualityDimension enum', () => {
    it('has exactly 5 entries', () => {
      expect(Object.values(DescriptionQualityDimension)).toHaveLength(5);
    });
  });

  describe('assessDescriptionQuality()', () => {
    it('scores rich sensory description highly', () => {
      const text = '冰凉的雨滴打在粗糙的墙面上，刺鼻的泥腥味弥漫在空气中。'
        + '她攥紧拳头，转身奔向出口。阴沉的天空压抑得让人喘不过气。'
        + '树叶在风中摇曳，灯火闪烁不定。';

      const result = assessDescriptionQuality(text);

      expect(result.dimensions).toHaveLength(5);
      expect(result.overallScore).toBeGreaterThan(3);
    });

    it('gives low score for plain text', () => {
      const text = '他走进了房间。';
      const result = assessDescriptionQuality(text);

      expect(result.overallScore).toBeLessThan(3);
    });

    it('detects sensory detail dimension', () => {
      const text = '冰凉的触感，刺鼻的气味，刺耳的声音，温暖的手掌';
      const result = assessDescriptionQuality(text);

      const sensory = result.dimensions.find(
        (d) => d.dimension === DescriptionQualityDimension.SENSORY_DETAIL,
      );
      expect(sensory?.score).toBeGreaterThan(0);
      expect(sensory?.evidence.length).toBeGreaterThan(0);
    });

    it('detects showing action dimension', () => {
      const text = '她攥紧拳头，转身推开大门，跳起抓住了绳索';
      const result = assessDescriptionQuality(text);

      const action = result.dimensions.find(
        (d) => d.dimension === DescriptionQualityDimension.SHOWING_ACTION,
      );
      expect(action?.score).toBeGreaterThan(0);
    });

    it('generates suggestions for weak dimensions', () => {
      const text = '他走了。';
      const result = assessDescriptionQuality(text);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});

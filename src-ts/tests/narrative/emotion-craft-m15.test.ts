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
    it('adds the high-quality suggestion for multi-dimensional vivid description', () => {
      const text = '冰凉的雨滴落在粗糙的青石台阶上，刺鼻的草木腥味混着潮湿泥土扑面而来。'
        + '那把裂了口的铜灯在这个阴沉、压抑而又明亮得诡异的长廊里闪烁摇曳。'
        + '她正好在第三道门前停住，分明看见某个影子一模一样地贴在墙上，精确得像刻出来的一样。'
        + '她攥紧手中的纸条，转身推开半掩的木门，蹲下身抓住湿滑的栏杆，随即跳起奔向尽头。'
        + '风声翻滚，尘灰流淌，墙上的影子旋转、蔓延又收缩。';
      const result = assessDescriptionQuality(text);

      expect(result.overallScore).toBeGreaterThanOrEqual(7);
      expect(result.suggestions).toContain('描写质量较高，多维度描写充分');
    });
  });
});

import { describe, expect, it } from 'vitest';

import { CharacterDepthSystem } from '../../narrative/character-depth';

describe('CharacterDepthSystem — M15', () => {
  const system = new CharacterDepthSystem();

  describe('assessCharacterCreation()', () => {
    it('scores rich character with multiple dimensions', () => {
      const content = '他有一个独特的标志性的习惯。内心充满矛盾和两难。'
        + '经历了深刻的成长和蜕变。与亦敌亦友的人有着复杂关系。'
        + '在灰色地带中挣扎，有缺陷但不失善良。';

      const result = system.assessCharacterCreation({}, content);

      expect(result.dimensions).toHaveLength(6);
      expect(result.overallScore).toBeGreaterThan(3);
      for (const dim of result.dimensions) {
        expect(dim.dimension).toBeTruthy();
        expect(typeof dim.score).toBe('number');
      }
    });

    it('gives low score for flat character', () => {
      const content = '他是一个普通人。';
      const result = system.assessCharacterCreation({}, content);

      expect(result.overallScore).toBeLessThan(5);
    });

    it('generates suggestions for weak dimensions', () => {
      const content = '他是一个普通人。';
      const result = system.assessCharacterCreation({}, content);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('evaluatePlotCharacterBalance()', () => {
    it('returns balanced result for equal plot and character', () => {
      const result = system.evaluatePlotCharacterBalance(
        ['冲突', '高潮', '反转'],
        ['成长', '蜕变', '挣扎'],
      );

      expect(result.balanceScore).toBeGreaterThanOrEqual(7);
      expect(result.recommendation).toContain('平衡');
    });

    it('identifies plot-heavy imbalance', () => {
      const result = system.evaluatePlotCharacterBalance(
        ['冲突', '高潮', '反转', '战斗', '升级', '危机'],
        ['挣扎'],
      );

      expect(result.plotDensity).toBeGreaterThan(result.characterDepth);
      expect(result.recommendation).toContain('角色');
    });

    it('identifies character-heavy imbalance', () => {
      const result = system.evaluatePlotCharacterBalance(
        ['冲突'],
        ['成长', '蜕变', '挣扎', '矛盾', '恐惧', '渴望'],
      );

      expect(result.characterDepth).toBeGreaterThan(result.plotDensity);
      expect(result.recommendation).toContain('情节');
    });
  });
});

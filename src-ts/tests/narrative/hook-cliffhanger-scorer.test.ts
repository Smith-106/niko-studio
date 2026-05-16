import { describe, expect, it } from 'vitest';
import {
  HookDimension,
  CliffhangerDimension,
  scoreHook,
  scoreCliffhanger,
  analyzeHookCliffhanger,
} from '../../narrative/writing-craft/hook-cliffhanger-scorer';

const HOOK_TEXT = '突然，一道黑影从黑暗中冲出。就在这时，林岚感觉到一股诡异的杀意。然而，她并不知道，真正的危险才刚刚开始。她紧握着武器，盯着前方的敌人，心里充满了疑惑和不解。';
const CLIFFHANGER_TEXT = '林岚颤抖着看着眼前的一切，不敢相信这竟然是真的。真相竟然出人意料，原来这一切都是一个精心设计的阴谋。然而更大的危机即将来临，故事才刚刚开始……她不知道接下来还会发生什么。';
const PLAIN_TEXT = '今天天气不错，出门散了步。';

describe('Hook & Cliffhanger Scorer', () => {
  describe('scoreHook', () => {
    it('scores hook dimensions for rich opening text', () => {
      const result = scoreHook(HOOK_TEXT);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.dimensions[HookDimension.CONFLICT_HINT]).toBeGreaterThan(0);
      expect(result.dimensions[HookDimension.INFO_GAP]).toBeGreaterThan(0);
      expect(result.dimensions[HookDimension.SENSORY_IMPACT]).toBeGreaterThan(0);
      expect(result.dimensions[HookDimension.PACING_ENTRY]).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('returns low scores for plain text', () => {
      const result = scoreHook(PLAIN_TEXT);

      expect(result.overall).toBeLessThan(30);
    });

    it('only analyzes first 200 chars', () => {
      const longText = HOOK_TEXT + '冲突冲突冲突危险危险'.repeat(20);
      const result = scoreHook(longText);
      expect(result.overall).toBeGreaterThan(0);
    });
  });

  describe('scoreCliffhanger', () => {
    it('scores cliffhanger dimensions for suspenseful ending', () => {
      const result = scoreCliffhanger(CLIFFHANGER_TEXT);

      expect(result.overall).toBeGreaterThan(0);
      expect(result.dimensions[CliffhangerDimension.UNRESOLVED_QUESTIONS]).toBeGreaterThan(0);
      expect(result.dimensions[CliffhangerDimension.EMOTIONAL_PEAK]).toBeGreaterThan(0);
      expect(result.dimensions[CliffhangerDimension.TWIST_IMPACT]).toBeGreaterThan(0);
      expect(result.dimensions[CliffhangerDimension.ANTICIPATION]).toBeGreaterThan(0);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('returns low scores for plain text', () => {
      const result = scoreCliffhanger(PLAIN_TEXT);
      expect(result.overall).toBeLessThan(30);
    });
  });

  describe('analyzeHookCliffhanger', () => {
    it('analyzes multiple chapters', () => {
      const chapters = [
        { content: HOOK_TEXT + CLIFFHANGER_TEXT, chapterIndex: 0 },
        { content: PLAIN_TEXT, chapterIndex: 1 },
        { content: HOOK_TEXT + CLIFFHANGER_TEXT, chapterIndex: 2 },
      ];

      const result = analyzeHookCliffhanger(chapters);

      expect(result.chapters).toHaveLength(3);
      expect(result.averageHookScore).toBeGreaterThan(0);
      expect(result.averageCliffhangerScore).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('identifies weak chapters', () => {
      const result = analyzeHookCliffhanger([
        { content: PLAIN_TEXT, chapterIndex: 0 },
      ]);
      expect(result.weakChapters).toContain(0);
    });

    it('returns empty result for no chapters', () => {
      const result = analyzeHookCliffhanger([]);
      expect(result.chapters).toHaveLength(0);
      expect(result.averageHookScore).toBe(0);
    });
  });
});

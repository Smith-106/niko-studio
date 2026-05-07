import { describe, expect, it } from 'vitest';

import { STORY_STRUCTURES } from '../../narrative/writing-craft/craft-catalog';
import { SubtextEvaluator } from '../../narrative/evaluators/subtext-evaluator';
import { analyzeEmotionCraft } from '../../narrative/writing-craft/emotion-craft';
import { detectUnreliableNarrator } from '../../narrative/writing-craft/unreliable-narrator';
import { analyzeRetentionRhythm } from '../../narrative/writing-craft/retention-rhythm';
import { SuspenseAnalyzer } from '../../narrative/suspense-analyzer';

describe('M13 Remaining Items', () => {
  // ── 1. Truby 22 Steps ──

  describe('Truby 22-step structure', () => {
    it('has truby_22_steps in STORY_STRUCTURES', () => {
      expect(STORY_STRUCTURES.truby_22_steps).toBeDefined();
      expect(STORY_STRUCTURES.truby_22_steps.name).toContain('Truby');
    });

    it('has exactly 22 beats', () => {
      expect(STORY_STRUCTURES.truby_22_steps.beats).toHaveLength(22);
    });

    it('beats are ordered by position', () => {
      const positions = STORY_STRUCTURES.truby_22_steps.beats.map((b) => b.position);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1]);
      }
    });

    it('covers full story range', () => {
      const positions = STORY_STRUCTURES.truby_22_steps.beats.map((b) => b.position);
      expect(positions[0]).toBeLessThanOrEqual(0.05);
      expect(positions[positions.length - 1]).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ── 2. McKee Three Functions ──

  describe('McKee three-function dialogue evaluation', () => {
    const evaluator = new SubtextEvaluator();

    it('evaluates McKee functions for dialogue', () => {
      const text = '「我觉得你不应该这么做，因为这违反了我们的信念。你凭什么决定一切？」';
      const result = evaluator.evaluateMcKeeFunctions(text);
      expect(result.dialogueCount).toBeGreaterThan(0);
      expect(result.averageFunctions).toBeGreaterThan(0);
    });

    it('detects weak dialogues with low function count', () => {
      const text = '「今天天气很好。」「是的，不错。」「我们去散步吧。」「好的。」';
      const result = evaluator.evaluateMcKeeFunctions(text);
      expect(result.weakDialogues).toBeGreaterThan(0);
    });

    it('returns suggestions', () => {
      const text = '「你凭什么反对我的决定？我不会答应的。」';
      const result = evaluator.evaluateMcKeeFunctions(text);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('handles no dialogues', () => {
      const result = evaluator.evaluateMcKeeFunctions('没有对话的文本。');
      expect(result.dialogueCount).toBe(0);
    });
  });

  // ── 3. Emotion Craft (Show-don't-tell) ──

  describe('Emotion craft analysis', () => {
    it('detects tell patterns', () => {
      const text = '他很高兴，她很害怕，他们很生气。';
      const result = analyzeEmotionCraft(text);
      expect(result.tellCount).toBeGreaterThan(0);
    });

    it('detects show patterns', () => {
      const text = '他拳头攥紧，指甲掐入掌心。她咬紧牙关，深吸一口气。';
      const result = analyzeEmotionCraft(text);
      expect(result.showCount).toBeGreaterThan(0);
    });

    it('calculates show ratio', () => {
      const text = '他很高兴，但拳头攥紧。她很害怕，呼吸急促。';
      const result = analyzeEmotionCraft(text);
      expect(result.showRatio).toBeGreaterThan(0);
      expect(result.showRatio).toBeLessThanOrEqual(1);
    });

    it('suggests improvements for low show ratio', () => {
      const text = '他很高兴。她很害怕。他很难过。她很生气。他感到恐惧。';
      const result = analyzeEmotionCraft(text);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('returns score 0 for no emotion text', () => {
      const result = analyzeEmotionCraft('他走在路上。');
      expect(result.totalDetections).toBe(0);
    });
  });

  // ── 4. Unreliable Narrator ──

  describe('Unreliable narrator detection', () => {
    it('detects memory uncertainty signals', () => {
      const chapters = [
        { content: '那天的事我记不太清了，好像是下雨，也许不是。后来才知道真相并非如此。', chapterIndex: 1 },
      ];
      const result = detectUnreliableNarrator(chapters);
      expect(result.manipulationSigns.length).toBeGreaterThan(0);
      expect(result.reliabilityScore).toBeLessThan(100);
    });

    it('detects self-contradictions', () => {
      const chapters = [
        { content: '他从不喝酒。但有一次他喝得烂醉。', chapterIndex: 1 },
      ];
      const result = detectUnreliableNarrator(chapters);
      expect(result.contradictions.length).toBeGreaterThan(0);
    });

    it('detects selective omission', () => {
      const chapters = [
        { content: '这些就不说了，过程不重要。总之结果就是他输了。', chapterIndex: 1 },
      ];
      const result = detectUnreliableNarrator(chapters);
      expect(result.contradictions.some((c) => c.type === 'omission')).toBe(true);
    });

    it('returns high score for reliable narrator', () => {
      const chapters = [
        { content: '他看到桌上有三本书，窗户开着，外面阳光明媚。', chapterIndex: 1 },
      ];
      const result = detectUnreliableNarrator(chapters);
      expect(result.reliabilityScore).toBe(100);
    });
  });

  // ── 5. Closed-Circle Detection ──

  describe('Closed-circle (暴风雪山庄) detection', () => {
    const analyzer = new SuspenseAnalyzer();

    it('detects isolated island setting', () => {
      const chapters = [
        { content: '他们被困在一座孤岛上，暴风雪封锁了一切出路。通讯中断，电话打不通。所有嫌疑人都在场，但第二个人又死了。尸体被发现时，每个人的不在场都不成立。', chapterIndex: 1 },
      ];
      const result = analyzer.detectClosedCircle(chapters);
      expect(result.detected).toBe(true);
      expect(result.elements.length).toBeGreaterThanOrEqual(3);
    });

    it('detects villa/estate setting', () => {
      const chapters = [
        { content: '别墅里的一共十个人，出不去，断桥了。又死了一个，尸体在书房。剩下的每个人都很害怕。', chapterIndex: 1 },
      ];
      const result = analyzer.detectClosedCircle(chapters);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('returns not detected for open setting', () => {
      const chapters = [
        { content: '他在城市街道上走着，阳光很好。', chapterIndex: 1 },
      ];
      const result = analyzer.detectClosedCircle(chapters);
      expect(result.detected).toBe(false);
    });
  });

  // ── 6. Retention Rhythm ──

  describe('Retention rhythm analysis', () => {
    it('analyzes chapter hooks and satisfaction', () => {
      const chapters = [
        { content: '突然一道黑影从天而降，他震惊全场，碾压了所有人。就在这时，没想到更大的危险来了。', chapterIndex: 1 },
        { content: '他突破瓶颈，终于晋级。然而真相远未揭露。', chapterIndex: 2 },
        { content: '平静的一天，没有发生什么特别的事。', chapterIndex: 3 },
      ];
      const result = analyzeRetentionRhythm(chapters);
      expect(result.profiles).toHaveLength(3);
      expect(result.profiles[0].hookStrength).toBeGreaterThan(result.profiles[2].hookStrength);
    });

    it('calculates golden three score', () => {
      const chapters = [
        { content: '突然他碾压了所有人，震惊全场，秒杀了对手。就在这时更大的危机来了。', chapterIndex: 1 },
        { content: '他突破晋级，终于获得认可。然而真相远未揭露，不料。', chapterIndex: 2 },
        { content: '打脸成功，复仇兑现。没想到更大的秘密。', chapterIndex: 3 },
      ];
      const result = analyzeRetentionRhythm(chapters);
      expect(result.goldenThreeScore).toBeGreaterThan(10);
    });

    it('detects micro cycles', () => {
      const chapters = Array.from({ length: 9 }, (_, i) => ({
        content: i % 3 === 0 ? '他震惊全场，碾压了对手。突然。' : '平淡的一天。',
        chapterIndex: i + 1,
      }));
      const result = analyzeRetentionRhythm(chapters);
      expect(result.microCycles.length).toBe(3);
    });

    it('suggests improvements for weak rhythm', () => {
      const chapters = [
        { content: '他走在路上。天气不错。', chapterIndex: 1 },
        { content: '她看了一会儿书。喝了一杯茶。', chapterIndex: 2 },
        { content: '他们聊天。没什么特别的。', chapterIndex: 3 },
      ];
      const result = analyzeRetentionRhythm(chapters);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('handles pay wall chapter', () => {
      const chapters = [
        { content: '突然真相大白，他震惊全场。就在这时。', chapterIndex: 1 },
        { content: '更大的秘密揭晓，碾压对手。殊不知。', chapterIndex: 2 },
        { content: '后续发展。', chapterIndex: 3 },
      ];
      const result = analyzeRetentionRhythm(chapters, 2);
      expect(result.profiles[1].payWallProximity).toBe('at');
    });
  });
});

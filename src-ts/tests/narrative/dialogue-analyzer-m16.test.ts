import { describe, expect, it } from 'vitest';

import { DialogueAnalyzer, DialogueQuality } from '../../narrative/dialogue-analyzer';

describe('DialogueAnalyzer — M16', () => {
  const analyzer = new DialogueAnalyzer();

  describe('analyzeDialogue()', () => {
    it('extracts dialogue lines from quoted text', () => {
      const text = '他沉默了片刻，说道："你根本不了解我。"她叹了口气。';
      const result = analyzer.analyzeDialogue(text);

      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines[0].content).toContain('了解');
    });

    it('scores all 5 quality dimensions', () => {
      const text = '他冷笑道："你不明白。"她欲言又止，低下头。老子才不怕你。';
      const result = analyzer.analyzeDialogue(text);

      expect(result.qualityScores).toHaveLength(5);
      const dimensions = result.qualityScores.map((s) => s.dimension);
      expect(dimensions).toContain(DialogueQuality.SUBTEXT_RICH);
      expect(dimensions).toContain(DialogueQuality.CONFLICT_DRIVEN);
    });

    it('detects subtext indicators', () => {
      const text = '她欲言又止，别过脸去，沉默了很久，然后叹了口气。';
      const result = analyzer.analyzeDialogue(text);

      const subtext = result.qualityScores.find((s) => s.dimension === DialogueQuality.SUBTEXT_RICH);
      expect(subtext?.score).toBeGreaterThan(0);
    });

    it('penalizes on-the-nose dialogue', () => {
      const text = '"我很难过，"她说。"我很害怕，"他说。';
      const result = analyzer.analyzeDialogue(text);

      const onTheNose = result.qualityScores.find((s) => s.dimension === DialogueQuality.ON_THE_NOSE);
      expect(onTheNose!.score).toBeLessThan(10);
    });

    it('detects voice differentiation', () => {
      const text = '老子才不管那些。鄙人不才，愿效犬马之劳。本座说了算。';
      const result = analyzer.analyzeDialogue(text);

      const voice = result.qualityScores.find((s) => s.dimension === DialogueQuality.VOICE_DISTINCT);
      expect(voice?.score).toBeGreaterThan(0);
    });

    it('computes subtextRatio', () => {
      const text = '她沉默了一会儿。';
      const result = analyzer.analyzeDialogue(text);
      expect(typeof result.subtextRatio).toBe('number');
    });

    it('generates suggestions for weak dialogue', () => {
      const text = '他说："我想要这个。"她说："好的。"';
      const result = analyzer.analyzeDialogue(text);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
    it('surfaces on-the-nose suggestions when multiple bad patterns are present', () => {
      const text = '"我很难过，"她说。"我很害怕，"他说。"我知道你在想什么，"她冷笑道。';
      const result = analyzer.analyzeDialogue(text);

      const onTheNose = result.qualityScores.find((s) => s.dimension === DialogueQuality.ON_THE_NOSE);
      expect(onTheNose?.score).toBeLessThan(6);
      expect(onTheNose?.evidence).toEqual(expect.arrayContaining(['我很难过', '我很害怕', '我知道你在想什么']));
      expect(result.suggestions.some((s) => s.includes('直白情感表达'))).toBe(true);
    });
  });
});

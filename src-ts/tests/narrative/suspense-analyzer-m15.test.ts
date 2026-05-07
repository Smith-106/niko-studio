import { describe, expect, it } from 'vitest';

import { SuspenseAnalyzer } from '../../narrative/suspense-analyzer';

describe('SuspenseAnalyzer — M15', () => {
  const analyzer = new SuspenseAnalyzer();

  describe('analyzeEdsonSequence()', () => {
    const chapters = [
      { content: '主角生活平淡，有一个不可告人的秘密。突然一天一切改变了。', position: 0.01 },
      { content: '催化事件发生，他被迫做出选择。犹豫了很久。', position: 0.07 },
      { content: '进入了新的世界，开始探索。中点出现转折。', position: 0.35 },
      { content: '一切崩塌，失去了一切。灵魂进入黑夜。', position: 0.55 },
      { content: '最终决战，高潮来了。', position: 0.8 },
    ];

    it('returns alignment analysis with expected structure', () => {
      const result = analyzer.analyzeEdsonSequence(chapters);

      expect(result.alignments).toBeDefined();
      expect(result.alignments.length).toBeGreaterThan(0);
      expect(typeof result.overallAlignmentScore).toBe('number');
      expect(result.missingBeats).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('each alignment has required fields', () => {
      const result = analyzer.analyzeEdsonSequence(chapters);
      for (const a of result.alignments) {
        expect(a.beatName).toBeTruthy();
        expect(typeof a.expectedPosition).toBe('number');
        expect(typeof a.aligned).toBe('boolean');
        expect(typeof a.deviation).toBe('number');
      }
    });

    it('detects aligned beats near expected positions', () => {
      const result = analyzer.analyzeEdsonSequence(chapters);
      const alignedCount = result.alignments.filter((a) => a.aligned).length;
      expect(alignedCount).toBeGreaterThan(0);
    });
  });

  describe('detectAntiPatterns()', () => {
    it('detects info dump pattern', () => {
      const chapters = [
        { content: '众所周知，在这个世界上有五大帝国。传说中有一种叫做灵力的能量。', chapterIndex: 0 },
      ];
      const result = analyzer.detectAntiPatterns(chapters);
      const infoDump = result.detections.find((d) => d.pattern === 'info_dump');
      expect(infoDump?.detected).toBe(true);
    });

    it('detects passive protagonist pattern', () => {
      const chapters = [
        { content: '他只好接受命运的安排，被迫走上这条路。别无选择，无奈之下只能如此。', chapterIndex: 0 },
      ];
      const result = analyzer.detectAntiPatterns(chapters);
      const passive = result.detections.find((d) => d.pattern === 'passive_protagonist');
      expect(passive?.detected).toBe(true);
    });

    it('returns health score and severity counts', () => {
      const chapters = [
        { content: '众所周知在这个世界，他被迫无奈只好接受。', chapterIndex: 0 },
      ];
      const result = analyzer.detectAntiPatterns(chapters);

      expect(typeof result.criticalCount).toBe('number');
      expect(typeof result.warningCount).toBe('number');
      expect(typeof result.overallHealthScore).toBe('number');
      expect(result.suggestions).toBeDefined();
    });

    it('returns clean result for well-written text', () => {
      const chapters = [
        { content: '她攥紧拳头，转身面对敌人。心跳加速，但她毫不犹豫。', chapterIndex: 0 },
      ];
      const result = analyzer.detectAntiPatterns(chapters);
      expect(result.criticalCount).toBe(0);
    });

    it('has exactly 10 detection entries', () => {
      const chapters = [{ content: '测试文本', chapterIndex: 0 }];
      const result = analyzer.detectAntiPatterns(chapters);
      expect(result.detections).toHaveLength(10);
    });
  });

  describe('detectNarrativeTricks()', () => {
    it('detects narrative tricks in rich text', () => {
      const chapters = [
        { content: '但是突然发生了意想不到的事。然而真相究竟是什么？就在这时一切都变了。原来如此，果然如此。', chapterIndex: 0 },
      ];
      const result = analyzer.detectNarrativeTricks(chapters);

      expect(result.tricks.length).toBeGreaterThan(0);
      const detectedCount = result.tricks.filter((t) => t.detected).length;
      expect(detectedCount).toBeGreaterThan(0);
    });

    it('returns overall trick score', () => {
      const chapters = [
        { content: '简单文本没有太多技巧。', chapterIndex: 0 },
      ];
      const result = analyzer.detectNarrativeTricks(chapters);
      expect(typeof result.overallTrickScore).toBe('number');
      expect(result.overallTrickScore).toBeGreaterThanOrEqual(0);
    });

    it('generates suggestions for missing tricks', () => {
      const chapters = [{ content: '平淡', chapterIndex: 0 }];
      const result = analyzer.detectNarrativeTricks(chapters);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { navigatePacing, type PrescriptionType } from '../../narrative/pacing-navigator';

const ENGAGING_CHAPTER = `突然，一道黑影从黑暗中冲出。就在这时，林岚感觉到一股诡异的杀意。然而，她并不知道，真正的危险才刚刚开始。敌人逼近，陷阱已经布下，阴谋正在展开。她紧握武器，盯着前方。`;
const EMOTIONAL_CHAPTER = `她攥紧了拳头，眼眶泛红。心跳加速，呼吸一滞，手指颤抖着。那一拳砸在桌上，震得杯子都跳了起来。深吸一口气，她告诉自己要冷静。`;
const NEUTRAL_CHAPTER = `今天天气不错。出门散步。回来吃饭。看了会儿书。睡了个午觉。`;

describe('Pacing Navigator', () => {
  it('generates prescriptions for chapters with issues', () => {
    const chapters = [
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 3 },
    ];

    const result = navigatePacing(chapters);

    expect(result.prescriptions.length).toBeGreaterThan(0);
    expect(result.pacingScore).toBeGreaterThanOrEqual(0);
    expect(result.rhythmAnalysis).not.toBeNull();
    expect(result.emotionalArc).not.toBeNull();
  });

  it('each prescription has required fields', () => {
    const result = navigatePacing([
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
    ]);

    for (const p of result.prescriptions) {
      expect(p).toHaveProperty('chapterIndex');
      expect(p).toHaveProperty('type');
      expect(p).toHaveProperty('label');
      expect(p).toHaveProperty('priority');
      expect(p).toHaveProperty('reason');
      expect(['low', 'medium', 'high']).toContain(p.priority);
      expect(['climax', 'turning_point', 'breathing_room', 'foreshadow_harvest', 'escalation']).toContain(p.type);
    }
  });

  it('prescriptions are sorted by priority', () => {
    const result = navigatePacing([
      { content: NEUTRAL_CHAPTER, chapterIndex: 0 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 1 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 2 },
      { content: NEUTRAL_CHAPTER, chapterIndex: 3 },
    ]);

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < result.prescriptions.length; i++) {
      const prev = priorityOrder[result.prescriptions[i - 1].priority as keyof typeof priorityOrder];
      const curr = priorityOrder[result.prescriptions[i].priority as keyof typeof priorityOrder];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('scores well for well-paced chapters', () => {
    const result = navigatePacing([
      { content: ENGAGING_CHAPTER, chapterIndex: 0 },
      { content: EMOTIONAL_CHAPTER, chapterIndex: 1 },
      { content: ENGAGING_CHAPTER, chapterIndex: 2 },
    ]);

    expect(result.pacingScore).toBeGreaterThan(0);
  });

  it('returns empty result for no chapters', () => {
    const result = navigatePacing([]);
    expect(result.prescriptions).toHaveLength(0);
    expect(result.pacingScore).toBe(0);
  });
});

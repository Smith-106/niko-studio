import { describe, expect, it, vi } from 'vitest';

import {
  ConflictAnalyzer,
  ConflictIntensity,
  ConflictType,
} from '../../narrative/analyzers/conflict-analyzer';

describe('ConflictAnalyzer', () => {
  it('quickAnalyze detects multiple conflict types and intensity distribution', () => {
    const analyzer = new ConflictAnalyzer();

    const result = analyzer.quickAnalyze(
      '她一方面想离开，一方面又害怕失去。敌人的威胁越来越强烈，最终两人爆发争吵，对抗几乎致命。',
    );

    expect(result.count).toBeGreaterThan(0);
    expect(
      result.items.some((item) => item.type === ConflictType.INTERNAL),
    ).toBe(true);
    expect(
      result.items.some((item) => item.type === ConflictType.EXTERNAL),
    ).toBe(true);
    expect(
      result.items.some((item) => item.type === ConflictType.INTERPERSONAL),
    ).toBe(true);
    expect(
      Object.values(result.metadata.intensity_distribution as Record<string, number>).some(
        (count) => Number(count) > 0,
      ),
    ).toBe(true);
  });

  it('returns dominant conflict type from rule analysis', () => {
    const analyzer = new ConflictAnalyzer();

    const dominant = analyzer.getDominantConflictType(
      '她犹豫、纠结、挣扎，又反复自问是否应该继续前进。',
    );

    expect(dominant).toBe(ConflictType.INTERNAL);
  });

  it('falls back to quickAnalyze when llm analysis fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const analyzer = new ConflictAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '他们爆发争吵，外部威胁逼近，她内心也在挣扎。',
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.count).toBeGreaterThan(0);
    expect(result.items[0]?.intensity).toBeDefined();
  });

  it('merges llm conflicts with rule-based conflicts when llm succeeds', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        conflicts: [
          {
            type: 'interpersonal',
            content: '他们面对面争执。',
            parties: ['林岚', '阿澈'],
            intensity: 'high',
            description: '人物关系冲突',
          },
        ],
      }),
    };
    const analyzer = new ConflictAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '他们爆发争吵，外部威胁逼近，她内心也在挣扎。',
    );

    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(
      result.items.some((item) => item.type === ConflictType.INTERPERSONAL && item.intensity === ConflictIntensity.HIGH),
    ).toBe(true);
    expect(result.summary).toContain('LLM');
  });
});

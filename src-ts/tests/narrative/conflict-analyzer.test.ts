import { describe, expect, it, vi } from 'vitest';

import {
  ConflictAnalyzer,
  ConflictIntensity,
  ConflictType,
} from '../../narrative/analyzers/conflict-analyzer';

const RICH_CONFLICT_TEXT =
  '她一方面想离开，一方面又害怕失去。敌人的威胁越来越强烈，最终两人爆发争吵，对抗几乎致命。';

describe('ConflictAnalyzer', () => {
  it('quickAnalyze detects multiple conflict types and intensity distribution', () => {
    const analyzer = new ConflictAnalyzer();

    const result = analyzer.quickAnalyze(RICH_CONFLICT_TEXT);

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

  it('exposes serializable conflicts, description metadata, and analyze fallback without llm', async () => {
    const analyzer = new ConflictAnalyzer();
    const quickSpy = vi.spyOn(analyzer, 'quickAnalyze');
    const analyzed = await analyzer.analyze(RICH_CONFLICT_TEXT);
    const first = analyzed.items[0];

    expect(analyzer.description).toContain('冲突');
    expect(quickSpy).toHaveBeenCalled();
    expect(first).toBeDefined();
    expect(first?.toDict()).toMatchObject({
      type: first?.type,
      content: first?.content,
      parties: first?.parties,
      intensity: first?.intensity,
      indicators: first?.indicators,
      position: first?.position,
      description: first?.description,
    });
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
      result.items.some(
        (item) =>
          item.type === ConflictType.INTERPERSONAL
          && item.intensity === ConflictIntensity.HIGH,
      ),
    ).toBe(true);
    expect(result.summary).toContain('LLM');
  });

  it('falls back to rule conflicts when llm returns no conflicts field', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({ summary: 'missing conflicts field' }),
    };
    const analyzer = new ConflictAnalyzer(llmClient as never);

    const result = await analyzer.analyze(RICH_CONFLICT_TEXT);

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.count).toBeGreaterThan(0);
  });

  it('skips malformed llm conflict items and returns null for invalid dominant type metadata', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        conflicts: [
          {
            type: 'unsupported-type',
            content: 'invalid conflict payload',
            intensity: 'critical',
          },
        ],
      }),
    };
    const analyzer = new ConflictAnalyzer(llmClient as never);

    const result = await analyzer.analyze(RICH_CONFLICT_TEXT);
    expect(result.count).toBeGreaterThan(0);

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue({
      metadata: {
        type_distribution: {
          unsupported: 2,
        },
      },
    } as never);

    expect(analyzer.getDominantConflictType('ignored')).toBeNull();
  });
});

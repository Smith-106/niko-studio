import { describe, expect, it, vi } from 'vitest';

import {
  ConflictAnalyzer,
  ConflictIntensity,
  ConflictType,
} from '../../narrative/analyzers/conflict-analyzer';

describe('narrative/conflict-analyzer branch-gap coverage', () => {
  it('uses llm defaults for missing fields and keeps empty lists stable', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        conflicts: [{}],
      }),
    };
    const analyzer = new ConflictAnalyzer(llmClient as never);

    const result = await analyzer.analyze('');

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      type: ConflictType.INTERPERSONAL,
      content: '',
      parties: [],
      intensity: ConflictIntensity.MEDIUM,
      description: '',
    });
    expect(result.summary).toContain('LLM: 1');
  });

  it('falls back to the empty distribution summary when no rule conflicts are found', () => {
    const analyzer = new ConflictAnalyzer();

    const result = analyzer.quickAnalyze('plain calm paragraph with no known conflict markers');

    expect(result.count).toBe(0);
    expect(result.summary).toContain('0');
  });

  it('returns null dominant types for missing, empty, zero-only, and invalid metadata distributions', () => {
    const analyzer = new ConflictAnalyzer();

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValueOnce({
      metadata: {},
    } as never);
    expect(analyzer.getDominantConflictType('ignored')).toBeNull();

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValueOnce({
      metadata: { type_distribution: {} },
    } as never);
    expect(analyzer.getDominantConflictType('ignored')).toBeNull();

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValueOnce({
      metadata: {
        type_distribution: {
          internal: 0,
          external: 0,
          interpersonal: 0,
        },
      },
    } as never);
    expect(analyzer.getDominantConflictType('ignored')).toBeNull();

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValueOnce({
      metadata: {
        type_distribution: {
          internal: 1,
          unsupported: 3,
        },
      },
    } as never);
    expect(analyzer.getDominantConflictType('ignored')).toBeNull();
  });

  it('selects the largest later distribution entry and skips llm items with invalid intensity values', async () => {
    const analyzer = new ConflictAnalyzer({
      generateJson: vi.fn().mockResolvedValue({
        conflicts: [
          {
            type: 'internal',
            intensity: 'unsupported',
            content: 'bad intensity',
          },
        ],
      }),
    } as never);

    const llmResult = await analyzer.analyze('plain calm paragraph');
    expect(llmResult.count).toBe(0);

    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValueOnce({
      metadata: {
        type_distribution: {
          internal: 1,
          external: 4,
          interpersonal: 2,
        },
      },
    } as never);
    expect(analyzer.getDominantConflictType('ignored')).toBe(ConflictType.EXTERNAL);
  });
});

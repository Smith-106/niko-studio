import { describe, expect, it, vi } from 'vitest';

import { CharacterStateAnalyzer } from '../../narrative/analyzers/character-state-analyzer';

describe('CharacterStateAnalyzer', () => {
  it('quickAnalyze extracts state segments with emotions, goals, conflicts, and agency', () => {
    const analyzer = new CharacterStateAnalyzer();

    const result = analyzer.quickAnalyze(
      '她害怕失败，却决定继续追查真相。她必须行动，虽然内心仍然挣扎。\\n\\n随后她冷静观察四周，准备下一步计划。',
    );

    expect(result.count).toBeGreaterThan(0);
    expect(result.metadata).toHaveProperty('average_agency');
    expect(result.items[0]?.emotions.length).toBeGreaterThan(0);
    expect(result.items[0]?.goals.length).toBeGreaterThan(0);
    expect(result.items[0]?.conflicts.length).toBeGreaterThan(0);
  });

  it('returns dominant emotions from rule analysis', () => {
    const analyzer = new CharacterStateAnalyzer();

    const dominant = analyzer.getDominantEmotions(
      '她害怕失去一切。她焦虑地等待结果，却仍然准备继续行动。',
    );

    expect(dominant).toContain('negative');
  });

  it('falls back to quickAnalyze when llm analysis fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const analyzer = new CharacterStateAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '她决定出发，却仍然害怕后果。',
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.count).toBeGreaterThan(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('uses llm states when llm succeeds', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        states: [
          {
            position: 0,
            content: '她决定站出来。',
            emotions: ['positive'],
            goals: ['决定'],
            conflicts: ['却'],
            agency_score: 0.8,
          },
        ],
        summary: 'LLM state summary',
      }),
    };
    const analyzer = new CharacterStateAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '她决定站出来，却仍担心失败。',
    );

    expect(result.count).toBe(1);
    expect(result.items[0]?.agencyScore).toBe(0.8);
    expect(result.summary).toBe('LLM state summary');
    expect(result.metadata['analysis_source']).toBe('llm');
  });
});

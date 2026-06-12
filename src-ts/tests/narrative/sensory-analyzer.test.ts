import { describe, expect, it, vi } from 'vitest';

import {
  SensoryAnalyzer,
  SensoryType,
} from '../../narrative/analyzers/sensory-analyzer';

describe('SensoryAnalyzer', () => {
  it('quickAnalyze extracts multi-sensory details and density metadata', () => {
    const analyzer = new SensoryAnalyzer();

    const result = analyzer.quickAnalyze(
      '她看到昏暗的灯光，听到远处的脚步声，闻到焦味，指尖触到冰冷的铁门，舌尖还残留苦涩。',
    );

    expect(result.count).toBeGreaterThan(0);
    expect(result.metadata).toHaveProperty('type_distribution');
    expect(result.metadata).toHaveProperty('density');
    expect(result.items.some((item) => item.type === SensoryType.VISUAL)).toBe(true);
    expect(result.items.some((item) => item.type === SensoryType.AUDITORY)).toBe(true);
    expect(result.items.some((item) => item.type === SensoryType.OLFACTORY)).toBe(true);
    expect(result.items.some((item) => item.type === SensoryType.TACTILE)).toBe(true);
    expect(result.items.some((item) => item.type === SensoryType.GUSTATORY)).toBe(true);
  });

  it('extractByType and getSensoryDensity return deterministic per-type results', () => {
    const analyzer = new SensoryAnalyzer();
    const content = '她看到红光，也听到铃声，然后闻到花香。';

    const visual = analyzer.extractByType(content, SensoryType.VISUAL);
    const density = analyzer.getSensoryDensity(content);

    expect(visual.length).toBeGreaterThan(0);
    expect(Number(density[ SensoryType.VISUAL ])).toBeGreaterThanOrEqual(0);
    expect(Number(density[ SensoryType.AUDITORY ])).toBeGreaterThanOrEqual(0);
  });

  it('falls back to quickAnalyze when llm sensory analysis fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const analyzer = new SensoryAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '她看到光影摇曳，听到低语与呼吸声。',
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.count).toBeGreaterThan(0);
  });

  it('merges llm details with rule-based details when llm succeeds', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        sensory_details: [
          {
            type: 'visual',
            content: '昏暗灯光映入眼帘',
            intensity: 0.8,
            context: '营造压迫感',
          },
        ],
      }),
    };
    const analyzer = new SensoryAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '她看到昏暗灯光，也听到脚步声。',
    );

    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(
      result.items.some((item) => item.type === SensoryType.VISUAL && item.context === '营造压迫感'),
    ).toBe(true);
    expect(result.summary).toContain('LLM');
  });

  it('serializes sensory details and skips invalid llm entries', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        sensory_details: [
          { type: 'invalid', content: 'ignored' },
          {
            type: 'tactile',
            content: 'cold stone',
            intensity: 0.7,
            context: 'surface detail',
          },
        ],
      }),
    };
    const analyzer = new SensoryAnalyzer(llmClient as never);

    const result = await analyzer.analyze('');
    const dict = result.toDict();

    expect(result.count).toBe(1);
    expect(result.metadata['llm_count']).toBe(1);
    expect(dict['items']).toEqual([
      {
        type: SensoryType.TACTILE,
        content: 'cold stone',
        keywords: [],
        position: 1,
        intensity: 0.7,
        context: 'surface detail',
      },
    ]);
  });

  it('returns zero density for empty content and exposes analyzer metadata', async () => {
    const analyzer = new SensoryAnalyzer();

    expect(analyzer.name).toBe('SensoryAnalyzer');
    expect(analyzer.description.length).toBeGreaterThan(0);

    const result = await analyzer.analyze('');
    expect(result.isEmpty).toBe(true);

    const density = analyzer.getSensoryDensity('');
    expect(density).toEqual({
      [SensoryType.VISUAL]: 0,
      [SensoryType.AUDITORY]: 0,
      [SensoryType.OLFACTORY]: 0,
      [SensoryType.TACTILE]: 0,
      [SensoryType.GUSTATORY]: 0,
    });
  });
});

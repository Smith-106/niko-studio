import { describe, expect, it, vi } from 'vitest';

import { AnalysisResult } from '../../narrative/analyzers/base';
import {
  SensoryAnalyzer,
  SensoryType,
} from '../../narrative/analyzers/sensory-analyzer';

describe('SensoryAnalyzer branch-gap coverage', () => {
  it('fills missing llm sensory fields with safe defaults', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        sensory_details: [{ type: 'visual' }],
      }),
    };
    const analyzer = new SensoryAnalyzer(llmClient as never);

    const result = await analyzer.analyze('');
    const detail = result.items[0] as {
      type: SensoryType;
      content: string;
      intensity: number;
      context: string;
    };

    expect(detail).toMatchObject({
      type: SensoryType.VISUAL,
      content: '',
      intensity: 0.5,
      context: '',
    });
    expect(result.metadata).toMatchObject({
      llm_count: 1,
      rule_count: 0,
    });
  });

  it('returns an empty density map when quick analysis metadata omits type distribution', () => {
    const analyzer = new SensoryAnalyzer();
    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue(
      new AnalysisResult(analyzer.name, analyzer.analysisType, [], {}, 'no distribution'),
    );

    expect(analyzer.getSensoryDensity('abc')).toEqual({});
  });
});

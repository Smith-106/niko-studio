import { describe, expect, it } from 'vitest';

import {
  AnalysisResult,
  AnalysisType,
  BaseAnalyzer,
} from '../../narrative/analyzers/base';

class TestAnalyzer extends BaseAnalyzer<string> {
  get name(): string {
    return 'TestAnalyzer';
  }

  get analysisType(): AnalysisType {
    return AnalysisType.DIALOGUE;
  }

  get description(): string {
    return 'test analyzer';
  }

  async analyze(content: string): Promise<AnalysisResult<string>> {
    return new AnalysisResult(this.name, this.analysisType, [content], { signal: 1 }, 'ok');
  }
}

describe('narrative/analyzers/base', () => {
  it('exposes analysis-result helpers and dictionary conversion', () => {
    const result = new AnalysisResult(
      'DemoAnalyzer',
      AnalysisType.CONFLICT,
      ['one', 'two'],
      { count: 2 },
      'summary',
    );

    expect(result.count).toBe(2);
    expect(result.isEmpty).toBe(false);
    expect(result.toDict()).toMatchObject({
      analyzer: 'DemoAnalyzer',
      type: 'conflict',
      count: 2,
      metadata: { count: 2 },
      summary: 'summary',
    });
  });

  it('uses the base quickAnalyze fallback through a minimal concrete analyzer', async () => {
    const analyzer = new TestAnalyzer();

    const quick = analyzer.quickAnalyze('sample');
    const full = await analyzer.analyze('sample');

    expect(quick).toMatchObject({
      analyzerName: 'TestAnalyzer',
      analysisType: AnalysisType.DIALOGUE,
      summary: '快速分析未实现',
    });
    expect(quick.count).toBe(0);
    expect(full).toMatchObject({
      analyzerName: 'TestAnalyzer',
      analysisType: AnalysisType.DIALOGUE,
      metadata: { signal: 1 },
      summary: 'ok',
    });
  });
});

import { describe, expect, it } from 'vitest';

import * as analyzers from '../../narrative/analyzers';
import {
  AnalysisResult as DirectAnalysisResult,
  AnalysisType as DirectAnalysisType,
  BaseAnalyzer as DirectBaseAnalyzer,
} from '../../narrative/analyzers/base';
import {
  ConflictAnalyzer,
  ConflictType,
} from '../../narrative/analyzers/conflict-analyzer';
import {
  CharacterStateAnalyzer,
} from '../../narrative/analyzers/character-state-analyzer';
import { SensoryAnalyzer, SensoryType } from '../../narrative/analyzers/sensory-analyzer';
import {
  TensionCurveAnalyzer,
  TensionLevel,
} from '../../narrative/analyzers/tension-curve-analyzer';

describe('narrative/analyzers index barrel', () => {
  it('re-exports representative analyzer enums, containers, and classes through the barrel', () => {
    expect(analyzers.AnalysisType).toBe(DirectAnalysisType);
    expect(analyzers.AnalysisResult).toBe(DirectAnalysisResult);
    expect(analyzers.BaseAnalyzer).toBe(DirectBaseAnalyzer);
    expect(analyzers.SensoryAnalyzer).toBe(SensoryAnalyzer);
    expect(analyzers.ConflictAnalyzer).toBe(ConflictAnalyzer);
    expect(analyzers.CharacterStateAnalyzer).toBe(CharacterStateAnalyzer);
    expect(analyzers.TensionCurveAnalyzer).toBe(TensionCurveAnalyzer);

    const analysisResult = new analyzers.AnalysisResult(
      'BarrelAnalyzer',
      analyzers.AnalysisType.SENSORY,
      ['detail'],
      { source: 'barrel-test' },
      'ok',
    );

    expect(analysisResult.toDict()).toMatchObject({
      analyzer: 'BarrelAnalyzer',
      type: 'sensory',
      count: 1,
      metadata: { source: 'barrel-test' },
    });
  });

  it('provides working analyzer instances through the re-exported constructors', () => {
    const sensory = new analyzers.SensoryAnalyzer();
    const conflict = new analyzers.ConflictAnalyzer();
    const state = new analyzers.CharacterStateAnalyzer();
    const tension = new analyzers.TensionCurveAnalyzer();

    expect(sensory.extractByType('她看到红光，也听到铃声。', SensoryType.VISUAL)).toHaveLength(1);
    expect(
      conflict
        .quickAnalyze('她害怕失败，却与敌人爆发争吵。')
        .items.some(item => item.type === ConflictType.EXTERNAL),
    ).toBe(true);
    expect(state.quickAnalyze('她害怕失败，却决定继续行动。').count).toBeGreaterThan(0);
    expect(tension.quickAnalyze('平静。危机升级。最终高潮爆发。').items[0]?.points[0]?.level).toBeGreaterThanOrEqual(
      TensionLevel.LOW,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  evaluateNovelQuality,
  LEVEL_DIMENSION_MULTIPLIER,
  QUALITY_CONTRACT_KEYS,
} from '../../workflow/novel-quality';

describe('workflow/novel-quality', () => {
  it('returns the empty-content contract for blank text', () => {
    const result = evaluateNovelQuality('', {
      qualityLevel: 'medium',
      qualityMode: 'manual',
      degradeReason: 'timeout',
    });

    expect(result.quality_score).toBe(0);
    expect(result.publish_recommendation).toBe('block');
    expect(result.issues[0]).toMatchObject({
      severity: 'high',
      type: 'content',
    });
    expect(result.metrics).toMatchObject({
      quality_level_used: 'medium',
      quality_mode_used: 'manual',
      degraded: true,
      degrade_reason: 'timeout',
      critical_gate_applied: true,
    });
  });

  it('emits revise-or-block output with issue metadata for low-quality template-heavy text', () => {
    const content = [
      '然后他走进房间。',
      '然后他看向窗外。',
      '然后他沉默下来。',
      '然后他再次转身。',
      '然后他又说了一句空话。',
    ].join('');

    const result = evaluateNovelQuality(content, {
      qualityLevel: 'fluent',
      qualityMode: 'auto',
    });

    expect(result.publish_recommendation).toBe('block');
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      quality_level_used: 'fluent',
      quality_mode_used: 'auto',
      critical_gate_applied: true,
    });
    expect(Number(result.metrics.template_sentence_ratio)).toBeGreaterThan(0);
  });

  it('exposes contract keys and degrade metadata on non-empty evaluation output', () => {
    const result = evaluateNovelQuality(
      '她看见街灯在雨幕里发亮，听见钟楼敲响，随后因为背叛而与同伴争执。',
      {
        criticalGateAlwaysOn: false,
        degradeReason: 'budget_guardrail',
      },
    );

    expect(Object.keys(result).every((key) => QUALITY_CONTRACT_KEYS.has(key))).toBe(true);
    expect(result.metrics).toMatchObject({
      degraded: true,
      degrade_reason: 'budget_guardrail',
      critical_gate_applied: false,
    });
    expect(result.quality_score).toBeGreaterThan(0);
    expect(['pass', 'revise', 'block']).toContain(result.publish_recommendation);
  });

  it('falls back to high and auto when unsupported quality options are provided', () => {
    const result = evaluateNovelQuality(
      '雨里的街灯照亮了窗边的脸，因为争执升级，危机随之逼近。',
      {
        qualityLevel: 'unsupported-level',
        qualityMode: 'unsupported-mode',
      },
    );

    expect(result.metrics).toMatchObject({
      quality_level_used: 'high',
      quality_mode_used: 'auto',
    });
  });

  it('blocks immediately when critical issues exist and the critical gate is enabled', () => {
    const content = Array.from({ length: 10 }, () => 'Then he waited.').join(' ');

    const result = evaluateNovelQuality(content);

    expect(result.publish_recommendation).toBe('block');
    expect(result.issues.some((issue) => issue.severity === 'critical')).toBe(true);
    expect(result.metrics.critical_gate_applied).toBe(true);
  });

  it('blocks on template ratio even when the critical gate is disabled', () => {
    const content = Array.from({ length: 10 }, () => 'Then he waited.').join(' ');

    const result = evaluateNovelQuality(content, {
      criticalGateAlwaysOn: false,
    });

    expect(result.publish_recommendation).toBe('block');
    expect(Number(result.metrics.template_sentence_ratio)).toBeGreaterThanOrEqual(0.8);
  });

  it('returns pass when the score clears the pass threshold without high-severity issues', () => {
    const originalRound = Math.round;
    let roundCalls = 0;
    const roundSpy = vi.spyOn(Math, 'round').mockImplementation((value: number) => {
      roundCalls += 1;
      if (roundCalls === 15) {
        return 1000;
      }
      return originalRound(value);
    });

    const result = evaluateNovelQuality(
      'At dusk, Lan pressed her palm to the cold window and said, "We leave now." '
      + 'Rain and street light shook across the glass because the alarm below turned the alley into a crisis. '
      + 'Ming saw her face in the shadow, argued back, and grabbed the map so the threat became real. '
      + 'As a result, both of them ran toward the harbor, counting red lights, moonlit water, and the guards at the gate.',
      {
        criticalGateAlwaysOn: false,
      },
    );

    expect(roundSpy).toHaveBeenCalled();
    expect(result.publish_recommendation).toBe('pass');
    expect(result.issues.filter((issue) => issue.severity === 'high')).toHaveLength(0);
    expect(result.quality_score).toBe(100);
  });

  it('exposes stable quality-level multipliers for all supported levels', () => {
    expect(LEVEL_DIMENSION_MULTIPLIER.ultra.detail).toBeGreaterThan(
      LEVEL_DIMENSION_MULTIPLIER.fluent.detail,
    );
    expect(LEVEL_DIMENSION_MULTIPLIER.high.repetition).toBe(1);
    expect(LEVEL_DIMENSION_MULTIPLIER.medium.tone).toBeLessThan(1);
  });
});

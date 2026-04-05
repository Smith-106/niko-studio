import { describe, expect, it } from 'vitest';

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

  it('exposes stable quality-level multipliers for all supported levels', () => {
    expect(LEVEL_DIMENSION_MULTIPLIER.ultra.detail).toBeGreaterThan(
      LEVEL_DIMENSION_MULTIPLIER.fluent.detail,
    );
    expect(LEVEL_DIMENSION_MULTIPLIER.high.repetition).toBe(1);
    expect(LEVEL_DIMENSION_MULTIPLIER.medium.tone).toBeLessThan(1);
  });
});

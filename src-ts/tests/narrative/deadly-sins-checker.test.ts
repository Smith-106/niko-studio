import { describe, expect, it } from 'vitest';

import {
  DeadlySin,
  DeadlySinsChecker,
} from '../../narrative/evaluators/deadly-sins-checker';

describe('narrative/evaluators/deadly-sins-checker', () => {
  it('exposes the deadly-sin enum and quickScan result envelope', () => {
    const checker = new DeadlySinsChecker();

    const result = checker.quickScan('她缓慢叙述，没有看到、听到、感觉等感官线索。');

    expect(DeadlySin.STRUCTURAL_DRIFT).toBe('structural_drift');
    expect(DeadlySin.EMOTIONAL_VACUUM).toBe('emotional_vacuum');
    expect(result.score).toBeGreaterThan(0);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('快速');
  });

  it('evaluate returns issue and metrics envelopes for bounded inputs', async () => {
    const checker = new DeadlySinsChecker();

    const result = await checker.evaluate(
      '她只是机械地向前走，没有任何目标，也没有感官细节，叙述松散而空洞。',
      {},
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.metrics).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

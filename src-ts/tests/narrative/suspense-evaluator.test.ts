import { describe, expect, it } from 'vitest';

import { SuspenseEvaluator } from '../../narrative/evaluators/suspense-evaluator';

describe('narrative/evaluators/suspense-evaluator', () => {
  it('exposes public metadata getters', () => {
    const evaluator = new SuspenseEvaluator();

    expect(evaluator.name).toContain('悬念');
    expect(evaluator.description).toContain('悬念');
    expect(evaluator.relatedSkill).toBe('suspense-craft');
  });

  it('quickScan returns a stable score envelope for bounded suspense inputs', () => {
    const evaluator = new SuspenseEvaluator();

    const result = evaluator.quickScan(
      '谁在暗处跟踪她？钟声越来越近，威胁正在逼近，倒计时只剩最后十分钟。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.level).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('快扫');
  });

  it('evaluate returns suspense metrics and issues through the public api', async () => {
    const evaluator = new SuspenseEvaluator();

    const result = await evaluator.evaluate(
      '谁在暗处跟踪她？威胁越来越近，炸弹倒计时只剩最后十分钟，她必须在门被撞开前找出真相。',
    );

    expect(result.score).toBeGreaterThan(0);
    expect(result.metrics).toMatchObject({
      story_questions: expect.any(Number),
      threat_situation: expect.any(Number),
      fuse_effect: expect.any(Number),
    });
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('悬念强度');
  });
});

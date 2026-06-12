import { describe, expect, it, vi } from 'vitest';

import { DefaultWorkflowRoutingStrategy } from '../../workflow/strategies/routing-strategy.js';
import { WorkflowLevel } from '../../workflow/types.js';

describe('workflow/strategies/routing-strategy additional coverage', () => {
  it('detects rapid questions, defaults to L3 when nothing matches, and escalates long text', () => {
    const strategy = new DefaultWorkflowRoutingStrategy(() => [], (payload) => payload);
    const router = (strategy as unknown as {
      router: {
        scoreRouteFeatures: (task: string) => {
          matched_level: number;
          matched_features: Array<Record<string, unknown>>;
        };
      };
    }).router;

    expect(strategy.detectLevel('What is a protagonist?')).toBe(WorkflowLevel.L1_RAPID);
    expect(strategy.detectLevel('plain routing text with no obvious markers')).toBe(
      WorkflowLevel.L3_STANDARD,
    );

    const longQuestionScore = router.scoreRouteFeatures('What is this? '.repeat(12));

    expect(longQuestionScore.matched_level).toBe(WorkflowLevel.L3_STANDARD);
    expect(
      longQuestionScore.matched_features.some((feature) => feature.category === 'long_text_escalation'),
    ).toBe(true);
  });

  it('builds contract-shaped route responses for string inputs', async () => {
    const resolveTemplate = vi.fn((level: number) => [
      { name: `step-${level}`, description: 'template step' },
    ]);
    const withContract = vi.fn((payload: Record<string, unknown>) => ({
      ...payload,
      wrapped: true,
    }));
    const strategy = new DefaultWorkflowRoutingStrategy(resolveTemplate, withContract);

    const result = await strategy.route('What is the fastest answer?');

    expect(resolveTemplate).toHaveBeenCalledWith(WorkflowLevel.L1_RAPID);
    expect(withContract).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'L1',
        final_level: 'L1',
        suggested_workflow: [{ name: 'step-1', description: 'template step' }],
      }),
    );
    expect(result).toMatchObject({
      level: 'L1',
      final_level: 'L1',
      wrapped: true,
    });
    expect(Array.isArray(result.matched_features)).toBe(true);
    expect(result.routing_diagnostics).toBeTruthy();
  });

  it('normalizes object requests and falls back to L3 labels when the scored level is unknown', async () => {
    const resolveTemplate = vi.fn((level: number) => [
      { name: `step-${level}`, description: 'template step' },
    ]);
    const withContract = vi.fn((payload: Record<string, unknown>) => payload);
    const strategy = new DefaultWorkflowRoutingStrategy(resolveTemplate, withContract);

    (
      strategy as unknown as {
        router: {
          scoreRouteFeatures: ReturnType<typeof vi.fn>;
        };
      }
    ).router = {
      scoreRouteFeatures: vi.fn(() => ({
        matched_level: 99,
        structured_scores: {},
        legacy_scores: {},
        matched_features: [],
        structured_top_score: 0,
        legacy_level: WorkflowLevel.L3_STANDARD,
        legacy_top_score: 0,
        feature_model: {},
      })),
    };

    const result = await strategy.route({ task: 'manual override' });

    expect(resolveTemplate).toHaveBeenCalledWith(99);
    expect(result.level).toBe('L3');
    expect(result.final_level).toBe('L3');
    expect(result.description).toBeTruthy();
    expect(result.reason).toContain('0');
  });
});

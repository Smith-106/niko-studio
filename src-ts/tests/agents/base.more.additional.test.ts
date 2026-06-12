import { describe, expect, it } from 'vitest';

import { BaseAgent } from '../../agents/base';

class BudgetProbeAgent extends BaseAgent {
  constructor(config?: Record<string, unknown>) {
    super('BudgetProbeAgent', config);
  }

  run(inputData: unknown): unknown {
    return inputData;
  }
}

describe('BaseAgent more additional coverage', () => {
  it('returns a non-throwing per-request cost failure when requested', () => {
    const agent = new BudgetProbeAgent({
      max_cost_per_request: 0.001,
      max_cost_per_session: 1,
      max_tokens_per_request: 1000,
    });

    expect(
      agent.checkBudget(
        {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          estimatedCost: 0.002,
          timestamp: new Date('2026-06-06T00:00:00.000Z'),
        },
        false,
      ),
    ).toEqual([
      false,
      'Request cost $0.0020 exceeds limit $0.001',
    ]);
  });

  it('returns a non-throwing session cost failure before reaching the token branch', () => {
    const agent = new BudgetProbeAgent({
      max_cost_per_request: 1,
      max_cost_per_session: 0.003,
      max_tokens_per_request: 1000,
    });

    agent.recordUsage({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      estimatedCost: 0.0025,
      timestamp: new Date('2026-06-06T00:00:01.000Z'),
    });

    expect(
      agent.checkBudget(
        {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          estimatedCost: 0.001,
          timestamp: new Date('2026-06-06T00:00:02.000Z'),
        },
        false,
      ),
    ).toEqual([
      false,
      'Session cost $0.0035 would exceed limit $0.003',
    ]);
  });

  it('throws a session cost BudgetExceededError when the projected session exceeds the limit', () => {
    const agent = new BudgetProbeAgent({
      max_cost_per_request: 1,
      max_cost_per_session: 0.003,
      max_tokens_per_request: 1000,
    });

    agent.recordUsage({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      estimatedCost: 0.0025,
      timestamp: new Date('2026-06-06T00:00:03.000Z'),
    });

    expect(() =>
      agent.checkBudget({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedCost: 0.001,
        timestamp: new Date('2026-06-06T00:00:04.000Z'),
      }),
    ).toThrow('Session cost $0.0035 would exceed limit $0.003');
  });
});

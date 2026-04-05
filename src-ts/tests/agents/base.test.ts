import { describe, expect, it, vi } from 'vitest';

import {
  BaseAgent,
  BudgetExceededError,
  MODEL_PRICING,
  ModelProvider,
  tokenUsageToDict,
} from '../../agents/base';

class TestAgent extends BaseAgent {
  constructor(config?: Record<string, unknown>) {
    super('TestAgent', config);
  }
}

describe('BaseAgent utilities', () => {
  it('serializes token usage and exposes model pricing metadata', () => {
    const usage = {
      inputTokens: 120,
      outputTokens: 60,
      totalTokens: 180,
      estimatedCost: 0.0042,
      timestamp: new Date('2026-04-04T00:00:00.000Z'),
    };

    expect(tokenUsageToDict(usage)).toMatchObject({
      input_tokens: 120,
      output_tokens: 60,
      total_tokens: 180,
      estimated_cost: 0.0042,
      timestamp: '2026-04-04T00:00:00.000Z',
    });
    expect(MODEL_PRICING['gpt-4o'].provider).toBe(ModelProvider.OPENAI);
    expect(MODEL_PRICING['local'].contextWindow).toBe(32000);
  });

  it('counts tokens and estimates cost with the configured model', () => {
    const agent = new TestAgent({
      model: 'gpt-4o-mini',
    });

    const usage = agent.estimateCost('abcd'.repeat(100), 1000);

    expect(agent.countTokens('abcd')).toBe(1);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(1000);
    expect(usage.totalTokens).toBe(1100);
    expect(usage.estimatedCost).toBeGreaterThan(0);
  });

  it('checks request and session budget limits and can return warnings instead of throwing', () => {
    const agent = new TestAgent({
      max_cost_per_request: 0.001,
      max_cost_per_session: 0.002,
      max_tokens_per_request: 10,
      budget_warn_threshold: 0.5,
    });

    const hugeUsage = {
      inputTokens: 10,
      outputTokens: 10,
      totalTokens: 20,
      estimatedCost: 0.01,
      timestamp: new Date(),
    };

    expect(() => agent.checkBudget(hugeUsage)).toThrow(BudgetExceededError);

    const [ok, warning] = agent.checkBudget(
      {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        estimatedCost: 0.0008,
        timestamp: new Date(),
      },
      false,
    );

    expect(ok).toBe(true);
    expect(warning).toContain('Request approaching cost limit');
  });

  it('records usage, summarizes history, and resets session counters', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const agent = new TestAgent({
      model: 'gpt-4o',
    });

    agent.recordUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.001,
      timestamp: new Date('2026-04-04T00:00:00.000Z'),
    });
    agent.recordUsage({
      inputTokens: 200,
      outputTokens: 100,
      totalTokens: 300,
      estimatedCost: 0.002,
      timestamp: new Date('2026-04-04T00:01:00.000Z'),
    });

    const summary = agent.getUsageSummary();

    expect(summary).toMatchObject({
      model: 'gpt-4o',
      request_count: 2,
      total_input_tokens: 300,
      total_output_tokens: 150,
      total_tokens: 450,
      total_cost: 0.003,
    });
    expect((summary.history as Array<Record<string, unknown>>)).toHaveLength(2);

    agent.resetSession();
    const resetSummary = agent.getUsageSummary();

    expect(resetSummary.request_count).toBe(0);
    expect(resetSummary.total_cost).toBe(0);
    logSpy.mockRestore();
  });
});

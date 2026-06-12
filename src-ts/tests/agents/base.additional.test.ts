import { describe, expect, it, vi } from 'vitest';

import {
  BaseAgent,
  BudgetExceededError,
  type TokenUsage,
} from '../../agents/base';
import { LifecycleStage, type AgentContext } from '../../agents/lifecycle-hooks';

class InspectableAgent extends BaseAgent {
  constructor(config?: Record<string, unknown>) {
    super('InspectableAgent', config);
  }

  run(inputData: unknown): unknown {
    return inputData;
  }

  async runStage(
    stage: LifecycleStage,
    context: AgentContext,
  ): Promise<AgentContext> {
    return this.runLifecycle(stage, context);
  }
}

describe('BaseAgent additional coverage', () => {
  it('falls back to default pricing and default output token estimates for unknown models', () => {
    const agent = new InspectableAgent({ model: 'unknown-model' });

    const usage = agent.estimateCost('a'.repeat(12));

    expect(usage.inputTokens).toBe(3);
    expect(usage.outputTokens).toBe(500);
    expect(usage.totalTokens).toBe(503);
    expect(usage.estimatedCost).toBeCloseTo(
      (3 / 1_000_000) * 2.5 + (500 / 1_000_000) * 10,
      10,
    );
  });

  it('returns non-throwing failures for session-cost and token-limit checks', () => {
    const agent = new InspectableAgent({
      max_cost_per_request: 1,
      max_cost_per_session: 0.001,
      max_tokens_per_request: 10,
      budget_warn_threshold: 0.8,
    });

    agent.recordUsage({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      estimatedCost: 0.0009,
      timestamp: new Date('2026-06-05T00:00:00.000Z'),
    });

    expect(
      agent.checkBudget(
        {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          estimatedCost: 0.0002,
          timestamp: new Date('2026-06-05T00:00:01.000Z'),
        },
        false,
      ),
    ).toEqual([
      false,
      'Session cost $0.0011 would exceed limit $0.001',
    ]);

    expect(
      agent.checkBudget(
        {
          inputTokens: 2,
          outputTokens: 9,
          totalTokens: 11,
          estimatedCost: 0.00001,
          timestamp: new Date('2026-06-05T00:00:02.000Z'),
        },
        false,
      ),
    ).toEqual([false, 'Token count 11 exceeds limit 10']);
  });

  it('builds prompt envelopes, runs lifecycle hooks in order, and exposes the pass-through path', async () => {
    const agent = new InspectableAgent();
    const first = vi.fn(async (context: AgentContext) => ({
      ...context,
      order: ['first'],
      count: 1,
    }));
    const second = vi.fn(async (context: AgentContext) => ({
      ...context,
      order: [...(context['order'] as string[]), 'second'],
      count: Number(context['count']) + 1,
    }));

    agent.addHook(LifecycleStage.PLANNING, first);
    agent.addHook(LifecycleStage.PLANNING, second);

    const planned = await agent.runStage(LifecycleStage.PLANNING, {
      task: 'outline',
    });
    const untouched = await agent.runStage(LifecycleStage.EXECUTION, {
      task: 'draft',
    });

    expect(planned).toMatchObject({
      task: 'outline',
      order: ['first', 'second'],
      count: 2,
    });
    expect(untouched).toEqual({ task: 'draft' });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    expect(
      agent.constructPrompt(
        'plan',
        'draft next scene',
        'guided',
        'chapter 2',
        '3 options',
        'stay consistent',
      ),
    ).toContain('PURPOSE: plan');
  });

  it('routes logActivity through logger severity branches and records warning logs', () => {
    const agent = new InspectableAgent({
      max_cost_per_request: 0.01,
      max_cost_per_session: 0.01,
      max_tokens_per_request: 1000,
      budget_warn_threshold: 0.5,
    });
    const logger = (agent as unknown as { _logger: Record<string, unknown> })
      ._logger as {
      info: (message: string, metadata?: Record<string, unknown>) => void;
      warn: (message: string, metadata?: Record<string, unknown>) => void;
      error: (message: string, metadata?: Record<string, unknown>) => void;
      debug: (message: string, metadata?: Record<string, unknown>) => void;
    };

    const infoSpy = vi.spyOn(logger, 'info');
    const warnSpy = vi.spyOn(logger, 'warn');
    const errorSpy = vi.spyOn(logger, 'error');
    const debugSpy = vi.spyOn(logger, 'debug');

    const usage: TokenUsage = {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      estimatedCost: 0.006,
      timestamp: new Date('2026-06-05T00:00:03.000Z'),
    };

    const [ok, warning] = agent.checkBudget(usage, false);
    agent.logActivity('default-info', { channel: 'meta' });
    agent.logActivity('warn-msg', 'WARNING');
    agent.logActivity('error-msg', 'ERROR');
    agent.logActivity('debug-msg', 'DEBUG');

    expect(ok).toBe(true);
    expect(warning).toContain('Request approaching cost limit');
    expect(warning).toContain('Session approaching cost limit');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Request approaching cost limit'),
    );
    expect(infoSpy).toHaveBeenCalledWith('default-info', { channel: 'meta' });
    expect(warnSpy).toHaveBeenCalledWith('warn-msg', {});
    expect(errorSpy).toHaveBeenCalledWith('error-msg', {});
    expect(debugSpy).toHaveBeenCalledWith('debug-msg', {});
  });

  it('returns a null warning message when usage stays below warning thresholds', () => {
    const agent = new InspectableAgent({
      max_cost_per_request: 1,
      max_cost_per_session: 1,
      max_tokens_per_request: 1000,
      budget_warn_threshold: 0.9,
    });

    expect(
      agent.checkBudget(
        {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          estimatedCost: 0.01,
          timestamp: new Date('2026-06-06T00:00:00.000Z'),
        },
        false,
      ),
    ).toEqual([true, null]);
  });

  it('throws the token-limit BudgetExceededError when requested', () => {
    const agent = new InspectableAgent({
      max_cost_per_request: 1,
      max_cost_per_session: 1,
      max_tokens_per_request: 5,
    });

    expect(() =>
      agent.checkBudget({
        inputTokens: 2,
        outputTokens: 4,
        totalTokens: 6,
        estimatedCost: 0.0001,
        timestamp: new Date(),
      }),
    ).toThrow(BudgetExceededError);
  });
});

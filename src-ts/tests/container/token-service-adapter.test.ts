import { afterEach, describe, expect, it, vi } from 'vitest';

const estimateTokensMock = vi.fn();
const estimateCostMock = vi.fn();
const checkBudgetMock = vi.fn();
const recordUsageMock = vi.fn();
const getBudgetStatusMock = vi.fn();

vi.mock('../../services/token-service', () => ({
  TokenService: class {
    estimateTokens = estimateTokensMock;
    estimateCost = estimateCostMock;
    checkBudget = checkBudgetMock;
    recordUsage = recordUsageMock;
    getBudgetStatus = getBudgetStatusMock;
  },
}));

describe('TokenServiceAdapter', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses public token-service APIs for budget checks, usage updates, and status reads', async () => {
    estimateTokensMock.mockReturnValueOnce(321);
    estimateCostMock.mockReturnValue(0.123456);
    checkBudgetMock.mockReturnValueOnce(true);
    getBudgetStatusMock.mockReturnValueOnce({
      totalCost: 1.25,
      budget: 10,
      remaining: 8.75,
    });

    const { TokenServiceAdapter } = await import('../../container/adapters.js');
    const adapter = new TokenServiceAdapter();

    expect(adapter.countTokens('chapter opening')).toBe(321);
    expect(adapter.isWithinBudget('session-1', 1200)).toBe(true);

    adapter.updateUsage('session-1', 1200);

    expect(adapter.getUsage('session-1')).toEqual({
      used: 1.25,
      budget: 10,
      remaining: 8.75,
    });

    expect(estimateCostMock).toHaveBeenNthCalledWith(1, 1200, 0, 'default');
    expect(checkBudgetMock).toHaveBeenCalledWith(0.123456, undefined, 'session-1');
    expect(recordUsageMock).toHaveBeenCalledWith(1200, 0.123456, 'default', 'session-1', 1200, 0);
    expect(getBudgetStatusMock).toHaveBeenCalledWith('session-1');
  });
});

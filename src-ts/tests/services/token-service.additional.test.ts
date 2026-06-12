import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  TokenService,
  getTokenService,
  resetTokenService,
} from '../../services/token-service.js';

describe('TokenService additional coverage', () => {
  let tempDir: string;
  let service: TokenService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'niko-token-extra-'));
    service = new TokenService(join(tempDir, 'token_usage.db'), { maxCostPerSession: 5.0 });
  });

  afterEach(() => {
    service.close();
    resetTokenService();
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('groups usage summaries by day', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 'day-session');
    service.recordUsage(2000, 0.02, 'claude-3-5-sonnet', 'day-session');

    const summary = service.getUsageSummary('day-session', 'day');

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      input_tokens: 2100,
      output_tokens: 900,
      total_cost: 0.03,
      request_count: 2,
    });
    expect(typeof summary[0]?.day).toBe('string');
    expect((summary[0]?.day as string).length).toBeGreaterThan(0);
  });

  it('keeps usagePercent at zero for zero-budget sessions', () => {
    service.setBudget('zero-budget', 0);
    service.recordUsage(100, 0.25, 'gpt-4o', 'zero-budget', 70, 30);

    const status = service.getBudgetStatus('zero-budget');

    expect(status).toMatchObject({
      sessionId: 'zero-budget',
      budget: 0,
      totalCost: 0.25,
      remaining: 0,
      usagePercent: 0,
      requestCount: 1,
    });
  });

  it('defaults missing session and partial token counts to zero-filled records', () => {
    service.recordUsage(5, 0.01, 'gpt-4o', undefined, undefined, 5);
    service.recordUsage(6, 0.02, 'gpt-4o', undefined, 6, undefined);

    const history = service.getUsageHistory('default');

    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'default',
          inputTokens: 0,
          outputTokens: 5,
        }),
        expect.objectContaining({
          sessionId: 'default',
          inputTokens: 6,
          outputTokens: 0,
        }),
      ]),
    );
  });

  it('reuses and resets the exported singleton service', () => {
    resetTokenService();
    const singleton = getTokenService(join(tempDir, 'local-singleton.db'));

    expect(getTokenService(join(tempDir, 'ignored-local.db'))).toBe(singleton);
    resetTokenService();

    const recreated = getTokenService(join(tempDir, 'local-recreated.db'));
    expect(recreated).not.toBe(singleton);
  });

  it('registers an exit shutdown hook that resets the singleton service', async () => {
    const registered: Array<() => void> = [];
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === 'exit') {
        registered.push(listener as () => void);
      }
      return process;
    });

    vi.resetModules();
    const module = await import('../../services/token-service');
    const singleton = module.getTokenService(join(tempDir, 'singleton.db'));

    expect(module.getTokenService(join(tempDir, 'ignored.db'))).toBe(singleton);
    expect(registered).toHaveLength(1);

    registered[0]();

    const afterShutdown = module.getTokenService(join(tempDir, 'after-shutdown.db'));
    expect(afterShutdown).not.toBe(singleton);
    afterShutdown.close();
    processOnSpy.mockRestore();
  });
});

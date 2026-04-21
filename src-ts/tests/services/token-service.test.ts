/**
 * TokenService Tests
 *
 * Tests token estimation, cost calculation, budget control,
 * usage tracking, and model pricing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TokenService,
  MODEL_PRICING,
  getTokenService,
  resetTokenService,
} from '../../services/token-service';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-token-'));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tempDir: string;
let service: TokenService;

beforeEach(() => {
  tempDir = createTempDir();
  const dbPath = join(tempDir, 'token_usage.db');
  service = new TokenService(dbPath, { maxCostPerSession: 5.0 });
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  service.close();
  resetTokenService();
  rmSync(tempDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// MODEL_PRICING
// ---------------------------------------------------------------------------

describe('MODEL_PRICING', () => {
  it('has entries for known models', () => {
    expect(MODEL_PRICING['gpt-4o']).toBeDefined();
    expect(MODEL_PRICING['claude-3-5-sonnet']).toBeDefined();
    expect(MODEL_PRICING['gemini-2.0-flash']).toBeDefined();
  });

  it('has default fallback pricing', () => {
    expect(MODEL_PRICING['default']).toBeDefined();
    expect(MODEL_PRICING['default'].input).toBeGreaterThan(0);
    expect(MODEL_PRICING['default'].output).toBeGreaterThan(0);
  });

  it('all models have input and output pricing', () => {
    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThanOrEqual(pricing.input);
    }
  });
});

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

describe('TokenService.estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(service.estimateTokens('')).toBe(0);
  });

  it('estimates English text tokens', () => {
    const text = 'Hello, this is a test sentence for token estimation.';
    const tokens = service.estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(text.length);
  });

  it('estimates Chinese text tokens (more tokens per char)', () => {
    const chineseText = '\u4f60\u597d\u4e16\u754c\u6211\u662f\u4e2d\u6587\u6d4b\u8bd5';
    const tokens = service.estimateTokens(chineseText);
    expect(tokens).toBeGreaterThan(0);
  });

  it('Chinese text yields more tokens than English text of same length', () => {
    const englishText = 'a'.repeat(100);
    const chineseText = '\u4e2d'.repeat(50); // 50 Chinese chars = 150 bytes

    const englishTokens = service.estimateTokens(englishText);
    const chineseTokens = service.estimateTokens(chineseText);

    // Chinese chars are ~1.5 chars/token, English ~4 chars/token
    // So same-length Chinese text produces more tokens
    expect(chineseTokens / chineseText.length).toBeGreaterThan(
      englishTokens / englishText.length,
    );
  });
});

describe('TokenService.estimateMessages', () => {
  it('estimates tokens for messages array', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];
    const tokens = service.estimateMessages(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('handles message with name field', () => {
    const messages = [
      { role: 'user', content: 'Hi', name: 'Alice' },
    ];
    const tokens = service.estimateMessages(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('handles multimodal content with image', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'http://example.com/image.png' } },
        ],
      },
    ];
    const tokens = service.estimateMessages(messages);
    expect(tokens).toBeGreaterThan(0);
    // Should include 85 low-res base tokens for image
    expect(tokens).toBeGreaterThanOrEqual(85);
  });

  it('returns 3 for empty messages array (end tokens only)', () => {
    const tokens = service.estimateMessages([]);
    expect(tokens).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Cost analysis
// ---------------------------------------------------------------------------

describe('TokenService.estimateCost', () => {
  it('estimates cost for known model', () => {
    const cost = service.estimateCost(1000, 500, 'gpt-4o');
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });

  it('uses default pricing for unknown model', () => {
    const cost = service.estimateCost(1000, 500, 'unknown-model-xyz');
    expect(cost).toBeGreaterThan(0);
  });

  it('estimates cost for Claude model', () => {
    const cost = service.estimateCost(1000000, 500000, 'claude-3-5-sonnet');
    expect(cost).toBeGreaterThan(0);
    // Claude 3.5 Sonnet: $3/M input, $15/M output
    // 1M input = $3, 500K output = $7.50, total = $10.50
    expect(cost).toBeCloseTo(10.5, 2);
  });
});

describe('TokenService.getModelPricing', () => {
  it('returns pricing for known model', () => {
    const pricing = service.getModelPricing('gpt-4o');
    expect(pricing.input).toBe(2.50);
    expect(pricing.output).toBe(10.00);
  });

  it('uses prefix match for model variants', () => {
    const pricing = service.getModelPricing('gpt-4o-2024-05-13');
    // Should match 'gpt-4o' prefix
    expect(pricing.input).toBe(2.50);
  });

  it('returns default for completely unknown model', () => {
    const pricing = service.getModelPricing('my-custom-model-v3');
    expect(pricing).toBe(MODEL_PRICING['default']);
  });
});

describe('TokenService.listModels', () => {
  it('returns list excluding default', () => {
    const models = service.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.model === 'gpt-4o')).toBe(true);
    expect(models.some((m) => m.model === 'default')).toBe(false);
    expect(models.every((m) => m.encoding === 'cl100k_base')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Budget control
// ---------------------------------------------------------------------------

describe('TokenService budget', () => {
  it('setBudget and getBudget persist budget', () => {
    service.setBudget('session-1', 20.0);
    expect(service.getBudget('session-1')).toBe(20.0);
  });

  it('getBudget returns default for unknown session', () => {
    expect(service.getBudget('unknown-session')).toBe(5.0);
  });

  it('checkBudget returns true when under budget', () => {
    expect(service.checkBudget(1.0, 5.0)).toBe(true);
  });

  it('checkBudget returns false when over budget', () => {
    expect(service.checkBudget(10.0, 5.0)).toBe(false);
  });

  it('checkBudget considers session usage when sessionId given', () => {
    service.setBudget('budget-session', 5.0);
    service.recordUsage(1000, 1.0, 'gpt-4o', 'budget-session', 700, 300);
    expect(service.checkBudget(5.0, undefined, 'budget-session')).toBe(false);
  });

  it('getBudgetStatus returns full status', () => {
    service.setBudget('status-session', 10.0);
    service.recordUsage(1000, 0.5, 'gpt-4o', 'status-session', 700, 300);

    const status = service.getBudgetStatus('status-session');
    expect(status.sessionId).toBe('status-session');
    expect(status.budget).toBe(10.0);
    expect(status.totalCost).toBe(0.5);
    expect(status.remaining).toBeCloseTo(9.5, 2);
    expect(status.usagePercent).toBeCloseTo(5.0, 2);
    expect(status.requestCount).toBe(1);
    expect(status.totalInputTokens).toBe(700);
    expect(status.totalOutputTokens).toBe(300);
  });

  it('getBudgetStatus uses default session when none given', () => {
    const status = service.getBudgetStatus();
    expect(status.sessionId).toBe('default');
    expect(status.budget).toBe(5.0);
  });
});

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------

describe('TokenService usage tracking', () => {
  it('recordUsage stores usage and getUsageHistory retrieves it', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 'hist-session', 700, 300);

    const history = service.getUsageHistory('hist-session');
    expect(history).toHaveLength(1);
    expect(history[0].sessionId).toBe('hist-session');
    expect(history[0].model).toBe('gpt-4o');
    expect(history[0].inputTokens).toBe(700);
    expect(history[0].outputTokens).toBe(300);
    expect(history[0].cost).toBe(0.01);
  });

  it('recordUsage splits tokens when input/output not given', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 'split-session');

    const history = service.getUsageHistory('split-session');
    expect(history[0].inputTokens).toBe(700);
    expect(history[0].outputTokens).toBe(300);
  });

  it('getUsageHistory defaults to all sessions', () => {
    service.recordUsage(100, 0.001, 'gpt-4o', 's1');
    service.recordUsage(200, 0.002, 'gpt-4o', 's2');

    const history = service.getUsageHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('getUsageHistory respects limit', () => {
    for (let i = 0; i < 10; i++) {
      service.recordUsage(100, 0.001, 'gpt-4o', 'limit-session');
    }
    const history = service.getUsageHistory('limit-session', 3);
    expect(history).toHaveLength(3);
  });

  it('getUsageSummary groups by model', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 'summary-session');
    service.recordUsage(2000, 0.02, 'gpt-4o', 'summary-session');

    const summary = service.getUsageSummary('summary-session', 'model');
    expect(summary.length).toBeGreaterThanOrEqual(1);
    expect(summary[0].model).toBe('gpt-4o');
    // First call: 1000 tokens -> inp=700, out=300
    // Second call: 2000 tokens -> inp=1400, out=600
    expect(summary[0].input_tokens).toBe(2100);
    expect(summary[0].request_count).toBe(2);
  });

  it('getUsageSummary groups by session', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 's1');
    service.recordUsage(2000, 0.02, 'gpt-4o', 's2');

    const summary = service.getUsageSummary(undefined, 'session');
    expect(summary.length).toBeGreaterThanOrEqual(2);
  });

  it('clearSessionUsage removes usage for a session', () => {
    for (let i = 0; i < 5; i++) {
      service.recordUsage(100, 0.001, 'gpt-4o', 'clear-session');
    }
    const deleted = service.clearSessionUsage('clear-session');
    expect(deleted).toBe(5);

    const history = service.getUsageHistory('clear-session');
    expect(history).toHaveLength(0);
  });

  it('getUsageSummary filters by session', () => {
    service.recordUsage(1000, 0.01, 'gpt-4o', 'filter-s');
    service.recordUsage(2000, 0.02, 'claude-3-5-sonnet', 'other-s');

    const summary = service.getUsageSummary('filter-s', 'model');
    expect(summary).toHaveLength(1);
    expect(summary[0].model).toBe('gpt-4o');
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('TokenService lifecycle', () => {
  it('close can be called safely', () => {
    const svc = new TokenService(join(tempDir, 'close-test.db'));
    svc.close(); // Should not throw
    svc.close(); // Double close should not throw
  });

  it('can be reopened after close', () => {
    const dbPath = join(tempDir, 'reopen.db');
    const svc = new TokenService(dbPath);
    svc.setBudget('reopen-s', 10.0);
    svc.close();

    const svc2 = new TokenService(dbPath);
    expect(svc2.getBudget('reopen-s')).toBe(10.0);
    svc2.close();
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('singleton functions', () => {
  it('getTokenService returns same instance', () => {
    const t1 = getTokenService(join(tempDir, 'singleton.db'));
    const t2 = getTokenService(join(tempDir, 'singleton.db'));
    expect(t1).toBe(t2);
    t1.close();
  });

  it('resetTokenService closes and clears instance', () => {
    const t1 = getTokenService(join(tempDir, 'reset-singleton.db'));
    resetTokenService();
    const t2 = getTokenService(join(tempDir, 'reset-singleton.db'));
    expect(t1).not.toBe(t2);
    t2.close();
  });
});

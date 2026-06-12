import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  containsDetectionEvasionIntent,
  normalizeContextBudgetMetrics,
  normalizeIssueText,
  normalizeRetrievalMetrics,
  normalizeSelfLearningMetrics,
} from '../../mcp/contract';

describe('mcp/contract more additional coverage', () => {
  afterEach(() => {
    vi.doUnmock('../../workflow/types.js');
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('defaults missing terminal fields while preserving preexisting legacy entries from the workflow helper', async () => {
    vi.doMock('../../workflow/types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../workflow/types.js')>();
      return {
        ...actual,
        ensureContractPayload: vi.fn().mockReturnValue({
          terminal_state: 'kept-state',
          legacy_contract_fields: {
            decision: 'legacy-decision',
            terminal: 'legacy-terminal',
            terminal_state: 'legacy-state',
          },
        }),
      };
    });

    const { withTerminalContract } = await import('../../mcp/contract.js?legacy-preserve');
    const result = withTerminalContract({});

    expect(result).toMatchObject({
      decision: 'go',
      terminal: 'done',
      terminal_state: 'kept-state',
      legacy_contract_fields: {
        decision: 'legacy-decision',
        terminal: 'legacy-terminal',
        terminal_state: 'legacy-state',
      },
    });
  });

  it('detects prohibited detection keys directly on object payloads', () => {
    expect(
      containsDetectionEvasionIntent({
        anti_detection: false,
      }),
    ).toBe(true);
  });

  it('covers empty-text issue fallback and metric fallback branches', () => {
    expect(normalizeIssueText('   ', 'fallback-text')).toBe('fallback-text');

    expect(normalizeRetrievalMetrics({}, {})).toEqual({
      stage1_candidates: 0,
      stage2_selected: 0,
      cited_count: 0,
      effective_hit_rate: 0,
    });

    expect(normalizeContextBudgetMetrics({}, {})).toEqual({
      token_total: 0,
      token_effective: 0,
      utilization: 0,
    });

    expect(
      normalizeSelfLearningMetrics(
        {},
        {
          strategy_adoption_rate: 0.25,
          reflector_triggered: true,
          curator_applied: true,
        },
      ),
    ).toEqual({
      strategy_adoption_rate: 0.25,
      reflector_triggered: true,
      curator_applied: true,
    });

    expect(normalizeSelfLearningMetrics({}, {})).toEqual({
      strategy_adoption_rate: 0,
      reflector_triggered: false,
      curator_applied: false,
    });
  });

  it('covers guard-enabled fallback through config when env is unset', async () => {
    delete process.env.NIKO_DETECTION_EVASION_GUARD;

    vi.doMock('../../mcp/config.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../mcp/config.js')>();
      return {
        ...actual,
        getConfigValue: vi.fn().mockReturnValue(false),
      };
    });

    const { resolveDetectionEvasionGuardEnabled } = await import('../../mcp/contract.js?guard-config-fallback');
    expect(resolveDetectionEvasionGuardEnabled()).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_GUARD_ENV = process.env.NIKO_DETECTION_EVASION_GUARD;

function restoreGuardEnv(): void {
  if (ORIGINAL_GUARD_ENV === undefined) {
    delete process.env.NIKO_DETECTION_EVASION_GUARD;
  } else {
    process.env.NIKO_DETECTION_EVASION_GUARD = ORIGINAL_GUARD_ENV;
  }
}

describe('mcp/contract tail coverage', () => {
  afterEach(() => {
    restoreGuardEnv();
    vi.doUnmock('../../workflow/types.js');
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('covers primitive-safe detection checks, env-driven guard resolution, direct publish values, and null result merge fallback', async () => {
    process.env.NIKO_DETECTION_EVASION_GUARD = 'yes';

    const {
      containsDetectionEvasionIntent,
      guardDetectionEvasionPayload,
      mergeQualitySidecar,
      normalizePublishRecommendation,
    } = await import('../../mcp/contract.js?tail-direct');

    expect(containsDetectionEvasionIntent(42)).toBe(false);
    expect(guardDetectionEvasionPayload({ prompt: 'polish the pacing only' })).toBeNull();
    expect(
      normalizePublishRecommendation(
        { publish_recommendation: '  block  ' },
        'pass',
      ),
    ).toBe('block');
    expect(
      mergeQualitySidecar(
        null,
        { stage1_candidates: 4 },
        null,
      ),
    ).toEqual({
      metrics: {
        retrieval: {
          stage1_candidates: 4,
        },
      },
    });
  });

  it('rebuilds legacy fields when workflow defaults return a null legacy payload', async () => {
    vi.doMock('../../workflow/types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../workflow/types.js')>();
      return {
        ...actual,
        ensureContractPayload: vi.fn().mockReturnValue({
          workflow_level: 'L4-Brainstorm',
          decision: 'go',
          terminal: 'interrupted',
          legacy_contract_fields: null,
        }),
      };
    });

    const { withTerminalContract } = await import('../../mcp/contract.js?legacy-null');
    const result = withTerminalContract({ workflow_level: 'L4-Brainstorm' });

    expect(result.legacy_contract_fields).toMatchObject({
      decision: 'go',
      terminal: 'aborted',
      terminal_state: 'aborted',
    });
    expect(result.terminal_state).toBe('aborted');
  });

  it('falls back to an empty contract payload when the workflow helper returns null', async () => {
    vi.doMock('../../workflow/types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../workflow/types.js')>();
      return {
        ...actual,
        ensureContractPayload: vi.fn().mockReturnValue(null),
      };
    });

    const contractModule = await import('../../mcp/contract.js?contract-null');
    const normalized = contractModule.normalizeQualityPayload({
      quality_score: 7,
      issues: ['ignore-me'],
    });

    expect(normalized).toEqual({
      analysis_schema_version: contractModule.ANALYSIS_SCHEMA_VERSION,
      quality_score: 7,
      issues: [],
      metrics: {
        dialogue_ratio: 0,
        conflict_points: 0,
        visual_details: 0,
        template_sentence_ratio: 0,
        dimension_scores: {
          repetition: 0,
          tone: 0,
          clarity: 0,
          causality: 0,
          detail: 0,
          factuality: 0,
        },
        retrieval: {
          stage1_candidates: 0,
          stage2_selected: 0,
          cited_count: 0,
          effective_hit_rate: 0,
        },
        context_budget: {
          token_total: 0,
          token_effective: 0,
          utilization: 0,
        },
        self_learning: {
          strategy_adoption_rate: 0,
          reflector_triggered: false,
          curator_applied: false,
        },
      },
      publish_recommendation: 'revise',
    });
  });

  it('uses the final schema constant fallback when all earlier candidates normalize to empty strings', async () => {
    vi.doMock('../../workflow/types.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../workflow/types.js')>();
      return {
        ...actual,
        ANALYSIS_SCHEMA_VERSION: '   ',
      };
    });

    const { normalizeSchemaVersion } = await import('../../mcp/contract.js?schema-blank');

    expect(normalizeSchemaVersion({}, {})).toBe('   ');
  });
});

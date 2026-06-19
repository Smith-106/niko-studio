import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PhaseOrchestratorAdapter branch-gap coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../workflow/team/phase-gate-evaluator.js');
  });

  it('falls back to an empty transition list when a valid phase has no mapped transitions', async () => {
    vi.doMock('../../workflow/team/phase-gate-evaluator.js', async () => {
      const actual = await vi.importActual<typeof import('../../workflow/team/phase-gate-evaluator.js')>(
        '../../workflow/team/phase-gate-evaluator.js',
      );
      return {
        ...actual,
        TEAM_TRANSITIONS: new Map(),
      };
    });

    const { PhaseOrchestratorAdapter } = await import('../../container/adapters.js');
    const { TeamPhase } = await import('../../workflow/team/phase-gate-evaluator.js');
    const adapter = new PhaseOrchestratorAdapter();

    expect(adapter.getQualityGates(TeamPhase.planning)).toEqual([]);
  });

  it('uses NIKO_GATEWAY_INITIAL_PHASE env var when set to a valid phase', async () => {
    const originalPhase = process.env['NIKO_GATEWAY_INITIAL_PHASE'];
    process.env['NIKO_GATEWAY_INITIAL_PHASE'] = 'execution';

    try {
      const { PhaseOrchestratorAdapter } = await import('../../container/adapters.js');
      const { TeamPhase } = await import('../../workflow/team/phase-gate-evaluator.js');
      const adapter = new PhaseOrchestratorAdapter();

      // Verify the adapter was initialized with the execution phase
      expect(adapter.orchestrator.phase).toBe(TeamPhase.execution);
    } finally {
      if (originalPhase === undefined) {
        delete process.env['NIKO_GATEWAY_INITIAL_PHASE'];
      } else {
        process.env['NIKO_GATEWAY_INITIAL_PHASE'] = originalPhase;
      }
    }
  });
});

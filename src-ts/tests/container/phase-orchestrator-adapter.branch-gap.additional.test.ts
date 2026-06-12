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
});

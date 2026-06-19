import { afterEach, describe, expect, it } from 'vitest';

import {
  TeamPhase,
  TEAM_TRANSITIONS,
  type PhaseGateInput,
} from '../../../workflow/team/phase-gate-evaluator.js';
import { PhaseOrchestrator } from '../../../workflow/team/phase-orchestrator.js';

const passingGate: PhaseGateInput = {
  review: { verdict: 'APPROVE' },
  verification: { status: 'verified' },
  validation: {
    status: 'valid',
    test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 },
  },
};

describe('PhaseOrchestrator branch-gap coverage', () => {
  let verificationTransitions: readonly { to: TeamPhase; maxRetries: number | null }[] | undefined;

  afterEach(() => {
    const transitions = TEAM_TRANSITIONS as Map<TeamPhase, readonly { to: TeamPhase; maxRetries: number | null }[]>;
    if (verificationTransitions) {
      transitions.set(TeamPhase.verification, verificationTransitions);
      verificationTransitions = undefined;
    }
  });

  it('falls back to an empty transition list when the current phase is unmapped', () => {
    const orchestrator = new PhaseOrchestrator();
    (orchestrator as { _phase: string })._phase = 'custom-unmapped-phase';

    const result = orchestrator.advance(passingGate);

    expect(result).toEqual({
      success: false,
      from: 'custom-unmapped-phase',
      to: 'custom-unmapped-phase',
      fixAttempts: 0,
      gateReasons: [],
    });
  });

  it('uses the first transition when no non-fix target exists', () => {
    const transitions = TEAM_TRANSITIONS as Map<TeamPhase, readonly { to: TeamPhase; maxRetries: number | null }[]>;
    verificationTransitions = transitions.get(TeamPhase.verification);
    transitions.set(TeamPhase.verification, [{ to: TeamPhase.fix, maxRetries: null }]);

    const orchestrator = new PhaseOrchestrator(TeamPhase.verification);
    const result = orchestrator.advance(passingGate);

    expect(result).toMatchObject({
      success: true,
      from: TeamPhase.verification,
      to: TeamPhase.fix,
      fixAttempts: 1,
      forcedComplete: false,
      gateReasons: [],
    });
    expect(orchestrator.phase).toBe(TeamPhase.fix);
  });

  it('returns failure when a soft gate cannot find a fix transition', () => {
    const orchestrator = new PhaseOrchestrator(TeamPhase.planning);
    const result = orchestrator.advance(
      {
        verification: {
          status: 'gaps_found',
          gaps: [{ severity: 'critical', description: 'Needs more work' }],
        },
      },
      false,
    );

    expect(result).toEqual({
      success: false,
      from: TeamPhase.planning,
      to: TeamPhase.planning,
      fixAttempts: 0,
      gateReasons: ['1 high/critical verification gap(s)'],
    });
  });
});

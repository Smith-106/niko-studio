import { afterEach, describe, expect, it, vi } from 'vitest';

const appendFileSyncMock = vi.hoisted(() => vi.fn());
const existsSyncMock = vi.hoisted(() => vi.fn());
const mkdirSyncMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  appendFileSync: appendFileSyncMock,
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
  writeFileSync: vi.fn(),
}));

vi.mock('../../../logger/index.js', () => ({
  createLogger: () => ({
    warn: warnMock,
  }),
}));

import { evaluatePhaseGate, TeamPhase } from '../../../workflow/team/phase-gate-evaluator.js';
import { PhaseOrchestrator } from '../../../workflow/team/phase-orchestrator.js';

describe('PhaseOrchestrator additional coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns an unsuccessful result when the current phase has no outgoing transition', () => {
    existsSyncMock.mockReturnValue(true);
    const orchestrator = new PhaseOrchestrator(TeamPhase.complete);

    const result = orchestrator.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
    });

    expect(result).toMatchObject({
      success: false,
      from: TeamPhase.complete,
      to: TeamPhase.complete,
      fixAttempts: 0,
    });
    expect(orchestrator.phase).toBe(TeamPhase.complete);
  });

  it('swallows JSONL persistence failures and logs a warning', () => {
    existsSyncMock.mockReturnValue(false);
    appendFileSyncMock.mockImplementation(() => {
      throw new Error('disk full');
    });

    const orchestrator = new PhaseOrchestrator(TeamPhase.planning, 'C:/tmp/phase-orchestrator');
    const result = orchestrator.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    });

    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.execution);
    expect(mkdirSyncMock).toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith('Failed to persist transition record', { error: 'Error: disk full' });
  });

  it('covers review fallback counts and critical-only verification gaps', () => {
    const blocked = evaluatePhaseGate({
      review: { verdict: 'BLOCK' },
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain('Review verdict is BLOCK (? findings)');

    const gaps = evaluatePhaseGate({
      verification: {
        status: 'gaps_found',
        gaps: [{ severity: 'critical', description: 'Missing gate' }],
      },
    });
    expect(gaps.allowed).toBe(false);
    expect(gaps.reasons).toContain('1 high/critical verification gap(s)');
  });

  it('uses the empty verification-gap fallback when gaps are omitted', () => {
    const result = evaluatePhaseGate({
      verification: {
        status: 'gaps_found',
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.overridable).toBe(true);
  });
});

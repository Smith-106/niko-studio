import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  evaluatePhaseGate,
  MAX_FIX_ATTEMPTS,
  TeamPhase,
  TEAM_TRANSITIONS,
  type PhaseGateInput,
} from '../../../workflow/team/phase-gate-evaluator.js';
import { PhaseOrchestrator } from '../../../workflow/team/phase-orchestrator.js';

describe('evaluatePhaseGate', () => {
  it('allows when all checks pass', () => {
    const input: PhaseGateInput = {
      review: { verdict: 'APPROVE', findings_count: 0 },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    };
    const result = evaluatePhaseGate(input);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('blocks on review verdict BLOCK (hard gate)', () => {
    const input: PhaseGateInput = {
      review: { verdict: 'BLOCK', findings_count: 5 },
    };
    const result = evaluatePhaseGate(input);
    expect(result.allowed).toBe(false);
    expect(result.overridable).toBe(false);
    expect(result.reasons[0]).toContain('BLOCK');
  });

  it('soft-blocks on high/critical verification gaps', () => {
    const input: PhaseGateInput = {
      verification: {
        status: 'gaps_found',
        gaps: [
          { severity: 'high', description: 'Missing auth check' },
          { severity: 'low', description: 'Minor style issue' },
          { severity: 'critical', description: 'SQL injection' },
        ],
      },
    };
    const result = evaluatePhaseGate(input);
    expect(result.allowed).toBe(false);
    expect(result.overridable).toBe(true);
    expect(result.reasons[0]).toContain('2');
  });

  it('soft-blocks on zero test coverage', () => {
    const input: PhaseGateInput = {
      validation: {
        status: 'valid',
        test_coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
      },
    };
    const result = evaluatePhaseGate(input);
    expect(result.allowed).toBe(false);
    expect(result.overridable).toBe(true);
    expect(result.reasons[0]).toContain('0%');
  });

  it('ignores low-severity gaps', () => {
    const input: PhaseGateInput = {
      verification: {
        status: 'gaps_found',
        gaps: [
          { severity: 'low', description: 'Style issue' },
          { severity: 'medium', description: 'Refactor suggestion' },
        ],
      },
    };
    const result = evaluatePhaseGate(input);
    expect(result.allowed).toBe(true);
  });

  it('handles null/undefined input gracefully', () => {
    const result = evaluatePhaseGate({});
    expect(result.allowed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });
});

describe('TeamPhase transitions', () => {
  it('planning → execution', () => {
    const transitions = TEAM_TRANSITIONS.get(TeamPhase.planning)!;
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe(TeamPhase.execution);
  });

  it('verification → complete or fix', () => {
    const transitions = TEAM_TRANSITIONS.get(TeamPhase.verification)!;
    expect(transitions).toHaveLength(2);
    expect(transitions.map(t => t.to)).toContain(TeamPhase.complete);
    expect(transitions.map(t => t.to)).toContain(TeamPhase.fix);
  });

  it('fix → review with maxRetries', () => {
    const transitions = TEAM_TRANSITIONS.get(TeamPhase.fix)!;
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe(TeamPhase.review);
    expect(transitions[0].maxRetries).toBe(MAX_FIX_ATTEMPTS);
  });
});

describe('PhaseOrchestrator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-orch-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows EPERM */ }
  });

  it('starts at planning phase', () => {
    const orch = new PhaseOrchestrator();
    expect(orch.phase).toBe(TeamPhase.planning);
    expect(orch.fixAttempts).toBe(0);
  });

  it('advances through happy path: planning → execution → review → verification → complete', () => {
    const orch = new PhaseOrchestrator();

    // planning → execution
    const r1 = orch.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    });
    expect(r1.success).toBe(true);
    expect(r1.from).toBe(TeamPhase.planning);
    expect(r1.to).toBe(TeamPhase.execution);

    // execution → review
    const r2 = orch.advance({ review: { verdict: 'APPROVE' } });
    expect(r2.success).toBe(true);
    expect(r2.to).toBe(TeamPhase.review);

    // review → verification
    const r3 = orch.advance({ review: { verdict: 'APPROVE' } });
    expect(r3.success).toBe(true);
    expect(r3.to).toBe(TeamPhase.verification);

    // verification → complete
    const r4 = orch.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    });
    expect(r4.success).toBe(true);
    expect(r4.to).toBe(TeamPhase.complete);
  });

  it('enters fix loop when soft gate fails', () => {
    const orch = new PhaseOrchestrator(TeamPhase.verification);

    const result = orch.advance({
      verification: {
        status: 'gaps_found',
        gaps: [{ severity: 'high', description: 'Missing test' }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.fix);
    expect(orch.fixAttempts).toBe(1);
  });

  it('force-overrides soft gate', () => {
    const orch = new PhaseOrchestrator(TeamPhase.verification);

    const result = orch.advance(
      {
        verification: {
          status: 'gaps_found',
          gaps: [{ severity: 'high', description: 'Missing test' }],
        },
      },
      true, // force
    );

    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.complete);
    expect(result.forcedComplete).toBe(true);
  });

  it('hard gate BLOCK cannot be force-overridden', () => {
    const orch = new PhaseOrchestrator(TeamPhase.verification);

    const result = orch.advance(
      { review: { verdict: 'BLOCK', findings_count: 5 } },
      true, // force — should not work
    );

    expect(result.success).toBe(false);
    expect(orch.phase).toBe(TeamPhase.verification);
  });

  it('fix-retry exhausts and forces completion', () => {
    const orch = new PhaseOrchestrator(TeamPhase.verification);

    // First 3 fix attempts
    for (let i = 0; i < MAX_FIX_ATTEMPTS; i++) {
      orch.advance({
        verification: {
          status: 'gaps_found',
          gaps: [{ severity: 'high', description: 'Missing test' }],
        },
      });
      expect(orch.phase).toBe(TeamPhase.fix);

      // Simulate fix → review
      if (i < MAX_FIX_ATTEMPTS - 1) {
        // fix → review (gate passes review)
        orch.advance({ review: { verdict: 'APPROVE' } });
        // review → verification (soft gate still fails)
        orch.advance({
          verification: {
            status: 'gaps_found',
            gaps: [{ severity: 'high', description: 'Still missing' }],
          },
        });
      }
    }

    // After exhausting fix attempts, should force complete
    const result = orch.advance({
      verification: {
        status: 'gaps_found',
        gaps: [{ severity: 'high', description: 'Persistent' }],
      },
    });
    expect(result.forcedComplete).toBe(true);
  });

  it('persists transition records to JSONL', () => {
    const orch = new PhaseOrchestrator(TeamPhase.planning, tmpDir);

    orch.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    });

    const jsonlPath = path.join(tmpDir, 'phase-transitions.jsonl');
    expect(fs.existsSync(jsonlPath)).toBe(true);

    const content = fs.readFileSync(jsonlPath, 'utf-8').trim();
    const record = JSON.parse(content);
    expect(record.from).toBe('planning');
    expect(record.to).toBe('execution');
    expect(record.trigger).toBe('gate-passed');
    expect(record.gateReasons).toHaveLength(0);
  });

  it('reset returns to initial phase', () => {
    const orch = new PhaseOrchestrator(TeamPhase.verification);
    orch.advance({
      verification: { status: 'gaps_found', gaps: [{ severity: 'high', description: 'gap' }] },
    });
    expect(orch.fixAttempts).toBeGreaterThan(0);

    orch.reset();
    expect(orch.phase).toBe(TeamPhase.planning);
    expect(orch.fixAttempts).toBe(0);
    expect(orch.history).toHaveLength(0);
  });

  it('history tracks all transitions', () => {
    const orch = new PhaseOrchestrator();

    orch.advance({
      review: { verdict: 'APPROVE' },
      verification: { status: 'verified' },
      validation: { status: 'valid', test_coverage: { statements: 80, branches: 70, functions: 90, lines: 85 } },
    });

    expect(orch.history).toHaveLength(1);
    expect(orch.history[0].from).toBe(TeamPhase.planning);
    expect(orch.history[0].to).toBe(TeamPhase.execution);
  });
});

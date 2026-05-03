/**
 * L5 Coordinator Stress Tests (PLN-006 Phase 2 / TASK-004)
 *
 * Surfaces FM-3 (mid-phase interrupt windows lose in-flight unit progress)
 * from audit-l4-l5.md, plus end-to-end persistState contract and concurrent
 * session isolation.
 *
 * Mirrors TASK-003 pattern: failures are recorded — never thrown — so
 * `vitest run` exits 0 and TASK-005 can consume
 * `stress-results-l5.json.failed[]` for targeted fixes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, test, afterAll } from 'vitest';

import {
  Level5Coordinator,
  coordinatorStateToDict,
  type CoordinatorState,
} from '../../workflow/levels/level5-coordinator.js';
import {
  createTempSessionRoot,
  validateNoUnhandledRejections,
  withTimeout,
} from './harness/stress-harness.js';
import { l5ThreeStepChain } from './harness/scenarios.js';

// ----------------------------------------------------------------------
// Results collector (written to disk in afterAll)
// ----------------------------------------------------------------------
const RESULTS_DIR = path.resolve(
  process.cwd(),
  '..',
  'desktop',
  '.workflow',
  'scratch',
  '20260503-plan-P2-l4-l5-workflow-hardening',
);
const RESULTS_PATH = path.join(RESULTS_DIR, 'stress-results-l5.json');

interface PassRecord {
  test: string;
  notes: string;
}

interface FailRecord {
  test: string;
  error: string;
  file_line: string;
  repro: string;
}

interface ResultsBundle {
  passed: PassRecord[];
  failed: FailRecord[];
  warnings: string[];
}

const results: ResultsBundle = {
  passed: [],
  failed: [],
  warnings: [],
};

function recordPass(testName: string, notes?: string): void {
  results.passed.push({ test: testName, notes: notes ?? '' });
}

function recordFail(testName: string, error: unknown, fileLine: string, repro: string): void {
  const message = error instanceof Error ? error.message : String(error);
  results.failed.push({
    test: testName,
    error: message,
    file_line: fileLine,
    repro,
  });
}

function recordWarning(message: string): void {
  results.warnings.push(message);
}

afterAll(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});

// ----------------------------------------------------------------------
// Mock retriever — keeps L5 _executeAnalyze synthetic + offline.
// ----------------------------------------------------------------------
function buildMockRetriever() {
  return {
    async hybridSearch(_params: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
      return [
        { id: 'r1', source: 'mock', score: 0.9, content: 'mock content r1' },
        { id: 'r2', source: 'mock', score: 0.7, content: 'mock content r2' },
      ];
    },
    async resolveContext(text: string): Promise<string> {
      return text;
    },
  };
}

async function runWithBudget<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return withTimeout(promise, ms, label);
}

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------
describe('Level5Coordinator stress (PLN-006 P2 / TASK-004)', () => {
  test('executes 3-step chain end-to-end with persistState at each phase boundary', async () => {
    const testName = 'executes 3-step chain end-to-end with persistState at each phase boundary';
    const tempRoot = createTempSessionRoot();
    const persistDir = path.join(tempRoot.path, 'persist');
    try {
      const fixture = l5ThreeStepChain();
      const sanitizedId = fixture.session_id.replace(/[^A-Za-z0-9_-]/g, '-');

      const l5 = new Level5Coordinator(
        { persist_dir: persistDir },
        undefined,
        buildMockRetriever(),
      );

      const finalState = (await runWithBudget(
        l5.execute({
          user_request: fixture.user_request,
          domain: fixture.domain,
          session_id: sanitizedId,
          errors: [],
        } as never),
        30000,
        'L5-3-step-e2e',
      )) as Record<string, unknown>;

      // Decision contract: APPROVED on full completion, HUMAN_REVIEW
      // when not all units completed. Either is a valid terminal
      // outcome of the persist-state contract; FAILED is not.
      if (finalState.decision !== 'APPROVED' && finalState.decision !== 'HUMAN_REVIEW') {
        throw new Error(
          `unexpected terminal decision: ${String(finalState.decision)} (errors=${JSON.stringify(finalState.errors ?? [])})`,
        );
      }
      if (finalState.decision === 'HUMAN_REVIEW') {
        recordWarning(
          `Test 1: terminal decision was HUMAN_REVIEW (not APPROVED) — some execution units did not COMPLETE. State persisted but caller would need human triage. Errors: ${JSON.stringify(finalState.errors ?? [])}`,
        );
      }

      const persistedPath = path.join(persistDir, `${sanitizedId}.json`);
      if (!fs.existsSync(persistedPath)) {
        throw new Error(`persisted file missing: ${persistedPath}`);
      }
      const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8')) as Record<string, unknown>;
      if (persisted.session_id !== sanitizedId) {
        throw new Error(
          `persisted session_id mismatch: expected ${sanitizedId}, got ${String(persisted.session_id)}`,
        );
      }
      if (persisted.phase !== 'completed' && persisted.phase !== 'executing') {
        throw new Error(`persisted phase not terminal: ${String(persisted.phase)}`);
      }

      recordPass(
        testName,
        `decision=${String(finalState.decision)} phase=${String(persisted.phase)} sessionId=${sanitizedId}`,
      );
    } catch (err) {
      recordFail(
        testName,
        err,
        'level5-coordinator.ts (5 persistState calls + final decision block)',
        'Instantiate Level5Coordinator with mock retriever + tmp persist_dir, call execute({user_request,domain,session_id}). Verify <persist_dir>/<sessionId>.json exists with terminal phase. If APPROVED unreachable, inspect _allUnitsCompleted().',
      );
    } finally {
      tempRoot.cleanup();
    }
  });

  test('resumes cleanly from mid-chain checkpoint', async () => {
    const testName = 'resumes cleanly from mid-chain checkpoint';
    const tempRoot = createTempSessionRoot();
    const persistDir = path.join(tempRoot.path, 'persist');
    try {
      recordWarning(
        'Test 2 simulates interrupt by pre-writing a planning-phase CoordinatorState file rather than killing a real process. Sufficient to exercise _tryResume + loadState resume path; does not detect mid-process state-machine races (FM-3 secondary aspects).',
      );

      const sessionId = `resume-test-${Date.now()}`;

      // Run #1: full execute, but along the way capture the
      // post-planning snapshot before phase advances to 'executing'.
      const l5a = new Level5Coordinator(
        { persist_dir: persistDir },
        undefined,
        buildMockRetriever(),
      );
      const originalPersist = l5a.persistState.bind(l5a);
      let plannedSnapshot: Record<string, unknown> | null = null;
      l5a.persistState = async (cs: CoordinatorState): Promise<string> => {
        if (cs.phase === 'planning' && plannedSnapshot === null) {
          await originalPersist(cs);
          plannedSnapshot = JSON.parse(JSON.stringify(coordinatorStateToDict(cs))) as Record<string, unknown>;
          throw new Error('SIMULATED_MID_CHAIN_ABORT');
        }
        if (cs.phase === 'failed') {
          // Swallow the post-abort failed-state write so the disk file
          // remains at phase='planning' for the resume run below.
          return cs.sessionId;
        }
        return originalPersist(cs);
      };

      await l5a.execute({
        user_request: 'analyze plan execute',
        domain: 'novel',
        session_id: sessionId,
        errors: [],
      } as never);

      const persistedPath = path.join(persistDir, `${sessionId}.json`);
      if (!fs.existsSync(persistedPath)) {
        throw new Error(`pre-seed: persist file missing at ${persistedPath}`);
      }
      const seeded = JSON.parse(fs.readFileSync(persistedPath, 'utf8')) as Record<string, unknown>;
      if (seeded.phase !== 'planning') {
        throw new Error(`pre-seed phase mismatch: expected planning, got ${String(seeded.phase)}`);
      }
      if (plannedSnapshot === null) {
        throw new Error('pre-seed: planning snapshot was never captured');
      }

      // Run #2: fresh coordinator, same persist_dir + session_id.
      const l5b = new Level5Coordinator(
        { persist_dir: persistDir },
        undefined,
        buildMockRetriever(),
      );
      const resumedState = (await runWithBudget(
        l5b.execute({
          user_request: 'analyze plan execute',
          domain: 'novel',
          session_id: sessionId,
          errors: [],
        } as never),
        30000,
        'L5-resume',
      )) as Record<string, unknown>;

      if (resumedState.resumed !== true) {
        throw new Error(
          `resumed flag not set on second-run state (expected true, got ${String(resumedState.resumed)})`,
        );
      }
      if (resumedState.decision !== 'APPROVED' && resumedState.decision !== 'HUMAN_REVIEW') {
        throw new Error(
          `resume run did not reach terminal decision: ${String(resumedState.decision)}`,
        );
      }
      const finalPersisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8')) as Record<string, unknown>;
      if (finalPersisted.phase !== 'completed' && finalPersisted.phase !== 'executing') {
        throw new Error(`resume final phase not terminal: ${String(finalPersisted.phase)}`);
      }

      recordPass(
        testName,
        `pre-seeded phase=planning, resumed=true, final phase=${String(finalPersisted.phase)}, decision=${String(resumedState.decision)}`,
      );
    } catch (err) {
      recordFail(
        testName,
        err,
        'level5-coordinator.ts: _tryResume + loadState + terminal-phase guard',
        'Pre-write a CoordinatorState with phase=planning to <persist_dir>/<sessionId>.json (or trigger via monkey-patched persistState that throws after planning snapshot). Instantiate fresh Level5Coordinator with same persist_dir+session_id. execute() should call _tryResume, loadState returns state, resumed flag set, then phase advances to executing→completed.',
      );
    } finally {
      tempRoot.cleanup();
    }
  });

  test('concurrent two L5 sessions do not corrupt each other persistState files', async () => {
    const testName = 'concurrent two L5 sessions do not corrupt each other persistState files';
    const tempRoot = createTempSessionRoot();
    const persistDir = path.join(tempRoot.path, 'persist');
    try {
      const sessionA = `concurrent-a-${Date.now()}`;
      const sessionB = `concurrent-b-${Date.now()}`;

      const retrieverA = {
        async hybridSearch(_p: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
          return [{ id: 'r-a', source: 'mock-a', score: 0.91, content: 'content-a' }];
        },
        async resolveContext(text: string): Promise<string> {
          return `${text} [RESOLVED-A]`;
        },
      };
      const retrieverB = {
        async hybridSearch(_p: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
          return [{ id: 'r-b', source: 'mock-b', score: 0.71, content: 'content-b' }];
        },
        async resolveContext(text: string): Promise<string> {
          return `${text} [RESOLVED-B]`;
        },
      };

      const l5a = new Level5Coordinator({ persist_dir: persistDir }, undefined, retrieverA);
      const l5b = new Level5Coordinator({ persist_dir: persistDir }, undefined, retrieverB);

      const [stateA, stateB] = (await runWithBudget(
        Promise.all([
          l5a.execute({
            user_request: 'request-A',
            domain: 'novel',
            session_id: sessionA,
            errors: [],
          } as never),
          l5b.execute({
            user_request: 'request-B',
            domain: 'novel',
            session_id: sessionB,
            errors: [],
          } as never),
        ]),
        30000,
        'L5-concurrent',
      )) as [Record<string, unknown>, Record<string, unknown>];

      const fileA = path.join(persistDir, `${sessionA}.json`);
      const fileB = path.join(persistDir, `${sessionB}.json`);
      if (!fs.existsSync(fileA)) throw new Error(`session A persist file missing: ${fileA}`);
      if (!fs.existsSync(fileB)) throw new Error(`session B persist file missing: ${fileB}`);
      const persistedA = JSON.parse(fs.readFileSync(fileA, 'utf8')) as Record<string, unknown>;
      const persistedB = JSON.parse(fs.readFileSync(fileB, 'utf8')) as Record<string, unknown>;

      if (persistedA.session_id !== sessionA) {
        throw new Error(
          `cross-contamination: file A has session_id ${String(persistedA.session_id)}, expected ${sessionA}`,
        );
      }
      if (persistedB.session_id !== sessionB) {
        throw new Error(
          `cross-contamination: file B has session_id ${String(persistedB.session_id)}, expected ${sessionB}`,
        );
      }
      if (stateA.session_id !== sessionA || stateB.session_id !== sessionB) {
        throw new Error(
          `state session_id cross-talk: A=${String(stateA.session_id)} B=${String(stateB.session_id)}`,
        );
      }

      recordPass(
        testName,
        `two concurrent sessions persisted to distinct files with correct sessionIds (A=${sessionA}, B=${sessionB})`,
      );
    } catch (err) {
      recordFail(
        testName,
        err,
        'level5-coordinator.ts: persistState + session-manager.ts: _appendSnapshotIndex race',
        'Promise.all of two Level5Coordinator.execute() with distinct session_ids on shared persist_dir. Each <persist_dir>/<id>.json must exist with its own session_id field.',
      );
    } finally {
      tempRoot.cleanup();
    }
  });

  test('unhandled rejections are zero across all 3 L5 stress cases', async () => {
    const testName = 'unhandled rejections are zero across all 3 L5 stress cases';
    const validator = validateNoUnhandledRejections();
    const tempRoot = createTempSessionRoot();
    const persistDir = path.join(tempRoot.path, 'persist');
    try {
      // Scenario 1: simple E2E
      const l5_e2e = new Level5Coordinator(
        { persist_dir: persistDir },
        undefined,
        buildMockRetriever(),
      );
      await l5_e2e.execute({
        user_request: 'rejection-probe-e2e',
        domain: 'novel',
        session_id: `urj-e2e-${Date.now()}`,
        errors: [],
      } as never);

      // Scenario 2: forced abort path
      const l5_abort = new Level5Coordinator(
        { persist_dir: persistDir },
        undefined,
        {
          async hybridSearch(): Promise<Array<Record<string, unknown>>> {
            throw new Error('SIMULATED_RETRIEVER_FAILURE');
          },
          async resolveContext(): Promise<string> {
            throw new Error('SIMULATED_RESOLVE_FAILURE');
          },
        },
      );
      await l5_abort.execute({
        user_request: 'rejection-probe-abort',
        domain: 'novel',
        session_id: `urj-abort-${Date.now()}`,
        errors: [],
      } as never);

      // Scenario 3: concurrent
      const l5_c1 = new Level5Coordinator({ persist_dir: persistDir }, undefined, buildMockRetriever());
      const l5_c2 = new Level5Coordinator({ persist_dir: persistDir }, undefined, buildMockRetriever());
      await Promise.all([
        l5_c1.execute({
          user_request: 'urj-c1',
          domain: 'novel',
          session_id: `urj-c1-${Date.now()}`,
          errors: [],
        } as never),
        l5_c2.execute({
          user_request: 'urj-c2',
          domain: 'novel',
          session_id: `urj-c2-${Date.now()}`,
          errors: [],
        } as never),
      ]);

      // Microtask + macrotask drain so any unawaited rejection has
      // a chance to surface before we stop the listener.
      await new Promise<void>(r => setImmediate(r));
      await new Promise<void>(r => setTimeout(r, 50));

      const guard = validator.stop();
      if (!guard.pass) {
        const summary = guard.errors
          .map(e => (e instanceof Error ? e.message : String(e)))
          .join(' | ');
        throw new Error(`${guard.errors.length} unhandled rejection(s) detected: ${summary}`);
      }
      recordPass(testName, '0 unhandled rejections across 3 scenarios');
    } catch (err) {
      try {
        validator.stop();
      } catch {
        /* already stopped */
      }
      recordFail(
        testName,
        err,
        'level5-coordinator.ts: failed-state persistState in catch block + persistState fire-and-forget paths',
        'Run E2E + forced-abort + concurrent under process.on(unhandledRejection). Likely root cause: unawaited persistState() inside catch block, or fire-and-forget retriever rejection escaping _executeAnalyze`s catch.',
      );
    } finally {
      tempRoot.cleanup();
    }
  });
});

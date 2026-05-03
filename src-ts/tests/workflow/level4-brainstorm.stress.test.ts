/**
 * L4 Brainstorm Stress Tests (PLN-006 Phase 2 / TASK-003)
 *
 * Surfaces FM-1 (sequential generateArtifacts), FM-2 (timeout_per_role
 * never enforced), FM-5 (concurrent L4 session isolation) from
 * audit-l4-l5.md. Failures are recorded — never thrown — so the suite
 * exits 0 and TASK-005 can consume `stress-results-l4.json.failed[]`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, test, afterAll } from 'vitest';

import {
  Level4Brainstorm,
  getDefaultRoles,
} from '../../workflow/levels/level4-brainstorm.js';
import { SessionManager } from '../../workflow/session/session-manager.js';
import {
  createTempSessionRoot,
  validateNoUnhandledRejections,
} from './harness/stress-harness.js';
import {
  l4SequentialRounds,
  concurrentL4Sessions,
} from './harness/scenarios.js';

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
const RESULTS_PATH = path.join(RESULTS_DIR, 'stress-results-l4.json');

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

afterAll(() => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2), 'utf8');
});

// ----------------------------------------------------------------------
// Mock helpers
// ----------------------------------------------------------------------
interface L4MockContainerOptions {
  latency?: number;
  response?: string;
}

interface L4MockAgent {
  run(input?: { prompt?: string; mode?: string; role?: string }): { content: string };
  generate(prompt: string): Promise<string>;
}

interface L4MockContainer {
  getAgent(type: string, opts?: Record<string, unknown>): L4MockAgent;
}

/**
 * Level4Brainstorm prefers `writer.generate(prompt, opts)` (async) when
 * available, falling back to sync `writer.run({...})`. Provide both so we
 * can exercise either path.
 */
function buildL4Container(
  { latency = 0, response = 'mock-writer-analysis' }: L4MockContainerOptions = {},
): L4MockContainer {
  return {
    getAgent(_type: string, _opts?: Record<string, unknown>): L4MockAgent {
      return {
        run(_input?: { prompt?: string; mode?: string; role?: string }): { content: string } {
          if (latency > 0) {
            // Synchronous busy-wait — surfaces FM-1/FM-2 if execute()
            // ever falls back to the sync run() path.
            const target = Date.now() + latency;
            while (Date.now() < target) {
              // intentional busy wait
            }
          }
          return { content: response };
        },
        async generate(_prompt: string): Promise<string> {
          if (latency > 0) {
            await new Promise(r => setTimeout(r, latency));
          }
          return response;
        },
      };
    },
  };
}

// ----------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------
describe('Level4Brainstorm stress (PLN-006 P2 / TASK-003)', () => {
  test('runs 5 sequential rounds without unhandled rejections', async () => {
    const testName = 'runs 5 sequential rounds without unhandled rejections';
    const validator = validateNoUnhandledRejections();
    try {
      const container = buildL4Container();
      const level4 = new Level4Brainstorm({}, container as never);
      const rounds = l4SequentialRounds(5);

      let prev: Record<string, unknown> | null = null;
      for (let i = 0; i < rounds.length; i++) {
        const state = {
          user_request: rounds[i].user_request,
          context: (prev?.specification_markdown as string) ?? rounds[i].context,
          errors: [],
        } as Record<string, unknown>;
        const result = (await level4.execute(state as never)) as Record<string, unknown>;
        const errs = (result.errors as unknown[] | undefined) ?? [];
        if (errs.length !== 0) {
          throw new Error(`Round ${i} produced errors: ${JSON.stringify(errs)}`);
        }
        if (!Array.isArray(result.role_analyses)) {
          throw new Error(`Round ${i} missing role_analyses`);
        }
        prev = result;
      }
      const guard = validator.stop();
      if (!guard.pass) {
        throw new Error(`Unhandled rejections detected: ${guard.errors.length}`);
      }
      recordPass(testName, '5 sequential rounds completed cleanly');
    } catch (err) {
      try {
        validator.stop();
      } catch {
        /* already stopped */
      }
      recordFail(
        testName,
        err,
        'level4-brainstorm.ts:268-318',
        'Level4Brainstorm.execute() threw or accumulated errors during 5-round loop',
      );
    }
  });

  test('5 rounds complete within 30s total', async () => {
    const testName = '5 rounds complete within 30s total';
    const PER_ROLE_LATENCY_MS = 1500;
    // Async variant: with parallel generateArtifactsAsync, 5 default roles *
    // 1500ms ~= 1500ms per round (parallel), 5 rounds ~= ~7.5s total.
    try {
      const container = buildL4Container({ latency: PER_ROLE_LATENCY_MS });
      const level4 = new Level4Brainstorm({}, container as never);

      const start = Date.now();
      let prev: Record<string, unknown> | null = null;
      for (let i = 0; i < 5; i++) {
        const state = {
          user_request: `topic-${i}`,
          context: (prev?.specification_markdown as string) ?? '',
          errors: [],
        } as Record<string, unknown>;
        prev = (await level4.execute(state as never)) as Record<string, unknown>;
        if (Date.now() - start > 30000) {
          throw new Error(
            `Timeout: L4-5-rounds exceeded 30000ms after round ${i + 1}/5 ` +
              `(elapsed ${Date.now() - start}ms)`,
          );
        }
      }
      const elapsed = Date.now() - start;
      recordPass(testName, `5 rounds finished in ${elapsed}ms (under 30s budget)`);
    } catch (err) {
      recordFail(
        testName,
        err,
        'level4-brainstorm.ts:345-374 (sync) / :379-435 (async)',
        'execute() must call generateArtifactsAsync (parallel + Promise.race timeout); sequential generateArtifacts would exceed 30s budget.',
      );
    }
  }, 60000);

  test('concurrent two L4 sessions on shared session root preserve isolation', async () => {
    const testName = 'concurrent two L4 sessions on shared session root preserve isolation';
    const tempRoot = createTempSessionRoot();
    try {
      const sessionMgr = new SessionManager(tempRoot.path);
      const sessions = concurrentL4Sessions(2);

      const sanitizedIds = sessions.map(s => {
        const id = s.session_id.replace(/[^A-Za-z0-9_-]/g, '-');
        sessionMgr.init(id, 'standard', 'stress-test', 'novel');
        return id;
      });

      const container = buildL4Container({ response: 'mock-writer-isolation-test' });

      const promises = sessions.map((s, idx) =>
        Promise.resolve().then(async () => {
          const level4 = new Level4Brainstorm({}, container as never);
          const state = {
            user_request: s.user_request,
            context: s.context,
            session_id: sanitizedIds[idx],
            errors: [],
          } as Record<string, unknown>;
          return (await level4.execute(state as never)) as Record<string, unknown>;
        }),
      );
      const states = await Promise.all(promises);

      if (
        !Array.isArray(states[0].role_analyses) ||
        !Array.isArray(states[1].role_analyses)
      ) {
        throw new Error('one of the concurrent states missing role_analyses');
      }
      if (states[0].role_analyses === states[1].role_analyses) {
        throw new Error('role_analyses shared by reference between concurrent sessions');
      }
      if (states[0].user_request === states[1].user_request) {
        throw new Error('user_request collision between concurrent sessions');
      }

      const activeBase = path.join(path.resolve(tempRoot.path), 'active');
      for (const id of sanitizedIds) {
        const sessionJson = path.join(activeBase, id, 'session.json');
        if (!fs.existsSync(sessionJson)) {
          throw new Error(`session.json missing for ${id} at ${sessionJson}`);
        }
      }

      recordPass(testName, 'two concurrent sessions kept role_analyses arrays distinct');
    } catch (err) {
      recordFail(
        testName,
        err,
        'level4-brainstorm.ts (state mutation) + level5-coordinator.ts:73 (shared analysisRetriever)',
        'Two concurrent Level4Brainstorm.execute() calls on shared SessionManager root; check role_analyses identity + session.json presence per session_id',
      );
    } finally {
      tempRoot.cleanup();
    }
  });

  test('memory check: round 5 state.role_analyses length matches expected role count', async () => {
    const testName = 'memory check: round 5 state.role_analyses length matches expected role count';
    try {
      const container = buildL4Container();
      const level4 = new Level4Brainstorm({}, container as never);
      const expectedCount = getDefaultRoles().length;

      let prev: Record<string, unknown> | null = null;
      for (let i = 0; i < 5; i++) {
        const state = {
          user_request: `mem-topic-${i}`,
          context: (prev?.specification_markdown as string) ?? '',
          errors: [],
        } as Record<string, unknown>;
        prev = (await level4.execute(state as never)) as Record<string, unknown>;
      }

      const finalLen = ((prev?.role_analyses as unknown[]) ?? []).length;
      if (finalLen !== expectedCount) {
        throw new Error(`role_analyses length ${finalLen} !== expected ${expectedCount}`);
      }
      recordPass(
        testName,
        `round 5 role_analyses length=${finalLen} matches getDefaultRoles().length=${expectedCount}`,
      );
    } catch (err) {
      recordFail(
        testName,
        err,
        'level4-brainstorm.ts (state.role_analyses overwritten each call)',
        'After 5 sequential execute() invocations, final state.role_analyses length must equal getDefaultRoles().length — verifies no leak/duplication.',
      );
    }
  });
});

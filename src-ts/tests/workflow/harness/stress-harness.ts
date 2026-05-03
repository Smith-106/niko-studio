/**
 * Stress Test Harness
 *
 * Reusable utilities for L4/L5 workflow stress tests:
 *   - createMockContainer: deterministic ServiceContainer-shaped mock
 *   - createTempSessionRoot: isolated tmp dir with cleanup
 *   - withTimeout: race a promise against a deadline
 *   - validateNoUnhandledRejections: detect unhandled promise rejections
 *   - assertSessionState: assert STATE shape on a SessionManager
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

import { ContentType } from '../../../workflow/session/session-manager.js';

// ============================================================
// Types
// ============================================================

export interface MockAgent {
  generate(prompt: string): Promise<string>;
}

export interface MockContainer {
  getAgent(type: string, opts?: Record<string, unknown>): MockAgent;
}

export interface CreateMockContainerOptions {
  /** Map of agent type → canned response. */
  responses?: Record<string, string>;
  /** Artificial latency (ms) before generate resolves. */
  latency?: number;
}

export interface TempSessionRoot {
  path: string;
  cleanup(): void;
}

export interface UnhandledRejectionGuardResult {
  pass: boolean;
  errors: unknown[];
}

export interface UnhandledRejectionGuard {
  stop(): UnhandledRejectionGuardResult;
}

interface SessionStateReader {
  read(sessionId: string, contentType: string): string | null | undefined;
}

// ============================================================
// Mock container
// ============================================================

/**
 * Build a minimal ServiceContainer-shaped mock with deterministic agents.
 * Each agent exposes a single async `generate(prompt)` method.
 */
export function createMockContainer(
  { responses = {}, latency = 0 }: CreateMockContainerOptions = {},
): MockContainer {
  return {
    getAgent(type: string, _opts?: Record<string, unknown>): MockAgent {
      return {
        async generate(_prompt: string): Promise<string> {
          if (latency > 0) {
            await new Promise(resolve => setTimeout(resolve, latency));
          }
          return responses[type] ?? `mock-${type}-response`;
        },
      };
    },
  };
}

// ============================================================
// Temp session root
// ============================================================

/**
 * Create an isolated temporary session root directory. Caller is
 * responsible for invoking `cleanup()` (typically in afterEach/finally).
 */
export function createTempSessionRoot(): TempSessionRoot {
  const dir = path.join(os.tmpdir(), `niko-stress-${randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return {
    path: dir,
    cleanup(): void {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// ============================================================
// withTimeout
// ============================================================

/**
 * Race a promise against a timeout. Rejects with a labelled Error on timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race<T>([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: ${label} after ${ms}ms`));
      }, ms);
    }),
  ]);
}

// ============================================================
// Unhandled rejection guard
// ============================================================

/**
 * Install an `unhandledRejection` listener for the duration of a test.
 * Call `.stop()` to remove the listener and obtain the captured errors.
 */
export function validateNoUnhandledRejections(): UnhandledRejectionGuard {
  const errors: unknown[] = [];
  const handler = (reason: unknown): void => {
    errors.push(reason);
  };
  process.on('unhandledRejection', handler);
  return {
    stop(): UnhandledRejectionGuardResult {
      process.off('unhandledRejection', handler);
      return {
        pass: errors.length === 0,
        errors,
      };
    },
  };
}

// ============================================================
// assertSessionState
// ============================================================

/**
 * Assert that the persisted STATE for a session contains every key in
 * `expectedShape`. Throws on the first missing key.
 */
export function assertSessionState(
  sessionMgr: SessionStateReader,
  sessionId: string,
  expectedShape: Record<string, unknown>,
): void {
  const stateStr = sessionMgr.read(sessionId, ContentType.STATE);
  let state: Record<string, unknown>;
  try {
    state = JSON.parse(stateStr || '{}') as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`assertSessionState: invalid JSON for session ${sessionId}: ${msg}`);
  }
  for (const key of Object.keys(expectedShape)) {
    if (!(key in state)) {
      throw new Error(`assertSessionState: missing key '${key}' in session ${sessionId} state`);
    }
  }
}

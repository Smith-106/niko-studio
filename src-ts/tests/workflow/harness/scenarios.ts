/**
 * Stress Test Scenarios
 *
 * State-shape builders for L4/L5 stress tests. These produce only the
 * minimum data required by the workflow level under test — actual session
 * orchestration is the caller's responsibility.
 */
import { randomUUID } from 'node:crypto';

export interface L4RoundState {
  user_request: string;
  context: string;
}

export interface L5ChainState {
  user_request: string;
  domain: string;
  session_id: string;
}

export interface L4ConcurrentSessionState {
  user_request: string;
  session_id: string;
  context: string;
}

/**
 * Build `n` sequential L4 round states, each carrying forward the prior
 * round's synthesized output as `context`.
 */
export function l4SequentialRounds(n: number): L4RoundState[] {
  const rounds: L4RoundState[] = [];
  for (let i = 0; i < n; i++) {
    rounds.push({
      user_request: `topic-${i}`,
      context: i > 0 ? `round-${i - 1}-output` : '',
    });
  }
  return rounds;
}

/**
 * Build a single L5 three-step (analyze → plan → execute) chain state.
 */
export function l5ThreeStepChain(): L5ChainState {
  return {
    user_request: 'analyze plan execute',
    domain: 'novel',
    session_id: randomUUID(),
  };
}

/**
 * Build `count` independent L4 session states for concurrent execution.
 * Each state has its own `session_id` so callers can target a shared
 * session root without collisions.
 */
export function concurrentL4Sessions(count: number): L4ConcurrentSessionState[] {
  const sessions: L4ConcurrentSessionState[] = [];
  for (let i = 0; i < count; i++) {
    sessions.push({
      user_request: `concurrent-topic-${i}`,
      session_id: randomUUID(),
      context: '',
    });
  }
  return sessions;
}

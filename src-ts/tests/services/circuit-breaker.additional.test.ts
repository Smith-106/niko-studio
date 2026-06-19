import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDebug = vi.hoisted(() => vi.fn());
const mockInfo = vi.hoisted(() => vi.fn());
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock('../../logger/index.js', () => ({
  createLogger: vi.fn(() => ({
    debug: mockDebug,
    info: mockInfo,
    warn: mockWarn,
  })),
}));

import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitState,
} from '../../services/circuit-breaker.js';

describe('services/circuit-breaker additional coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('transitions from OPEN to HALF_OPEN after cooldown and enforces half-open call limits', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 100,
      halfOpenMaxCalls: 2,
    });

    breaker.recordFailure();

    expect(breaker.state).toBe(CircuitState.OPEN);
    expect(breaker.allow()).toBe(false);

    vi.advanceTimersByTime(100);

    expect(breaker.state).toBe(CircuitState.HALF_OPEN);
    expect(breaker.allow()).toBe(true);
    expect(breaker.allow()).toBe(true);
    expect(breaker.allow()).toBe(false);
  });

  it('closes and resets counters after a successful HALF_OPEN probe', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 50,
      halfOpenMaxCalls: 1,
    });

    breaker.recordFailure();
    vi.advanceTimersByTime(50);

    expect(breaker.state).toBe(CircuitState.HALF_OPEN);
    expect(breaker.allow()).toBe(true);

    breaker.recordSuccess();

    expect(breaker.state).toBe(CircuitState.CLOSED);
    expect(breaker.failureCount).toBe(0);
    expect(breaker.allow()).toBe(true);
  });

  it('reopens immediately when a HALF_OPEN probe fails', () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 50,
      halfOpenMaxCalls: 1,
    });

    breaker.recordFailure();
    vi.advanceTimersByTime(50);

    expect(breaker.allow()).toBe(true);

    breaker.recordFailure();

    expect(breaker.state).toBe(CircuitState.OPEN);
    expect(breaker.allow()).toBe(false);
  });

  it('supports registry diagnostics, resets, and open-provider enumeration', () => {
    const registry = new CircuitBreakerRegistry({
      failureThreshold: 1,
      cooldownMs: 60,
      halfOpenMaxCalls: 1,
    });

    registry.recordFailure('openai');
    registry.recordSuccess('anthropic');

    expect(registry.getBreaker('openai')).toBeDefined();
    expect(registry.getState('openai')).toBe(CircuitState.OPEN);
    expect(registry.getOpenCircuitProviders()).toEqual(['openai']);
    expect(registry.getStatus()).toEqual({
      anthropic: { state: CircuitState.CLOSED, failureCount: 0 },
      openai: { state: CircuitState.OPEN, failureCount: 1 },
    });

    vi.advanceTimersByTime(60);
    expect(registry.allow('openai')).toBe(true);

    registry.recordFailure('openai');
    expect(registry.getState('openai')).toBe(CircuitState.OPEN);

    registry.reset('openai');
    expect(registry.getState('openai')).toBe(CircuitState.CLOSED);

    registry.recordFailure('cohere');
    registry.resetAll();

    expect(registry.getState('openai')).toBe(CircuitState.CLOSED);
    expect(registry.getState('cohere')).toBe(CircuitState.CLOSED);
  });
});

/**
 * Circuit Breaker - Provider Health Protection
 *
 * Prevents cascading failures by tracking provider health and
 * blocking calls to unhealthy providers until they recover.
 *
 * States:
 * - CLOSED: Normal operation, all calls allowed
 * - OPEN: Provider failed too many times, calls blocked until cooldown
 * - HALF_OPEN: Testing recovery, limited calls allowed
 */

import { createLogger } from '../logger/index.js';

const _log = createLogger('circuit-breaker');

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Milliseconds to wait in OPEN state before transitioning to HALF_OPEN */
  cooldownMs: number;
  /** Number of allowed calls in HALF_OPEN state before deciding CLOSED or OPEN */
  halfOpenMaxCalls: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 60000,
  halfOpenMaxCalls: 3,
};

/**
 * CircuitBreaker - Tracks health of a single provider
 *
 * State transitions:
 *   CLOSED  --(failureThreshold reached)--> OPEN
 *   OPEN    --(cooldown expired)----------> HALF_OPEN
 *   HALF_OPEN --(success)-----------------> CLOSED
 *   HALF_OPEN --(failure)-----------------> OPEN
 */
export class CircuitBreaker {
  private _state: CircuitState = CircuitState.CLOSED;
  private _failureCount = 0;
  private _lastFailureTime = 0;
  private _halfOpenCallCount = 0;
  private readonly _config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Current circuit state */
  get state(): CircuitState {
    // Check for automatic OPEN → HALF_OPEN transition on cooldown expiry
    if (this._state === CircuitState.OPEN) {
      const elapsed = Date.now() - this._lastFailureTime;
      if (elapsed >= this._config.cooldownMs) {
        this._transitionTo(CircuitState.HALF_OPEN);
      }
    }
    return this._state;
  }

  /** Whether a call is allowed through the circuit */
  allow(): boolean {
    const currentState = this.state;

    switch (currentState) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.HALF_OPEN:
        if (this._halfOpenCallCount < this._config.halfOpenMaxCalls) {
          this._halfOpenCallCount++;
          return true;
        }
        return false;

      case CircuitState.OPEN:
        return false;
    }
  }

  /** Record a successful call */
  recordSuccess(): void {
    if (this._state === CircuitState.HALF_OPEN) {
      this._transitionTo(CircuitState.CLOSED);
      _log.info('Circuit recovered to CLOSED after successful HALF_OPEN call');
    }
    this._failureCount = 0;
  }

  /** Record a failed call */
  recordFailure(): void {
    this._failureCount++;
    this._lastFailureTime = Date.now();

    if (this._state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN reopens the circuit
      this._transitionTo(CircuitState.OPEN);
      _log.warn('Circuit reopened from HALF_OPEN due to failure');
      return;
    }

    if (this._state === CircuitState.CLOSED && this._failureCount >= this._config.failureThreshold) {
      this._transitionTo(CircuitState.OPEN);
      _log.warn(
        `Circuit opened after ${this._failureCount} consecutive failures ` +
        `(threshold: ${this._config.failureThreshold})`
      );
    }
  }

  /** Force reset to CLOSED state */
  reset(): void {
    this._transitionTo(CircuitState.CLOSED);
    _log.info('Circuit forcibly reset to CLOSED');
  }

  /** Get current failure count (useful for diagnostics) */
  get failureCount(): number {
    return this._failureCount;
  }

  private _transitionTo(newState: CircuitState): void {
    const oldState = this._state;
    if (oldState === newState) return;

    this._state = newState;

    if (newState === CircuitState.CLOSED) {
      this._failureCount = 0;
      this._halfOpenCallCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this._halfOpenCallCount = 0;
    }

    _log.debug(`Circuit transitioned: ${oldState} → ${newState}`);
  }
}

/**
 * CircuitBreakerRegistry - Per-provider circuit breaker management
 *
 * Manages a Map of provider name → CircuitBreaker instances.
 * Shared config applies to all breakers; individual breakers
 * can override config at creation time.
 */
export class CircuitBreakerRegistry {
  private readonly _breakers = new Map<string, CircuitBreaker>();
  private readonly _config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Check if calls are allowed for a given provider */
  allow(providerName: string): boolean {
    return this._getOrCreate(providerName).allow();
  }

  /** Record a successful call for a provider */
  recordSuccess(providerName: string): void {
    this._getOrCreate(providerName).recordSuccess();
  }

  /** Record a failed call for a provider */
  recordFailure(providerName: string): void {
    this._getOrCreate(providerName).recordFailure();
  }

  /** Force reset a provider's circuit to CLOSED */
  reset(providerName: string): void {
    const breaker = this._breakers.get(providerName);
    if (breaker) {
      breaker.reset();
    }
  }

  /** Force reset all circuits to CLOSED */
  resetAll(): void {
    for (const breaker of this._breakers.values()) {
      breaker.reset();
    }
  }

  /** Get the state of a provider's circuit */
  getState(providerName: string): CircuitState {
    return this._getOrCreate(providerName).state;
  }

  /** Get the CircuitBreaker instance for a provider (for advanced diagnostics) */
  getBreaker(providerName: string): CircuitBreaker | undefined {
    return this._breakers.get(providerName);
  }

  /** Get all provider names that currently have open circuits */
  getOpenCircuitProviders(): string[] {
    const open: string[] = [];
    for (const [name, breaker] of this._breakers) {
      if (!breaker.allow()) {
        open.push(name);
      }
    }
    return open;
  }

  /** Get status snapshot of all known circuits */
  getStatus(): Record<string, { state: CircuitState; failureCount: number }> {
    const status: Record<string, { state: CircuitState; failureCount: number }> = {};
    for (const [name, breaker] of this._breakers) {
      status[name] = { state: breaker.state, failureCount: breaker.failureCount };
    }
    return status;
  }

  private _getOrCreate(providerName: string): CircuitBreaker {
    let breaker = this._breakers.get(providerName);
    if (!breaker) {
      breaker = new CircuitBreaker(this._config);
      this._breakers.set(providerName, breaker);
    }
    return breaker;
  }
}

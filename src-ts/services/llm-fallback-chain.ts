/**
 * LLM Fallback Chain - Provider Fallback with Latency Tracking
 *
 * Wraps CircuitBreakerRegistry and provider map to provide a formalized
 * fallback chain with latency tracking and event publishing.
 *
 * Features:
 * - Ordered provider chain with circuit-breaker integration
 * - Per-provider latency tracking with sliding window
 * - Optional latency-based routing within same tier
 * - EventBus integration for fallback lifecycle events
 */

import { createLogger } from '../logger/index.js';
import { CircuitBreakerRegistry } from './circuit-breaker.js';
import { ProviderType, ProviderUnavailableError, CircuitOpenError } from './llm-service.js';
import type { LLMProvider } from '../protocols/llm';
import type { IEventBus } from './event-bus.js';

const _log = createLogger('llm-fallback-chain');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Fallback chain configuration
 */
export interface FallbackChainConfig {
  /** Ordered list of providers to try */
  chain: ProviderType[];
  /** Retries per provider before moving to next */
  retryPerProvider: number;
  /** How many recent calls to track for latency stats (default 100) */
  latencyWindowSize: number;
  /** When true, prefer lower-latency providers within same tier */
  enableLatencyRouting: boolean;
}

const DEFAULT_CHAIN_CONFIG: FallbackChainConfig = {
  chain: [ProviderType.OPENAI, ProviderType.ANTHROPIC, ProviderType.AZURE, ProviderType.LOCAL],
  retryPerProvider: 1,
  latencyWindowSize: 100,
  enableLatencyRouting: false,
};

// ---------------------------------------------------------------------------
// ProviderLatencyTracker
// ---------------------------------------------------------------------------

/**
 * Tracks per-provider response times using a sliding window.
 */
export class ProviderLatencyTracker {
  private readonly windows = new Map<string, number[]>();
  private readonly maxSize: number;

  constructor(windowSize: number = 100) {
    this.maxSize = windowSize;
  }

  /**
   * Record a latency measurement for a provider.
   */
  recordLatency(provider: string, durationMs: number): void {
    let window = this.windows.get(provider);
    if (!window) {
      window = [];
      this.windows.set(provider, window);
    }
    window.push(durationMs);
    if (window.length > this.maxSize) {
      window.shift();
    }
  }

  /**
   * Get latency statistics for a provider.
   */
  getStats(provider: string): { avgMs: number; p95Ms: number; callCount: number } {
    const window = this.windows.get(provider);
    if (!window || window.length === 0) {
      return { avgMs: 0, p95Ms: 0, callCount: 0 };
    }

    const callCount = window.length;
    const avgMs = window.reduce((sum, v) => sum + v, 0) / callCount;

    // p95: sort ascending, pick index at 95th percentile
    const sorted = [...window].sort((a, b) => a - b);
    const p95Index = Math.ceil(callCount * 0.95) - 1;
    const p95Ms = sorted[Math.min(p95Index, sorted.length - 1)];

    return { avgMs, p95Ms, callCount };
  }

  /**
   * Sort providers by average latency (ascending).
   * Providers with no data are placed last.
   */
  sortByLatency(providers: string[]): string[] {
    const withStats = providers
      .map(p => ({ provider: p, avgMs: this.getStats(p).avgMs }))
      .sort((a, b) => a.avgMs - b.avgMs);
    return withStats.map(entry => entry.provider);
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * LLM Fallback Chain interface
 */
export interface ILLMFallbackChain {
  /**
   * Execute an operation with fallback across providers in the configured chain.
   * Tries providers in chain order, skipping circuit-open providers,
   * tracking latency, and publishing events.
   */
  executeWithFallback<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderType,
  ): Promise<T>;

  /**
   * Get latency statistics for all tracked providers.
   */
  getLatencyStats(): Record<string, { avgMs: number; p95Ms: number; callCount: number }>;

  /**
   * Get the current fallback chain configuration.
   */
  getChainConfig(): FallbackChainConfig;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * LLMFallbackChainImpl implements ILLMFallbackChain
 *
 * Constructor takes CircuitBreakerRegistry, Map<ProviderType, LLMProvider>,
 * FallbackChainConfig, and optional IEventBus.
 */
export class LLMFallbackChainImpl implements ILLMFallbackChain {
  private readonly _circuitBreakerRegistry: CircuitBreakerRegistry;
  private readonly _providers: Map<ProviderType, LLMProvider>;
  private readonly _config: FallbackChainConfig;
  private readonly _eventBus: IEventBus | null;
  private readonly _latencyTracker: ProviderLatencyTracker;

  constructor(
    circuitBreakerRegistry: CircuitBreakerRegistry,
    providers: Map<ProviderType, LLMProvider>,
    config: Partial<FallbackChainConfig> = {},
    eventBus?: IEventBus,
  ) {
    this._circuitBreakerRegistry = circuitBreakerRegistry;
    this._providers = providers;
    this._config = { ...DEFAULT_CHAIN_CONFIG, ...config };
    this._eventBus = eventBus ?? null;
    this._latencyTracker = new ProviderLatencyTracker(this._config.latencyWindowSize);
  }

  /**
   * Execute an operation with fallback across providers in the configured chain.
   */
  async executeWithFallback<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderType,
  ): Promise<T> {
    const chainOrder = this._resolveChainOrder(preferredProvider);
    const errors: Array<{ provider: ProviderType; error: Error; latencyMs: number }> = [];

    // Publish start event
    this._publishEvent('llm:fallback-start', {
      operationName,
      preferredProvider,
      chainOrder,
    });

    for (const provider of chainOrder) {
      // Check circuit breaker before attempting
      if (!this._circuitBreakerRegistry.allow(provider)) {
        const state = this._circuitBreakerRegistry.getState(provider);
        _log.warn(
          `${operationName}: skipping provider "${provider}" — circuit is ${state}`
        );
        errors.push({
          provider,
          error: new CircuitOpenError(provider, state),
          latencyMs: 0,
        });
        continue;
      }

      // Provider must exist in the map
      const providerInstance = this._providers.get(provider);
      if (!providerInstance) {
        _log.warn(
          `${operationName}: provider "${provider}" not registered, skipping`
        );
        errors.push({
          provider,
          error: new ProviderUnavailableError(`Provider "${provider}" not registered`, provider),
          latencyMs: 0,
        });
        continue;
      }

      // Retry loop per provider
      for (let attempt = 1; attempt <= this._config.retryPerProvider; attempt++) {
        // Publish attempt event
        this._publishEvent('llm:fallback-attempt', {
          operationName,
          provider,
          attempt,
        });

        const startTime = Date.now();
        try {
          const result = await operation(providerInstance);
          const latencyMs = Date.now() - startTime;

          // Track latency and record success in circuit breaker
          this._latencyTracker.recordLatency(provider, latencyMs);
          this._circuitBreakerRegistry.recordSuccess(provider);

          // Publish success event
          this._publishEvent('llm:fallback-success', {
            operationName,
            provider,
            latencyMs,
          });

          _log.info(
            `${operationName}: succeeded on provider "${provider}" in ${latencyMs}ms`
          );
          return result;
        } catch (error) {
          const latencyMs = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));

          // Track latency even for failures
          this._latencyTracker.recordLatency(provider, latencyMs);

          // Publish provider-failed event
          this._publishEvent('llm:fallback-provider-failed', {
            operationName,
            provider,
            error: err.message,
            latencyMs,
          });

          _log.warn(
            `${operationName}: provider "${provider}" attempt ${attempt}/${this._config.retryPerProvider} failed: ${err.message} (${latencyMs}ms)`
          );

          // Record failure in circuit breaker
          this._circuitBreakerRegistry.recordFailure(provider);

          // If we have retries left for this provider, continue retry loop
          if (attempt < this._config.retryPerProvider) {
            continue;
          }

          // All retries exhausted for this provider, record and move on
          errors.push({ provider, error: err, latencyMs });
        }
      }
    }

    // All providers exhausted
    const allErrors = errors.map(e => e.error);

    // Publish exhausted event
    this._publishEvent('llm:fallback-exhausted', {
      operationName,
      errors: allErrors.map(e => e.message),
    });

    // If all errors are CircuitOpenError, throw a combined CircuitOpenError
    const openProviders = this._circuitBreakerRegistry.getOpenCircuitProviders();
    if (openProviders.length > 0 && allErrors.every(e => e instanceof CircuitOpenError)) {
      throw new CircuitOpenError(
        openProviders[0],
        this._circuitBreakerRegistry.getState(openProviders[0]),
        `All provider circuits are open [${openProviders.join(', ')}]. ` +
        `No providers available for ${operationName}.`
      );
    }

    throw new ProviderUnavailableError(
      `All providers failed for ${operationName}: ` +
      allErrors.map(e => e.message).join('; '),
      undefined,
      false,
    );
  }

  /**
   * Get latency statistics for all tracked providers.
   */
  getLatencyStats(): Record<string, { avgMs: number; p95Ms: number; callCount: number }> {
    const stats: Record<string, { avgMs: number; p95Ms: number; callCount: number }> = {};

    // Include stats for all providers in the chain
    for (const provider of this._config.chain) {
      stats[provider] = this._latencyTracker.getStats(provider);
    }

    // Also include any provider that has latency data but isn't in the chain
    for (const provider of this._providers.keys()) {
      if (!stats[provider]) {
        const providerStats = this._latencyTracker.getStats(provider);
        if (providerStats.callCount > 0) {
          stats[provider] = providerStats;
        }
      }
    }

    return stats;
  }

  /**
   * Get the current fallback chain configuration.
   */
  getChainConfig(): FallbackChainConfig {
    return this._config;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the effective chain order for a given preferred provider.
   * If latency routing is enabled, sorts providers by avg latency within
   * the same tier (preferred vs rest).
   */
  private _resolveChainOrder(preferredProvider?: ProviderType): ProviderType[] {
    let ordered: ProviderType[];

    if (preferredProvider) {
      // Place preferred provider first, then rest of chain
      const preferred: ProviderType[] = [];
      const rest: ProviderType[] = [];
      for (const p of this._config.chain) {
        if (p === preferredProvider) {
          preferred.push(p);
        } else {
          rest.push(p);
        }
      }
      ordered = [...preferred, ...rest];
    } else {
      ordered = [...this._config.chain];
    }

    // If latency routing is enabled, sort same-tier providers by avg latency
    if (this._config.enableLatencyRouting) {
      // Split into preferred tier and fallback tier
      const preferredTier = preferredProvider ? [preferredProvider] : ordered.slice(0, 1);
      const fallbackTier = preferredProvider ? ordered.slice(1) : ordered.slice(1);

      // Sort each tier by latency
      const sortedPreferred = this._latencyTracker.sortByLatency(preferredTier) as ProviderType[];
      const sortedFallback = this._latencyTracker.sortByLatency(fallbackTier) as ProviderType[];

      ordered = [...sortedPreferred, ...sortedFallback];
    }

    // Filter out providers not registered in the provider map
    // but keep them if all providers are missing (to produce a clear error)
    const available = ordered.filter(p => this._providers.has(p));
    if (available.length > 0) {
      return available;
    }
    // No providers registered at all — return original order for error reporting
    return ordered;
  }

  /**
   * Publish an event via the EventBus (if available).
   */
  private _publishEvent(channel: string, payload: Record<string, unknown>): void {
    if (this._eventBus) {
      try {
        this._eventBus.publish(channel, payload);
      } catch {
        // EventBus publishing failure must never block the operation
      }
    }
  }
}
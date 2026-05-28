import type { CircuitBreakerRegistry } from '../services/circuit-breaker';
import type { MCPHandler, MCPRequest, MCPRouteResult } from './mcp-router';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/** Thrown when every provider in the fallback chain has failed. */
export class MCPAllProvidersFailedError extends Error {
  public readonly failures: ReadonlyArray<{ provider: string; error: unknown }>;

  constructor(failures: ReadonlyArray<{ provider: string; error: unknown }>) {
    const providerNames = failures.map((f) => f.provider).join(', ');
    super(`All providers failed: [${providerNames}]`);
    this.name = 'MCPAllProvidersFailedError';
    this.failures = failures;
  }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IProviderFallbackChain {
  /** Try primary handler, fall back on failure. */
  execute(request: MCPRequest, routeResult: MCPRouteResult): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ProviderFallbackChain implements IProviderFallbackChain {
  private readonly circuitBreakerRegistry?: CircuitBreakerRegistry;
  private readonly fallbackHandlers = new Map<string, MCPHandler>();

  constructor(circuitBreakerRegistry?: CircuitBreakerRegistry) {
    this.circuitBreakerRegistry = circuitBreakerRegistry;
  }

  /** Register a fallback handler for a provider name. */
  registerFallbackHandler(providerName: string, handler: MCPHandler): void {
    this.fallbackHandlers.set(providerName, handler);
  }

  async execute(request: MCPRequest, routeResult: MCPRouteResult): Promise<unknown> {
    const failures: { provider: string; error: unknown }[] = [];

    // Build the ordered list: primary first, then fallbacks.
    const allProviderNames = [routeResult.provider, ...routeResult.fallbackProviders];

    for (const providerName of allProviderNames) {
      const handler = this.resolveHandler(providerName, routeResult);

      // If we cannot resolve the handler, skip this provider.
      if (!handler) {
        continue;
      }

      try {
        const result = await handler(request);

        // Record success with circuit breaker.
        this.recordSuccess(providerName);

        return result;
      } catch (error) {
        // Record failure with circuit breaker.
        this.recordFailure(providerName);

        failures.push({ provider: providerName, error });
        // Continue to next fallback provider.
      }
    }

    throw new MCPAllProvidersFailedError(failures);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Resolve the handler for a given provider name. */
  private resolveHandler(
    providerName: string,
    routeResult: MCPRouteResult,
  ): MCPHandler | undefined {
    // Primary provider's handler is carried directly in the route result.
    if (providerName === routeResult.provider) {
      return routeResult.handler;
    }

    // Fallback providers — resolve from the registered fallback handler map.
    return this.fallbackHandlers.get(providerName);
  }

  /** Record a success with the circuit breaker, if available. */
  private recordSuccess(providerName: string): void {
    if (!this.circuitBreakerRegistry) {
      return;
    }

    // Always record success so HALF_OPEN circuits can recover.
    this.circuitBreakerRegistry.recordSuccess(providerName);
  }

  /** Record a failure with the circuit breaker, if available. */
  private recordFailure(providerName: string): void {
    if (!this.circuitBreakerRegistry) {
      return;
    }

    this.circuitBreakerRegistry.recordFailure(providerName);
  }
}
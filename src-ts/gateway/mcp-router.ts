import type { CircuitBreakerRegistry } from '../services/circuit-breaker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** JSON-RPC style MCP request. */
export interface MCPRequest {
  method: string;
  params: Record<string, unknown>;
  id?: string;
}

/** Handler function that processes an MCP request. */
export type MCPHandler = (request: MCPRequest) => Promise<unknown>;

/** Description of a provider and what it can handle. */
export interface MCPProviderSpec {
  /** Provider identifier. */
  name: string;
  /** MCP methods this provider can handle (e.g. 'tools/call', 'resources/read'). */
  capabilities: string[];
  /** The actual handler function. */
  handler: MCPHandler;
  /** Higher = preferred when multiple providers support the same method. Default 0. */
  priority: number;
  /** Current health status. */
  healthStatus: 'healthy' | 'degraded' | 'unavailable';
}

/** Result of routing an MCP request to a provider. */
export interface MCPRouteResult {
  /** Which provider was selected. */
  provider: string;
  /** The handler function for the selected provider. */
  handler: MCPHandler;
  /** Ordered list of fallback providers (by priority, excluding the primary). */
  fallbackProviders: string[];
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IMCPRequestRouter {
  /** Route a request to the best capable handler. */
  route(request: MCPRequest): Promise<MCPRouteResult>;
  /** Register a provider with capabilities. */
  registerProvider(provider: MCPProviderSpec): void;
  /** List available providers. */
  getProviders(): MCPProviderSpec[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class MCPRequestRouter implements IMCPRequestRouter {
  private readonly providers = new Map<string, MCPProviderSpec>();
  private readonly circuitBreakerRegistry?: CircuitBreakerRegistry;

  constructor(circuitBreakerRegistry?: CircuitBreakerRegistry) {
    this.circuitBreakerRegistry = circuitBreakerRegistry;
  }

  async route(request: MCPRequest): Promise<MCPRouteResult> {
    const candidates = this.findCandidates(request.method);

    if (candidates.length === 0) {
      throw new Error(`No provider registered for method: ${request.method}`);
    }

    const { primary, fallbacks } = this.selectPrimaryAndFallbacks(candidates);

    return {
      provider: primary.name,
      handler: primary.handler,
      fallbackProviders: fallbacks.map((p) => p.name),
    };
  }

  registerProvider(provider: MCPProviderSpec): void {
    this.providers.set(provider.name, provider);
  }

  getProviders(): MCPProviderSpec[] {
    return Array.from(this.providers.values());
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Find all providers that declare a capability for the given method. */
  private findCandidates(method: string): MCPProviderSpec[] {
    const candidates: MCPProviderSpec[] = [];

    for (const spec of this.providers.values()) {
      if (!spec.capabilities.includes(method)) {
        continue;
      }

      // Skip providers that are marked unavailable.
      if (spec.healthStatus === 'unavailable') {
        continue;
      }

      // Skip providers whose circuit breaker is open.
      if (this.isCircuitOpen(spec.name)) {
        continue;
      }

      candidates.push(spec);
    }

    // Sort by priority descending (highest first).
    candidates.sort((a, b) => b.priority - a.priority);

    return candidates;
  }

  /** Partition candidates into primary (first) and fallbacks (rest). */
  private selectPrimaryAndFallbacks(
    candidates: MCPProviderSpec[],
  ): { primary: MCPProviderSpec; fallbacks: MCPProviderSpec[] } {
    // Among candidates already sorted by priority, prefer 'healthy' over 'degraded'.
    const healthy = candidates.filter((c) => c.healthStatus === 'healthy');
    const degraded = candidates.filter((c) => c.healthStatus === 'degraded');
    const ordered = [...healthy, ...degraded];

    if (ordered.length === 0) {
      // Should not happen because we filter 'unavailable' earlier, but guard.
      throw new Error('No healthy or degraded providers available');
    }

    return {
      primary: ordered[0],
      fallbacks: ordered.slice(1),
    };
  }

  /** Check whether the circuit breaker blocks calls for a provider. */
  private isCircuitOpen(providerName: string): boolean {
    if (!this.circuitBreakerRegistry) {
      return false;
    }

    return !this.circuitBreakerRegistry.allow(providerName);
  }
}

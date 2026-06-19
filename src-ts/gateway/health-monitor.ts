import type { IMCPRequestRouter } from './mcp-router';
import type { CircuitBreakerRegistry } from '../services/circuit-breaker';
import type { IEventBus } from '../services/event-bus';
import { createLogger } from '../logger/index.js';

const _log = createLogger('health-monitor');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthMonitorConfig {
  /** How often to probe all providers (ms). Default 30000. */
  probeIntervalMs?: number;
  /** Timeout per probe (ms). Default 5000. */
  timeoutMs?: number;
  /** Consecutive failures before marking degraded. Default 3. */
  degradationThreshold?: number;
}

export interface HealthProbeResult {
  providerName: string;
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
  timestamp: number;
}

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ProviderHealthState {
  status: ProviderHealthStatus;
  consecutiveFailures: number;
  lastProbeTime: number;
  averageResponseMs: number;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IMCPHealthMonitor {
  /** Begin monitoring loop. */
  start(): Promise<void>;
  /** Stop monitoring. */
  stop(): void;
  /** Probe a single provider. */
  probeProvider(providerName: string): Promise<HealthProbeResult>;
  /** Probe all registered providers. */
  probeAllProviders(): Promise<Record<string, HealthProbeResult>>;
  /** Get health status for all providers. */
  getHealthStatus(): Record<string, ProviderHealthState>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<HealthMonitorConfig> = {
  probeIntervalMs: 30000,
  timeoutMs: 5000,
  degradationThreshold: 3,
};

export class MCPHealthMonitorImpl implements IMCPHealthMonitor {
  private readonly router: IMCPRequestRouter;
  private readonly circuitBreakerRegistry: CircuitBreakerRegistry;
  private readonly eventBus: IEventBus;
  private readonly config: Required<HealthMonitorConfig>;
  private readonly healthStates = new Map<string, ProviderHealthState>();
  private readonly responseTimeHistory = new Map<string, number[]>();
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    router: IMCPRequestRouter,
    circuitBreakerRegistry: CircuitBreakerRegistry,
    eventBus: IEventBus,
    config?: HealthMonitorConfig,
  ) {
    this.router = router;
    this.circuitBreakerRegistry = circuitBreakerRegistry;
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initial probe
    await this.probeAllProviders();

    // Periodic probing
    this.probeTimer = setInterval(() => {
      this.probeAllProviders().catch((err) => {
        _log.error('Periodic health probe failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.config.probeIntervalMs);
    this.probeTimer.unref?.();

    _log.info('Health monitor started', { probeIntervalMs: this.config.probeIntervalMs });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.probeTimer !== null) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }

    _log.info('Health monitor stopped');
  }

  async probeProvider(providerName: string): Promise<HealthProbeResult> {
    const timestamp = Date.now();
    const providers = this.router.getProviders();
    const provider = providers.find((p) => p.name === providerName);

    if (!provider) {
      return {
        providerName,
        healthy: false,
        responseTimeMs: 0,
        error: `Provider "${providerName}" not found in router`,
        timestamp,
      };
    }

    try {
      const start = Date.now();

      // Probe by sending a lightweight health-check request through the provider handler.
      const probeResult = await Promise.race([
        provider.handler({ method: 'health/check', params: {}, id: `probe-${timestamp}` }),
        this.createTimeout(),
      ]);

      const responseTimeMs = Date.now() - start;

      this.recordSuccess(providerName, responseTimeMs);

      return {
        providerName,
        healthy: true,
        responseTimeMs,
        timestamp,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.recordFailure(providerName, errorMessage);

      return {
        providerName,
        healthy: false,
        responseTimeMs: 0,
        error: errorMessage,
        timestamp,
      };
    }
  }

  async probeAllProviders(): Promise<Record<string, HealthProbeResult>> {
    const providers = this.router.getProviders();
    const results: Record<string, HealthProbeResult> = {};

    // Probe all providers concurrently
    const probePromises = providers.map(async (provider) => {
      const result = await this.probeProvider(provider.name);
      results[provider.name] = result;
    });

    await Promise.allSettled(probePromises);

    return results;
  }

  getHealthStatus(): Record<string, ProviderHealthState> {
    const status: Record<string, ProviderHealthState> = {};

    for (const [name, state] of this.healthStates) {
      status[name] = { ...state };
    }

    // Include providers that haven't been probed yet with 'unknown' status
    const providers = this.router.getProviders();
    for (const provider of providers) {
      if (!status[provider.name]) {
        status[provider.name] = {
          status: 'unknown',
          consecutiveFailures: 0,
          lastProbeTime: 0,
          averageResponseMs: 0,
        };
      }
    }

    return status;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Create a timeout promise that rejects after config.timeoutMs. */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Probe timed out after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs,
      );
    });
  }

  /** Record a successful probe and update health state. */
  private recordSuccess(providerName: string, responseTimeMs: number): void {
    const prev = this.healthStates.get(providerName);
    const wasDegraded = prev?.status === 'degraded' || prev?.status === 'unhealthy';

    // Update response time history
    this.trackResponseTime(providerName, responseTimeMs);

    const newState: ProviderHealthState = {
      status: 'healthy',
      consecutiveFailures: 0,
      lastProbeTime: Date.now(),
      averageResponseMs: this.computeAverageResponseMs(providerName),
    };

    this.healthStates.set(providerName, newState);

    // Record success with circuit breaker
    this.circuitBreakerRegistry.recordSuccess(providerName);

    // Publish recovery event if provider was previously degraded/unhealthy
    if (wasDegraded) {
      this.eventBus.publish('mcp:provider-recovered', {
        name: providerName,
        previousStatus: prev!.status,
        responseTimeMs,
      });
      _log.info('Provider recovered', { name: providerName, responseTimeMs });
    }
  }

  /** Record a failed probe and update health state. */
  private recordFailure(providerName: string, error: string): void {
    const prev = this.healthStates.get(providerName);
    const consecutiveFailures = (prev?.consecutiveFailures ?? 0) + 1;

    // Determine new status based on failure count
    let newStatus: ProviderHealthStatus;
    if (consecutiveFailures >= this.config.degradationThreshold * 2) {
      newStatus = 'unhealthy';
    } else if (consecutiveFailures >= this.config.degradationThreshold) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    const newState: ProviderHealthState = {
      status: newStatus,
      consecutiveFailures,
      lastProbeTime: Date.now(),
      averageResponseMs: prev?.averageResponseMs ?? 0,
    };

    this.healthStates.set(providerName, newState);

    // Record failure with circuit breaker
    this.circuitBreakerRegistry.recordFailure(providerName);

    // Publish degradation event when threshold is first reached
    if (
      newStatus === 'degraded' &&
      prev?.status !== 'degraded' &&
      prev?.status !== 'unhealthy'
    ) {
      this.eventBus.publish('mcp:provider-degraded', {
        name: providerName,
        consecutiveFailures,
        degradationThreshold: this.config.degradationThreshold,
        error,
      });
      _log.warn('Provider degraded', {
        name: providerName,
        consecutiveFailures,
        error,
      });
    }

    if (newStatus === 'unhealthy' && prev?.status !== 'unhealthy') {
      _log.error('Provider unhealthy', {
        name: providerName,
        consecutiveFailures,
        error,
      });
    }
  }

  /** Track response time samples (keep last 20 for rolling average). */
  private trackResponseTime(providerName: string, responseTimeMs: number): void {
    let history = this.responseTimeHistory.get(providerName);
    if (!history) {
      history = [];
      this.responseTimeHistory.set(providerName, history);
    }

    history.push(responseTimeMs);

    // Keep only the last 20 samples for rolling average
    if (history.length > 20) {
      history.shift();
    }
  }

  /** Compute rolling average response time for a provider. */
  private computeAverageResponseMs(providerName: string): number {
    const history = this.responseTimeHistory.get(providerName);
    if (!history || history.length === 0) return 0;

    const sum = history.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / history.length);
  }
}

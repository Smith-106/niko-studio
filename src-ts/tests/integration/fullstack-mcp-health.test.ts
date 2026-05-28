import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServiceDiscoveryImpl } from '../../gateway/service-discovery.js';
import type { DiscoveredProvider } from '../../gateway/service-discovery.js';
import { MCPHealthMonitorImpl } from '../../gateway/health-monitor.js';
import type { HealthProbeResult, ProviderHealthState } from '../../gateway/health-monitor.js';
import { MCPRequestRouter } from '../../gateway/mcp-router.js';
import type { MCPProviderSpec } from '../../gateway/mcp-router.js';
import { CircuitBreakerRegistry, CircuitState } from '../../services/circuit-breaker.js';
import { TypedEventBus } from '../../services/event-bus.js';
import { EventLogImpl } from '../../services/event-log.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Test Suite: MCP Service Discovery + Health Monitoring
// ---------------------------------------------------------------------------

describe('Integration: MCP service discovery + health monitoring', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;
  let circuitRegistry: CircuitBreakerRegistry;
  let router: MCPRequestRouter;
  let tmpDir: string;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 200 });
    eventBus = new TypedEventBus(undefined, { eventLog });
    circuitRegistry = new CircuitBreakerRegistry({
      failureThreshold: 3,
      cooldownMs: 100,
      halfOpenMaxCalls: 1,
    });
    router = new MCPRequestRouter(circuitRegistry);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-int-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows EPERM */ }
    eventLog.clear();
  });

  it('discover providers from config → verify auto-registration with router', async () => {
    // Write a mock mcp-config.json file
    const configContent = JSON.stringify({
      providers: [
        { name: 'alpha', capabilities: ['tools/call', 'resources/read'], endpoint: 'http://localhost:8080', priority: 10 },
        { name: 'beta', capabilities: ['tools/call'], endpoint: 'http://localhost:8081', priority: 5 },
      ],
    });
    const configPath = path.join(tmpDir, 'mcp-config.json');
    fs.writeFileSync(configPath, configContent, 'utf-8');

    const discovery = new MCPServiceDiscoveryImpl(router, eventBus, {
      configPath,
      environmentPrefix: 'MCP_TEST_INT_',
      scanIntervalMs: 60000, // Long interval so we don't get periodic scans
    });

    // Discover providers
    const providers = await discovery.discoverProviders();

    expect(providers.length).toBe(2);
    expect(providers.some((p) => p.name === 'alpha')).toBe(true);
    expect(providers.some((p) => p.name === 'beta')).toBe(true);

    // Verify providers were auto-registered with the router
    const registered = router.getProviders();
    expect(registered.length).toBe(2);
    expect(registered.some((p) => p.name === 'alpha')).toBe(true);
    expect(registered.some((p) => p.name === 'beta')).toBe(true);

    // Verify discovery events published
    const discoverEvents = eventLog.getEvents({ channel: 'mcp:provider-discovered' });
    expect(discoverEvents.length).toBe(2);

    discovery.stop();
  });

  it('health probe succeeds → verify provider marked healthy', async () => {
    // Register a healthy provider in the router
    const healthyProvider: MCPProviderSpec = {
      name: 'healthy-provider',
      capabilities: ['tools/call', 'health/check'],
      handler: async (_request) => ({ status: 'ok' }),
      priority: 10,
      healthStatus: 'healthy',
    };
    router.registerProvider(healthyProvider);

    const monitor = new MCPHealthMonitorImpl(router, circuitRegistry, eventBus, {
      probeIntervalMs: 60000,
      timeoutMs: 5000,
      degradationThreshold: 3,
    });

    // Probe the healthy provider
    const result = await monitor.probeProvider('healthy-provider');

    expect(result.healthy).toBe(true);
    expect(result.providerName).toBe('healthy-provider');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);

    // Provider should be marked healthy
    const healthStatus = monitor.getHealthStatus();
    expect(healthStatus['healthy-provider'].status).toBe('healthy');
    expect(healthStatus['healthy-provider'].consecutiveFailures).toBe(0);

    // Circuit breaker should remain CLOSED
    expect(circuitRegistry.getState('healthy-provider')).toBe(CircuitState.CLOSED);
  });

  it('multiple probe failures → verify provider marked degraded → circuit breaker updated', async () => {
    // Register a failing provider in the router
    const failingProvider: MCPProviderSpec = {
      name: 'failing-provider',
      capabilities: ['tools/call', 'health/check'],
      handler: async (_request) => { throw new Error('Provider intentionally failing'); },
      priority: 5,
      healthStatus: 'healthy',
    };
    router.registerProvider(failingProvider);

    const monitor = new MCPHealthMonitorImpl(router, circuitRegistry, eventBus, {
      probeIntervalMs: 60000,
      timeoutMs: 5000,
      degradationThreshold: 3,
    });

    // Probe multiple times to exceed degradation threshold
    await monitor.probeProvider('failing-provider');
    await monitor.probeProvider('failing-provider');
    await monitor.probeProvider('failing-provider');

    // Provider should be marked degraded (3 consecutive failures = degradationThreshold)
    const healthStatus = monitor.getHealthStatus();
    expect(healthStatus['failing-provider'].status).toBe('degraded');
    expect(healthStatus['failing-provider'].consecutiveFailures).toBe(3);

    // Circuit breaker should have recorded failures and be open
    expect(circuitRegistry.getState('failing-provider')).toBe(CircuitState.OPEN);

    // Verify degraded event was published
    const degradedEvents = eventLog.getEvents({ channel: 'mcp:provider-degraded' });
    expect(degradedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('provider recovers → verify health status restored → recovery event published', async () => {
    // Register a provider that initially fails then recovers
    let shouldFail = true;
    const recoverableProvider: MCPProviderSpec = {
      name: 'recoverable-provider',
      capabilities: ['tools/call', 'health/check'],
      handler: async (request) => {
        if (shouldFail) {
          throw new Error('Provider failing');
        }
        return { status: 'ok', method: request.method };
      },
      priority: 5,
      healthStatus: 'healthy',
    };
    router.registerProvider(recoverableProvider);

    const monitor = new MCPHealthMonitorImpl(router, circuitRegistry, eventBus, {
      probeIntervalMs: 60000,
      timeoutMs: 5000,
      degradationThreshold: 3,
    });

    // Push into degraded state
    await monitor.probeProvider('recoverable-provider');
    await monitor.probeProvider('recoverable-provider');
    await monitor.probeProvider('recoverable-provider');

    const degradedStatus = monitor.getHealthStatus()['recoverable-provider'];
    expect(degradedStatus.status).toBe('degraded');

    // Circuit breaker is open
    expect(circuitRegistry.getState('recoverable-provider')).toBe(CircuitState.OPEN);

    // Wait for circuit breaker cooldown
    await new Promise((r) => setTimeout(r, 150));

    // Provider recovers now
    shouldFail = false;

    // After cooldown, circuit auto-transitions to HALF_OPEN on next getState/allow call.
    // The health monitor's probeProvider calls circuitBreakerRegistry.recordSuccess
    // which only transitions HALF_OPEN→CLOSED, so we need to ensure the circuit
    // has already transitioned to HALF_OPEN before probing.
    expect(circuitRegistry.getState('recoverable-provider')).toBe(CircuitState.HALF_OPEN);

    // Probe to detect recovery
    const result = await monitor.probeProvider('recoverable-provider');

    expect(result.healthy).toBe(true);

    // Health status should be restored to healthy
    const finalStatus = monitor.getHealthStatus()['recoverable-provider'];
    expect(finalStatus.status).toBe('healthy');
    expect(finalStatus.consecutiveFailures).toBe(0);

    // Circuit breaker should be closed again
    expect(circuitRegistry.getState('recoverable-provider')).toBe(CircuitState.CLOSED);

    // Verify recovery event was published
    const recoveryEvents = eventLog.getEvents({ channel: 'mcp:provider-recovered' });
    expect(recoveryEvents.length).toBeGreaterThanOrEqual(1);
  });
});
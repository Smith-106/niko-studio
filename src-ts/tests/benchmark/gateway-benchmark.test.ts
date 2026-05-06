/**
 * Gateway performance benchmark.
 *
 * Measures P50/P95/P99 latency for core endpoints.
 * Run: npx vitest run tests/benchmark/gateway-benchmark.test.ts
 *
 * Results are saved to tests/benchmark/baseline.json for regression tracking.
 * This test ALWAYS passes — it records performance, doesn't enforce thresholds.
 */

import { afterEach, describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';

import { buildGatewayDeps } from '../../gateway-server';
import { ConfigManager } from '../../config';
import { ServiceContainer } from '../../container/ServiceContainer';
import { ServiceTypes } from '../../container/types';
import { createGatewayRequestHandler } from '../../mcp/gateway-request-handler';
import { gatewayRoutes } from '../../mcp/routes';
import { setGatewayDeps } from '../../mcp/endpoints/health';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const ITERATIONS = 50;

function createTestContainer(): ServiceContainer {
  const container = new ServiceContainer();
  const healthOk = { healthCheck: async () => ({ status: 'ok' }) };
  container.registerMock(ServiceTypes.MemoryEngine, healthOk);
  container.registerMock(ServiceTypes.GraphEngine, healthOk);
  container.registerMock(ServiceTypes.SearchEngine, healthOk);
  container.registerMock(ServiceTypes.WorkflowEngine, healthOk);
  container.registerMock(ServiceTypes.CriticEngine, healthOk);
  return container;
}

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  ConfigManager.resetInstance();
  const deps = buildGatewayDeps(createTestContainer());
  setGatewayDeps(deps);
  const server = createServer(createGatewayRequestHandler(gatewayRoutes));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

async function measureLatency(
  fn: () => Promise<unknown>,
  iterations: number = ITERATIONS,
): Promise<{ p50: number; p95: number; p99: number; avg: number; min: number; max: number }> {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    latencies.push(performance.now() - start);
  }
  latencies.sort((a, b) => a - b);
  const p = (pct: number) => Math.round(latencies[Math.floor(pct / 100 * latencies.length)] * 100) / 100;
  return {
    p50: p(50), p95: p(95), p99: p(99),
    avg: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length * 100) / 100,
    min: p(0), max: p(100),
  };
}

describe('Gateway Performance Benchmark', () => {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    version: '9.2.0',
    iterations: ITERATIONS,
    endpoints: {} as Record<string, unknown>,
  };
  let baseUrl = '';
  let server: Server;

  afterEach(async () => {
    // cleanup handled in last test
  });

  it('starts benchmark server', async () => {
    const ctx = await startServer();
    server = ctx.server;
    baseUrl = ctx.baseUrl;
  });

  it('benchmarks GET /health', async () => {
    const r = await measureLatency(() => fetch(`${baseUrl}/health`));
    (results.endpoints as Record<string, unknown>)['GET /health'] = r;
    console.log(`GET /health    — P50: ${r.p50}ms  P95: ${r.p95}ms  P99: ${r.p99}ms`);
  });

  it('benchmarks GET /tools', async () => {
    const r = await measureLatency(() => fetch(`${baseUrl}/tools`));
    (results.endpoints as Record<string, unknown>)['GET /tools'] = r;
    console.log(`GET /tools     — P50: ${r.p50}ms  P95: ${r.p95}ms  P99: ${r.p99}ms`);
  });

  it('benchmarks GET /metrics', async () => {
    const r = await measureLatency(() => fetch(`${baseUrl}/metrics`));
    (results.endpoints as Record<string, unknown>)['GET /metrics'] = r;
    console.log(`GET /metrics   — P50: ${r.p50}ms  P95: ${r.p95}ms  P99: ${r.p99}ms`);
  });

  it('benchmarks POST /chat (validation)', { timeout: 60_000 }, async () => {
    // POST /chat involves the full LLM pipeline — use fewer iterations
    const r = await measureLatency(
      () =>
        fetch(`${baseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'benchmark' }] }),
        }),
      10,
    );
    (results.endpoints as Record<string, unknown>)['POST /chat'] = r;
    console.log(`POST /chat     — P50: ${r.p50}ms  P95: ${r.p95}ms  P99: ${r.p99}ms`);
  });

  it('benchmarks POST /workflow/route', { timeout: 30_000 }, async () => {
    const r = await measureLatency(
      () =>
        fetch(`${baseUrl}/workflow/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
          body: JSON.stringify({ topic: 'benchmark', mode: 'rapid' }),
        }),
      10,
    );
    (results.endpoints as Record<string, unknown>)['POST /workflow/route'] = r;
    console.log(`POST /workflow — P50: ${r.p50}ms  P95: ${r.p95}ms  P99: ${r.p99}ms`);
  });

  it('saves baseline and shuts down', async () => {
    writeFileSync('tests/benchmark/baseline.json', JSON.stringify(results, null, 2));
    console.log('\nBaseline saved to tests/benchmark/baseline.json');
    server.close();
    ConfigManager.resetInstance();
  });
});

/**
 * Gateway performance benchmark script.
 *
 * Measures P50/P95/P99 latency and throughput for core endpoints.
 * Usage: npx ts-node tests/benchmark/gateway-benchmark.ts
 *
 * This establishes a performance baseline for tracking regressions.
 * Results are written to src-ts/tests/benchmark/baseline.json.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { writeFileSync } from 'node:fs';

import { buildGatewayDeps } from '../../gateway-server.js';
import { ConfigManager } from '../../config/index.js';
import { ServiceContainer } from '../../container/ServiceContainer.js';
import { ServiceTypes } from '../../container/types.js';
import { createGatewayRequestHandler } from '../../mcp/gateway-request-handler.js';
import { gatewayRoutes } from '../../mcp/routes/index.js';
import { setGatewayDeps } from '../../mcp/endpoints/health.js';

// ── Helpers ──────────────────────────────────────────────────

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

async function startBenchmarkServer(): Promise<{ server: Server; baseUrl: string }> {
  ConfigManager.resetInstance();
  const container = createTestContainer();
  const deps = buildGatewayDeps(container);
  setGatewayDeps(deps);

  const server = createServer(createGatewayRequestHandler(gatewayRoutes));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function measureLatency(
  label: string,
  fn: () => Promise<number>,
  iterations: number = 50,
): Promise<{ label: string; p50: number; p95: number; p99: number; avg: number; min: number; max: number }> {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const ms = await fn();
    latencies.push(ms);
  }
  latencies.sort((a, b) => a - b);

  const p = (percentile: number) => latencies[Math.floor(percentile / 100 * latencies.length)];
  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;

  return {
    label,
    p50: Math.round(p(50) * 100) / 100,
    p95: Math.round(p(95) * 100) / 100,
    p99: Math.round(p(99) * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    min: Math.round(latencies[0] * 100) / 100,
    max: Math.round(latencies[latencies.length - 1] * 100) / 100,
  };
}

async function timedFetch(url: string, options?: RequestInit): Promise<number> {
  const start = performance.now();
  await fetch(url, {
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
    ...options,
  });
  return performance.now() - start;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const { server, baseUrl } = await startBenchmarkServer();

  console.log('Niko Studio Gateway Performance Benchmark');
  console.log('==========================================');
  console.log(`Server: ${baseUrl}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  try {
    const results: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      version: '9.2.0',
      iterations: 50,
      endpoints: {},
    };

    // 1. GET /health
    const health = await measureLatency('GET /health', () => timedFetch(`${baseUrl}/health`));
    results.endpoints['GET /health'] = health;
    console.log(`GET /health    — P50: ${health.p50}ms  P95: ${health.p95}ms  P99: ${health.p99}ms`);

    // 2. GET /tools
    const tools = await measureLatency('GET /tools', () => timedFetch(`${baseUrl}/tools`));
    results.endpoints['GET /tools'] = tools;
    console.log(`GET /tools     — P50: ${tools.p50}ms  P95: ${tools.p95}ms  P99: ${tools.p99}ms`);

    // 3. GET /metrics
    const metrics = await measureLatency('GET /metrics', () => timedFetch(`${baseUrl}/metrics`));
    results.endpoints['GET /metrics'] = metrics;
    console.log(`GET /metrics   — P50: ${metrics.p50}ms  P95: ${metrics.p95}ms  P99: ${metrics.p99}ms`);

    // 4. POST /chat (validation only — no LLM calls)
    const chat = await measureLatency('POST /chat', () =>
      timedFetch(`${baseUrl}/chat`, {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'benchmark test' }] }),
      }),
    );
    results.endpoints['POST /chat'] = chat;
    console.log(`POST /chat     — P50: ${chat.p50}ms  P95: ${chat.p95}ms  P99: ${chat.p99}ms`);

    // 5. POST /workflow/route
    const workflow = await measureLatency('POST /workflow/route', () =>
      timedFetch(`${baseUrl}/workflow/route`, {
        method: 'POST',
        body: JSON.stringify({ topic: 'benchmark', mode: 'rapid' }),
      }),
    );
    results.endpoints['POST /workflow/route'] = workflow;
    console.log(`POST /workflow — P50: ${workflow.p50}ms  P95: ${workflow.p95}ms  P99: ${workflow.p99}ms`);

    // Write baseline
    const outputPath = 'tests/benchmark/baseline.json';
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nBaseline written to: ${outputPath}`);
  } finally {
    server.close();
    ConfigManager.resetInstance();
  }
}

main().catch((e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});

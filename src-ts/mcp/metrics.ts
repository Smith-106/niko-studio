/**
 * MCP Gateway Metrics System
 *
 * Request metrics collection and reporting for the MCP gateway.
 * Note: Starlette middleware is NOT ported.
 *
 * Migrated from src/mcp/metrics.py
 */

// ============================================================
// Internal Metrics State
// ============================================================

interface MetricsState {
  requestsTotal: number;
  requestsFailedTotal: number;
  latencyMsTotal: number;
  latencyMsMax: number;
}

export const METRICS: MetricsState = {
  requestsTotal: 0,
  requestsFailedTotal: 0,
  latencyMsTotal: 0.0,
  latencyMsMax: 0.0,
};

// ============================================================
// Public Functions
// ============================================================

/**
 * Record request metrics for monitoring.
 */
export function recordRequestMetrics(statusCode: number, latencyMs: number): void {
  METRICS.requestsTotal += 1;
  if (statusCode >= 400) {
    METRICS.requestsFailedTotal += 1;
  }
  METRICS.latencyMsTotal += latencyMs;
  if (latencyMs > METRICS.latencyMsMax) {
    METRICS.latencyMsMax = latencyMs;
  }
}

/**
 * Get a snapshot of current metrics.
 */
export function getMetricsSnapshot(): Record<string, number> {
  const { requestsTotal, requestsFailedTotal, latencyMsTotal } = METRICS;
  const avgLatency = requestsTotal > 0 ? latencyMsTotal / requestsTotal : 0.0;

  return {
    requests_total: requestsTotal,
    requests_failed_total: requestsFailedTotal,
    requests_success_total: requestsTotal - requestsFailedTotal,
    latency_ms_avg: Math.round(avgLatency * 100) / 100,
    latency_ms_max: Math.round(METRICS.latencyMsMax * 100) / 100,
  };
}

/**
 * Get current UTC time in ISO format.
 */
export function utcNowIso(): string {
  return new Date().toISOString().replace(/\+00:00$/, 'Z');
}

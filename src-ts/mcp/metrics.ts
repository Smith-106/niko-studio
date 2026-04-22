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

interface MetricsDimensionState {
  requestsTotal: number;
  requestsFailedTotal: number;
  latencyMsTotal: number;
  latencyMsMax: number;
}

interface MetricsState {
  requestsTotal: number;
  requestsFailedTotal: number;
  latencyMsTotal: number;
  latencyMsMax: number;
  routeMethodMetrics: Map<string, MetricsDimensionState>;
  routeMethodStatusCounts: Map<string, number>;
}

export const METRICS: MetricsState = {
  requestsTotal: 0,
  requestsFailedTotal: 0,
  latencyMsTotal: 0.0,
  latencyMsMax: 0.0,
  routeMethodMetrics: new Map(),
  routeMethodStatusCounts: new Map(),
};

export interface RequestMetricsDimensions {
  route?: string;
  method?: string;
  statusCode: number;
  latencyMs: number;
}

function dimensionKey(route: string, method: string): string {
  return `${route} ${method}`;
}

function statusKey(route: string, method: string, statusCode: number): string {
  return `${route} ${method} ${statusCode}`;
}

function normalizeDimensions(input: RequestMetricsDimensions): {
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
} {
  return {
    route: typeof input.route === 'string' && input.route.trim() ? input.route.trim() : 'unknown_route',
    method: typeof input.method === 'string' && input.method.trim() ? input.method.trim().toUpperCase() : 'UNKNOWN',
    statusCode: input.statusCode,
    latencyMs: input.latencyMs,
  };
}

// ============================================================
// Public Functions
// ============================================================

/**
 * Record request metrics for monitoring.
 */
export function recordRequestMetrics(statusCode: number, latencyMs: number): void;
export function recordRequestMetrics(input: RequestMetricsDimensions): void;
export function recordRequestMetrics(
  statusCodeOrInput: number | RequestMetricsDimensions,
  latencyMs?: number,
): void {
  const normalized = typeof statusCodeOrInput === 'number'
    ? normalizeDimensions({ statusCode: statusCodeOrInput, latencyMs: latencyMs ?? 0 })
    : normalizeDimensions(statusCodeOrInput);

  METRICS.requestsTotal += 1;
  if (normalized.statusCode >= 400) {
    METRICS.requestsFailedTotal += 1;
  }
  METRICS.latencyMsTotal += normalized.latencyMs;
  if (normalized.latencyMs > METRICS.latencyMsMax) {
    METRICS.latencyMsMax = normalized.latencyMs;
  }

  const rmKey = dimensionKey(normalized.route, normalized.method);
  const rmCurrent = METRICS.routeMethodMetrics.get(rmKey) ?? {
    requestsTotal: 0,
    requestsFailedTotal: 0,
    latencyMsTotal: 0,
    latencyMsMax: 0,
  };
  rmCurrent.requestsTotal += 1;
  if (normalized.statusCode >= 400) {
    rmCurrent.requestsFailedTotal += 1;
  }
  rmCurrent.latencyMsTotal += normalized.latencyMs;
  if (normalized.latencyMs > rmCurrent.latencyMsMax) {
    rmCurrent.latencyMsMax = normalized.latencyMs;
  }
  METRICS.routeMethodMetrics.set(rmKey, rmCurrent);

  const rmsKey = statusKey(normalized.route, normalized.method, normalized.statusCode);
  METRICS.routeMethodStatusCounts.set(rmsKey, (METRICS.routeMethodStatusCounts.get(rmsKey) ?? 0) + 1);
}

/**
 * Get a snapshot of current metrics.
 */
export function getMetricsSnapshot(): Record<string, unknown> {
  const { requestsTotal, requestsFailedTotal, latencyMsTotal } = METRICS;
  const avgLatency = requestsTotal > 0 ? latencyMsTotal / requestsTotal : 0.0;

  const latencyByRouteMethod: Record<string, Record<string, number>> = {};
  for (const [key, value] of METRICS.routeMethodMetrics.entries()) {
    const average = value.requestsTotal > 0 ? value.latencyMsTotal / value.requestsTotal : 0;
    latencyByRouteMethod[key] = {
      requests_total: value.requestsTotal,
      requests_failed_total: value.requestsFailedTotal,
      requests_success_total: value.requestsTotal - value.requestsFailedTotal,
      latency_ms_avg: Math.round(average * 100) / 100,
      latency_ms_max: Math.round(value.latencyMsMax * 100) / 100,
    };
  }

  const statusCounts: Record<string, number> = {};
  for (const [key, value] of METRICS.routeMethodStatusCounts.entries()) {
    statusCounts[key] = value;
  }

  return {
    requests_total: requestsTotal,
    requests_failed_total: requestsFailedTotal,
    requests_success_total: requestsTotal - requestsFailedTotal,
    latency_ms_avg: Math.round(avgLatency * 100) / 100,
    latency_ms_max: Math.round(METRICS.latencyMsMax * 100) / 100,
    latency_by_route_method: latencyByRouteMethod,
    requests_by_route_method_status: statusCounts,
  };
}

export function resetMetrics(): void {
  METRICS.requestsTotal = 0;
  METRICS.requestsFailedTotal = 0;
  METRICS.latencyMsTotal = 0;
  METRICS.latencyMsMax = 0;
  METRICS.routeMethodMetrics.clear();
  METRICS.routeMethodStatusCounts.clear();
}

/**
 * Get current UTC time in ISO format.
 */
export function utcNowIso(): string {
  return new Date().toISOString().replace(/\+00:00$/, 'Z');
}

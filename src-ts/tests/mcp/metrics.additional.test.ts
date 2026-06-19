import { beforeEach, describe, expect, it } from 'vitest';

import {
  METRICS,
  getMetricsSnapshot,
  recordRequestMetrics,
  resetMetrics,
  utcNowIso,
} from '../../mcp/metrics.js';

describe('mcp/metrics additional coverage', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('records normalized route, method, status, and latency dimensions', () => {
    recordRequestMetrics({
      route: '  /health  ',
      method: ' get ',
      statusCode: 200,
      latencyMs: 12.345,
    });
    recordRequestMetrics({
      route: '/health',
      method: 'GET',
      statusCode: 503,
      latencyMs: 30,
    });

    expect(getMetricsSnapshot()).toEqual({
      requests_total: 2,
      requests_failed_total: 1,
      requests_success_total: 1,
      latency_ms_avg: 21.17,
      latency_ms_max: 30,
      latency_by_route_method: {
        '/health GET': {
          requests_total: 2,
          requests_failed_total: 1,
          requests_success_total: 1,
          latency_ms_avg: 21.17,
          latency_ms_max: 30,
        },
      },
      requests_by_route_method_status: {
        '/health GET 200': 1,
        '/health GET 503': 1,
      },
    });
  });

  it('supports numeric overloads, empty snapshots, reset, and UTC timestamps', () => {
    expect(getMetricsSnapshot()).toMatchObject({
      requests_total: 0,
      requests_failed_total: 0,
      latency_ms_avg: 0,
      latency_ms_max: 0,
      latency_by_route_method: {},
      requests_by_route_method_status: {},
    });

    recordRequestMetrics(404);
    expect(getMetricsSnapshot()).toMatchObject({
      requests_total: 1,
      requests_failed_total: 1,
      latency_by_route_method: {
        'unknown_route UNKNOWN': expect.objectContaining({
          requests_total: 1,
          requests_failed_total: 1,
          latency_ms_avg: 0,
        }),
      },
      requests_by_route_method_status: {
        'unknown_route UNKNOWN 404': 1,
      },
    });

    resetMetrics();
    expect(getMetricsSnapshot()).toMatchObject({
      requests_total: 0,
      requests_by_route_method_status: {},
    });
    expect(utcNowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('clears dimension maps when a new route exceeds the metrics key cap', () => {
    for (let index = 0; index < 500; index++) {
      recordRequestMetrics({
        route: `/route-${index}`,
        method: 'GET',
        statusCode: 200,
        latencyMs: index,
      });
    }

    recordRequestMetrics({
      route: '/overflow',
      method: 'post',
      statusCode: 201,
      latencyMs: 10,
    });

    expect(getMetricsSnapshot()).toMatchObject({
      requests_total: 501,
      latency_by_route_method: {
        '/overflow POST': {
          requests_total: 1,
          requests_success_total: 1,
          latency_ms_avg: 10,
        },
      },
      requests_by_route_method_status: {
        '/overflow POST 201': 1,
      },
    });
  });

  it('reports zero average for an empty route-method bucket', () => {
    METRICS.routeMethodMetrics.set('empty GET', {
      requestsTotal: 0,
      requestsFailedTotal: 0,
      latencyMsTotal: 99,
      latencyMsMax: 0,
    });

    expect(getMetricsSnapshot()).toMatchObject({
      latency_by_route_method: {
        'empty GET': {
          requests_total: 0,
          latency_ms_avg: 0,
        },
      },
    });
  });
});

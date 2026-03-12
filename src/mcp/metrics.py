"""
MCP Gateway Metrics System

Request metrics collection and reporting for the MCP gateway.
"""

import time
from datetime import datetime, timezone
from typing import Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


# ============ 网关运行时指标 ============

_METRICS: Dict[str, float | int] = {
    "requests_total": 0,
    "requests_failed_total": 0,
    "latency_ms_total": 0.0,
    "latency_ms_max": 0.0,
}


def _record_request_metrics(status_code: int, latency_ms: float) -> None:
    """Record request metrics for monitoring."""
    _METRICS["requests_total"] += 1
    if status_code >= 400:
        _METRICS["requests_failed_total"] += 1
    _METRICS["latency_ms_total"] += latency_ms
    if latency_ms > _METRICS["latency_ms_max"]:
        _METRICS["latency_ms_max"] = latency_ms


def _get_metrics_snapshot() -> dict:
    """Get a snapshot of current metrics."""
    requests_total = _METRICS["requests_total"]
    requests_failed = _METRICS["requests_failed_total"]
    latency_total = _METRICS["latency_ms_total"]
    avg_latency = latency_total / requests_total if requests_total else 0.0
    return {
        "requests_total": requests_total,
        "requests_failed_total": requests_failed,
        "requests_success_total": requests_total - requests_failed,
        "latency_ms_avg": round(avg_latency, 2),
        "latency_ms_max": round(_METRICS["latency_ms_max"], 2),
    }


def _utc_now_iso() -> str:
    """Get current UTC time in ISO format."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class GatewayMetricsMiddleware(BaseHTTPMiddleware):
    """网关请求指标采集中间件"""

    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            status_code = response.status_code if response is not None else 500
            _record_request_metrics(status_code, elapsed_ms)


__all__ = [
    "_METRICS",
    "_record_request_metrics",
    "_get_metrics_snapshot",
    "_utc_now_iso",
    "GatewayMetricsMiddleware",
]

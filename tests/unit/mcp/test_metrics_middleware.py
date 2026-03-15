# -*- coding: utf-8 -*-

from unittest.mock import MagicMock

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse


@pytest.mark.asyncio
async def test_gateway_metrics_middleware_records_success_and_failure(monkeypatch):
    import src.mcp.metrics as metrics

    record_mock = MagicMock()
    monkeypatch.setattr(metrics, "_record_request_metrics", record_mock)

    middleware = metrics.GatewayMetricsMiddleware(app=Starlette())

    req = Request({"type": "http", "method": "GET", "path": "/x", "headers": []})

    async def call_next(_request):
        return JSONResponse({"ok": True}, status_code=201)

    resp = await middleware.dispatch(req, call_next)
    assert resp.status_code == 201
    assert record_mock.call_count == 1
    args, _ = record_mock.call_args
    assert args[0] == 201

    record_mock.reset_mock()

    async def call_next_fail(_request):
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await middleware.dispatch(req, call_next_fail)

    args, _ = record_mock.call_args
    assert args[0] == 500

# -*- coding: utf-8 -*-

from unittest.mock import MagicMock

import pytest


def test_gateway_parse_origins_misc_branches():
    from src.mcp import gateway as gateway_module

    assert gateway_module._parse_origins([None, " a ", ""]) == ["a"]
    assert gateway_module._parse_origins(123) == ["123"]


def test_gateway_merge_recommendations_with_genre_appends(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "genre_to_generation_recommendation", lambda _g: {"id": "genre"})

    merged = gateway_module._merge_recommendations_with_genre([{ "id": 1 }], "mystery")
    assert merged == [{"id": 1}, {"id": "genre"}]


def test_gateway_normalize_schema_version_returns_non_empty_candidate(monkeypatch):
    from src.mcp import gateway as gateway_module

    monkeypatch.setattr(gateway_module, "ANALYSIS_SCHEMA_VERSION", "2026-02")
    assert gateway_module._normalize_schema_version({"analysis_schema_version": "2026-03"}, {}) == "2026-03"


@pytest.mark.asyncio
async def test_gateway_localhost_only_middleware_disabled_passthrough():
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse

    from src.mcp import gateway as gateway_module

    middleware = gateway_module.GatewayLocalhostOnlyMiddleware(
        app=Starlette(),
        enabled=False,
        exempt_paths=[],
    )

    async def call_next(_request):
        return JSONResponse({"ok": True}, status_code=200)

    request = Request({
        "type": "http",
        "method": "GET",
        "path": "/health",
        "headers": [],
        "client": ("8.8.8.8", 12345),
    })

    response = await middleware.dispatch(request, call_next)
    assert response.status_code == 200


def test_is_loopback_host_empty_host_branch():
    from src.mcp import gateway as gateway_module

    assert gateway_module._is_loopback_host("") is False

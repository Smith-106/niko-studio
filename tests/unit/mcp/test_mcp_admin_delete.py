# -*- coding: utf-8 -*-

import json

import pytest
from starlette.requests import Request


async def _json_request(path: str, payload: dict | None = None) -> Request:
    body = json.dumps(payload or {}).encode("utf-8")
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.request", "body": b"", "more_body": False}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "query_string": b"",
        "headers": [(b"content-type", b"application/json")],
        "path_params": {},
    }
    return Request(scope, receive)


@pytest.mark.asyncio
async def test_delete_mcp_service_branches(monkeypatch):
    from src.mcp.service_config import McpServiceConfig
    from src.mcp import gateway as gateway_module
    from src.mcp.endpoints import mcp_admin

    # missing service_id returns 400
    req = await _json_request("/mcp/services/", {})
    req.scope["path_params"] = {}
    res = await mcp_admin.delete_mcp_service(req)
    assert res.status_code == 400

    # builtin cannot delete
    req = await _json_request("/mcp/services/memory", {})
    req.scope["path_params"] = {"service_id": "memory"}
    res = await mcp_admin.delete_mcp_service(req)
    assert res.status_code == 400

    # missing service returns 404
    req = await _json_request("/mcp/services/nope", {})
    req.scope["path_params"] = {"service_id": "nope"}
    res = await mcp_admin.delete_mcp_service(req)
    assert res.status_code == 404

    # create a custom service and delete it
    snapshot_configs = dict(gateway_module._MCP_SERVICE_CONFIGS)
    snapshot_cache = dict(gateway_module._MCP_SERVICE_HEALTH_CACHE)
    try:
        gateway_module._MCP_SERVICE_CONFIGS["custom"] = McpServiceConfig(
            service_id="custom",
            name="Custom",
            path="/custom",
            enabled=True,
            builtin=False,
        )
        gateway_module._MCP_SERVICE_HEALTH_CACHE["custom"] = "ok"

        req = await _json_request("/mcp/services/custom", {})
        req.scope["path_params"] = {"service_id": "custom"}
        res = await mcp_admin.delete_mcp_service(req)
        assert res.status_code == 200
    finally:
        gateway_module._MCP_SERVICE_CONFIGS.clear()
        gateway_module._MCP_SERVICE_CONFIGS.update(snapshot_configs)
        gateway_module._MCP_SERVICE_HEALTH_CACHE.clear()
        gateway_module._MCP_SERVICE_HEALTH_CACHE.update(snapshot_cache)

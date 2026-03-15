# -*- coding: utf-8 -*-

from unittest.mock import AsyncMock, MagicMock

import pytest


def _get_raw_mcp_tool_function(mcp_obj, func_name: str):
    decorator = mcp_obj.tool.return_value
    for call in decorator.call_args_list:
        fn = call.args[0]
        if getattr(fn, "__name__", "") == func_name:
            return fn
    raise AssertionError(f"raw function not found for {func_name}")


@pytest.mark.asyncio
async def test_workflow_plan_governance_hook_enabled_and_failure_swallowed(monkeypatch):
    import src.mcp.services.workflow as workflow_service

    raw_workflow_plan = _get_raw_mcp_tool_function(workflow_service.workflow_mcp, "workflow_plan")

    # Force governance enabled
    monkeypatch.setattr(workflow_service, "_resolve_governance_hook_enabled", lambda: True)

    async def _boom(*_args, **_kwargs):
        raise RuntimeError("dbhub down")

    adapters = MagicMock()
    adapters.governance.on_schema_workflow = AsyncMock(side_effect=_boom)
    monkeypatch.setattr(workflow_service, "_get_integration_adapters", lambda: adapters)

    engine = MagicMock()
    engine.plan = AsyncMock(return_value={"plan_id": "p1"})
    monkeypatch.setattr(workflow_service, "_get_engine", lambda: engine)

    result = await raw_workflow_plan("task", level="L3", recommendations=[{"id": 1}], genre=None)

    assert result == {"plan_id": "p1"}


def test_workflow_helper_wrappers(monkeypatch):
    import src.mcp.config as mcp_config
    import src.mcp.gateway as gateway_module
    import src.mcp.services.workflow as workflow_service

    sentinel = object()
    monkeypatch.setattr(gateway_module, "_INTEGRATION_ADAPTERS", sentinel)
    assert workflow_service._get_integration_adapters() is sentinel

    monkeypatch.setattr(mcp_config, "_resolve_governance_hook_enabled", lambda: True)
    assert workflow_service._resolve_governance_hook_enabled() is True

    monkeypatch.setattr(mcp_config, "_resolve_langflow_flow_name", lambda: "flow")
    assert workflow_service._resolve_langflow_flow_name() == "flow"

@pytest.mark.asyncio
async def test_workflow_merge_recommendations_with_genre_none_branch(monkeypatch):
    import src.mcp.services.workflow as workflow_service

    # Force helper to return None, so _merge_recommendations_with_genre takes the None-branch
    monkeypatch.setattr(
        workflow_service,
        "genre_to_generation_recommendation",
        lambda _g: None,
        raising=False,
    )

    assert workflow_service._merge_recommendations_with_genre([{ "id": 1 }], "none") == [{"id": 1}]
    assert workflow_service._merge_recommendations_with_genre(None, "none") is None


def test_search_governance_wrapper(monkeypatch):
    import src.mcp.config as mcp_config
    import src.mcp.services.search as search_service

    monkeypatch.setattr(mcp_config, "_resolve_governance_hook_enabled", lambda: True)
    assert search_service._resolve_governance_hook_enabled() is True


def test_search_helper_wrappers(monkeypatch):
    import src.mcp.config as mcp_config
    import src.mcp.gateway as gateway_module
    import src.mcp.services.search as search_service

    engine = object()
    monkeypatch.setattr(gateway_module, "get_search_engine", lambda: engine)
    assert search_service._get_engine() is engine

    sentinel = object()
    monkeypatch.setattr(gateway_module, "_INTEGRATION_ADAPTERS", sentinel)
    assert search_service._get_integration_adapters() is sentinel

    monkeypatch.setattr(mcp_config, "_resolve_redis_rate_limit", lambda: (1, 2))
    assert search_service._resolve_redis_rate_limit() == (1, 2)

    monkeypatch.setattr(mcp_config, "_resolve_search_cache_key", lambda *args, **kwargs: "k")
    assert search_service._resolve_search_cache_key("q", "all", 1, None) == "k"

    monkeypatch.setattr(gateway_module, "_resolve_search_route_mode", lambda: "legacy")
    assert search_service._resolve_search_route_mode() == "legacy"

    monkeypatch.setattr(gateway_module, "_resolve_search_elastic_timeout_ms", lambda: 123)
    assert search_service._resolve_search_elastic_timeout_ms() == 123

    monkeypatch.setattr(mcp_config, "_resolve_redis_cache_ttl_seconds", lambda: 9)
    assert search_service._resolve_redis_cache_ttl_seconds() == 9

    monkeypatch.setattr(mcp_config, "_resolve_langflow_flow_name", lambda: "flow")
    assert search_service._resolve_langflow_flow_name() == "flow"

# -*- coding: utf-8 -*-
"""Coverage tests for integration adapter boundaries."""

import pytest
from unittest.mock import patch

from src.integrations.adapters import (
    IntegrationFlags,
    NoopCacheRateLimitAdapter,
    NoopGovernanceHookAdapter,
    NoopGraphProjectionAdapter,
    NoopOrchestrationHookAdapter,
    NoopSearchAdapter,
    NoopStorageShadowAdapter,
    StubDbhubGovernanceHook,
    StubElasticsearchAdapter,
    StubLangflowOrchestrationHook,
    StubNeo4jProjectionAdapter,
    StubPostgresShadowAdapter,
    StubRedisCacheRateLimitAdapter,
    create_integration_adapters,
    get_integration_flags,
)


@pytest.mark.asyncio
async def test_noop_adapters_return_disabled_defaults():
    storage = NoopStorageShadowAdapter()
    cache = NoopCacheRateLimitAdapter()
    search = NoopSearchAdapter()
    graph = NoopGraphProjectionAdapter()
    governance = NoopGovernanceHookAdapter()
    orchestration = NoopOrchestrationHookAdapter()

    assert await storage.shadow_write_memory({"id": "m1"}) is False
    assert await cache.cache_get("k") is None
    assert await cache.cache_set("k", {"v": 1}, 30) is False
    assert await cache.allow_request("k", 3, 60) is True
    assert await search.index_document({"id": "doc"}) is False
    assert await search.search("q", "all", 5) == []
    assert await graph.project_entity({"id": "entity"}) is False
    assert await graph.project_relation({"id": "relation"}) is False
    assert await governance.on_schema_workflow("event", {"x": 1}) is False
    assert await orchestration.run("flow-a", {"x": 1}) == {"status": "disabled", "flow_name": "flow-a"}


@pytest.mark.asyncio
async def test_stub_adapters_return_success_defaults():
    storage = StubPostgresShadowAdapter()
    cache = StubRedisCacheRateLimitAdapter()
    search = StubElasticsearchAdapter()
    graph = StubNeo4jProjectionAdapter()
    governance = StubDbhubGovernanceHook()
    orchestration = StubLangflowOrchestrationHook()

    assert await storage.shadow_write_memory({"id": "m1"}) is True
    assert await cache.cache_get("k") is None
    assert await cache.cache_set("k", {"v": 1}, 30) is True
    assert await cache.allow_request("k", 3, 60) is True
    assert await search.index_document({"id": "doc"}) is True
    assert await search.search("q", "all", 5) == []
    assert await graph.project_entity({"id": "entity"}) is True
    assert await graph.project_relation({"id": "relation"}) is True
    assert await governance.on_schema_workflow("event", {"x": 1}) is True
    assert await orchestration.run("flow-a", {"x": 1}) == {
        "status": "ok",
        "flow_name": "flow-a",
        "provider": "langflow",
    }


def test_get_integration_flags_reads_config_values():
    values = {
        "integration.postgres_enabled": 1,
        "integration.redis_cache_enabled": 0,
        "integration.elasticsearch_enabled": "yes",
        "integration.neo4j_enabled": "",
        "integration.langflow_enabled": None,
    }

    def _fake_get_config_value(key, default=False):
        return values.get(key, default)

    with patch("src.config.get_config_value", side_effect=_fake_get_config_value):
        flags = get_integration_flags()

    assert flags == IntegrationFlags(
        postgres_enabled=True,
        redis_cache_enabled=False,
        elasticsearch_enabled=True,
        neo4j_enabled=False,
        langflow_enabled=False,
    )


def test_create_integration_adapters_all_disabled_uses_noop_and_stub_governance():
    with patch(
        "src.integrations.adapters.get_integration_flags",
        return_value=IntegrationFlags(),
    ):
        bundle = create_integration_adapters()

    assert isinstance(bundle.storage_shadow, NoopStorageShadowAdapter)
    assert isinstance(bundle.cache_rate_limit, NoopCacheRateLimitAdapter)
    assert isinstance(bundle.search, NoopSearchAdapter)
    assert isinstance(bundle.graph_projection, NoopGraphProjectionAdapter)
    assert isinstance(bundle.governance, StubDbhubGovernanceHook)
    assert isinstance(bundle.orchestration, NoopOrchestrationHookAdapter)
    assert bundle.flags == IntegrationFlags()


def test_create_integration_adapters_all_enabled_uses_stub_adapters():
    enabled = IntegrationFlags(
        postgres_enabled=True,
        redis_cache_enabled=True,
        elasticsearch_enabled=True,
        neo4j_enabled=True,
        langflow_enabled=True,
    )

    with patch("src.integrations.adapters.get_integration_flags", return_value=enabled):
        bundle = create_integration_adapters()

    assert isinstance(bundle.storage_shadow, StubPostgresShadowAdapter)
    assert isinstance(bundle.cache_rate_limit, StubRedisCacheRateLimitAdapter)
    assert isinstance(bundle.search, StubElasticsearchAdapter)
    assert isinstance(bundle.graph_projection, StubNeo4jProjectionAdapter)
    assert isinstance(bundle.governance, StubDbhubGovernanceHook)
    assert isinstance(bundle.orchestration, StubLangflowOrchestrationHook)
    assert bundle.flags == enabled

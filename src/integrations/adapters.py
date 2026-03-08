"""
Optional integration adapter boundaries.

These adapters define explicit non-critical extension points for external
systems while keeping local-first behavior as the default path.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, Protocol


logger = logging.getLogger("niko-integrations")


class StorageShadowAdapter(Protocol):
    async def shadow_write_memory(self, payload: Dict[str, Any]) -> bool:
        ...


class CacheRateLimitAdapter(Protocol):
    async def cache_get(self, key: str) -> Dict[str, Any] | None:
        ...

    async def cache_set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> bool:
        ...

    async def allow_request(self, key: str, limit: int, window_seconds: int) -> bool:
        ...


class SearchAdapter(Protocol):
    async def index_document(self, document: Dict[str, Any]) -> bool:
        ...

    async def search(self, query: str, scope: str, limit: int) -> list[Dict[str, Any]]:
        ...


class GraphProjectionAdapter(Protocol):
    async def project_entity(self, entity: Dict[str, Any]) -> bool:
        ...

    async def project_relation(self, relation: Dict[str, Any]) -> bool:
        ...


class GovernanceHookAdapter(Protocol):
    async def on_schema_workflow(self, event: str, payload: Dict[str, Any]) -> bool:
        ...


class OrchestrationHookAdapter(Protocol):
    async def run(self, flow_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...


@dataclass
class IntegrationFlags:
    postgres_enabled: bool = False
    redis_cache_enabled: bool = False
    elasticsearch_enabled: bool = False
    neo4j_enabled: bool = False
    langflow_enabled: bool = False


class NoopStorageShadowAdapter(StorageShadowAdapter):
    async def shadow_write_memory(self, payload: Dict[str, Any]) -> bool:
        _ = payload
        return False


class NoopCacheRateLimitAdapter(CacheRateLimitAdapter):
    async def cache_get(self, key: str) -> Dict[str, Any] | None:
        _ = key
        return None

    async def cache_set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> bool:
        _ = (key, value, ttl_seconds)
        return False

    async def allow_request(self, key: str, limit: int, window_seconds: int) -> bool:
        _ = (key, limit, window_seconds)
        return True


class NoopSearchAdapter(SearchAdapter):
    async def index_document(self, document: Dict[str, Any]) -> bool:
        _ = document
        return False

    async def search(self, query: str, scope: str, limit: int) -> list[Dict[str, Any]]:
        _ = (query, scope, limit)
        return []


class NoopGraphProjectionAdapter(GraphProjectionAdapter):
    async def project_entity(self, entity: Dict[str, Any]) -> bool:
        _ = entity
        return False

    async def project_relation(self, relation: Dict[str, Any]) -> bool:
        _ = relation
        return False


class NoopGovernanceHookAdapter(GovernanceHookAdapter):
    async def on_schema_workflow(self, event: str, payload: Dict[str, Any]) -> bool:
        _ = (event, payload)
        return False


class NoopOrchestrationHookAdapter(OrchestrationHookAdapter):
    async def run(self, flow_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        _ = (flow_name, payload)
        return {"status": "disabled", "flow_name": flow_name}


class StubPostgresShadowAdapter(StorageShadowAdapter):
    """PostgreSQL shadow-write stub (non-blocking, best-effort)."""

    async def shadow_write_memory(self, payload: Dict[str, Any]) -> bool:
        await asyncio.sleep(0)
        logger.debug("postgres shadow write stub invoked", extra={"payload_keys": sorted(payload.keys())})
        return True


class StubRedisCacheRateLimitAdapter(CacheRateLimitAdapter):
    """Redis cache/rate-limit stub with in-process no-op semantics."""

    async def cache_get(self, key: str) -> Dict[str, Any] | None:
        _ = key
        await asyncio.sleep(0)
        return None

    async def cache_set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> bool:
        _ = (key, value, ttl_seconds)
        await asyncio.sleep(0)
        return True

    async def allow_request(self, key: str, limit: int, window_seconds: int) -> bool:
        _ = (key, limit, window_seconds)
        await asyncio.sleep(0)
        return True


class StubElasticsearchAdapter(SearchAdapter):
    """Elasticsearch indexing/query stub, safe fallback expected upstream."""

    async def index_document(self, document: Dict[str, Any]) -> bool:
        _ = document
        await asyncio.sleep(0)
        return True

    async def search(self, query: str, scope: str, limit: int) -> list[Dict[str, Any]]:
        _ = (query, scope, limit)
        await asyncio.sleep(0)
        return []


class StubNeo4jProjectionAdapter(GraphProjectionAdapter):
    """Neo4j projection stub for non-critical mirror projections."""

    async def project_entity(self, entity: Dict[str, Any]) -> bool:
        _ = entity
        await asyncio.sleep(0)
        return True

    async def project_relation(self, relation: Dict[str, Any]) -> bool:
        _ = relation
        await asyncio.sleep(0)
        return True


class StubDbhubGovernanceHook(GovernanceHookAdapter):
    """Placeholder hook for dbhub governance/schema workflow integration."""

    async def on_schema_workflow(self, event: str, payload: Dict[str, Any]) -> bool:
        _ = (event, payload)
        await asyncio.sleep(0)
        return True


class StubLangflowOrchestrationHook(OrchestrationHookAdapter):
    """Optional Langflow orchestration pilot hook."""

    async def run(self, flow_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        _ = payload
        await asyncio.sleep(0)
        return {"status": "ok", "flow_name": flow_name, "provider": "langflow"}


def get_integration_flags() -> IntegrationFlags:
    from src.config import get_config_value

    return IntegrationFlags(
        postgres_enabled=bool(get_config_value("integration.postgres_enabled", False)),
        redis_cache_enabled=bool(get_config_value("integration.redis_cache_enabled", False)),
        elasticsearch_enabled=bool(get_config_value("integration.elasticsearch_enabled", False)),
        neo4j_enabled=bool(get_config_value("integration.neo4j_enabled", False)),
        langflow_enabled=bool(get_config_value("integration.langflow_enabled", False)),
    )


@dataclass
class IntegrationAdapterBundle:
    storage_shadow: StorageShadowAdapter
    cache_rate_limit: CacheRateLimitAdapter
    search: SearchAdapter
    graph_projection: GraphProjectionAdapter
    governance: GovernanceHookAdapter
    orchestration: OrchestrationHookAdapter
    flags: IntegrationFlags


def create_integration_adapters() -> IntegrationAdapterBundle:
    flags = get_integration_flags()
    return IntegrationAdapterBundle(
        storage_shadow=StubPostgresShadowAdapter() if flags.postgres_enabled else NoopStorageShadowAdapter(),
        cache_rate_limit=StubRedisCacheRateLimitAdapter() if flags.redis_cache_enabled else NoopCacheRateLimitAdapter(),
        search=StubElasticsearchAdapter() if flags.elasticsearch_enabled else NoopSearchAdapter(),
        graph_projection=StubNeo4jProjectionAdapter() if flags.neo4j_enabled else NoopGraphProjectionAdapter(),
        governance=StubDbhubGovernanceHook(),
        orchestration=StubLangflowOrchestrationHook() if flags.langflow_enabled else NoopOrchestrationHookAdapter(),
        flags=flags,
    )

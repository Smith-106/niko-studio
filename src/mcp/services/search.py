"""
MCP Search Service

Search service FastMCP module with 3 tools for search operations.
"""

import asyncio
import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("niko-gateway")

search_mcp = FastMCP("NikoSearch", stateless_http=True)


def _get_engine():
    """Get search engine (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import get_search_engine
    return get_search_engine()


def _get_integration_adapters():
    """Get integration adapters (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import _INTEGRATION_ADAPTERS
    return _INTEGRATION_ADAPTERS


def _resolve_redis_rate_limit():
    """Resolve Redis rate limit settings."""
    from src.mcp.config import _resolve_redis_rate_limit
    return _resolve_redis_rate_limit()


def _resolve_search_cache_key(query: str, scope: str, limit: int, profile: Optional[str]) -> str:
    """Generate cache key for search results."""
    from src.mcp.config import _resolve_search_cache_key
    return _resolve_search_cache_key(query, scope, limit, profile)


def _resolve_search_route_mode() -> str:
    """Resolve search routing mode (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import _resolve_search_route_mode
    return _resolve_search_route_mode()


def _resolve_search_elastic_timeout_ms() -> int:
    """Resolve Elasticsearch timeout in milliseconds (lazy import for test compatibility)."""
    from src.mcp.gateway import _resolve_search_elastic_timeout_ms
    return _resolve_search_elastic_timeout_ms()


def _resolve_redis_cache_ttl_seconds() -> int:
    """Resolve Redis cache TTL in seconds."""
    from src.mcp.config import _resolve_redis_cache_ttl_seconds
    return _resolve_redis_cache_ttl_seconds()


def _resolve_langflow_flow_name() -> str:
    """Resolve Langflow flow name for orchestration hooks."""
    from src.mcp.config import _resolve_langflow_flow_name
    return _resolve_langflow_flow_name()


def _resolve_governance_hook_enabled() -> bool:
    """Check if DBHub governance hook is enabled."""
    from src.mcp.config import _resolve_governance_hook_enabled
    return _resolve_governance_hook_enabled()


@search_mcp.tool()
async def search_hybrid(
    query: str,
    scope: str = "all",
    limit: int = 10,
    profile: str | None = None,
    min_score: float | None = None,
    budget_tokens: int | None = None,
    rerank: bool = False,
    route_mode: str | None = None,
) -> list:
    """
    混合搜索 (向量 + 关键词 + 图谱)

    Args:
        query: 搜索查询
        scope: 搜索范围 (all/memory/graph/files)
        limit: 返回数量
        profile: 检索 profile 名称（可选）
        min_score: 最小分数阈值（可选）
        budget_tokens: 上下文预算 token（可选）
        rerank: 是否启用重排（可选）
        route_mode: 搜索路由 (legacy/elastic/hybrid, 可选)

    Returns:
        搜索结果列表
    """
    adapters = _get_integration_adapters()
    flags = adapters.flags

    if flags.redis_cache_enabled:
        rate_limit, window_seconds = _resolve_redis_rate_limit()
        allowed = await adapters.cache_rate_limit.allow_request(
            key=f"search:rate:{scope}",
            limit=rate_limit,
            window_seconds=window_seconds,
        )
        if not allowed:
            logger.warning("Redis rate-limit denied request, fallback safe response returned")
            return []

    cache_key = _resolve_search_cache_key(query=query, scope=scope, limit=limit, profile=profile)
    if flags.redis_cache_enabled:
        cached = await adapters.cache_rate_limit.cache_get(cache_key)
        if isinstance(cached, dict) and isinstance(cached.get("results"), list):
            return cached["results"]

    effective_route_mode = route_mode or _resolve_search_route_mode()
    effective_timeout_ms = _resolve_search_elastic_timeout_ms()

    engine = _get_engine()
    hybrid_kwargs = {
        "query": query,
        "scope": scope,
        "limit": limit,
        "profile": profile,
        "min_score": min_score,
        "budget_tokens": budget_tokens,
        "rerank": rerank,
    }
    if route_mode is not None or effective_route_mode != "legacy" or effective_timeout_ms != 300:
        hybrid_kwargs["route_mode"] = effective_route_mode
        hybrid_kwargs["elastic_timeout_ms"] = effective_timeout_ms
    results = await engine.hybrid_search(**hybrid_kwargs)

    if flags.redis_cache_enabled:
        ttl_seconds = _resolve_redis_cache_ttl_seconds()
        await adapters.cache_rate_limit.cache_set(
            cache_key,
            {"results": results},
            ttl_seconds=ttl_seconds,
        )

    if flags.elasticsearch_enabled:
        async def _index_results_async() -> None:
            for item in results[: min(len(results), 10)]:
                if not isinstance(item, dict):
                    continue
                try:
                    await adapters.search.index_document(item)
                except Exception as exc:
                    logger.warning("Elasticsearch async indexing failed: %s", exc)

        asyncio.create_task(_index_results_async())

    if flags.langflow_enabled:
        try:
            await adapters.orchestration.run(
                flow_name=_resolve_langflow_flow_name(),
                payload={
                    "query": query,
                    "scope": scope,
                    "limit": limit,
                    "result_count": len(results),
                    "route_mode": effective_route_mode,
                },
            )
        except Exception as exc:
            logger.warning("Langflow orchestration hook failed, continue local-first: %s", exc)

    return results


@search_mcp.tool()
async def search_iterative(
    query: str,
    max_iterations: int = 3,
    confidence_threshold: float = 0.8,
    profile: str | None = None,
    min_score: float | None = None,
    budget_tokens: int | None = None,
    rerank: bool = False,
) -> dict:
    """
    迭代检索 (GAM 模式)

    Args:
        query: 初始查询
        max_iterations: 最大迭代次数
        confidence_threshold: 置信度阈值
        profile: 检索 profile 名称（可选）
        min_score: 最小分数阈值（可选）
        budget_tokens: 上下文预算 token（可选）
        rerank: 是否启用重排（可选）

    Returns:
        {"answer": "...", "sources": [...], "iterations": 2}
    """
    engine = _get_engine()
    return await engine.iterative_retrieve(
        query=query,
        max_iterations=max_iterations,
        confidence_threshold=confidence_threshold,
        profile=profile,
        min_score=min_score,
        budget_tokens=budget_tokens,
        rerank=rerank,
    )


@search_mcp.tool()
async def search_context(text: str) -> str:
    """
    解析 @引用 并返回上下文

    支持的引用类型:
    - @character:名称  → 角色信息
    - @chapter:编号    → 章节内容
    - @memory:查询     → 相关记忆
    - @skill:技能名    → 技能包内容 (本地文件)

    Args:
        text: 包含 @引用 的文本

    Returns:
        解析后的完整上下文

    示例:
        输入: "根据@character:张三的性格，使用@skill:fictional-dream..."
        输出: "[角色:张三] 性格:内向... [技能包:fictional-dream] 内容..."
    """
    engine = _get_engine()
    return await engine.resolve_context(text)


__all__ = ["search_mcp"]

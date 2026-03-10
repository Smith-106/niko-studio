# -*- coding: utf-8 -*-
"""Iterative retriever staged pipeline tests."""

import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from src.search.iterative_retriever import IterativeRetriever, RetrievalProfile, SearchResult


@pytest.mark.asyncio
async def test_hybrid_search_applies_min_score_and_trace_fields():
    retriever = IterativeRetriever()
    retriever._memory_engine = AsyncMock()
    retriever._memory_engine.search = AsyncMock(return_value=[
        {"id": "m1", "content": "high", "score": 0.9, "layer": "l1", "dimension": "d1"},
        {"id": "m2", "content": "low", "score": 0.2, "layer": "l1", "dimension": "d1"},
    ])

    with patch.object(retriever, "_search_graph", new=AsyncMock(return_value=[])), patch.object(
        retriever, "_search_files", new=AsyncMock(return_value=[])
    ):
        results = await retriever.hybrid_search("query", min_score=0.5)

    assert len(results) == 1
    assert results[0]["id"] == "m1"
    trace = retriever.last_trace
    assert trace["stages"]["collect"]["candidates"] >= 1
    assert trace["stages"]["trim"]["dropped_by_threshold"] >= 1


@pytest.mark.asyncio
async def test_hybrid_search_rerank_failure_falls_back_to_original_order():
    retriever = IterativeRetriever()
    candidates = [
        SearchResult(id="a", content="alpha", source="memory", score=0.8, metadata={}),
        SearchResult(id="b", content="beta", source="memory", score=0.7, metadata={}),
    ]

    with patch.object(retriever, "_collect_candidates", new=AsyncMock(return_value=candidates)), patch.object(
        retriever, "_rerank_candidates", new=AsyncMock(side_effect=RuntimeError("rerank down"))
    ):
        results = await retriever.hybrid_search("query", rerank=True)

    assert [r["id"] for r in results] == ["a", "b"]
    assert retriever.last_trace["stages"]["rerank"]["fallback"] is True


@pytest.mark.asyncio
async def test_hybrid_search_budget_and_source_quota_trim():
    retriever = IterativeRetriever()
    profile = RetrievalProfile(
        name="quota",
        source_quota={"memory": 1, "graph": 1, "file": 1},
        budget={"budget_tokens": 6},
    )

    with patch.object(retriever, "_resolve_profile", new=AsyncMock(return_value=profile)), patch.object(
        retriever,
        "_collect_candidates",
        new=AsyncMock(
            return_value=[
                SearchResult(id="m1", content="aaaa", source="memory", score=0.9, metadata={}),
                SearchResult(id="m2", content="bbbb", source="memory", score=0.8, metadata={}),
                SearchResult(id="g1", content="cccc", source="graph", score=0.7, metadata={}),
            ]
        ),
    ):
        results = await retriever.hybrid_search("query", limit=10)

    assert [r["id"] for r in results] == ["m1", "g1"]


@pytest.mark.asyncio
async def test_hybrid_search_invalid_route_mode_falls_back_to_legacy_mode_trace():
    retriever = IterativeRetriever()

    with patch.object(
        retriever,
        "_collect_candidates",
        new=AsyncMock(return_value=[SearchResult(id="a", content="alpha", source="memory", score=0.8, metadata={})]),
    ), patch.object(retriever, "_collect_elastic_candidates", new=AsyncMock(return_value=[])) as elastic_collect:
        results = await retriever.hybrid_search("query", route_mode="unknown")

    assert [r["id"] for r in results] == ["a"]
    assert retriever.last_trace["stages"]["collect"]["route_mode"] == "legacy"
    elastic_collect.assert_not_awaited()


@pytest.mark.asyncio
async def test_hybrid_search_elastic_route_uses_elastic_candidates_when_available():
    retriever = IterativeRetriever()

    with patch.object(
        retriever,
        "_collect_candidates",
        new=AsyncMock(return_value=[SearchResult(id="legacy", content="legacy", source="memory", score=0.2, metadata={})]),
    ), patch.object(
        retriever,
        "_collect_elastic_candidates",
        new=AsyncMock(return_value=[SearchResult(id="es", content="elastic", source="elastic", score=0.9, metadata={})]),
    ):
        results = await retriever.hybrid_search("query", route_mode="elastic", limit=5)

    assert [r["id"] for r in results] == ["es"]
    assert retriever.last_trace["stages"]["collect"]["elastic_candidates"] == 1


@pytest.mark.asyncio
async def test_hybrid_search_hybrid_route_merges_legacy_and_elastic_candidates():
    retriever = IterativeRetriever()

    with patch.object(
        retriever,
        "_collect_candidates",
        new=AsyncMock(
            return_value=[
                SearchResult(id="legacy", content="legacy", source="memory", score=0.4, metadata={}),
            ]
        ),
    ), patch.object(
        retriever,
        "_collect_elastic_candidates",
        new=AsyncMock(
            return_value=[
                SearchResult(id="elastic", content="elastic", source="elastic", score=0.9, metadata={}),
            ]
        ),
    ):
        results = await retriever.hybrid_search("query", route_mode="hybrid", limit=5)

    assert [r["id"] for r in results] == ["elastic", "legacy"]


@pytest.mark.asyncio
async def test_iterative_retrieve_propagates_pipeline_options_and_trace():
    retriever = IterativeRetriever()

    with patch.object(retriever, "hybrid_search", new=AsyncMock(return_value=[
        {"id": "x", "content": "result", "source": "memory", "score": 0.92, "metadata": {}},
    ])) as hybrid:
        result = await retriever.iterative_retrieve(
            "query",
            max_iterations=1,
            profile="standard_balanced",
            min_score=0.4,
            budget_tokens=256,
            rerank=True,
        )

    assert result["iterations"] == 1
    assert result["confidence"] == 0.92
    assert "retrieval_trace" in result
    hybrid.assert_awaited_once_with(
        "query",
        scope="all",
        limit=10,
        profile="standard_balanced",
        min_score=0.4,
        budget_tokens=256,
        rerank=True,
        route_mode="legacy",
    )


@pytest.mark.asyncio
async def test_collect_elastic_candidates_disabled_returns_empty():
    retriever = IterativeRetriever()
    retriever._integration_adapters = SimpleNamespace(
        flags=SimpleNamespace(elasticsearch_enabled=False),
        search=AsyncMock(),
    )

    results = await retriever._collect_elastic_candidates("q", "all", 5, timeout_ms=50)

    assert results == []


@pytest.mark.asyncio
async def test_collect_elastic_candidates_handles_exception_and_invalid_items():
    retriever = IterativeRetriever()
    retriever._integration_adapters = SimpleNamespace(
        flags=SimpleNamespace(elasticsearch_enabled=True),
        search=SimpleNamespace(search=AsyncMock(side_effect=RuntimeError("es down"))),
    )

    failed = await retriever._collect_elastic_candidates("q", "all", 5, timeout_ms=50)
    assert failed == []

    retriever._integration_adapters = SimpleNamespace(
        flags=SimpleNamespace(elasticsearch_enabled=True),
        search=SimpleNamespace(
            search=AsyncMock(
                return_value=[
                    {"id": "", "content": "skip"},
                    {"id": "ok", "content": "body", "score": 0.7, "metadata": "bad"},
                ]
            )
        ),
    )

    results = await retriever._collect_elastic_candidates("q", "all", 5, timeout_ms=50)
    assert len(results) == 1
    assert results[0].id == "ok"
    assert results[0].metadata == {}


def test_merge_result_candidates_dedupes_and_honors_limit():
    retriever = IterativeRetriever()
    merged = retriever._merge_result_candidates(
        primary=[
            SearchResult(id="x", content="a", source="memory", score=0.9, metadata={}),
            SearchResult(id="dup", content="a", source="memory", score=0.8, metadata={}),
        ],
        secondary=[
            SearchResult(id="dup", content="b", source="elastic", score=0.95, metadata={}),
            SearchResult(id="z", content="c", source="elastic", score=0.7, metadata={}),
        ],
        limit=10,
    )

    assert [item.id for item in merged] == ["dup", "x", "z"]




def test_merge_result_candidates_hits_limit_break_branch():
    retriever = IterativeRetriever()
    merged = retriever._merge_result_candidates(
        primary=[
            SearchResult(id="a", content="a", source="memory", score=0.9, metadata={}),
            SearchResult(id="b", content="b", source="memory", score=0.8, metadata={}),
        ],
        secondary=[
            SearchResult(id="c", content="c", source="elastic", score=0.7, metadata={}),
        ],
        limit=2,
    )

    assert [item.id for item in merged] == ["a", "b"]
    retriever = IterativeRetriever()

    no_fusion_profile = RetrievalProfile(
        source_weights={"memory": 0.5},
        fusion={"enabled": False},
    )
    assert retriever._fuse_score(1.0, "memory", "hello", {"hello"}, no_fusion_profile) == 0.5

    fusion_profile = RetrievalProfile(
        source_weights={"graph": 1.0},
        fusion={"enabled": True, "dense": 0.6, "sparse": 0.2, "graph": 0.2},
    )
    fused = retriever._fuse_score(0.5, "graph", "hero arrives", {"hero"}, fusion_profile)
    assert 0.0 <= fused <= 1.0
    assert fused > 0.5


@pytest.mark.asyncio
async def test_rerank_candidates_maps_metadata_and_falls_back_when_empty():
    retriever = IterativeRetriever()
    candidates = [
        SearchResult(id="a", content="alpha", source="memory", score=0.6, metadata={"x": 1}),
        SearchResult(id="b", content="beta", source="graph", score=0.5, metadata={}),
    ]

    rerank_result = [
        SimpleNamespace(id="a", score=0.99, metadata={"tag": "top"}),
        SimpleNamespace(id="missing", score=0.1, metadata={}),
    ]
    reranker = SimpleNamespace(rerank=AsyncMock(return_value=rerank_result))

    with patch("src.services.reranker.factory.RerankerFactory.from_env", return_value=reranker):
        reranked = await retriever._rerank_candidates("query", candidates, top_k=10)

    assert len(reranked) == 1
    assert reranked[0].id == "a"
    assert reranked[0].metadata["reranked"] is True
    assert reranked[0].metadata["tag"] == "top"

    empty_reranker = SimpleNamespace(rerank=AsyncMock(return_value=[]))
    with patch("src.services.reranker.factory.RerankerFactory.from_env", return_value=empty_reranker):
        fallback = await retriever._rerank_candidates("query", candidates, top_k=10)

    assert fallback == candidates


def test_trim_results_covers_dedupe_quota_none_and_budget_skip_and_estimate_tokens():
    retriever = IterativeRetriever()
    deduped, dropped = retriever._trim_results(
        results=[
            SearchResult(id="dup", content="a" * 12, source="memory", score=0.9, metadata={}),
            SearchResult(id="dup", content="b" * 8, source="memory", score=0.8, metadata={}),
            SearchResult(id="f1", content="c" * 40, source="file", score=0.7, metadata={}),
            SearchResult(id="f2", content="d" * 8, source="file", score=0.6, metadata={}),
        ],
        limit=10,
        min_score=0.5,
        budget_tokens=5,
        source_quota={"memory": 1, "file": None},
    )

    assert dropped == 0
    assert [item.id for item in deduped] == ["dup", "f2"]
    assert retriever._estimate_tokens("") == 0


@pytest.mark.asyncio
async def test_resolve_profile_custom_and_fallback_paths():
    retriever = IterativeRetriever()

    assert (await retriever._resolve_profile(None)).name == "default"
    assert (await retriever._resolve_profile("standard_balanced")).name == "standard_balanced"

    retriever._memory_engine = SimpleNamespace(
        get_retrieval_profile=lambda name: {
            "enabled": True,
            "source_weights": {"memory": 1.2},
            "thresholds": {"min_score": 0.3},
            "budget": {"budget_tokens": 123},
            "rerank": {"enabled": True, "top_k": 7},
            "source_quota": {"memory": 3},
            "fusion": {"enabled": True, "dense": 0.7, "sparse": 0.2, "graph": 0.1},
        }
    )

    custom = await retriever._resolve_profile("custom-x")
    assert custom.name == "custom-x"
    assert custom.thresholds["min_score"] == 0.3

    retriever._memory_engine = SimpleNamespace(get_retrieval_profile=lambda name: {"enabled": False})
    fallback = await retriever._resolve_profile("custom-disabled")
    assert fallback.name == "default"


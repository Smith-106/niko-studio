# -*- coding: utf-8 -*-
"""Iterative retriever staged pipeline tests."""

import pytest
from unittest.mock import AsyncMock, patch

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
    )

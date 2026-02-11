# -*- coding: utf-8 -*-
"""
IterativeRetriever Tests

Tests for SearchResult dataclass, IterativeRetriever init/patterns,
sync helpers (_extract_keywords, _extract_snippet), async methods.
"""

import re
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path

from src.search.iterative_retriever import (
    SearchResult,
    IterativeRetriever,
)


# ============================================================
# SearchResult dataclass
# ============================================================

class TestSearchResultDataclass:

    def test_basic(self):
        sr = SearchResult(id="1", content="text", source="memory", score=0.9)
        assert sr.id == "1"
        assert sr.metadata is None

    def test_with_metadata(self):
        sr = SearchResult(id="2", content="c", source="graph", score=0.5, metadata={"k": "v"})
        assert sr.metadata["k"] == "v"


# ============================================================
# IterativeRetriever init
# ============================================================

class TestInit:

    def test_default(self):
        ir = IterativeRetriever()
        assert ir._project_root == Path.cwd()
        assert ir._file_extensions == {".md", ".txt"}

    def test_custom_root(self, tmp_path):
        ir = IterativeRetriever(project_root=tmp_path)
        assert ir._project_root == tmp_path

    def test_custom_extensions(self):
        ir = IterativeRetriever(file_extensions={".py", ".js"})
        assert ".py" in ir._file_extensions


# ============================================================
# CONTEXT_PATTERNS
# ============================================================

class TestContextPatterns:

    def test_character_pattern(self):
        pattern = IterativeRetriever.CONTEXT_PATTERNS["character"]
        m = re.search(pattern, "@character:abc")
        assert m is not None
        assert m.group(1) == "abc"

    def test_chapter_pattern(self):
        pattern = IterativeRetriever.CONTEXT_PATTERNS["chapter"]
        m = re.search(pattern, "@chapter:5")
        assert m is not None
        assert m.group(1) == "5"

    def test_scene_pattern(self):
        pattern = IterativeRetriever.CONTEXT_PATTERNS["scene"]
        m = re.search(pattern, "@scene:opening")
        assert m is not None
        assert m.group(1) == "opening"

    def test_all_patterns_valid(self):
        for key, pattern in IterativeRetriever.CONTEXT_PATTERNS.items():
            compiled = re.compile(pattern)
            assert compiled is not None


# ============================================================
# _extract_keywords
# ============================================================

class TestExtractKeywords:

    def test_basic(self):
        ir = IterativeRetriever()
        results = [
            {"content": "The detective investigates a murder case"},
        ]
        keywords = ir._extract_keywords(results)
        assert isinstance(keywords, list)
        assert len(keywords) > 0

    def test_mixed_content(self):
        ir = IterativeRetriever()
        results = [
            {"content": "The detective investigates a murder case"},
        ]
        keywords = ir._extract_keywords(results)
        assert any(len(k) >= 3 for k in keywords)

    def test_empty_results(self):
        ir = IterativeRetriever()
        keywords = ir._extract_keywords([])
        assert keywords == []

    def test_limit_top5(self):
        ir = IterativeRetriever()
        results = [
            {"content": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10"},
        ]
        keywords = ir._extract_keywords(results)
        assert len(keywords) <= 5


# ============================================================
# _extract_snippet
# ============================================================

class TestExtractSnippet:

    def test_keyword_found(self):
        ir = IterativeRetriever()
        content = "prefix content target keyword here suffix content" * 5
        snippet = ir._extract_snippet(content, ["target"], max_len=100)
        assert "target" in snippet

    def test_keyword_not_found(self):
        ir = IterativeRetriever()
        content = "some text content"
        snippet = ir._extract_snippet(content, ["nonexistent"], max_len=100)
        assert snippet.startswith("some")

    def test_long_content_ellipsis(self):
        ir = IterativeRetriever()
        content = "A" * 500
        snippet = ir._extract_snippet(content, ["nonexistent"], max_len=100)
        assert snippet.endswith("...")

    def test_keyword_in_middle(self):
        ir = IterativeRetriever()
        prefix = "X" * 100
        content = prefix + "TARGET" + "Y" * 100
        snippet = ir._extract_snippet(content, ["target"], max_len=100)
        assert "..." in snippet

    def test_short_content(self):
        ir = IterativeRetriever()
        content = "short"
        snippet = ir._extract_snippet(content, ["short"], max_len=200)
        assert snippet == "short"


# ============================================================
# _search_files (async)
# ============================================================

class TestSearchFiles:

    @pytest.mark.asyncio
    async def test_search_files_finds_match(self, tmp_path):
        (tmp_path / "test.md").write_text("unique searchable content here", encoding="utf-8")
        (tmp_path / "other.txt").write_text("no match here", encoding="utf-8")

        ir = IterativeRetriever(project_root=tmp_path)
        results = await ir._search_files("unique", limit=10)
        assert len(results) >= 1
        assert results[0].source == "file"

    @pytest.mark.asyncio
    async def test_search_files_no_match(self, tmp_path):
        (tmp_path / "test.md").write_text("nothing relevant", encoding="utf-8")
        ir = IterativeRetriever(project_root=tmp_path)
        results = await ir._search_files("xyznonexistent", limit=10)
        assert len(results) == 0

    @pytest.mark.asyncio
    async def test_search_files_score_capped(self, tmp_path):
        (tmp_path / "many.md").write_text("test " * 100, encoding="utf-8")
        ir = IterativeRetriever(project_root=tmp_path)
        results = await ir._search_files("test", limit=10)
        if results:
            assert results[0].score <= 0.9

    @pytest.mark.asyncio
    async def test_search_files_unreadable(self, tmp_path):
        (tmp_path / "binary.md").write_bytes(b'\x80\x81\x82')
        ir = IterativeRetriever(project_root=tmp_path)
        results = await ir._search_files("test", limit=10)
        # Should not crash


# ============================================================
# resolve_context (async)
# ============================================================

class TestResolveContext:

    @pytest.mark.asyncio
    async def test_no_references(self):
        ir = IterativeRetriever()
        result = await ir.resolve_context("plain text no refs")
        assert result == "plain text no refs"

    @pytest.mark.asyncio
    async def test_character_reference(self):
        ir = IterativeRetriever()
        mock_graph = AsyncMock()
        mock_graph.get_character = AsyncMock(return_value={
            "name": "test_char",
            "properties": {"age": 28}
        })
        ir._graph_engine = mock_graph

        result = await ir.resolve_context("about @character:test_char story")
        assert "test_char" in result

    @pytest.mark.asyncio
    async def test_resolve_reference_error(self):
        ir = IterativeRetriever()
        mock_graph = AsyncMock()
        mock_graph.get_character = AsyncMock(side_effect=RuntimeError("fail"))
        ir._graph_engine = mock_graph

        result = await ir._resolve_reference("character", "test")
        assert result is None


# ============================================================
# _resolve_reference branches (async)
# ============================================================

class TestResolveReference:

    @pytest.mark.asyncio
    async def test_scene_reference(self):
        ir = IterativeRetriever()
        mock_mem = AsyncMock()
        mock_mem.search = AsyncMock(return_value=[{"content": "scene desc"}])
        ir._memory_engine = mock_mem

        result = await ir._resolve_reference("scene", "opening")
        assert result == "scene desc"

    @pytest.mark.asyncio
    async def test_chapter_reference(self):
        ir = IterativeRetriever()
        mock_mem = AsyncMock()
        mock_mem.search = AsyncMock(return_value=[
            {"content": "para one"},
            {"content": "para two"},
        ])
        ir._memory_engine = mock_mem

        result = await ir._resolve_reference("chapter", "1")
        assert "para one" in result
        assert "para two" in result

    @pytest.mark.asyncio
    async def test_memory_reference(self):
        ir = IterativeRetriever()
        mock_mem = AsyncMock()
        mock_mem.search = AsyncMock(return_value=[{"content": "memory content"}])
        ir._memory_engine = mock_mem

        result = await ir._resolve_reference("memory", "key")
        assert result == "memory content"

    @pytest.mark.asyncio
    async def test_timeline_reference(self):
        ir = IterativeRetriever()
        mock_mem = AsyncMock()
        mock_mem.search = AsyncMock(return_value=[
            {"content": "event A"},
            {"content": "event B"},
        ])
        ir._memory_engine = mock_mem

        result = await ir._resolve_reference("timeline", "main")
        assert "event A" in result

    @pytest.mark.asyncio
    async def test_foreshadow_reference(self):
        ir = IterativeRetriever()
        mock_graph = AsyncMock()
        mock_graph.get_foreshadows = AsyncMock(return_value=[
            {"name": "key_foreshadow", "properties": {"status": "planted", "description": "desc"}}
        ])
        ir._graph_engine = mock_graph

        result = await ir._resolve_reference("foreshadow", "key")
        assert result is not None
        assert "key_foreshadow" in result

    @pytest.mark.asyncio
    async def test_no_match(self):
        ir = IterativeRetriever()
        mock_mem = AsyncMock()
        mock_mem.search = AsyncMock(return_value=[])
        ir._memory_engine = mock_mem

        result = await ir._resolve_reference("memory", "nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_character_error_response(self):
        ir = IterativeRetriever()
        mock_graph = AsyncMock()
        mock_graph.get_character = AsyncMock(return_value={"error": "not found"})
        ir._graph_engine = mock_graph

        result = await ir._resolve_reference("character", "nobody")
        assert result is None


# ============================================================
# iterative_retrieve (async)
# ============================================================

class TestIterativeRetrieve:

    @pytest.mark.asyncio
    async def test_basic_iteration(self):
        ir = IterativeRetriever()
        with patch.object(ir, 'hybrid_search', new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                {"id": "r1", "content": "result content", "source": "memory", "score": 0.9, "metadata": {}},
            ]
            result = await ir.iterative_retrieve("test query", max_iterations=1)
            assert result["iterations"] >= 1
            assert len(result["results"]) >= 1
            assert result["confidence"] == 0.9

    @pytest.mark.asyncio
    async def test_stops_at_threshold(self):
        ir = IterativeRetriever()
        with patch.object(ir, 'hybrid_search', new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                {"id": "r1", "content": "high score", "source": "memory", "score": 0.95, "metadata": {}},
            ]
            result = await ir.iterative_retrieve("query", confidence_threshold=0.9)
            assert result["confidence"] >= 0.9
            assert result["iterations"] == 1

    @pytest.mark.asyncio
    async def test_no_results(self):
        ir = IterativeRetriever()
        with patch.object(ir, 'hybrid_search', new_callable=AsyncMock) as mock_search:
            mock_search.return_value = []
            result = await ir.iterative_retrieve("empty", max_iterations=3)
            assert result["iterations"] == 1
            assert len(result["results"]) == 0

    @pytest.mark.asyncio
    async def test_deduplication(self):
        ir = IterativeRetriever()
        call_count = 0

        async def mock_search(query, scope, limit):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return [
                    {"id": "r1", "content": "unique content here", "source": "memory", "score": 0.5, "metadata": {}},
                ]
            return [
                {"id": "r1", "content": "duplicate", "source": "memory", "score": 0.6, "metadata": {}},
                {"id": "r2", "content": "new result content", "source": "memory", "score": 0.4, "metadata": {}},
            ]

        with patch.object(ir, 'hybrid_search', side_effect=mock_search):
            result = await ir.iterative_retrieve("test", max_iterations=2, confidence_threshold=0.99)
            ids = [r["id"] for r in result["results"]]
            assert ids.count("r1") == 1

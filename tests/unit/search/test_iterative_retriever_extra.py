# -*- coding: utf-8 -*-
"""IterativeRetriever tests - sync methods, _extract_snippet, _extract_keywords, _search_files."""

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

from src.search.iterative_retriever import IterativeRetriever, SearchResult


class TestSearchResult:
    def test_fields(self):
        r = SearchResult(id="1", content="text", source="memory", score=0.9)
        assert r.id == "1"
        assert r.metadata is None


class TestInit:
    def test_defaults(self):
        r = IterativeRetriever()
        assert r._memory_engine is None
        assert r._graph_engine is None
        assert r._file_extensions == {".md", ".txt"}

    def test_custom(self, tmp_path):
        r = IterativeRetriever(project_root=tmp_path, file_extensions={".py"})
        assert r._project_root == tmp_path
        assert ".py" in r._file_extensions


class TestExtractSnippet:
    def test_keyword_found(self):
        r = IterativeRetriever()
        content = "A" * 100 + "keyword" + "B" * 100
        snippet = r._extract_snippet(content, ["keyword"], max_len=200)
        assert "keyword" in snippet.lower()

    def test_keyword_not_found(self):
        r = IterativeRetriever()
        content = "hello world this is content"
        snippet = r._extract_snippet(content, ["zzzzz"], max_len=10)
        assert len(snippet) <= 20  # with ellipsis

    def test_short_content(self):
        r = IterativeRetriever()
        snippet = r._extract_snippet("hi", ["hi"], max_len=200)
        assert "hi" in snippet

    def test_ellipsis_start(self):
        r = IterativeRetriever()
        content = "A" * 200 + "keyword" + "B" * 200
        snippet = r._extract_snippet(content, ["keyword"], max_len=100)
        assert snippet.startswith("...")


class TestExtractKeywords:
    def test_basic(self):
        r = IterativeRetriever()
        results = [
            {"content": "张三是一个角色 character"},
            {"content": "李四也是角色 another"},
        ]
        kws = r._extract_keywords(results)
        assert isinstance(kws, list)
        assert len(kws) > 0

    def test_empty(self):
        r = IterativeRetriever()
        assert r._extract_keywords([]) == []


class TestSearchFiles:
    @pytest.mark.asyncio
    async def test_search_files(self, tmp_path):
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("hello world test content", encoding="utf-8")
        (d / "b.txt").write_text("unrelated stuff", encoding="utf-8")
        r = IterativeRetriever(project_root=tmp_path, file_extensions={".md", ".txt"})
        results = await r._search_files("hello", limit=10)
        assert len(results) >= 1
        assert results[0].source == "file"

    @pytest.mark.asyncio
    async def test_search_files_no_match(self, tmp_path):
        (tmp_path / "a.md").write_text("nothing here", encoding="utf-8")
        r = IterativeRetriever(project_root=tmp_path)
        results = await r._search_files("zzzznotfound", limit=10)
        assert results == []

    @pytest.mark.asyncio
    async def test_search_files_unreadable(self, tmp_path):
        f = tmp_path / "bad.md"
        f.write_bytes(b'\x80\x81\x82')  # invalid utf-8
        r = IterativeRetriever(project_root=tmp_path)
        results = await r._search_files("test", limit=10)
        assert results == []


class TestContextPatterns:
    def test_patterns_exist(self):
        r = IterativeRetriever()
        assert "character" in r.CONTEXT_PATTERNS
        assert "scene" in r.CONTEXT_PATTERNS
        assert "memory" in r.CONTEXT_PATTERNS

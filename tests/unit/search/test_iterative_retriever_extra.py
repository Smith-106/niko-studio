# -*- coding: utf-8 -*-
"""IterativeRetriever tests - sync methods, _extract_snippet, _extract_keywords, _search_files."""

import sys
import types

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

    @pytest.mark.asyncio
    async def test_search_files_single_char_query_uses_fallback_keyword(self, tmp_path):
        (tmp_path / "single.md").write_text("a marker", encoding="utf-8")
        r = IterativeRetriever(project_root=tmp_path, file_extensions={".md"})

        results = await r._search_files("a", limit=10)

        assert any(item.id == "single.md" for item in results)

    @pytest.mark.asyncio
    async def test_search_files_skips_directory_path_from_glob(self, tmp_path):
        fake_dir = tmp_path / "fake.md"
        fake_dir.mkdir()
        real_file = tmp_path / "real.md"
        real_file.write_text("needle content", encoding="utf-8")

        r = IterativeRetriever(project_root=tmp_path, file_extensions={".md"})

        with patch.object(Path, "glob", return_value=[fake_dir, real_file]):
            results = await r._search_files("needle", limit=10)

        assert any(item.id == "real.md" for item in results)



class TestContextPatterns:
    def test_patterns_exist(self):
        r = IterativeRetriever()
        assert "character" in r.CONTEXT_PATTERNS
        assert "scene" in r.CONTEXT_PATTERNS
        assert "memory" in r.CONTEXT_PATTERNS


class TestLazyEngineProperties:
    def test_memory_engine_lazy_property(self):
        r = IterativeRetriever()
        fake_module = types.ModuleType("src.memory.unified_memory")

        class FakeUnifiedMemoryEngine:
            pass

        fake_module.UnifiedMemoryEngine = FakeUnifiedMemoryEngine

        with patch.dict(sys.modules, {"src.memory.unified_memory": fake_module}):
            engine = r.memory_engine

        assert isinstance(engine, FakeUnifiedMemoryEngine)

    def test_graph_engine_lazy_property(self):
        r = IterativeRetriever()
        fake_module = types.ModuleType("src.graph.graph_engine")

        class FakeGraphEngine:
            pass

        fake_module.GraphEngine = FakeGraphEngine

        with patch.dict(sys.modules, {"src.graph.graph_engine": fake_module}):
            engine = r.graph_engine

        assert isinstance(engine, FakeGraphEngine)


class TestHybridAndGraphSearchBranches:
    @pytest.mark.asyncio
    async def test_hybrid_search_memory_graph_files_and_sorting(self):
        r = IterativeRetriever()
        r._memory_engine = AsyncMock()
        r._memory_engine.search = AsyncMock(return_value=[
            {"id": "m1", "content": "memory", "score": 0.4, "layer": "l", "dimension": "d"}
        ])

        with (
            patch.object(r, "_search_graph", new=AsyncMock(return_value=[
                {"id": "g1", "type": "Character", "name": "Hero", "score": 0.7, "properties": {"k": "v"}}
            ])),
            patch.object(r, "_search_files", new=AsyncMock(return_value=[
                SearchResult(id="f1", content="file", source="file", score=0.9, metadata={"path": "p"})
            ])),
        ):
            results = await r.hybrid_search("query", scope="all", limit=5)

        assert [item["id"] for item in results] == ["f1", "g1", "m1"]

    @pytest.mark.asyncio
    async def test_search_graph_sets_score_and_skips_error_entities(self):
        r = IterativeRetriever()
        r._graph_engine = AsyncMock()
        # _search_graph now uses search_entities_by_name (parameterized query)
        # instead of execute_cypher (removed for security)
        r._graph_engine.search_entities_by_name = AsyncMock(return_value=[
            {"id": "ok", "type": "Character", "name": "hero"},
        ])

        result = await r._search_graph("hero", limit=5)

        assert len(result) == 1
        assert result[0]["score"] == 0.7


class TestIterativeRetrieveBranch:
    @pytest.mark.asyncio
    async def test_iterative_retrieve_breaks_when_expansion_repeats(self):
        r = IterativeRetriever()

        with (
            patch.object(r, "hybrid_search", new=AsyncMock(return_value=[
                {"id": "x", "content": "same same same", "source": "memory", "score": 0.2, "metadata": {}}
            ])),
            patch.object(r, "_extract_keywords", return_value=["same"]),
        ):
            result = await r.iterative_retrieve("q", max_iterations=3, confidence_threshold=0.8)

        assert result["iterations"] == 2
        assert result["queries_used"] == ["q", "same"]


class TestResolveReferenceStyleBranch:
    @pytest.mark.asyncio
    async def test_style_reference_load_success(self):
        r = IterativeRetriever()
        fake_module = types.ModuleType("src.skills.skill_engine")

        class FakeSkillEngine:
            async def load(self, _name):
                return {"name": "style-x", "description": "desc"}

        fake_module.SkillEngine = FakeSkillEngine

        with patch.dict(sys.modules, {"src.skills.skill_engine": fake_module}):
            resolved = await r._resolve_reference("style", "style-x")

        assert "技能包" in resolved

    @pytest.mark.asyncio
    async def test_style_reference_file_not_found(self):
        r = IterativeRetriever()
        fake_module = types.ModuleType("src.skills.skill_engine")

        class FakeSkillEngine:
            async def load(self, _name):
                raise FileNotFoundError("missing")

        fake_module.SkillEngine = FakeSkillEngine

        with patch.dict(sys.modules, {"src.skills.skill_engine": fake_module}):
            resolved = await r._resolve_reference("style", "missing")

        assert resolved is None

# -*- coding: utf-8 -*-
"""
Context Providers Tests

Tests for ContextPriority, ContextItem, BaseContextProvider._estimate_tokens,
MemoryContextProvider.get_context, SkillContextProvider.get_context.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from src.context.providers import (
    ContextPriority,
    ContextItem,
    BaseContextProvider,
    MemoryContextProvider,
    SkillContextProvider,
    ProjectContextProvider,
    ContextAggregator,
    get_default_aggregator,
)


# ============================================================
# ContextPriority
# ============================================================

class TestContextPriority:

    def test_values(self):
        assert ContextPriority.CRITICAL == 0
        assert ContextPriority.HIGH == 10
        assert ContextPriority.NORMAL == 50
        assert ContextPriority.LOW == 100
        assert ContextPriority.OPTIONAL == 200

    def test_ordering(self):
        assert ContextPriority.CRITICAL < ContextPriority.HIGH
        assert ContextPriority.HIGH < ContextPriority.NORMAL
        assert ContextPriority.NORMAL < ContextPriority.LOW
        assert ContextPriority.LOW < ContextPriority.OPTIONAL

    def test_is_int(self):
        assert isinstance(ContextPriority.CRITICAL, int)


# ============================================================
# ContextItem
# ============================================================

class TestContextItem:

    def test_creation_defaults(self):
        item = ContextItem(key="k", value="v", source="test")
        assert item.key == "k"
        assert item.value == "v"
        assert item.source == "test"
        assert item.priority == ContextPriority.NORMAL
        assert item.metadata == {}
        assert item.token_estimate == 0

    def test_creation_with_all_fields(self):
        item = ContextItem(
            key="k",
            value="v",
            source="test",
            priority=ContextPriority.HIGH,
            metadata={"a": 1},
            token_estimate=42,
        )
        assert item.priority == ContextPriority.HIGH
        assert item.metadata == {"a": 1}
        assert item.token_estimate == 42

    def test_to_prompt_segment_str_value(self):
        item = ContextItem(key="greeting", value="hello world", source="s")
        segment = item.to_prompt_segment()
        assert segment == "[greeting]\nhello world\n[/greeting]"

    def test_to_prompt_segment_dict_value(self):
        item = ContextItem(key="data", value={"name": "test"}, source="s")
        segment = item.to_prompt_segment()
        assert "[data]" in segment
        assert "[/data]" in segment
        assert '"name": "test"' in segment

    def test_to_prompt_segment_list_value(self):
        item = ContextItem(key="items", value=["a", "b", "c"], source="s")
        segment = item.to_prompt_segment()
        assert "[items]" in segment
        assert "[/items]" in segment
        assert "a\nb\nc" in segment

    def test_to_prompt_segment_dict_chinese(self):
        item = ContextItem(key="info", value={"name": "test"}, source="s")
        segment = item.to_prompt_segment()
        # ensure_ascii=False means Chinese chars would be preserved
        assert '"name"' in segment

    def test_to_prompt_segment_numeric_value(self):
        item = ContextItem(key="num", value=42, source="s")
        segment = item.to_prompt_segment()
        assert "42" in segment


# ============================================================
# BaseContextProvider._estimate_tokens
# ============================================================

class TestBaseContextProviderEstimateTokens:
    """Test _estimate_tokens via a concrete subclass."""

    def _make_provider(self):
        """Create a minimal concrete subclass for testing."""
        provider = MemoryContextProvider()
        return provider

    def test_english_only(self):
        provider = self._make_provider()
        text = "hello world test"  # 16 chars
        tokens = provider._estimate_tokens(text)
        assert tokens == int(16 / 4)

    def test_chinese_only(self):
        provider = self._make_provider()
        text = "test"  # 6 Chinese chars
        tokens = provider._estimate_tokens(text)
        assert tokens == int(len(text) / 4)

    def test_chinese_chars(self):
        provider = self._make_provider()
        # 3 Chinese characters
        tokens = provider._estimate_tokens("")
        chinese_chars = sum(1 for c in "" if '\u4e00' <= c <= '\u9fff')
        other_chars = len("") - chinese_chars
        expected = int(chinese_chars / 1.5 + other_chars / 4)
        assert tokens == expected

    def test_mixed_chinese_english(self):
        provider = self._make_provider()
        text = "hello"  # 2 Chinese + 5 English
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        expected = int(chinese_chars / 1.5 + other_chars / 4)
        tokens = provider._estimate_tokens(text)
        assert tokens == expected

    def test_empty_string(self):
        provider = self._make_provider()
        assert provider._estimate_tokens("") == 0


# ============================================================
# MemoryContextProvider.get_context
# ============================================================

class TestMemoryContextProvider:

    async def test_no_engine_returns_empty(self):
        provider = MemoryContextProvider(memory_engine=None)
        items = await provider.get_context(query="test")
        assert items == []

    async def test_name_and_priority(self):
        provider = MemoryContextProvider()
        assert provider.name == "memory"
        assert provider.priority == ContextPriority.HIGH

    async def test_search_returns_results(self):
        mock_result = MagicMock()
        mock_result.score = 0.9
        mock_result.content = "remembered content"
        mock_result.memory_type = "episodic"

        engine = MagicMock()
        engine.search = AsyncMock(return_value=[mock_result])

        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(query="test query")

        engine.search.assert_awaited_once_with(
            query="test query", limit=10, session_id=None
        )
        assert len(items) == 1
        assert items[0].key == "memory_0"
        assert items[0].value == "remembered content"
        assert items[0].source == "memory"
        assert items[0].metadata["score"] == 0.9
        assert items[0].metadata["type"] == "episodic"

    async def test_search_filters_low_relevance(self):
        low_score = MagicMock()
        low_score.score = 0.2
        low_score.content = "irrelevant"

        high_score = MagicMock()
        high_score.score = 0.8
        high_score.content = "relevant"
        high_score.memory_type = "semantic"

        engine = MagicMock()
        engine.search = AsyncMock(return_value=[low_score, high_score])

        provider = MemoryContextProvider(
            memory_engine=engine, relevance_threshold=0.5
        )
        items = await provider.get_context(query="test")

        assert len(items) == 1
        assert items[0].value == "relevant"

    async def test_session_id_context(self):
        engine = MagicMock()
        engine.search = AsyncMock(return_value=[])
        engine.get_session_context = AsyncMock(
            return_value={"role": "assistant", "history": []}
        )

        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(
            query="test", session_id="sess-001"
        )

        engine.search.assert_awaited_once()
        engine.get_session_context.assert_awaited_once_with("sess-001")
        assert len(items) == 1
        assert items[0].key == "session_context"
        assert items[0].priority == ContextPriority.CRITICAL

    async def test_session_id_no_context_returned(self):
        engine = MagicMock()
        engine.search = AsyncMock(return_value=[])
        engine.get_session_context = AsyncMock(return_value=None)

        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(
            query="test", session_id="sess-002"
        )
        assert len(items) == 0

    async def test_engine_without_search_method(self):
        engine = MagicMock(spec=[])  # no attributes
        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(query="test")
        assert items == []

    async def test_engine_exception_handled(self):
        engine = MagicMock()
        engine.search = AsyncMock(side_effect=RuntimeError("db error"))

        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(query="test")
        assert items == []

    async def test_result_without_score_attribute(self):
        """Results without .score should be included (no filtering)."""
        mock_result = MagicMock(spec=["content"])
        mock_result.content = "no score content"
        # Remove score attribute so hasattr returns False
        del mock_result.score

        engine = MagicMock()
        engine.search = AsyncMock(return_value=[mock_result])

        provider = MemoryContextProvider(memory_engine=engine)
        items = await provider.get_context(query="test")
        assert len(items) == 1


# ============================================================
# SkillContextProvider.get_context
# ============================================================

class TestSkillContextProvider:

    async def test_no_loader_returns_empty(self):
        provider = SkillContextProvider(skill_loader=None)
        items = await provider.get_context(query="test")
        assert items == []

    async def test_name_and_priority(self):
        provider = SkillContextProvider()
        assert provider.name == "skill"
        assert provider.priority == ContextPriority.NORMAL

    async def test_load_skill_by_id(self):
        loader = MagicMock()
        loader.load = MagicMock(return_value="skill content here")

        provider = SkillContextProvider(skill_loader=loader)
        items = await provider.get_context(
            skill_ids=["my-skill"], include_summary=False
        )

        loader.load.assert_called_once_with("my-skill")
        assert len(items) == 1
        assert items[0].key == "skill_my-skill"
        assert items[0].value == "skill content here"
        assert items[0].metadata["skill_id"] == "my-skill"

    async def test_skill_not_found(self):
        loader = MagicMock()
        loader.load = MagicMock(side_effect=FileNotFoundError)

        provider = SkillContextProvider(skill_loader=loader)
        items = await provider.get_context(
            skill_ids=["nonexistent"], include_summary=False
        )
        assert items == []

    async def test_content_truncation(self):
        long_content = "x" * 5000
        loader = MagicMock()
        loader.load = MagicMock(return_value=long_content)

        provider = SkillContextProvider(
            skill_loader=loader, max_skill_length=100
        )
        items = await provider.get_context(
            skill_ids=["big-skill"], include_summary=False
        )

        assert len(items) == 1
        assert len(items[0].value) < len(long_content)
        assert "... (" in items[0].value

    async def test_content_no_truncation_within_limit(self):
        content = "short content"
        loader = MagicMock()
        loader.load = MagicMock(return_value=content)

        provider = SkillContextProvider(
            skill_loader=loader, max_skill_length=4000
        )
        items = await provider.get_context(
            skill_ids=["s1"], include_summary=False
        )
        assert items[0].value == content

    async def test_include_summary(self):
        loader = MagicMock()
        loader.load = MagicMock(return_value="content")
        loader.get_summary = MagicMock(return_value="all skills summary")

        provider = SkillContextProvider(skill_loader=loader)
        items = await provider.get_context(
            skill_ids=["s1"], include_summary=True
        )

        # 1 skill + 1 summary
        assert len(items) == 2
        summary_item = [i for i in items if i.key == "available_skills"][0]
        assert summary_item.value == "all skills summary"
        assert summary_item.priority == ContextPriority.LOW

    async def test_extract_refs_from_query(self):
        loader = MagicMock()
        loader.load = MagicMock(return_value="ref content")
        loader.extract_refs = MagicMock(return_value=["ref-skill"])

        provider = SkillContextProvider(skill_loader=loader)
        items = await provider.get_context(
            query="use @ref-skill", include_summary=False
        )

        loader.extract_refs.assert_called_once_with("use @ref-skill")
        assert len(items) == 1
        assert items[0].metadata.get("from_ref") is True

    async def test_extract_refs_skip_already_loaded(self):
        loader = MagicMock()
        loader.load = MagicMock(return_value="content")
        loader.extract_refs = MagicMock(return_value=["s1"])

        provider = SkillContextProvider(skill_loader=loader)
        items = await provider.get_context(
            query="@s1",
            skill_ids=["s1"],
            include_summary=False,
        )

        # s1 loaded via skill_ids, not duplicated from refs
        assert len(items) == 1

    async def test_loader_exception_handled(self):
        loader = MagicMock()
        loader.load = MagicMock(side_effect=RuntimeError("broken"))

        provider = SkillContextProvider(skill_loader=loader)
        # The outer try/except catches RuntimeError
        items = await provider.get_context(
            skill_ids=["s1"], include_summary=False
        )
        assert items == []


# ============================================================
# ProjectContextProvider / ContextAggregator
# ============================================================

class TestProjectContextProvider:

    async def test_get_context_without_niko_dir(self, tmp_path):
        provider = ProjectContextProvider(project_root=str(tmp_path))
        items = await provider.get_context()
        assert items == []

    async def test_get_context_with_partial_files(self, tmp_path):
        niko = tmp_path / ".niko"
        niko.mkdir()
        (niko / "config.json").write_text('{"name":"demo"}', encoding="utf-8")
        (niko / "world.json").write_text('{"era":"future"}', encoding="utf-8")

        provider = ProjectContextProvider(project_root=str(tmp_path))
        items = await provider.get_context(include_characters=False, include_outline=False)

        keys = {i.key for i in items}
        assert "project_config" in keys
        assert "world" in keys
        assert "characters" not in keys
        assert "outline" not in keys

    async def test_get_context_handles_bad_character_json(self, tmp_path):
        niko = tmp_path / ".niko"
        chars = niko / "characters"
        chars.mkdir(parents=True)
        (chars / "a.json").write_text('{"name":"A"}', encoding="utf-8")
        (chars / "broken.json").write_text('not-json', encoding="utf-8")

        provider = ProjectContextProvider(project_root=str(tmp_path))
        items = await provider.get_context(include_world=False, include_outline=False)

        char_item = [i for i in items if i.key == "characters"][0]
        assert char_item.metadata["count"] == 1

    async def test_get_context_handles_top_level_exception(self, tmp_path, monkeypatch):
        niko = tmp_path / ".niko"
        niko.mkdir()
        (niko / "config.json").write_text('{"k":"v"}', encoding="utf-8")

        provider = ProjectContextProvider(project_root=str(tmp_path))

        original_loads = __import__("json").loads

        def _boom(data):
            if '"k":"v"' in data:
                raise RuntimeError("boom")
            return original_loads(data)

        monkeypatch.setattr("src.context.providers.json.loads", _boom)

        items = await provider.get_context()
        assert items == []


class TestContextAggregator:

    class _DummyProvider(BaseContextProvider):
        def __init__(self, name, priority, items=None, exc=None):
            super().__init__(name, priority)
            self._items = items or []
            self._exc = exc

        async def get_context(self, query=None, **kwargs):
            if self._exc:
                raise self._exc
            return self._items

    async def test_add_remove_and_list_providers(self):
        ag = ContextAggregator()
        p1 = self._DummyProvider("b", ContextPriority.NORMAL)
        p2 = self._DummyProvider("a", ContextPriority.HIGH)
        ag.add_provider(p1)
        ag.add_provider(p2)

        assert ag.list_providers() == ["a", "b"]
        assert ag.remove_provider("a") is True
        assert ag.remove_provider("missing") is False
        assert ag.list_providers() == ["b"]

    async def test_get_context_merges_and_sorts(self):
        ag = ContextAggregator()
        low = ContextItem(key="l", value="v", source="x", priority=ContextPriority.LOW, token_estimate=5)
        high = ContextItem(key="h", value="v", source="x", priority=ContextPriority.HIGH, token_estimate=5)
        ag.add_provider(self._DummyProvider("p1", ContextPriority.NORMAL, [low]))
        ag.add_provider(self._DummyProvider("p2", ContextPriority.HIGH, [high]))

        items = await ag.get_context(query="q")
        assert [i.key for i in items] == ["h", "l"]

    async def test_get_context_provider_kwargs(self):
        class _KwProvider(BaseContextProvider):
            def __init__(self):
                super().__init__("kw", ContextPriority.NORMAL)
                self.received = None

            async def get_context(self, query=None, **kwargs):
                self.received = kwargs
                return []

        p = _KwProvider()
        ag = ContextAggregator()
        ag.add_provider(p)

        await ag.get_context(query="qq", provider_kwargs={"kw": {"a": 1}}, shared=2)
        assert p.received["a"] == 1
        assert p.received["shared"] == 2

    async def test_get_context_ignores_provider_exception(self):
        ag = ContextAggregator()
        ok = ContextItem(key="ok", value="v", source="x", token_estimate=1)
        ag.add_provider(self._DummyProvider("bad", ContextPriority.NORMAL, exc=RuntimeError("x")))
        ag.add_provider(self._DummyProvider("good", ContextPriority.NORMAL, [ok]))

        items = await ag.get_context()
        assert [i.key for i in items] == ["ok"]

    async def test_apply_token_budget_keeps_high_priority_over_limit(self):
        ag = ContextAggregator()
        items = [
            ContextItem("a", "v", "s", ContextPriority.NORMAL, token_estimate=10),
            ContextItem("b", "v", "s", ContextPriority.HIGH, token_estimate=10),
            ContextItem("c", "v", "s", ContextPriority.LOW, token_estimate=1),
        ]
        result = ag._apply_token_budget(items, max_tokens=10)
        assert [i.key for i in result] == ["a", "b"]

    async def test_get_context_with_max_tokens(self):
        ag = ContextAggregator()
        ag.add_provider(self._DummyProvider("p", ContextPriority.NORMAL, [
            ContextItem("k1", "v", "s", ContextPriority.NORMAL, token_estimate=8),
            ContextItem("k2", "v", "s", ContextPriority.LOW, token_estimate=8),
        ]))
        items = await ag.get_context(max_tokens=10)
        assert [i.key for i in items] == ["k1"]

    def test_to_prompt_and_empty(self):
        ag = ContextAggregator()
        assert ag.to_prompt([]) == ""
        text = ag.to_prompt([
            ContextItem("a", "1", "s"),
            ContextItem("b", ["x", "y"], "s"),
        ])
        assert "[a]" in text and "[/b]" in text


def test_get_default_aggregator_with_optional_sources(monkeypatch):
    class _DummyMemory:
        pass

    class _DummySkill:
        pass

    ag = get_default_aggregator(memory_engine=_DummyMemory(), skill_loader=_DummySkill(), project_root=".")
    names = ag.list_providers()
    assert "memory" in names
    assert "skill" in names
    assert "project" in names

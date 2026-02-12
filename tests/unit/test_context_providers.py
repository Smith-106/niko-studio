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

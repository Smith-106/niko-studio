"""
Writer Agent Logic Tests

Tests for the pure-logic parts of WriterAgent: _post_process, data models,
_build_knowledge_context, inject_skills, retrieve_context (no LLM).
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from langchain_core.runnables import RunnableLambda
from src.agents.writer import (
    WriterAgent,
    WriterInput,
    WriterOutput,
)


class TestWriterInput:
    """Tests for WriterInput validation and normalization"""

    def test_default_values(self):
        wi = WriterInput()
        assert wi.scene_id == "scene-001"
        assert wi.pov_character == "主角"
        assert wi.objective == "推进剧情"
        assert wi.chapter_num == 1
        assert wi.word_target == 2000

    def test_explicit_values_override_defaults(self):
        wi = WriterInput(
            scene_id="CH03-SC02",
            pov_character="Alice",
            objective="escape",
            chapter_num=3,
        )
        assert wi.scene_id == "CH03-SC02"
        assert wi.pov_character == "Alice"
        assert wi.objective == "escape"
        assert wi.chapter_num == 3

    def test_scene_card_normalization(self):
        wi = WriterInput(
            scene_card={
                "scene_id": "SC-99",
                "pov_character": "Bob",
                "objective": "investigate",
                "conflict": "trapped",
                "outcome": "-",
                "plot_beat": "rising",
                "chapter_num": 5,
            }
        )
        assert wi.scene_id == "SC-99"
        assert wi.pov_character == "Bob"
        assert wi.objective == "investigate"
        assert wi.conflict == "trapped"
        # outcome defaults to "+" which is truthy, so scene_card value won't override
        assert wi.outcome == "+"
        assert wi.plot_beat == "rising"
        assert wi.chapter_num == 5

    def test_explicit_fields_override_scene_card(self):
        wi = WriterInput(
            scene_card={"scene_id": "from-card", "pov_character": "card-char"},
            scene_id="explicit-id",
            pov_character="explicit-char",
        )
        assert wi.scene_id == "explicit-id"
        assert wi.pov_character == "explicit-char"

    def test_foreshadow_fields(self):
        wi = WriterInput(
            foreshadows_to_plant=["clue A"],
            foreshadows_to_harvest=["old clue B"],
        )
        assert wi.foreshadows_to_plant == ["clue A"]
        assert wi.foreshadows_to_harvest == ["old clue B"]


class TestWriterOutput:
    """Tests for WriterOutput"""

    def test_basic_output(self):
        wo = WriterOutput(content="test content", wordcount=100)
        assert wo.content == "test content"
        assert wo.wordcount == 100
        assert wo.characters_appeared == []
        assert wo.forbidden_words_found == []
        assert wo.metadata is None

    def test_all_fields(self):
        wo = WriterOutput(
            content="full content",
            wordcount=2000,
            characters_appeared=["Alice", "Bob"],
            locations=["Tower"],
            foreshadows_planted=["clue"],
            foreshadows_harvested=["old clue"],
            sensory_types_used=["visual", "auditory"],
            forbidden_words_found=["突然"],
            sections_needing_review=["paragraph 1"],
        )
        assert len(wo.characters_appeared) == 2
        assert "Tower" in wo.locations


class TestPostProcess:
    """Tests for _post_process()"""

    def test_wordcount(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        output = agent._post_process("这是一段测试内容" * 100, input_data)
        assert output.wordcount == len("这是一段测试内容" * 100)

    def test_forbidden_words_detection(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "他突然转身，不禁感到恐惧，竟然无法动弹"
        output = agent._post_process(content, input_data)
        assert "突然" in output.forbidden_words_found
        assert "不禁" in output.forbidden_words_found
        assert "竟然" in output.forbidden_words_found

    def test_no_forbidden_words(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "他缓缓转身，寒意沿着脊椎攀升"
        output = agent._post_process(content, input_data)
        assert output.forbidden_words_found == []

    def test_sensory_detection_visual(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "光芒照亮了整个房间"
        output = agent._post_process(content, input_data)
        assert "visual" in output.sensory_types_used

    def test_sensory_detection_auditory(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "远处传来钟声"
        output = agent._post_process(content, input_data)
        assert "auditory" in output.sensory_types_used

    def test_sensory_detection_tactile(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "冷风刺痛了他的面颊"
        output = agent._post_process(content, input_data)
        assert "tactile" in output.sensory_types_used

    def test_sensory_detection_olfactory(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "空气中弥漫着一股气息"
        output = agent._post_process(content, input_data)
        assert "olfactory" in output.sensory_types_used

    def test_multiple_sensory_types(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "光芒刺眼，钟声回荡，冷风拂面，一股香味飘来"
        output = agent._post_process(content, input_data)
        assert len(output.sensory_types_used) >= 4

    def test_character_extraction(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput(
            character_profiles=[
                {"name": "克莱恩"},
                {"name": "梅丽莎"},
            ]
        )
        content = "克莱恩走向窗边，梅丽莎在门口等待"
        output = agent._post_process(content, input_data)
        assert "克莱恩" in output.characters_appeared
        assert "梅丽莎" in output.characters_appeared

    def test_character_not_in_content(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput(
            character_profiles=[{"name": "不存在的角色"}]
        )
        content = "这里没有任何角色"
        output = agent._post_process(content, input_data)
        assert output.characters_appeared == []

    def test_sections_needing_review_forbidden_words(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "他突然发现"
        output = agent._post_process(content, input_data)
        assert any("禁用词" in s for s in output.sections_needing_review)

    def test_sections_needing_review_sensory_insufficient(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput()
        content = "他走了"  # No sensory keywords at all
        output = agent._post_process(content, input_data)
        assert any("感官描写不足" in s for s in output.sections_needing_review)

    def test_foreshadows_passed_through(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput(
            foreshadows_to_plant=["clue A"],
            foreshadows_to_harvest=["old clue"],
        )
        output = agent._post_process("content", input_data)
        assert output.foreshadows_planted == ["clue A"]
        assert output.foreshadows_harvested == ["old clue"]


class TestInjectSkills:
    """Tests for inject_skills() and _build_enhanced_prompt()"""

    def test_no_skill_loader_returns_empty(self):
        agent = WriterAgent(llm=None, skill_loader=None)
        result = agent.inject_skills(["skill-1"])
        assert result == ""

    def test_inject_skills_with_loader(self):
        loader = MagicMock()
        loader.load_skill.return_value = {
            "name": "Test Skill",
            "content": "Do this special technique",
        }
        agent = WriterAgent(llm=None, skill_loader=loader)
        result = agent.inject_skills(["test-skill"])
        assert "Test Skill" in result
        assert "Do this special technique" in result
        assert agent._injected_skills == ["test-skill"]

    def test_inject_skills_multiple(self):
        loader = MagicMock()
        loader.load_skill.side_effect = [
            {"name": "Skill A", "content": "content A"},
            {"name": "Skill B", "content": "content B"},
        ]
        agent = WriterAgent(llm=None, skill_loader=loader)
        result = agent.inject_skills(["a", "b"])
        assert "Skill A" in result
        assert "Skill B" in result

    def test_inject_skills_load_failure_graceful(self):
        loader = MagicMock()
        loader.load_skill.side_effect = RuntimeError("not found")
        agent = WriterAgent(llm=None, skill_loader=loader)
        result = agent.inject_skills(["broken-skill"])
        assert result == ""

    def test_inject_skills_returns_none_from_loader(self):
        loader = MagicMock()
        loader.load_skill.return_value = None
        agent = WriterAgent(llm=None, skill_loader=loader)
        result = agent.inject_skills(["none-skill"])
        assert result == ""

    def test_build_enhanced_prompt_with_skills(self):
        loader = MagicMock()
        loader.load_skill.return_value = {"name": "Enhance", "content": "enhance it"}
        agent = WriterAgent(llm=None, skill_loader=loader)
        result = agent._build_enhanced_prompt("base prompt", ["enhance-skill"])
        assert "base prompt" in result
        assert "技能包指导" in result
        assert "enhance it" in result

    def test_build_enhanced_prompt_no_skills(self):
        agent = WriterAgent(llm=None, skill_loader=None)
        result = agent._build_enhanced_prompt("base prompt", ["skill-1"])
        assert result == "base prompt"


class TestWriteRuntimeLogic:

    def test_is_chapter_end_explicit_true(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput(scene_id="CH01-SC09", world_settings={"is_chapter_end": True})
        assert agent._is_chapter_end(input_data) is True

    def test_is_chapter_end_explicit_false(self):
        agent = WriterAgent(llm=None)
        input_data = WriterInput(scene_id="CH01-SC01", world_settings={"is_chapter_end": False})
        assert agent._is_chapter_end(input_data) is False

    def test_is_chapter_end_scene_rule(self):
        agent = WriterAgent(llm=None)
        assert agent._is_chapter_end(WriterInput(scene_id="CH02-SC01")) is True
        assert agent._is_chapter_end(WriterInput(scene_id="CH02-SC02")) is False

    def test_collect_effective_skill_ids_dedup(self):
        agent = WriterAgent(llm=None)
        wi = WriterInput(world_settings={"recommended_skills": ["a", "a", "b", "", None, "b"]})
        assert agent._collect_effective_skill_ids(wi) == ["a", "b"]

    @pytest.mark.asyncio
    async def test_run_chain_records_openai_proxy_warning(self):
        llm = RunnableLambda(lambda _: "ok")

        agent = WriterAgent(llm=llm)
        agent._get_openai_proxy_config = MagicMock(return_value={"enabled": True})
        agent._call_openai_proxy = AsyncMock(side_effect=RuntimeError("proxy fail"))

        warnings = []
        result = await agent._run_chain("{value}", {"value": "x"}, warnings=warnings)

        assert result == "ok"
        assert any("openai_proxy_fallback_failed" in item for item in warnings)

    @pytest.mark.asyncio
    async def test_write_skills_scoped_and_deduped(self):
        llm = RunnableLambda(lambda _: "chunk")
        loader = MagicMock()
        loader.load_skill.return_value = {"name": "Skill", "content": "guidance"}
        agent = WriterAgent(llm=llm, skill_loader=loader)

        input_data = WriterInput(
            scene_id="CH01-SC02",
            world_settings={"recommended_skills": ["skill-a", "skill-a", "skill-b"]},
            sensory_guidance={},
            emotional_arc="平静→变化",
        )

        output = await agent.write(input_data)
        assert output.content
        assert loader.load_skill.call_count == 2
        assert agent._injected_skills == []

    @pytest.mark.asyncio
    async def test_write_with_knowledge_merges_warning_and_summary(self):
        llm = RunnableLambda(lambda _: "chunk")

        kl = MagicMock()
        kl.search_entities = AsyncMock(side_effect=RuntimeError("lookup fail"))

        agent = WriterAgent(llm=llm, knowledge_layer=kl)
        input_data = WriterInput(scene_id="CH01-SC02", sensory_guidance={})

        output = await agent.write_with_knowledge(input_data)
        assert output.metadata is not None
        assert "knowledge_retrieved" in output.metadata
        assert any("knowledge_retrieval_failed" in w for w in output.metadata.get("warnings", []))


class TestBuildKnowledgeContext:
    """Tests for _build_knowledge_context()"""

    def test_empty_retrieved(self):
        agent = WriterAgent(llm=None)
        result = agent._build_knowledge_context({})
        assert result == ""

    def test_none_retrieved(self):
        agent = WriterAgent(llm=None)
        result = agent._build_knowledge_context(None)
        assert result == ""

    def test_entities_formatted(self):
        agent = WriterAgent(llm=None)
        retrieved = {
            "entities": [
                {"name": "Alice", "type": "character", "description": "protagonist"},
            ],
            "relations": [],
            "memories": [],
        }
        result = agent._build_knowledge_context(retrieved)
        assert "Alice" in result
        assert "character" in result
        assert "protagonist" in result

    def test_relations_formatted(self):
        agent = WriterAgent(llm=None)
        retrieved = {
            "entities": [{"name": "A", "type": "character", "description": ""}],
            "relations": [
                {"source": "Alice", "target": "Bob", "type": "ENEMY"},
            ],
            "memories": [],
        }
        result = agent._build_knowledge_context(retrieved)
        assert "Alice" in result
        assert "Bob" in result
        assert "ENEMY" in result

    def test_memories_formatted(self):
        agent = WriterAgent(llm=None)
        retrieved = {
            "entities": [{"name": "X", "type": "event", "description": ""}],
            "relations": [],
            "memories": [
                {"content": "Something happened in chapter 1"},
            ],
        }
        result = agent._build_knowledge_context(retrieved)
        assert "Something happened" in result

    def test_entities_limited_to_5(self):
        agent = WriterAgent(llm=None)
        retrieved = {
            "entities": [
                {"name": f"Char{i}", "type": "character", "description": f"desc{i}"}
                for i in range(10)
            ],
            "relations": [],
            "memories": [],
        }
        result = agent._build_knowledge_context(retrieved)
        # Should only include first 5
        assert "Char0" in result
        assert "Char4" in result
        assert "Char5" not in result


class TestRetrieveContext:
    """Tests for retrieve_context() without LLM"""

    @pytest.mark.asyncio
    async def test_no_knowledge_layer(self):
        agent = WriterAgent(llm=None, knowledge_layer=None)
        result = await agent.retrieve_context("query")
        assert result == {"entities": [], "relations": [], "memories": []}

    @pytest.mark.asyncio
    async def test_disabled_retrieval(self):
        kl = MagicMock()
        agent = WriterAgent(llm=None, knowledge_layer=kl, enable_knowledge_retrieval=False)
        result = await agent.retrieve_context("query")
        assert result == {"entities": [], "relations": [], "memories": []}

    @pytest.mark.asyncio
    async def test_with_knowledge_layer(self):
        kl = MagicMock()
        kl.search_entities = AsyncMock(return_value=[
            {"id": "e1", "name": "Alice", "type": "character"},
        ])
        kl.get_related_entities = AsyncMock(return_value=[
            {"source": "Alice", "target": "Bob", "type": "FRIEND"},
        ])
        kl.search_memories = AsyncMock(return_value=[
            {"content": "memory content"},
        ])
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        result = await agent.retrieve_context("alice")
        assert len(result["entities"]) == 1
        assert len(result["relations"]) >= 1
        assert len(result["memories"]) == 1

    @pytest.mark.asyncio
    async def test_context_types_filter(self):
        kl = MagicMock()
        kl.search_entities = AsyncMock(return_value=[
            {"id": "e1", "name": "Alice", "type": "character"},
            {"id": "e2", "name": "Tower", "type": "location"},
        ])
        kl.get_related_entities = AsyncMock(return_value=[])
        kl.search_memories = AsyncMock(return_value=[])
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        result = await agent.retrieve_context("query", context_types=["character"])
        assert len(result["entities"]) == 1
        assert result["entities"][0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_exception_returns_empty(self):
        kl = MagicMock()
        kl.search_entities = AsyncMock(side_effect=RuntimeError("db error"))
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        result = await agent.retrieve_context("query")
        assert result["entities"] == []


class TestSyncToKnowledgeLayer:
    """Tests for sync_to_knowledge_layer()"""

    @pytest.mark.asyncio
    async def test_no_knowledge_layer_noop(self):
        agent = WriterAgent(llm=None, knowledge_layer=None)
        output = WriterOutput(content="test", wordcount=4, characters_appeared=["Alice"])
        # Should not raise
        await agent.sync_to_knowledge_layer(output, "SC-01")

    @pytest.mark.asyncio
    async def test_sync_characters(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock()
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        output = WriterOutput(content="test", wordcount=4, characters_appeared=["Alice", "Bob"])
        await agent.sync_to_knowledge_layer(output, "SC-01")
        assert kl.add_entity.call_count >= 2

    @pytest.mark.asyncio
    async def test_sync_locations(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock()
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        output = WriterOutput(content="test", wordcount=4, locations=["Tower"])
        await agent.sync_to_knowledge_layer(output, "SC-01")
        assert kl.add_entity.called

    @pytest.mark.asyncio
    async def test_sync_foreshadows(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock()
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        output = WriterOutput(content="test", wordcount=4, foreshadows_planted=["mysterious letter"])
        await agent.sync_to_knowledge_layer(output, "SC-01")
        assert kl.add_entity.called

    @pytest.mark.asyncio
    async def test_sync_exception_silent(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock(side_effect=RuntimeError("db error"))
        agent = WriterAgent(llm=None, knowledge_layer=kl)
        output = WriterOutput(content="test", wordcount=4, characters_appeared=["Alice"])
        # Should not raise
        await agent.sync_to_knowledge_layer(output, "SC-01")

"""
Writer Agent 单元测试
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
from pathlib import Path
from langchain_core.runnables import RunnableLambda

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.writer import (
    WriterInput,
    WriterOutput,
    WriterAgent,
    create_writer_chain,
    create_writer_node,
    WRITER_SYSTEM_PROMPT
)


class TestWriterInput:
    """Writer输入数据模型测试"""
    
    def test_basic_input(self):
        """测试基本输入构建"""
        input_data = WriterInput(
            scene_id="CH01-SC01",
            chapter_num=1,
            pov_character="克莱恩",
            objective="调查案件",
            conflict="被人发现",
            outcome="-",
            plot_beat="潜入失败",
            emotional_arc="紧张→恐惧",
            sensory_guidance={"visual": "昏暗走廊"}
        )
        
        assert input_data.scene_id == "CH01-SC01"
        assert input_data.word_target == 2000  # 默认值
    
    def test_input_with_foreshadows(self):
        """测试包含伏笔任务的输入"""
        input_data = WriterInput(
            scene_id="CH01-SC01",
            chapter_num=1,
            pov_character="克莱恩",
            objective="调查",
            conflict="阻碍",
            outcome="+",
            plot_beat="测试",
            emotional_arc="测试",
            foreshadows_to_plant=["伏笔A", "伏笔B"],
            foreshadows_to_harvest=["伏笔C"]
        )
        
        assert len(input_data.foreshadows_to_plant) == 2
        assert "伏笔C" in input_data.foreshadows_to_harvest


class TestWriterOutput:
    """Writer输出数据模型测试"""
    
    def test_output_model(self):
        """测试输出模型"""
        output = WriterOutput(
            content="测试内容...",
            wordcount=100,
            characters_appeared=["克莱恩"],
            sensory_types_used=["visual", "auditory"]
        )
        
        assert output.wordcount == 100
        assert "visual" in output.sensory_types_used


class TestWriterSystemPrompt:
    """系统提示词测试"""
    
    def test_prompt_contains_dickensian_style(self):
        """测试提示词包含狄更斯风格指导"""
        assert "狄更斯" in WRITER_SYSTEM_PROMPT or "Dickens" in WRITER_SYSTEM_PROMPT
        assert "万物有灵" in WRITER_SYSTEM_PROMPT or "Animism" in WRITER_SYSTEM_PROMPT
    
    def test_prompt_contains_translation_tone(self):
        """测试提示词包含翻译腔指导"""
        assert "翻译腔" in WRITER_SYSTEM_PROMPT
    
    def test_prompt_contains_sensory_guidance(self):
        """测试提示词包含感官描写指导"""
        assert "感官" in WRITER_SYSTEM_PROMPT
        assert "视觉" in WRITER_SYSTEM_PROMPT or "听觉" in WRITER_SYSTEM_PROMPT
    
    def test_prompt_contains_forbidden_words(self):
        """测试提示词包含禁用词列表"""
        assert "突然" in WRITER_SYSTEM_PROMPT
        assert "不禁" in WRITER_SYSTEM_PROMPT


class TestWriterAgent:
    """Writer Agent 测试"""
    
    @pytest.fixture
    def mock_llm(self):
        """模拟LLM"""
        mock = MagicMock()
        mock.ainvoke = AsyncMock(return_value="雨水像鞭子一样抽打着窗户...")
        return mock
    
    def test_forbidden_words_detection(self, mock_llm):
        """测试禁用词检测"""
        agent = WriterAgent(mock_llm)
        
        # 模拟包含禁用词的内容
        content_with_forbidden = "他突然转身，不禁感到恐惧。"
        
        input_data = WriterInput(
            scene_id="TEST-01",
            chapter_num=1,
            pov_character="测试",
            objective="测试",
            conflict="测试",
            outcome="+",
            plot_beat="测试",
            emotional_arc="测试"
        )
        
        output = agent._post_process(content_with_forbidden, input_data)
        
        assert "突然" in output.forbidden_words_found
        assert "不禁" in output.forbidden_words_found
        assert len(output.sections_needing_review) > 0
    
    def test_sensory_detection(self, mock_llm):
        """测试感官描写检测"""
        agent = WriterAgent(mock_llm)
        
        content_with_sensory = """
        昏暗的光线透过窗帘洒落。
        远处传来钟声的回响。
        空气中弥漫着煤烟的气味。
        """
        
        input_data = WriterInput(
            scene_id="TEST-01",
            chapter_num=1,
            pov_character="测试",
            objective="测试",
            conflict="测试",
            outcome="+",
            plot_beat="测试",
            emotional_arc="测试"
        )
        
        output = agent._post_process(content_with_sensory, input_data)
        
        assert "visual" in output.sensory_types_used
        assert "auditory" in output.sensory_types_used
        # 应该有至少2种感官


class TestWriterChain:
    """Writer Chain 测试"""
    
    def test_chain_creation(self):
        """测试Chain创建"""
        mock_llm = MagicMock()
        
        chain = create_writer_chain(mock_llm)
        
        # Chain应该是一个可调用对象
        assert chain is not None
    
    @pytest.mark.asyncio
    async def test_chain_invocation(self, mocker):
        """测试Chain调用"""
        mock_llm = MagicMock()
        mock_response = MagicMock()
        mock_response.content = "生成的测试内容..."
        mock_llm.__or__ = MagicMock(return_value=mock_llm)
        
        # 这个测试主要验证不会抛出异常
        chain = create_writer_chain(mock_llm)
        assert chain is not None


class TestPromptChaining:
    """Prompt Chaining 测试"""

    def test_chain_templates_defined(self):
        """测试所有Chain模板都已定义"""
        from agents.writer import (
            CHAIN_SCENE_SETUP,
            CHAIN_CHARACTER_ENTRY,
            CHAIN_CONFLICT_DEVELOPMENT,
            CHAIN_RESOLUTION
        )

        assert "{location}" in CHAIN_SCENE_SETUP
        assert "{previous_content}" in CHAIN_CHARACTER_ENTRY
        assert "{conflict}" in CHAIN_CONFLICT_DEVELOPMENT
        assert "{outcome}" in CHAIN_RESOLUTION

    def test_chain_templates_have_structure(self):
        """测试Chain模板具有必要的结构"""
        from agents.writer import CHAIN_SCENE_SETUP

        assert "任务" in CHAIN_SCENE_SETUP or "##" in CHAIN_SCENE_SETUP
        assert "要求" in CHAIN_SCENE_SETUP


class TestWriterKnowledgeLayer:
    @pytest.mark.asyncio
    async def test_retrieve_context_disabled_returns_empty(self):
        agent = WriterAgent(MagicMock(), knowledge_layer=MagicMock(), enable_knowledge_retrieval=False)
        result = await agent.retrieve_context("query")
        assert result == {"entities": [], "relations": [], "memories": []}

    @pytest.mark.asyncio
    async def test_retrieve_context_filters_types_and_relations(self):
        kl = MagicMock()
        kl.search_entities = AsyncMock(return_value=[
            {"id": "c1", "name": "Alice", "type": "character"},
            {"id": "l1", "name": "Tower", "type": "location"},
        ])
        kl.get_related_entities = AsyncMock(return_value=[{"source": "Alice", "target": "Bob", "type": "friend"}])
        kl.search_memories = AsyncMock(return_value=[{"content": "Past event"}])

        agent = WriterAgent(MagicMock(), knowledge_layer=kl)
        result = await agent.retrieve_context("Alice", context_types=["character"], limit=5)

        assert len(result["entities"]) == 1
        assert result["entities"][0]["type"] == "character"
        assert len(result["relations"]) == 1
        assert len(result["memories"]) == 1

    @pytest.mark.asyncio
    async def test_retrieve_context_handles_exception(self):
        kl = MagicMock()
        kl.search_entities = AsyncMock(side_effect=RuntimeError("boom"))
        agent = WriterAgent(MagicMock(), knowledge_layer=kl)

        result = await agent.retrieve_context("Alice")

        assert result == {"entities": [], "relations": [], "memories": []}

    def test_build_knowledge_context_empty(self):
        agent = WriterAgent(MagicMock())
        assert agent._build_knowledge_context({"entities": [], "memories": []}) == ""

    def test_build_knowledge_context_renders_sections(self):
        agent = WriterAgent(MagicMock())
        text = agent._build_knowledge_context({
            "entities": [{"name": "Alice", "type": "character", "description": "hero"}],
            "relations": [{"source": "Alice", "target": "Bob", "type": "friend"}],
            "memories": [{"content": "Alice met Bob"}],
        })
        assert "知识库上下文" in text
        assert "Alice" in text
        assert "friend" in text

    @pytest.mark.asyncio
    async def test_write_with_knowledge_enhances_profiles_and_metadata(self):
        agent = WriterAgent(MagicMock(), knowledge_layer=MagicMock())
        agent.retrieve_context = AsyncMock(return_value={
            "entities": [
                {"name": "Eve", "type": "character", "description": "mysterious"},
                {"name": "Clock Tower", "type": "location", "description": "old"},
            ],
            "relations": [{"source": "Eve", "target": "Alice", "type": "ally"}],
            "memories": [{"content": "Eve once saved Alice"}],
        })
        mock_output = MagicMock()
        mock_output.metadata = {}
        agent.write = AsyncMock(return_value=mock_output)

        input_data = WriterInput(
            scene_id="S1",
            chapter_num=1,
            pov_character="Alice",
            objective="Find clue",
            conflict="Hidden enemy",
            outcome="+",
            plot_beat="beat",
            emotional_arc="calm→fear",
            character_profiles=[{"name": "Alice", "description": "lead"}],
        )

        output = await agent.write_with_knowledge(input_data)

        assert any(p.get("name") == "Eve" and p.get("source") == "knowledge_layer" for p in input_data.character_profiles)
        assert output.metadata["knowledge_retrieved"]["entities_count"] == 2
        assert output.metadata["knowledge_retrieved"]["relations_count"] == 1
        assert output.metadata["knowledge_retrieved"]["memories_count"] == 1
        agent.write.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_write_with_knowledge_does_not_duplicate_existing_character(self):
        agent = WriterAgent(MagicMock(), knowledge_layer=MagicMock())
        agent.retrieve_context = AsyncMock(return_value={
            "entities": [{"name": "Alice", "type": "character", "description": "lead"}],
            "relations": [],
            "memories": [],
        })
        agent.write = AsyncMock(return_value=WriterOutput(content="x", wordcount=1))

        input_data = WriterInput(
            scene_id="S2",
            chapter_num=1,
            pov_character="Alice",
            objective="Obj",
            conflict="Con",
            outcome="+",
            plot_beat="beat",
            emotional_arc="calm→calm",
            character_profiles=[{"name": "Alice", "description": "lead"}],
        )

        await agent.write_with_knowledge(input_data)

        assert len([p for p in input_data.character_profiles if p.get("name") == "Alice"]) == 1

    @pytest.mark.asyncio
    async def test_sync_to_knowledge_layer_adds_entities(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock(return_value=None)
        agent = WriterAgent(MagicMock(), knowledge_layer=kl)

        output = WriterOutput(
            content="text",
            wordcount=4,
            characters_appeared=["Alice", "Bob"],
            locations=["Tower"],
            foreshadows_planted=["A key clue"],
        )

        await agent.sync_to_knowledge_layer(output, "SC-1")

        assert kl.add_entity.await_count == 4

    @pytest.mark.asyncio
    async def test_sync_to_knowledge_layer_no_knowledge_layer(self):
        agent = WriterAgent(MagicMock(), knowledge_layer=None)
        output = WriterOutput(content="text", wordcount=4)
        await agent.sync_to_knowledge_layer(output, "SC-2")

    @pytest.mark.asyncio
    async def test_sync_to_knowledge_layer_swallows_exception(self):
        kl = MagicMock()
        kl.add_entity = AsyncMock(side_effect=RuntimeError("boom"))
        agent = WriterAgent(MagicMock(), knowledge_layer=kl)
        output = WriterOutput(content="text", wordcount=4, characters_appeared=["Alice"])

        await agent.sync_to_knowledge_layer(output, "SC-3")

class TestWriterExecutionPaths:
    def test_get_openai_proxy_config_missing_api_key(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com")
        agent = WriterAgent(MagicMock())
        assert agent._get_openai_proxy_config() is None

    def test_get_openai_proxy_config_normalizes_v1(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "k")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com")
        monkeypatch.setenv("OPENAI_MODEL", "model-x")
        agent = WriterAgent(MagicMock())
        cfg = agent._get_openai_proxy_config()
        assert cfg["base_url"] == "https://example.com/v1"
        assert cfg["model"] == "model-x"

    @pytest.mark.asyncio
    async def test_call_openai_proxy_success(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "k")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com/v1")

        class DummyResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": [{"message": {"content": "proxy result"}}]}

        with patch("agents.writer.requests.post", return_value=DummyResponse()) as mock_post:
            from langchain_core.messages import SystemMessage

            agent = WriterAgent(MagicMock())
            result = await agent._call_openai_proxy([SystemMessage(content="hi")])

            assert result == "proxy result"
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_continue_writing_uses_proxy_when_available(self):
        agent = WriterAgent(MagicMock())
        agent._get_openai_proxy_config = MagicMock(return_value={"api_key": "k", "base_url": "https://x/v1", "model": "m"})
        agent._call_openai_proxy = AsyncMock(return_value="continued by proxy")

        text = await agent.continue_writing("old", "next", allow_llm_fallback=True)

        assert text == "continued by proxy"
        agent._call_openai_proxy.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_continue_writing_no_llm_raises(self):
        agent = WriterAgent(None)
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="LLM not configured"):
            await agent.continue_writing("old", "next", allow_llm_fallback=False)

    @pytest.mark.asyncio
    async def test_write_runs_chaining_and_post_process(self):
        agent = WriterAgent(MagicMock())
        agent._run_chain = AsyncMock(side_effect=["s1", "s2", "s3", "s4"])

        input_data = WriterInput(
            scene_id="CH01-SC01",
            chapter_num=1,
            pov_character="Alice",
            objective="Find clue",
            conflict="Enemy appears",
            outcome="+",
            plot_beat="beat",
            emotional_arc="calm→fear",
            sensory_guidance={"location": "Street", "time": "Night", "atmosphere": "Fog"},
            character_profiles=[{"name": "Alice"}],
        )

        output = await agent.write(input_data)

class TestWriterFallbackAndSkills:
    @pytest.mark.asyncio
    async def test_run_chain_proxy_failure_falls_back_to_llm(self):
        llm = RunnableLambda(lambda _: "llm result")

        agent = WriterAgent(llm)
        agent._get_openai_proxy_config = MagicMock(return_value={"api_key": "k", "base_url": "https://x/v1", "model": "m"})
        agent._call_openai_proxy = AsyncMock(side_effect=RuntimeError("proxy down"))

        text = await agent._run_chain("test {x}", {"x": "v"}, allow_llm_fallback=True)

        assert text == "llm result"
        agent._call_openai_proxy.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_run_chain_raises_when_llm_fails_and_fallback_disabled(self):
        llm = RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed")))

        agent = WriterAgent(llm)
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="fallback disabled"):
            await agent._run_chain("test {x}", {"x": "v"}, allow_llm_fallback=False)

    @pytest.mark.asyncio
    async def test_run_chain_no_llm_raises(self):
        agent = WriterAgent(None)
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="LLM not configured"):
            await agent._run_chain("test {x}", {"x": "v"}, allow_llm_fallback=True)

    def test_inject_skills_without_loader_returns_empty(self):
        agent = WriterAgent(MagicMock(), skill_loader=None)
        text = agent.inject_skills(["skill-a"])
        assert text == ""

    def test_inject_skills_load_failure_is_swallowed(self):
        loader = MagicMock()
        loader.load_skill = MagicMock(side_effect=RuntimeError("bad skill"))
        agent = WriterAgent(MagicMock(), skill_loader=loader)

        text = agent.inject_skills(["skill-a"])

        assert text == ""

    def test_build_enhanced_prompt_when_no_skill_guidance(self):
        agent = WriterAgent(MagicMock())
        agent.inject_skills = MagicMock(return_value="")

        out = agent._build_enhanced_prompt("base prompt", ["x"])

        assert out == "base prompt"

    def test_build_enhanced_prompt_with_skill_guidance(self):
        agent = WriterAgent(MagicMock())
        agent.inject_skills = MagicMock(return_value="skill guidance")

        out = agent._build_enhanced_prompt("base prompt", ["x"])

        assert "base prompt" in out
        assert "skill guidance" in out

    @pytest.mark.asyncio
    async def test_write_injects_skills_from_world_settings(self):
        agent = WriterAgent(MagicMock())
        agent._run_chain = AsyncMock(side_effect=["a", "b", "c", "d"])
        agent.inject_skills = MagicMock(return_value="ok")

        input_data = WriterInput(
            scene_id="CH01-SC01",
            chapter_num=1,
            pov_character="Alice",
            objective="Obj",
            conflict="Con",
            outcome="+",
            plot_beat="beat",
            emotional_arc="calm→fear",
            world_settings={"recommended_skills": ["skill-a", "", 1]},
        )

        await agent.write(input_data)

        agent.inject_skills.assert_called_once_with(["skill-a"])


class TestWriterAdvancedExecution:
    @pytest.mark.asyncio
    async def test_continue_writing_proxy_failure_falls_back_to_llm(self):
        llm = RunnableLambda(lambda _: "from llm")

        agent = WriterAgent(llm)
        agent._get_openai_proxy_config = MagicMock(return_value={"api_key": "k", "base_url": "https://x/v1", "model": "m"})
        agent._call_openai_proxy = AsyncMock(side_effect=RuntimeError("proxy failed"))

        text = await agent.continue_writing("old", "hint", allow_llm_fallback=True)

        assert text == "from llm"

    @pytest.mark.asyncio
    async def test_continue_writing_llm_failure_with_fallback_disabled_raises(self):
        llm = RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed")))

        agent = WriterAgent(llm)
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="fallback disabled"):
            await agent.continue_writing("old", "hint", allow_llm_fallback=False)

    @pytest.mark.asyncio
    async def test_rewrite_section_uses_type_guidance(self):
        llm = RunnableLambda(lambda _: "rewritten")

        agent = WriterAgent(llm)

        out = await agent.rewrite_section("orig", "improve", rewrite_type="sensory")

        assert out == "rewritten"

    @pytest.mark.asyncio
    async def test_revise_success_sets_forbidden_words(self):
        llm = RunnableLambda(lambda _: "他突然停住脚步。")

        agent = WriterAgent(llm)
        output = await agent.revise(
            "draft",
            {"issues": ["x"], "suggestions": ["y"], "dimension_scores": {"style": 6}},
        )

        assert output.wordcount > 0
        assert "突然" in output.forbidden_words_found

    @pytest.mark.asyncio
    async def test_revise_without_llm_raises(self):
        agent = WriterAgent(None)

        with pytest.raises(RuntimeError, match="LLM not configured"):
            await agent.revise("draft", {}, allow_llm_fallback=True)

    @pytest.mark.asyncio
    async def test_revise_llm_failure_with_fallback_disabled_raises(self):
        llm = RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed")))

        agent = WriterAgent(llm)

        with pytest.raises(RuntimeError, match="fallback disabled"):
            await agent.revise("draft", {}, allow_llm_fallback=False)


class TestWriterNode:
    @pytest.mark.asyncio
    async def test_create_writer_node_maps_state_and_returns_updates(self):
        llm = MagicMock()
        output = WriterOutput(
            content="generated",
            wordcount=12,
            sensory_types_used=["visual"],
            forbidden_words_found=[],
            sections_needing_review=["x"],
        )

        with patch("agents.writer.WriterAgent.write", new=AsyncMock(return_value=output)):
            node = create_writer_node(llm)
            state = {
                "current_scene_card": {
                    "scene_id": "S-1",
                    "chapter_num": 2,
                    "pov_character": "Alice",
                    "objective": "Obj",
                    "conflict": "Con",
                    "outcome": "-",
                    "plot_beat": "beat",
                    "emotional_arc": "calm→fear",
                    "sensory_guidance": {"location": "Tower"},
                    "foreshadows_to_plant": ["A"],
                    "foreshadows_to_harvest": ["B"],
                },
                "character_profiles": [{"name": "Alice"}],
                "world_settings": {"k": "v"},
                "word_target": 900,
                "allow_llm_fallback": True,
            }

            result = await node(state)



class TestWriterRemainingBranches:
    def test_writer_input_normalizes_from_scene_card(self):
        input_data = WriterInput(
            scene_card={
                "scene_id": "SC-9",
                "chapter_num": 9,
                "pov_character": "Bob",
                "objective": "Find map",
                "conflict": "Locked door",
                "outcome": "-",
                "plot_beat": "beat",
                "emotional_arc": "calm→panic",
            }
        )

        assert input_data.scene_id == "SC-9"
        assert input_data.chapter_num == 9
        assert input_data.pov_character == "Bob"
        assert input_data.objective == "Find map"

    def test_writer_input_empty_outcome_and_emotional_arc_are_filled_from_scene_card(self):
        input_data = WriterInput(
            outcome="",
            emotional_arc="",
            scene_card={
                "outcome": "-",
                "emotional_arc": "cold→rage",
            },
        )

        assert input_data.outcome == "-"
        assert input_data.emotional_arc == "cold→rage"

    def test_get_openai_proxy_config_missing_base_url(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "k")
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
        monkeypatch.delenv("OPENAI_API_BASE", raising=False)
        agent = WriterAgent(MagicMock())
        assert agent._get_openai_proxy_config() is None

    @pytest.mark.asyncio
    async def test_call_openai_proxy_raises_when_config_missing(self):
        agent = WriterAgent(MagicMock())
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="config missing"):
            await agent._call_openai_proxy([])

    @pytest.mark.asyncio
    async def test_call_openai_proxy_raises_on_empty_choices(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "k")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com/v1")

        class DummyResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": []}

        with patch("agents.writer.requests.post", return_value=DummyResponse()):
            from langchain_core.messages import SystemMessage

            agent = WriterAgent(MagicMock())
            with pytest.raises(RuntimeError, match="empty choices"):
                await agent._call_openai_proxy([SystemMessage(content="hi")])

    @pytest.mark.asyncio
    async def test_call_openai_proxy_raises_on_empty_content(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "k")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com/v1")

        class DummyResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"choices": [{"message": {"content": ""}}]}

        with patch("agents.writer.requests.post", return_value=DummyResponse()):
            from langchain_core.messages import SystemMessage

            agent = WriterAgent(MagicMock())
            with pytest.raises(RuntimeError, match="empty content"):
                await agent._call_openai_proxy([SystemMessage(content="hi")])

    @pytest.mark.asyncio
    async def test_safe_call_sync_function_branch(self):
        agent = WriterAgent(MagicMock())

        def sync_func(x, y=0):
            return x + y

        out = await agent._safe_call(sync_func, 2, y=3)
        assert out == 5

    def test_inject_skills_success_path(self):
        loader = MagicMock()
        loader.load_skill = MagicMock(return_value={"name": "SkillA", "content": "Do X"})
        agent = WriterAgent(MagicMock(), skill_loader=loader)

        text = agent.inject_skills(["skill-a"])

        assert "SkillA" in text
        assert "Do X" in text

    @pytest.mark.asyncio
    async def test_run_chain_with_injected_skills_path(self):
        loader = MagicMock()
        loader.load_skill = MagicMock(return_value={"name": "SkillA", "content": "Do X"})
        agent = WriterAgent(RunnableLambda(lambda _: "ok"), skill_loader=loader)
        agent._injected_skills = ["skill-a"]

        out = await agent._run_chain("test {x}", {"x": "v"}, allow_llm_fallback=False)

        assert out == "ok"

    @pytest.mark.asyncio
    async def test_run_chain_llm_failure_with_fallback_enabled_reraises(self):
        agent = WriterAgent(RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed"))))
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="llm failed"):
            await agent._run_chain("test {x}", {"x": "v"}, allow_llm_fallback=True)

    def test_post_process_detects_tactile_and_characters(self):
        agent = WriterAgent(MagicMock())
        input_data = WriterInput(
            scene_id="S",
            chapter_num=1,
            pov_character="Alice",
            objective="x",
            conflict="y",
            outcome="+",
            plot_beat="b",
            emotional_arc="a→b",
            character_profiles=[{"name": "Alice"}],
        )

        output = agent._post_process("Alice 触到冰冷的墙。", input_data)

        assert "tactile" in output.sensory_types_used
        assert "Alice" in output.characters_appeared

    @pytest.mark.asyncio
    async def test_continue_writing_llm_failure_with_fallback_enabled_reraises(self):
        llm = RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed")))
        agent = WriterAgent(llm)
        agent._get_openai_proxy_config = MagicMock(return_value=None)

        with pytest.raises(RuntimeError, match="llm failed"):
            await agent.continue_writing("old", "hint", allow_llm_fallback=True)

    @pytest.mark.asyncio
    async def test_revise_llm_failure_with_fallback_enabled_reraises(self):
        llm = RunnableLambda(lambda _: (_ for _ in ()).throw(RuntimeError("llm failed")))
        agent = WriterAgent(llm)

        with pytest.raises(RuntimeError, match="llm failed"):
            await agent.revise("draft", {}, allow_llm_fallback=True)

"""
Writer Agent 单元测试
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.writer import (
    WriterInput,
    WriterOutput,
    WriterAgent,
    create_writer_chain,
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

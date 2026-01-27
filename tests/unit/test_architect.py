"""
Architect Agent 单元测试
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import json
from pathlib import Path

# 导入待测模块
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from agents.architect import (
    LOCKAnalysis,
    TwoDoorsStructure,
    SceneCard,
    StoryBlueprint,
    ArchitectAgent,
    create_architect_chain,
    ARCHITECT_SYSTEM_PROMPT
)


class TestLOCKAnalysis:
    """LOCK分析数据模型测试"""
    
    def test_lock_total_score(self):
        """测试LOCK总分计算"""
        lock = LOCKAnalysis(
            L_score=8, L_protagonist="艾琳", L_desire="找到母亲",
            L_pain_point="被抛弃的恐惧", L_unique_trait="能听懂猫语",
            O_score=7, O_short_term="逃离组织", O_long_term="揭开真相", O_measurable=True,
            C_score=9, C_external="神秘组织追杀", C_internal="自我怀疑", C_escalation="威胁升级",
            K_score=8, K_hooks=["钩子1", "钩子2"], K_transformation="从逃亡者到反击者"
        )
        
        assert lock.total_score == 32
        assert lock.is_valid == True  # >= 28
    
    def test_lock_invalid_when_low_score(self):
        """测试低分LOCK无效"""
        lock = LOCKAnalysis(
            L_score=5, L_protagonist="张三", L_desire="变强",
            L_pain_point="弱", L_unique_trait="无",
            O_score=5, O_short_term="修炼", O_long_term="巅峰", O_measurable=False,
            C_score=5, C_external="敌人", C_internal="无", C_escalation="无",
            K_score=5, K_hooks=[], K_transformation="变强"
        )
        
        assert lock.total_score == 20
        assert lock.is_valid == False  # < 28


class TestSceneCard:
    """场景卡片数据模型测试"""
    
    def test_valid_scene_id_format(self):
        """测试有效的场景ID格式"""
        scene = SceneCard(
            scene_id="CH01-SC01",
            chapter_num=1,
            scene_num=1,
            pov_character="艾琳",
            objective="获取情报",
            conflict="被发现",
            outcome="-",
            structural_function="Rising",
            emotional_arc="紧张→恐惧",
            sensory_guidance={"visual": "昏暗的走廊"},
            plot_beat="潜入失败"
        )
        
        assert scene.scene_id == "CH01-SC01"
    
    def test_invalid_scene_id_raises_error(self):
        """测试无效场景ID抛出错误"""
        with pytest.raises(ValueError, match="scene_id must be in format"):
            SceneCard(
                scene_id="chapter1-scene1",  # 错误格式
                chapter_num=1,
                scene_num=1,
                pov_character="艾琳",
                objective="测试",
                conflict="测试",
                outcome="+",
                structural_function="Test",
                emotional_arc="测试",
                sensory_guidance={},
                plot_beat="测试"
            )


class TestArchitectAgent:
    """Architect Agent 测试"""
    
    @pytest.fixture
    def mock_llm(self):
        """模拟LLM"""
        return MagicMock()
    
    @pytest.fixture
    def sample_golden_dataset(self, tmp_path):
        """创建测试用Golden Dataset"""
        dataset = [
            {
                "example_id": "test_sample",
                "analysis_lock": {
                    "L_Lead": {"score": 9, "protagonist": "克莱恩"}
                }
            }
        ]
        path = tmp_path / "golden_dataset.json"
        path.write_text(json.dumps(dataset, ensure_ascii=False))
        return str(path)
    
    def test_agent_loads_golden_dataset(self, mock_llm, sample_golden_dataset):
        """测试Agent能加载Golden Dataset"""
        agent = ArchitectAgent(mock_llm, sample_golden_dataset)
        
        assert len(agent.golden_dataset) == 1
        assert agent.golden_dataset[0]["example_id"] == "test_sample"
    
    def test_agent_handles_missing_golden_dataset(self, mock_llm):
        """测试Agent处理缺失的Golden Dataset"""
        agent = ArchitectAgent(mock_llm, "/nonexistent/path.json")
        
        assert agent.golden_dataset == []
    
    def test_system_prompt_contains_lock(self):
        """测试系统提示词包含LOCK相关内容"""
        assert "LOCK" in ARCHITECT_SYSTEM_PROMPT
        assert "Lead" in ARCHITECT_SYSTEM_PROMPT
        assert "Objective" in ARCHITECT_SYSTEM_PROMPT
        assert "Confrontation" in ARCHITECT_SYSTEM_PROMPT
        assert "Knockout" in ARCHITECT_SYSTEM_PROMPT
    
    def test_system_prompt_contains_two_doors(self):
        """测试系统提示词包含两扇门结构"""
        assert "两扇门" in ARCHITECT_SYSTEM_PROMPT or "第一扇门" in ARCHITECT_SYSTEM_PROMPT
        assert "不可回头" in ARCHITECT_SYSTEM_PROMPT or "不可逆转" in ARCHITECT_SYSTEM_PROMPT


class TestArchitectValidation:
    """Architect验证层测试"""
    
    @pytest.fixture
    def valid_blueprint(self):
        """创建有效的故事蓝图"""
        return StoryBlueprint(
            title="测试故事",
            genre="悬疑",
            logline="一个侦探寻找真相的故事",
            lock_analysis=LOCKAnalysis(
                L_score=8, L_protagonist="侦探", L_desire="找到真相",
                L_pain_point="失去搭档", L_unique_trait="推理能力",
                O_score=8, O_short_term="找到线索", O_long_term="破案", O_measurable=True,
                C_score=8, C_external="凶手", C_internal="自责", C_escalation="危险升级",
                K_score=8, K_hooks=["悬念"], K_transformation="成长"
            ),
            two_doors=TwoDoorsStructure(
                disturbance={"chapter": 1, "event": "发现尸体"},
                door_1={"chapter": 5, "event": "被卷入案件"},
                midpoint={"chapter": 15, "event": "假线索"},
                door_2={"chapter": 23, "event": "真相浮现"},
                climax={"chapter": 28, "event": "最终对决"}
            ),
            scene_cards=[
                SceneCard(
                    scene_id="CH01-SC01", chapter_num=1, scene_num=1,
                    pov_character="侦探", objective="调查", conflict="阻碍",
                    outcome="-", structural_function="Establishment",
                    emotional_arc="好奇→震惊", sensory_guidance={}, plot_beat="发现"
                )
            ],
            rhythm_analysis={"positive_scenes": 5, "negative_scenes": 5, "balance_score": 8, "warnings": []},
            target_chapters=30,
            target_wordcount=600000
        )
    
    def test_valid_blueprint_passes_validation(self, valid_blueprint, mock_llm):
        """测试有效蓝图通过验证"""
        agent = ArchitectAgent(mock_llm)
        
        # 不应抛出异常
        agent._validate(valid_blueprint)
    
    @pytest.fixture
    def mock_llm(self):
        return MagicMock()


class TestIntegration:
    """集成测试（需要真实LLM时跳过）"""
    
    @pytest.mark.skip(reason="需要真实LLM API")
    @pytest.mark.asyncio
    async def test_architect_generates_blueprint(self):
        """测试Architect生成完整蓝图"""
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        llm = ChatGoogleGenerativeAI(model="gemini-pro")
        agent = ArchitectAgent(llm)
        
        blueprint = await agent.plan(
            user_idea="一个穷困潦倒的侦探，在维多利亚时代的伦敦，意外获得了一本能看到未来的日记。",
            genre="悬疑",
            target_chapters=30
        )
        
        assert blueprint.lock_analysis.total_score >= 20
        assert len(blueprint.scene_cards) > 0

# -*- coding: utf-8 -*-
"""CriticEngine tests - all 5 evaluators, CriticEngine evaluate, hooks, plugins, from_config."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.narrative.critic_engine import (
    DimensionScore,
    EvaluationResult,
    DreamEvaluator,
    SuspenseEvaluator,
    CharacterEvaluator,
    PremiseEvaluator,
    VoiceEvaluator,
    CriticEngine,
)


class TestDimensionScore:
    def test_defaults(self):
        ds = DimensionScore(dimension="test", score=7.5, feedback="ok")
        assert ds.issues == []
        assert ds.highlights == []

    def test_with_data(self):
        ds = DimensionScore(dimension="d", score=5.0, feedback="f", issues=["i1"], highlights=["h1"])
        assert len(ds.issues) == 1
        assert len(ds.highlights) == 1


class TestDreamEvaluator:
    def test_high_score(self):
        text = "感受到仿佛画面沉浸真实细节氛围，一切都如此生动"
        result = DreamEvaluator().evaluate(text)
        assert result.dimension == "dream"
        assert result.score >= 7.0
        assert "优秀" in result.feedback

    def test_low_score(self):
        text = "告诉解释说明因为所以总之，这就是原因"
        result = DreamEvaluator().evaluate(text)
        assert result.score < 6.0
        assert len(result.issues) > 0

    def test_neutral(self):
        text = "一段普通的文字"
        result = DreamEvaluator().evaluate(text)
        assert 3.0 <= result.score <= 7.0

    def test_many_negatives(self):
        text = "告诉你因为所以总之解释说明，这就是原因"
        result = DreamEvaluator().evaluate(text)
        assert any("直白叙述" in i for i in result.issues)

    def test_few_positives(self):
        text = "简单的一句话"
        result = DreamEvaluator().evaluate(text)
        assert any("细节描写不足" in i for i in result.issues)


class TestSuspenseEvaluator:
    def test_high_tension(self):
        text = "突然意外竟然却但是然而，为什么怎么谁什么难道究竟，必须马上立刻"
        result = SuspenseEvaluator().evaluate(text)
        assert result.dimension == "suspense"
        assert result.score >= 7.0

    def test_low_tension(self):
        text = "平静的一天，什么都没有发生"
        result = SuspenseEvaluator().evaluate(text)
        assert result.score < 6.0
        assert any("缺少" in i for i in result.issues)

    def test_no_urgency(self):
        text = "突然意外竟然，但没有紧迫感"
        result = SuspenseEvaluator().evaluate(text)
        assert any("紧迫感" in i for i in result.issues)

    def test_feedback_high(self):
        text = "突然意外竟然却但是然而为什么怎么必须马上立刻紧急"
        result = SuspenseEvaluator().evaluate(text)
        assert "迫不及待" in result.feedback or "张力" in result.feedback


class TestCharacterEvaluator:
    def test_rich_character(self):
        text = '"你好"他说。"再见"她回答。他想了想，觉得心里很不安。他走了过去，她转身离开了。'
        result = CharacterEvaluator().evaluate(text)
        assert result.dimension == "character"
        assert result.score >= 5.0

    def test_flat_character(self):
        text = "天空很蓝，草地很绿"
        result = CharacterEvaluator().evaluate(text)
        assert result.score < 6.0
        assert any("对话" in i for i in result.issues)

    def test_no_psychology(self):
        text = '"你好"他说。"再见"她说。'
        result = CharacterEvaluator().evaluate(text)
        assert any("心理描写" in i for i in result.issues)


class TestPremiseEvaluator:
    def test_good_premise(self):
        text = "这个世界的规则是魔法需要遵循法则，因为原理决定了一切"
        result = PremiseEvaluator().evaluate(text)
        assert result.dimension == "premise"
        assert result.score >= 5.5

    def test_magic_without_rules(self):
        text = "他使用了魔法，一切都解决了"
        result = PremiseEvaluator().evaluate(text)
        assert any("超自然" in i for i in result.issues)

    def test_superpower_without_rules(self):
        text = "她的超能力非常强大"
        result = PremiseEvaluator().evaluate(text)
        assert any("超自然" in i for i in result.issues)

    def test_no_magic(self):
        text = "普通的现实世界故事"
        result = PremiseEvaluator().evaluate(text)
        assert len(result.issues) == 0


class TestVoiceEvaluator:
    def test_varied_voice(self):
        text = "短句。这是一个非常非常非常长的句子，包含了很多很多的内容和细节！像风一样自由。仿佛梦境。宛如星辰。"
        result = VoiceEvaluator().evaluate(text)
        assert result.dimension == "voice"
        assert result.score >= 5.0

    def test_monotone(self):
        text = "一句话。一句话。一句话。"
        result = VoiceEvaluator().evaluate(text)
        assert result.score <= 7.0

    def test_single_sentence(self):
        text = "只有一句话"
        result = VoiceEvaluator().evaluate(text)
        assert result.score >= 0


class TestCriticEngine:
    @pytest.fixture()
    def engine(self):
        return CriticEngine()

    @pytest.mark.asyncio
    async def test_evaluate_all_dimensions(self, engine):
        result = await engine.evaluate("突然他感受到了画面的沉浸感，心里想着为什么")
        dims = result["dimensions"]
        assert "dream" in dims
        assert "suspense" in dims
        assert "character" in dims
        assert "premise" in dims
        assert "voice" in dims
        assert "overall_score" in result

    @pytest.mark.asyncio
    async def test_evaluate_specific_dimensions(self, engine):
        result = await engine.evaluate("test content", dimensions=["dream", "voice"])
        dims = result["dimensions"]
        assert "dream" in dims
        assert "voice" in dims
        assert "suspense" not in dims

    @pytest.mark.asyncio
    async def test_evaluate_unknown_dimension_ignored(self, engine):
        result = await engine.evaluate("test", dimensions=["dream", "nonexistent"])
        dims = result["dimensions"]
        assert "dream" in dims
        assert "nonexistent" not in dims

    @pytest.mark.asyncio
    async def test_evaluate_low_score_recommends_skills(self, engine):
        # Very plain text should get low scores and skill recommendations
        result = await engine.evaluate("简单")
        assert "recommended_skills" in result

    def test_init_with_plugins(self):
        plugin = MagicMock()
        plugin.name = "test_plugin"
        engine = CriticEngine(plugins=[plugin])
        assert len(engine.plugins) == 1

    def test_register_duplicate_plugin(self):
        plugin = MagicMock()
        engine = CriticEngine(plugins=[plugin, plugin])
        assert len(engine.plugins) == 1

    @pytest.mark.asyncio
    async def test_initialize_plugin_error(self):
        plugin = MagicMock()
        plugin.name = "bad_plugin"
        plugin.load = AsyncMock(side_effect=RuntimeError("load fail"))
        engine = CriticEngine(plugins=[plugin])
        await engine.initialize()
        assert "bad_plugin" in engine._plugin_health

    @pytest.mark.asyncio
    async def test_health_check(self):
        plugin = MagicMock()
        plugin.name = "p1"
        plugin.health_check = AsyncMock(return_value={"status": "ok"})
        engine = CriticEngine(plugins=[plugin])
        result = await engine.health_check()
        assert result["engine"] == "primary"
        assert "p1" in result["plugins"]

    @pytest.mark.asyncio
    async def test_health_check_plugin_error(self):
        plugin = MagicMock()
        plugin.name = "bad"
        plugin.health_check = AsyncMock(side_effect=RuntimeError("fail"))
        engine = CriticEngine(plugins=[plugin])
        result = await engine.health_check()
        assert result["plugins"]["bad"]["status"] == "error"

    def test_from_config(self):
        with patch("src.narrative.critic_engine.get_config_value", return_value=True):
            engine = CriticEngine.from_config()
        assert engine.is_primary_engine is True

    @pytest.mark.asyncio
    async def test_before_hook(self):
        plugin = MagicMock()
        plugin.name = "hook"
        plugin.before_evaluate = AsyncMock(side_effect=lambda ctx: ctx)
        plugin.after_evaluate = AsyncMock(side_effect=lambda ctx: ctx)
        engine = CriticEngine(plugins=[plugin])
        await engine.evaluate("test")
        plugin.before_evaluate.assert_awaited_once()
        plugin.after_evaluate.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_hook_error_handled(self):
        plugin = MagicMock()
        plugin.name = "bad_hook"
        plugin.before_evaluate = AsyncMock(side_effect=RuntimeError("hook fail"))
        plugin.after_evaluate = AsyncMock(side_effect=RuntimeError("hook fail"))
        engine = CriticEngine(plugins=[plugin])
        result = await engine.evaluate("test")
        assert "overall_score" in result


class TestCriticEngineSuggestionsAndCompare:
    @pytest.fixture()
    def engine(self):
        return CriticEngine()

    @pytest.mark.asyncio
    async def test_suggest_improvements_maps_all_issue_categories(self, engine):
        issues = [
            "画面感不足",
            "沉浸感不够",
            "悬念偏弱",
            "对话太平",
            "设定不一致",
            "风格单一",
            "未知问题",
        ]

        suggestions = await engine.suggest_improvements("content", issues=issues, max_suggestions=10)

        assert len(suggestions) == len(issues)
        assert suggestions[0]["skill"] == "fictional-dream"
        assert suggestions[1]["skill"] == "fictional-dream"
        assert suggestions[2]["skill"] == "suspense-craft"
        assert suggestions[3]["skill"] == "character-forge"
        assert suggestions[4]["skill"] == "premise-magic"
        assert suggestions[5]["skill"] == "expression-craft"
        assert suggestions[6]["skill"] is None
        assert suggestions[6]["suggestion"] == "请参考相关技能包进行改进"

    @pytest.mark.asyncio
    async def test_suggest_improvements_uses_evaluation_issues_when_none(self, engine):
        with patch.object(engine, "evaluate", new=AsyncMock(return_value={"issues": ["心理描写不足", "逻辑欠缺"]})):
            suggestions = await engine.suggest_improvements("content", issues=None, max_suggestions=1)

        assert len(suggestions) == 1
        assert suggestions[0]["technique"] is None
        assert "深入角色内心" in suggestions[0]["suggestion"]

    @pytest.mark.asyncio
    async def test_compare_verdict_branches_and_dimension_intersection(self, engine):
        with patch.object(
            engine,
            "evaluate",
            new=AsyncMock(
                side_effect=[
                    {"overall_score": 70.0, "dimensions": {"dream": {"score": 6.0}, "voice": {"score": 5.0}}},
                    {"overall_score": 70.5, "dimensions": {"dream": {"score": 6.2}}},
                ]
            ),
        ):
            near = await engine.compare("a", "b")

        assert near["verdict"] == "两个版本质量相近"
        assert "dream" in near["dimension_changes"]
        assert "voice" not in near["dimension_changes"]

        with patch.object(
            engine,
            "evaluate",
            new=AsyncMock(
                side_effect=[
                    {"overall_score": 60.0, "dimensions": {"dream": {"score": 5.0}}},
                    {"overall_score": 61.0, "dimensions": {"dream": {"score": 6.5}}},
                ]
            ),
        ):
            improve = await engine.compare("a", "b")

        assert improve["verdict"] == "版本B优于版本A"
        assert improve["dimension_changes"]["dream"]["improved"] is True

        with patch.object(
            engine,
            "evaluate",
            new=AsyncMock(
                side_effect=[
                    {"overall_score": 80.0, "dimensions": {"dream": {"score": 8.0}}},
                    {"overall_score": 79.0, "dimensions": {"dream": {"score": 7.0}}},
                ]
            ),
        ):
            regress = await engine.compare("a", "b")

        assert regress["verdict"] == "版本A优于版本B"
        assert regress["dimension_changes"]["dream"]["improved"] is False


class TestFeedbackBranchLines:
    def test_suspense_feedback_mid_branch(self):
        msg = SuspenseEvaluator()._generate_feedback(6.5)
        assert "有一定的张力" in msg

    def test_character_feedback_high_branch(self):
        msg = CharacterEvaluator()._generate_feedback(8.2)
        assert "角色形象立体" in msg

    def test_premise_feedback_high_branch(self):
        msg = PremiseEvaluator()._generate_feedback(8.0)
        assert "设定清晰" in msg

    def test_voice_feedback_high_branch(self):
        msg = VoiceEvaluator()._generate_feedback(8.1)
        assert "风格鲜明" in msg


class TestFromConfigDisabled:
    def test_from_config_when_disabled(self):
        with patch("src.narrative.critic_engine.get_config_value", return_value=False):
            engine = CriticEngine.from_config()
        assert isinstance(engine, CriticEngine)

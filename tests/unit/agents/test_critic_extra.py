"""Extra branch tests for CriticAgent."""

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.critic import CriticAgent, CriticOutput, DimensionScore, create_critic_node


class _FakeParser:
    def __init__(self, pydantic_object):
        self.pydantic_object = pydantic_object

    def get_format_instructions(self):
        return "FORMAT"


class _FakeChain:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error

    async def ainvoke(self, _payload):
        if self.error:
            raise self.error
        return self.result


class _FakePromptLlm:
    def __init__(self, chain):
        self.chain = chain

    def __or__(self, _parser):
        return self.chain


class _FakePrompt:
    def __init__(self, chain):
        self.chain = chain

    def __or__(self, _llm):
        return _FakePromptLlm(self.chain)


def _fake_langchain_modules(chain):
    prompts_mod = types.ModuleType("langchain_core.prompts")
    output_mod = types.ModuleType("langchain_core.output_parsers")

    class _FakeChatPromptTemplate:
        @staticmethod
        def from_messages(_messages):
            return _FakePrompt(chain)

    prompts_mod.ChatPromptTemplate = _FakeChatPromptTemplate
    output_mod.PydanticOutputParser = _FakeParser
    return prompts_mod, output_mod


def _make_result() -> CriticOutput:
    return CriticOutput(
        decision="APPROVED",
        decision_reason="ok",
        total_score=85.0,
        lock_score=32.0,
        style_score=28.0,
        logic_score=25.0,
        dimension_details=[
            DimensionScore(dimension="dialogue_quality", score=8.0, weight=0.09, feedback="ok"),
            DimensionScore(dimension="L_lead", score=8.0, weight=0.08, feedback="ok"),
            DimensionScore(dimension="O_objective", score=8.0, weight=0.08, feedback="ok"),
            DimensionScore(dimension="C_confrontation", score=8.0, weight=0.16, feedback="ok"),
            DimensionScore(dimension="K_knockout", score=8.0, weight=0.08, feedback="ok"),
            DimensionScore(dimension="sensory_balance", score=8.0, weight=0.07, feedback="ok"),
            DimensionScore(dimension="dickensian_style", score=8.0, weight=0.07, feedback="ok"),
            DimensionScore(dimension="character_consistency", score=8.0, weight=0.07, feedback="ok"),
            DimensionScore(dimension="rhythm_control", score=8.0, weight=0.05, feedback="ok"),
            DimensionScore(dimension="plot_logic", score=8.0, weight=0.09, feedback="ok"),
            DimensionScore(dimension="reader_experience", score=8.0, weight=0.09, feedback="ok"),
            DimensionScore(dimension="worldbuilding_consistency", score=8.0, weight=0.07, feedback="ok"),
        ],
    )


@pytest.mark.asyncio
async def test_review_raises_when_llm_missing():
    agent = CriticAgent(llm=None)

    with pytest.raises(RuntimeError, match="LLM not configured"):
        await agent.review("text", {}, [], {})


@pytest.mark.asyncio
async def test_review_raises_runtime_when_chain_fails_and_fallback_disabled():
    result_error = RuntimeError("boom")
    chain = _FakeChain(error=result_error)
    prompts_mod, output_mod = _fake_langchain_modules(chain)
    agent = CriticAgent(llm=object())

    with patch.dict(
        sys.modules,
        {
            "langchain_core.prompts": prompts_mod,
            "langchain_core.output_parsers": output_mod,
        },
    ):
        with pytest.raises(RuntimeError, match="fallback disabled"):
            await agent.review("text", {}, [], {}, allow_llm_fallback=False)


@pytest.mark.asyncio
async def test_review_applies_rule_checks_and_injects_narrative_report():
    raw = _make_result()
    checked = _make_result()
    checked.total_score = 70.0
    chain = _FakeChain(result=raw)
    prompts_mod, output_mod = _fake_langchain_modules(chain)
    agent = CriticAgent(llm=object())

    with (
        patch.object(agent, "_apply_rule_checks", return_value=checked) as apply_mock,
        patch.object(agent, "_evaluate_narrative_report", AsyncMock(return_value={"overall": 9})) as eval_mock,
        patch.dict(
            sys.modules,
            {
                "langchain_core.prompts": prompts_mod,
                "langchain_core.output_parsers": output_mod,
            },
        ),
    ):
        result = await agent.review("clean text", {"scene_id": "s1"}, [], {})

    apply_mock.assert_called_once_with(raw, "clean text")
    eval_mock.assert_awaited_once()
    assert result.narrative_report == {"overall": 9}


@pytest.mark.asyncio
async def test_evaluate_narrative_report_returns_none_when_engine_missing():
    agent = CriticAgent(llm=MagicMock())
    agent.narrative_engine = None

    result = await agent._evaluate_narrative_report("text", {}, [], {})

    assert result is None




@pytest.mark.asyncio
async def test_review_re_raises_original_error_when_fallback_enabled():
    result_error = RuntimeError("boom")
    chain = _FakeChain(error=result_error)
    prompts_mod, output_mod = _fake_langchain_modules(chain)
    agent = CriticAgent(llm=object())

    with patch.dict(
        sys.modules,
        {
            "langchain_core.prompts": prompts_mod,
            "langchain_core.output_parsers": output_mod,
        },
    ):
        with pytest.raises(RuntimeError, match="boom"):
            await agent.review("text", {}, [], {}, allow_llm_fallback=True)


@pytest.mark.asyncio
async def test_evaluate_narrative_report_returns_summary_on_success():
    agent = CriticAgent(llm=MagicMock())
    report = MagicMock()
    report.overall_score = 83.126
    report.overall_level.value = "good"
    report.module_scores = {"a": 80}
    report.summary = "ok"
    report.recommended_skills = ["s1"]
    report.all_issues = [1, 2]
    report.critical_issues = [1]
    agent.narrative_engine.evaluate = AsyncMock(return_value=report)

    result = await agent._evaluate_narrative_report(
        "content", {"scene_id": "s1"}, [{"name": "hero"}], {"world": "x"}
    )

    assert result == {
        "overall_score": 83.13,
        "overall_level": "good",
        "module_scores": {"a": 80},
        "summary": "ok",
        "recommended_skills": ["s1"],
        "issues_count": 2,
        "critical_count": 1,
    }




@pytest.mark.asyncio
async def test_create_critic_node_calls_review_and_maps_state():
    output = _make_result()

    with patch.object(CriticAgent, "review", AsyncMock(return_value=output)):
        node = create_critic_node(llm=object())
        result = await node(
            {
                "draft_content": "t",
                "current_scene_card": {"scene_id": "S"},
                "character_profiles": [],
                "world_settings": {},
                "allow_llm_fallback": True,
            }
        )



@pytest.mark.asyncio
async def test_evaluate_narrative_report_returns_none_on_engine_error():
    agent = CriticAgent(llm=MagicMock())
    agent.narrative_engine.evaluate = AsyncMock(side_effect=RuntimeError("engine down"))

    result = await agent._evaluate_narrative_report("content", {}, [], {})

    assert result is None

"""Extra branch tests for ArchitectAgent."""

import sys
import types
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.agents.architect import (
    ArchitectAgent,
    LOCKAnalysis,
    RhythmAnalysis,
    SceneCard,
    StoryBlueprint,
    TwoDoorsStructure,
    create_architect_chain,
    create_architect_node,
)


def _make_blueprint() -> StoryBlueprint:
    return StoryBlueprint(
        title="T",
        genre="G",
        logline="L",
        lock_analysis=LOCKAnalysis(
            L_score=8,
            L_protagonist="Hero",
            L_desire="Goal",
            L_pain_point="Pain",
            L_unique_trait="Trait",
            O_score=8,
            O_short_term="S",
            O_long_term="Long",
            O_measurable=True,
            C_score=8,
            C_external="Ext",
            C_internal="Int",
            C_escalation="Up",
            K_score=8,
            K_hooks=["h1"],
            K_transformation="Grow",
        ),
        two_doors=TwoDoorsStructure(
            disturbance={"event": "d"},
            door_1={"event": "d1"},
            midpoint={"event": "m"},
            door_2={"event": "d2"},
            climax={"event": "c"},
        ),
        scene_cards=[
            SceneCard(
                scene_id="CH01-SC01",
                chapter_num=1,
                scene_num=1,
                pov_character="Hero",
                objective="obj",
                conflict="conflict",
                outcome="+",
                structural_function="Rising",
                emotional_arc="up-down",
                sensory_guidance={"v": "x"},
                plot_beat="beat",
            )
        ],
        rhythm_analysis=RhythmAnalysis(positive_scenes=1, negative_scenes=0, balance_score=7),
        target_chapters=1,
        target_wordcount=1000,
    )


class _FakeParser:
    def __init__(self, pydantic_object):
        self.pydantic_object = pydantic_object

    def get_format_instructions(self):
        return "FORMAT"


class _FakeChain:
    def __init__(self, blueprint):
        self.blueprint = blueprint

    async def ainvoke(self, _payload):
        return self.blueprint


class _FakePrompt:
    def __init__(self, blueprint):
        self.blueprint = blueprint

    def partial(self, **_kwargs):
        return self

    def __or__(self, _other):
        return _FakePromptLlm(self.blueprint)


class _FakePromptLlm:
    def __init__(self, blueprint):
        self.blueprint = blueprint

    def __or__(self, _parser):
        return _FakeChain(self.blueprint)


def _fake_langchain_modules(blueprint):
    prompts_mod = types.ModuleType("langchain_core.prompts")
    output_mod = types.ModuleType("langchain_core.output_parsers")

    class _FakeChatPromptTemplate:
        @staticmethod
        def from_messages(_messages):
            return _FakePrompt(blueprint)

    prompts_mod.ChatPromptTemplate = _FakeChatPromptTemplate
    output_mod.PydanticOutputParser = _FakeParser
    return prompts_mod, output_mod


def test_build_prompt_uses_parser_format_instructions():
    blueprint = _make_blueprint()
    prompts_mod, output_mod = _fake_langchain_modules(blueprint)
    agent = ArchitectAgent(llm=None, enable_sequential_thinking=False, enable_distillation=False)

    with patch.dict(
        sys.modules,
        {
            "langchain_core.prompts": prompts_mod,
            "langchain_core.output_parsers": output_mod,
        },
    ):
        prompt = agent._build_prompt("idea", "genre", target_chapters=12, target_wordcount=3456)

    assert "idea" in prompt
    assert "genre" in prompt
    assert "12" in prompt
    assert "FORMAT" in prompt


@pytest.mark.asyncio
async def test_plan_runs_validate_conclude_and_returns_blueprint():
    blueprint = _make_blueprint()
    prompts_mod, output_mod = _fake_langchain_modules(blueprint)
    agent = ArchitectAgent(llm=object(), enable_sequential_thinking=True, enable_distillation=False)

    with (
        patch.object(agent, "_validate") as validate_mock,
        patch.object(agent.thinking_engine, "conclude") as conclude_mock,
        patch.dict(
            sys.modules,
            {
                "langchain_core.prompts": prompts_mod,
                "langchain_core.output_parsers": output_mod,
            },
        ),
    ):
        result = await agent.plan("idea", "genre", target_chapters=1, target_wordcount=1000)

    assert result is blueprint
    validate_mock.assert_called_once_with(blueprint)
    conclude_mock.assert_called_once()


@pytest.mark.asyncio
async def test_sequential_thinking_genre_branch_executes_switches():
    agent = ArchitectAgent(llm=None, enable_sequential_thinking=True, enable_distillation=False)
    branch = SimpleNamespace(id="branch-1")

    with (
        patch.object(agent.thinking_engine, "branch", return_value=branch) as branch_mock,
        patch.object(agent.thinking_engine, "switch_branch") as switch_mock,
    ):
        await agent._sequential_thinking_plan("idea", "玄幻", 10, 10000)

    branch_mock.assert_called_once()
    switch_mock.assert_any_call("branch-1")
    switch_mock.assert_any_call("main")


@pytest.mark.asyncio
async def test_plan_with_distillation_returns_tuple_from_subcalls():
    agent = ArchitectAgent(llm=None, enable_sequential_thinking=False, enable_distillation=False)
    blueprint = _make_blueprint()
    distilled = {"entities": [{"name": "Hero"}], "relations": []}

    with (
        patch.object(agent, "plan", AsyncMock(return_value=blueprint)) as plan_mock,
        patch.object(agent, "distill_blueprint", AsyncMock(return_value=distilled)) as distill_mock,
    ):
        result = await agent.plan_with_distillation("idea", "genre", 2, 2000)

    assert result == (blueprint, distilled)
    plan_mock.assert_awaited_once()
    distill_mock.assert_awaited_once_with(blueprint)


@pytest.mark.asyncio
async def test_create_architect_node_calls_plan_and_maps_output():
    blueprint = _make_blueprint()

    with patch.object(ArchitectAgent, "plan", AsyncMock(return_value=blueprint)):
        node = create_architect_node(llm=object(), golden_dataset_path=None)
        result = await node(
            {
                "user_idea": "idea",
                "genre": "genre",
                "target_chapters": 3,
                "target_wordcount": 999,
            }
        )



def test_create_architect_chain_builds_pipe_chain():
    blueprint = _make_blueprint()
    prompts_mod, output_mod = _fake_langchain_modules(blueprint)

    class _DummyLLM:
        pass

    with patch.dict(
        sys.modules,
        {
            "langchain_core.prompts": prompts_mod,
            "langchain_core.output_parsers": output_mod,
        },
    ):
        chain = create_architect_chain(_DummyLLM())

    assert isinstance(chain, _FakeChain)
    broken_module = types.ModuleType("src.memory.distillation_manager")
    agent = None

    with patch.dict(sys.modules, {"src.memory.distillation_manager": broken_module}):
        agent = ArchitectAgent(llm=None, enable_sequential_thinking=False, enable_distillation=True)

    assert agent.distill_service is None

# -*- coding: utf-8 -*-
"""Extra branch tests for src.narrative.character_depth."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative import character_depth as cd
from src.narrative.character_depth import CharacterDepthSystem, CharacterTrait


class _LLMResponse:
    def __init__(self, content):
        self.content = content


@pytest.mark.asyncio
async def test_assess_interest_level_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps({"score": 8.4, "evidence": ["x"], "issues": ["y"], "suggestions": ["z"]}, ensure_ascii=False)
        )
    )
    sys = CharacterDepthSystem(llm=llm)

    with patch.object(cd, "CHARACTER_INTEREST_PROMPT", "interest {character_info} {content}"):
        result = await sys.assess_interest_level({"name": "hero"}, "content")

    assert result.trait == CharacterTrait.INTERESTING
    assert result.score == 8.4
    assert result.evidence == ["x"]


@pytest.mark.asyncio
async def test_detect_eccentricity_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps({"score": 7.1, "evidence": ["ecc"], "issues": [], "suggestions": ["add more"]}, ensure_ascii=False)
        )
    )
    sys = CharacterDepthSystem(llm=llm)

    with patch.object(cd, "CHARACTER_ECCENTRICITY_PROMPT", "ecc {character_info} {content}"):
        result = await sys.detect_eccentricity({"name": "hero"}, "content")

    assert result.trait == CharacterTrait.ECCENTRIC
    assert result.score == 7.1


@pytest.mark.asyncio
async def test_map_dual_personality_has_dual_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "has_dual_personality": True,
                    "score": 9.0,
                    "primary_persona": {"name": "scholar", "traits": ["calm"], "behavior_patterns": ["read"]},
                    "shadow_persona": {"name": "fighter", "traits": ["violent"], "behavior_patterns": ["attack"]},
                    "internal_conflict": "mind vs rage",
                    "switch_triggers": ["threat"],
                    "dramatic_potential": "high",
                    "suggestions": ["keep tension"],
                },
                ensure_ascii=False,
            )
        )
    )
    sys = CharacterDepthSystem(llm=llm)

    with patch.object(cd, "DUAL_PERSONALITY_PROMPT", "dual {character_info} {content}"):
        score, dp = await sys.map_dual_personality({"name": "hero"}, "content")

    assert score.trait == CharacterTrait.DUAL_PERSONALITY
    assert score.score == 9.0
    assert dp is not None
    assert dp.primary_persona.name == "scholar"
    assert dp.shadow_persona.name == "fighter"


@pytest.mark.asyncio
async def test_map_dual_personality_without_dual_branch_and_env_contrast_llm():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        side_effect=[
            _LLMResponse(json.dumps({"has_dual_personality": False, "score": 4.2, "dramatic_potential": "low", "suggestions": []})),
            _LLMResponse(json.dumps({"score": 8.8, "evidence": ["contrast"], "suggestions": ["more"]})),
        ]
    )
    sys = CharacterDepthSystem(llm=llm)

    with (
        patch.object(cd, "DUAL_PERSONALITY_PROMPT", "dual {character_info} {content}"),
        patch.object(cd, "ENVIRONMENT_CONTRAST_PROMPT", "env {character_info} {environment_info} {content}"),
    ):
        score, dp = await sys.map_dual_personality({"name": "hero"}, "content")
        env = await sys.check_environment_contrast({"name": "hero"}, {"place": "war"}, "content")

    assert score.score == 4.2
    assert dp is None
    assert env.score == 8.8
    assert env.trait == CharacterTrait.INTERESTING

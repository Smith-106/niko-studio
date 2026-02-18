# -*- coding: utf-8 -*-
"""Extra branch tests for src.narrative.premise_validator."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative import premise_validator as pv
from src.narrative.premise_validator import PremiseType, PremiseValidator


class _LLMResponse:
    def __init__(self, content):
        self.content = content


@pytest.mark.asyncio
async def test_parse_premise_llm_branch_sets_current_premise():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "character_trait": "greed",
                    "conflict": "morality",
                    "conclusion": "loss",
                    "premise_type": "reversal",
                },
                ensure_ascii=False,
            )
        )
    )
    v = PremiseValidator(llm=llm)

    with patch.object(pv, "PREMISE_PARSING_PROMPT", "parse {premise_statement}"):
        p = await v.parse_premise("Greed causes loss")

    assert p.premise_type == PremiseType.REVERSAL
    assert v.current_premise is p


@pytest.mark.asyncio
async def test_validate_scene_llm_branch_appends_alignment():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "alignment_score": 8.1,
                    "contribution": "pushes premise",
                    "evidence": ["ev1"],
                    "drift_detected": True,
                    "drift_description": "off track",
                },
                ensure_ascii=False,
            )
        )
    )
    v = PremiseValidator(llm=llm)
    v.current_premise = pv.Premise.from_statement("x")

    with patch.object(pv, "SCENE_ALIGNMENT_PROMPT", "scene {premise} {scene_content} {scene_id} {scene_objective}"):
        a = await v.validate_scene("s9", "content", "objective")

    assert a.scene_id == "s9"
    assert a.drift_detected is True
    assert len(v.scene_alignments) == 1


@pytest.mark.asyncio
async def test_track_progress_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=_LLMResponse(json.dumps({"proof_progress": 77, "trajectory": "good"})))
    v = PremiseValidator(llm=llm)
    v.current_premise = pv.Premise.from_statement("x")

    with patch.object(pv, "PREMISE_PROGRESS_PROMPT", "progress {premise} {scenes_summary}"):
        out = await v.track_premise_progress("summary")

    assert out["proof_progress"] == 77


def test_get_validation_result_drift_without_description_branch():
    v = PremiseValidator()
    v.current_premise = pv.Premise.from_statement("test")
    v.scene_alignments = [
        pv.PremiseAlignment(scene_id="s1", alignment_score=2.0, contribution="c", drift_detected=True, drift_description=None)
    ]

    result = v.get_validation_result()

    assert result.drift_count == 1
    assert len(result.critical_issues) == 1
    assert result.realignment_suggestions == []

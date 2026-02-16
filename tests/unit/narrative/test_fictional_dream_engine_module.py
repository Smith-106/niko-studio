# -*- coding: utf-8 -*-
"""`src.narrative.fictional_dream` 覆盖测试。"""

import importlib.util
import json
import sys
from pathlib import Path

import pytest


_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_MODULE_PATH = _PROJECT_ROOT / "src" / "narrative" / "fictional_dream.py"
_SPEC = importlib.util.spec_from_file_location("src.narrative.fictional_dream", _MODULE_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_MODULE = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _MODULE
_SPEC.loader.exec_module(_MODULE)

FictionalDreamEngine = _MODULE.FictionalDreamEngine
FictionalDreamResult = _MODULE.FictionalDreamResult
ImmersionScore = _MODULE.ImmersionScore
ImmersionStage = _MODULE.ImmersionStage

def _score(stage: ImmersionStage, value: float) -> ImmersionScore:
    return ImmersionScore(stage=stage, score=value)


def test_fictional_dream_result_strength_thresholds():
    strong = FictionalDreamResult(
        sympathy_score=_score(ImmersionStage.SYMPATHY, 8.5),
        identification_score=_score(ImmersionStage.IDENTIFICATION, 8.5),
        empathy_score=_score(ImmersionStage.EMPATHY, 8.5),
        immersion_score=_score(ImmersionStage.IMMERSION, 8.5),
    )
    assert strong.overall_score == pytest.approx(85.0)
    assert strong.dream_strength == "HYPNOTIC"

    moderate = FictionalDreamResult(
        sympathy_score=_score(ImmersionStage.SYMPATHY, 7.0),
        identification_score=_score(ImmersionStage.IDENTIFICATION, 7.0),
        empathy_score=_score(ImmersionStage.EMPATHY, 7.0),
        immersion_score=_score(ImmersionStage.IMMERSION, 7.0),
    )
    assert moderate.overall_score == pytest.approx(70.0)
    assert moderate.dream_strength == "STRONG"

    weak = FictionalDreamResult(
        sympathy_score=_score(ImmersionStage.SYMPATHY, 5.0),
        identification_score=_score(ImmersionStage.IDENTIFICATION, 5.0),
        empathy_score=_score(ImmersionStage.EMPATHY, 5.0),
        immersion_score=_score(ImmersionStage.IMMERSION, 5.0),
    )
    assert weak.overall_score == pytest.approx(50.0)
    assert weak.dream_strength == "MODERATE"

    broken = FictionalDreamResult(
        sympathy_score=_score(ImmersionStage.SYMPATHY, 4.9),
        identification_score=_score(ImmersionStage.IDENTIFICATION, 4.9),
        empathy_score=_score(ImmersionStage.EMPATHY, 4.9),
        immersion_score=_score(ImmersionStage.IMMERSION, 4.9),
    )
    assert broken.dream_strength == "WEAK"


@pytest.mark.asyncio
async def test_engine_uses_mock_scores_without_llm():
    engine = FictionalDreamEngine(llm=None)

    s = await engine.evaluate_sympathy("text", {"name": "A"})
    i = await engine.evaluate_identification("text", "goal")
    e = await engine.evaluate_empathy("text")
    im = await engine.evaluate_immersion("text")

    assert s.stage is ImmersionStage.SYMPATHY
    assert i.stage is ImmersionStage.IDENTIFICATION
    assert e.stage is ImmersionStage.EMPATHY
    assert im.stage is ImmersionStage.IMMERSION


class _Resp:
    def __init__(self, content: str):
        self.content = content


class _FakeLLM:
    def __init__(self, payloads):
        self.payloads = payloads
        self.prompts = []

    async def ainvoke(self, prompt):
        self.prompts.append(prompt)
        payload = self.payloads[len(self.prompts) - 1]
        return _Resp(json.dumps(payload, ensure_ascii=False))


@pytest.mark.asyncio
async def test_engine_uses_llm_json_for_each_stage():
    llm = _FakeLLM(
        [
            {"score": 9, "evidence": ["s"], "issues": [], "suggestions": ["s1"]},
            {"score": 8, "evidence": ["i"], "issues": ["i-issue"], "suggestions": []},
            {"score": 7, "evidence": ["e"], "issues": [], "suggestions": []},
            {"score": 6, "evidence": ["im"], "issues": [], "suggestions": []},
        ]
    )
    engine = FictionalDreamEngine(llm=llm)

    sympathy = await engine.evaluate_sympathy("content", {"role": "hero"})
    identification = await engine.evaluate_identification("content", "save world")
    empathy = await engine.evaluate_empathy("content")
    immersion = await engine.evaluate_immersion("content")

    assert sympathy.score == 9
    assert identification.issues == ["i-issue"]
    assert empathy.evidence == ["e"]
    assert immersion.score == 6
    assert len(llm.prompts) == 4


@pytest.mark.asyncio
async def test_evaluate_full_collects_critical_gaps(monkeypatch):
    engine = FictionalDreamEngine(llm=None)

    async def fake_sympathy(_content, _info):
        return ImmersionScore(stage=ImmersionStage.SYMPATHY, score=4.0)

    async def fake_identification(_content, _goal):
        return ImmersionScore(stage=ImmersionStage.IDENTIFICATION, score=3.0)

    async def fake_empathy(_content):
        return ImmersionScore(stage=ImmersionStage.EMPATHY, score=6.0)

    async def fake_immersion(_content):
        return ImmersionScore(stage=ImmersionStage.IMMERSION, score=7.0)

    monkeypatch.setattr(engine, "evaluate_sympathy", fake_sympathy)
    monkeypatch.setattr(engine, "evaluate_identification", fake_identification)
    monkeypatch.setattr(engine, "evaluate_empathy", fake_empathy)
    monkeypatch.setattr(engine, "evaluate_immersion", fake_immersion)

    result = await engine.evaluate_full("x", {"name": "n"}, "g")

    assert result.overall_score == pytest.approx(53.0)
    assert result.dream_strength == "MODERATE"
    assert len(result.critical_gaps) == 2
    assert "sympathy" in result.critical_gaps[0]

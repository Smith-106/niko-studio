# -*- coding: utf-8 -*-
"""Extra branch tests for src.narrative.narrative_voice."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative import narrative_voice as nv
from src.narrative.narrative_voice import NarrativeVoiceManager


class _LLMResponse:
    def __init__(self, content):
        self.content = content


@pytest.mark.asyncio
async def test_analyze_voice_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "detail_specificity": 8.0,
                    "sensory_richness": 7.0,
                    "voice_confidence": 6.0,
                    "author_presence": 9.0,
                },
                ensure_ascii=False,
            )
        )
    )
    mgr = NarrativeVoiceManager(llm=llm)

    with patch.object(nv, "VOICE_ANALYSIS_PROMPT", "voice {content}"):
        metrics = await mgr.analyze_voice("content")

    assert metrics.detail_specificity == 8.0
    assert metrics.author_presence == 9.0


@pytest.mark.asyncio
async def test_identify_weak_passages_llm_branch_caches_strong_passages():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "weak_passages": [
                        {
                            "location": "p1",
                            "original_text": "old",
                            "issue": "vague",
                            "suggestion": "detail",
                            "improved_example": "new",
                        }
                    ],
                    "strong_passages": ["s1", "s2"],
                },
                ensure_ascii=False,
            )
        )
    )
    mgr = NarrativeVoiceManager(llm=llm)

    with patch.object(nv, "WEAK_PASSAGE_DETECTION_PROMPT", "weak {content}"):
        weak = await mgr.identify_weak_passages("content")

    assert len(weak) == 1
    assert weak[0].location == "p1"
    assert mgr._last_strong_passages == ["s1", "s2"]


@pytest.mark.asyncio
async def test_extract_strong_passages_llm_branch_without_cache():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=_LLMResponse(json.dumps({"strong_passages": ["A"]})))
    mgr = NarrativeVoiceManager(llm=llm)

    with patch.object(nv, "WEAK_PASSAGE_DETECTION_PROMPT", "weak {content}"):
        strong = await mgr.extract_strong_passages("content")

    assert strong == ["A"]


@pytest.mark.asyncio
async def test_analyze_full_llm_branch_uses_cached_strong_passages():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        side_effect=[
            _LLMResponse(
                json.dumps(
                    {
                        "detail_specificity": 7.0,
                        "sensory_richness": 7.0,
                        "voice_confidence": 7.0,
                        "author_presence": 7.0,
                    }
                )
            ),
            _LLMResponse(
                json.dumps(
                    {
                        "weak_passages": [
                            {
                                "location": "p2",
                                "original_text": "x",
                                "issue": "y",
                                "suggestion": "z",
                            }
                        ],
                        "strong_passages": ["cached-strong"],
                    }
                )
            ),
        ]
    )
    mgr = NarrativeVoiceManager(llm=llm)

    with (
        patch.object(nv, "VOICE_ANALYSIS_PROMPT", "voice {content}"),
        patch.object(nv, "WEAK_PASSAGE_DETECTION_PROMPT", "weak {content}"),
    ):
        result = await mgr.analyze_full("content")

    assert result.strong_passages == ["cached-strong"]
    assert len(result.weak_passages) == 1

# -*- coding: utf-8 -*-
"""Extra branch tests for suspense_analyzer LLM paths."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative import suspense_analyzer as sa
from src.narrative.suspense_analyzer import SuspenseAnalyzer, SuspensePillar


class _LLMResponse:
    def __init__(self, content):
        self.content = content


@pytest.mark.asyncio
async def test_detect_story_questions_with_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "questions": [
                        {"question": "他会不会失败？", "location": "开篇", "intensity": 8.5}
                    ],
                    "score": 8.0,
                    "issues": ["问题数量可再增加"],
                    "suggestions": ["增加更强钩子"],
                },
                ensure_ascii=False,
            )
        )
    )
    analyzer = SuspenseAnalyzer(llm=llm)

    with patch.object(sa, "STORY_QUESTION_PROMPT", "story {content}"):
        result = await analyzer.detect_story_questions("content")

    assert result.pillar == SuspensePillar.STORY_QUESTION
    assert result.score == 8.0
    assert len(result.elements) == 1
    assert result.elements[0].question == "他会不会失败？"


@pytest.mark.asyncio
async def test_analyze_threat_situations_with_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "threats": [
                        {
                            "threat_type": "physical",
                            "description": "炸弹即将爆炸",
                            "target_character": "hero",
                            "intensity": 9.2,
                        }
                    ],
                    "score": 9.0,
                    "issues": [],
                    "suggestions": ["让后果更具体"],
                },
                ensure_ascii=False,
            )
        )
    )
    analyzer = SuspenseAnalyzer(llm=llm)

    with patch.object(sa, "THREAT_SITUATION_PROMPT", "threat {content} {character_info}"):
        result = await analyzer.analyze_threat_situations("content", {"name": "hero"})

    assert result.pillar == SuspensePillar.THREAT_SITUATION
    assert result.score == 9.0
    assert len(result.elements) == 1
    assert result.elements[0].threat_type == "physical"


@pytest.mark.asyncio
async def test_find_lit_fuses_with_llm_branch():
    llm = MagicMock()
    llm.ainvoke = AsyncMock(
        return_value=_LLMResponse(
            json.dumps(
                {
                    "fuses": [
                        {
                            "crisis": "列车即将离站",
                            "deadline": "三分钟内",
                            "consequence": "将永远错过她",
                            "intensity": 8.7,
                        }
                    ],
                    "score": 8.0,
                    "issues": ["时限感可更突出"],
                    "suggestions": ["增加倒计时细节"],
                },
                ensure_ascii=False,
            )
        )
    )
    analyzer = SuspenseAnalyzer(llm=llm)

    with patch.object(sa, "LIT_FUSE_PROMPT", "fuse {content}"):
        result = await analyzer.find_lit_fuses("content")

    assert result.pillar == SuspensePillar.LIT_FUSE
    assert result.score == 8.0
    assert len(result.elements) == 1
    assert result.elements[0].deadline == "三分钟内"

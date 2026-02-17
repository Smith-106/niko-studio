# -*- coding: utf-8 -*-
"""
角色状态分析器

从文本中提取角色状态轨迹，识别：
- 情绪状态 (emotions)
- 目标驱动 (goals)
- 内外冲突 (conflicts)
- 行动能动性 (agency)
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from .base import BaseAnalyzer, AnalysisResult, AnalysisType


EMOTION_KEYWORDS = {
    "positive": ["开心", "喜悦", "兴奋", "轻松", "期待", "安心", "满足"],
    "negative": ["害怕", "恐惧", "担忧", "焦虑", "痛苦", "绝望", "愤怒", "悲伤"],
    "neutral": ["平静", "冷静", "沉默", "思考", "观察"],
}

GOAL_MARKERS = [
    "要", "必须", "决定", "目标", "想要", "打算", "计划", "希望", "准备",
]

CONFLICT_MARKERS = [
    "但是", "然而", "却", "矛盾", "挣扎", "犹豫", "两难", "冲突", "对抗",
]

ACTION_MARKERS = [
    "冲", "跑", "追", "抓", "推", "拉", "喊", "说", "做", "行动", "决定",
]


@dataclass
class CharacterState:
    """单段文本中的角色状态。"""

    position: int
    content: str
    emotions: List[str] = field(default_factory=list)
    goals: List[str] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)
    agency_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "position": self.position,
            "content": self.content[:120],
            "emotions": self.emotions,
            "goals": self.goals,
            "conflicts": self.conflicts,
            "agency_score": self.agency_score,
        }


class CharacterStateAnalyzer(BaseAnalyzer):
    """角色状态分析器。"""

    @property
    def name(self) -> str:
        return "CharacterStateAnalyzer"

    @property
    def analysis_type(self) -> AnalysisType:
        return AnalysisType.CHARACTER_STATE

    @property
    def description(self) -> str:
        return "分析角色在叙事中的情绪、目标、冲突与能动性变化"

    async def analyze(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AnalysisResult[CharacterState]:
        if self.llm_client:
            return await self._analyze_with_llm(content, context)
        return self.quick_analyze(content)

    async def _analyze_with_llm(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AnalysisResult[CharacterState]:
        system_prompt = """你是叙事分析专家。请抽取角色状态轨迹并返回 JSON：
{
  "states": [
    {
      "position": 0,
      "content": "...",
      "emotions": ["..."],
      "goals": ["..."],
      "conflicts": ["..."],
      "agency_score": 0.6
    }
  ],
  "summary": "..."
}
"""
        prompt = f"分析以下文本中的角色状态变化：\n\n{content[:2000]}"

        try:
            result = await self.llm_client.generate_json(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
            )

            states: List[CharacterState] = []
            for item in result.get("states", []):
                states.append(
                    CharacterState(
                        position=int(item.get("position", len(states))),
                        content=str(item.get("content", "")),
                        emotions=[str(v) for v in item.get("emotions", [])],
                        goals=[str(v) for v in item.get("goals", [])],
                        conflicts=[str(v) for v in item.get("conflicts", [])],
                        agency_score=float(item.get("agency_score", 0.0)),
                    )
                )

            if not states:
                return self.quick_analyze(content)

            return AnalysisResult(
                analyzer_name=self.name,
                analysis_type=self.analysis_type,
                items=states,
                metadata={
                    "total_count": len(states),
                    "average_agency": round(
                        sum(s.agency_score for s in states) / len(states), 3
                    ),
                    "analysis_source": "llm",
                },
                summary=result.get("summary", self._build_summary(states)),
            )
        except Exception:
            return self.quick_analyze(content)

    def quick_analyze(self, content: str) -> AnalysisResult[CharacterState]:
        segments = self._segment_text(content)
        states: List[CharacterState] = []

        for idx, segment in enumerate(segments):
            emotions = self._extract_emotions(segment)
            goals = self._extract_keywords(segment, GOAL_MARKERS)
            conflicts = self._extract_keywords(segment, CONFLICT_MARKERS)
            agency = self._estimate_agency(segment, goals)

            if not (emotions or goals or conflicts):
                continue

            states.append(
                CharacterState(
                    position=idx,
                    content=segment.strip(),
                    emotions=emotions,
                    goals=goals,
                    conflicts=conflicts,
                    agency_score=agency,
                )
            )

        average_agency = (
            round(sum(s.agency_score for s in states) / len(states), 3) if states else 0.0
        )

        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
            items=states,
            metadata={
                "segment_count": len(segments),
                "total_count": len(states),
                "average_agency": average_agency,
                "emotion_distribution": self._emotion_distribution(states),
            },
            summary=self._build_summary(states),
        )

    def get_dominant_emotions(self, content: str) -> List[str]:
        result = self.quick_analyze(content)
        distribution = result.metadata.get("emotion_distribution", {})
        if not distribution:
            return []

        max_count = max(distribution.values())
        if max_count == 0:
            return []

        return [emotion for emotion, count in distribution.items() if count == max_count]

    def _segment_text(self, content: str) -> List[str]:
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        if len(paragraphs) > 1:
            return paragraphs

        sentences = [s.strip() for s in re.split(r"[。！？]", content) if s.strip()]
        return sentences

    def _extract_emotions(self, text: str) -> List[str]:
        found: List[str] = []
        for emotion_type, words in EMOTION_KEYWORDS.items():
            if any(word in text for word in words):
                found.append(emotion_type)
        return found

    def _extract_keywords(self, text: str, keywords: List[str]) -> List[str]:
        return [kw for kw in keywords if kw in text]

    def _estimate_agency(self, text: str, goals: List[str]) -> float:
        action_hits = sum(1 for marker in ACTION_MARKERS if marker in text)
        goal_bonus = min(2, len(goals))
        raw = action_hits + goal_bonus
        return min(1.0, round(raw * 0.2, 3))

    def _emotion_distribution(self, states: List[CharacterState]) -> Dict[str, int]:
        distribution = {"positive": 0, "negative": 0, "neutral": 0}
        for state in states:
            for emotion in state.emotions:
                if emotion in distribution:
                    distribution[emotion] += 1
        return distribution

    def _build_summary(self, states: List[CharacterState]) -> str:
        if not states:
            return "未检测到明显角色状态信号"

        avg_agency = sum(s.agency_score for s in states) / len(states)
        return f"检测到 {len(states)} 段角色状态，平均能动性 {avg_agency:.2f}"

"""Heuristic novel quality evaluation for gateway quality-check endpoint."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List

from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP


_CONFLICT_KEYWORDS = {
    "conflict",
    "struggle",
    "risk",
    "threat",
    "danger",
    "betray",
    "argue",
    "tension",
    "crisis",
    "oppose",
    "冲突",
    "矛盾",
    "危机",
    "争执",
    "对抗",
    "威胁",
    "背叛",
    "危险",
}

_VISUAL_KEYWORDS = {
    "light",
    "shadow",
    "color",
    "glow",
    "shape",
    "eyes",
    "face",
    "window",
    "street",
    "rain",
    "fog",
    "sun",
    "moon",
    "星",
    "光",
    "影",
    "色",
    "眼",
    "脸",
    "窗",
    "街",
    "雨",
    "雾",
    "月",
    "天",
}

_CAUSAL_MARKERS = {
    "because",
    "therefore",
    "so",
    "thus",
    "hence",
    "since",
    "as a result",
    "因为",
    "所以",
    "因此",
    "于是",
    "导致",
    "结果",
    "随后",
}

_TEMPLATE_PREFIXES = (
    "then",
    "next",
    "suddenly",
    "after that",
    "he ",
    "she ",
    "it ",
    "然后",
    "接着",
    "突然",
    "他",
    "她",
    "他们",
    "她们",
)

_UNCERTAIN_MARKERS = {
    "maybe",
    "perhaps",
    "probably",
    "seems",
    "I guess",
    "可能",
    "也许",
    "大概",
    "似乎",
    "好像",
}

_SENTENCE_SPLIT_RE = re.compile(r"[。！？!?\.]+|\n+")
_QUOTE_RE = re.compile(r"[\"“”‘’「」『』]")
_WORD_RE = re.compile(r"[A-Za-z]+|[\u4e00-\u9fff]")


def evaluate_novel_quality(content: str) -> Dict[str, Any]:
    text = (content or "").strip()
    if not text:
        return _empty_result()

    metrics = _compute_metrics(text)
    dimension_scores = _compute_dimension_scores(text, metrics)

    quality_score = _clamp(
        round(
            (
                dimension_scores["repetition"] * 0.20
                + dimension_scores["tone"] * 0.13
                + dimension_scores["clarity"] * 0.17
                + dimension_scores["causality"] * 0.20
                + dimension_scores["detail"] * 0.20
                + dimension_scores["factuality"] * 0.10
            ),
            1,
        ),
        0.0,
        100.0,
    )

    issues = _build_issues(text, metrics, dimension_scores, quality_score)
    publish_recommendation = _recommendation(metrics, quality_score, issues)

    # Keep semantic mapping ready for future contract expansion.
    _ = LEGACY_DECISION_MAP.get(publish_recommendation, "no_go" if publish_recommendation == "block" else "go")

    return {
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": quality_score,
        "issues": issues,
        "metrics": {
            "dialogue_ratio": metrics["dialogue_ratio"],
            "conflict_points": metrics["conflict_points"],
            "visual_details": metrics["visual_details"],
            "template_sentence_ratio": metrics["template_sentence_ratio"],
            "dimension_scores": dimension_scores,
        },
        "publish_recommendation": publish_recommendation,
    }


def _empty_result() -> Dict[str, Any]:
    zero_dimensions = {
        "repetition": 0.0,
        "tone": 0.0,
        "clarity": 0.0,
        "causality": 0.0,
        "detail": 0.0,
        "factuality": 0.0,
    }
    return {
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": 0.0,
        "issues": [
            {
                "severity": "high",
                "type": "content",
                "evidence": "content is empty",
                "suggestion": "Provide non-empty novel content before quality check.",
            }
        ],
        "metrics": {
            "dialogue_ratio": 0.0,
            "conflict_points": 0,
            "visual_details": 0,
            "template_sentence_ratio": 1.0,
            "dimension_scores": zero_dimensions,
        },
        "publish_recommendation": "block",
    }


def _compute_metrics(text: str) -> Dict[str, Any]:
    length = max(len(text), 1)
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]
    if not sentences:
        sentences = [text]

    quote_count = len(_QUOTE_RE.findall(text))
    dialogue_ratio = _clamp(round(min(quote_count * 6, length) / length, 4), 0.0, 1.0)

    lowered = text.lower()
    conflict_points = sum(lowered.count(keyword) for keyword in _CONFLICT_KEYWORDS)
    visual_details = sum(lowered.count(keyword) for keyword in _VISUAL_KEYWORDS)

    normalized = [_normalize_sentence(sentence) for sentence in sentences]
    duplicates = sum(count - 1 for count in Counter(normalized).values() if count > 1)
    duplicate_ratio = duplicates / max(len(sentences), 1)

    template_hits = 0
    for sentence in sentences:
        s = sentence.strip().lower()
        if s.startswith(_TEMPLATE_PREFIXES):
            template_hits += 1
    template_sentence_ratio = _clamp(
        round((template_hits / len(sentences)) * 0.6 + duplicate_ratio * 0.4, 4),
        0.0,
        1.0,
    )

    words = _WORD_RE.findall(text)
    return {
        "length": length,
        "sentences": sentences,
        "word_count": len(words),
        "dialogue_ratio": dialogue_ratio,
        "conflict_points": conflict_points,
        "visual_details": visual_details,
        "template_sentence_ratio": template_sentence_ratio,
        "duplicate_ratio": duplicate_ratio,
    }


def _compute_dimension_scores(text: str, metrics: Dict[str, Any]) -> Dict[str, float]:
    sentences = metrics["sentences"]
    avg_sentence_length = metrics["word_count"] / max(len(sentences), 1)

    repetition = _clamp(100.0 - metrics["template_sentence_ratio"] * 110.0, 0.0, 100.0)

    tone = _clamp(45.0 + metrics["dialogue_ratio"] * 70.0 + min(metrics["conflict_points"], 4) * 5.0, 0.0, 100.0)

    clarity_penalty = abs(avg_sentence_length - 16.0) * 2.2
    clarity = _clamp(92.0 - clarity_penalty, 0.0, 100.0)

    causal_hits = sum(text.lower().count(marker) for marker in _CAUSAL_MARKERS)
    causality = _clamp(35.0 + min(causal_hits, 8) * 8.0 + min(metrics["conflict_points"], 5) * 5.0, 0.0, 100.0)

    detail = _clamp(30.0 + min(metrics["visual_details"], 12) * 5.0, 0.0, 100.0)

    uncertain_hits = sum(text.lower().count(marker) for marker in _UNCERTAIN_MARKERS)
    factuality = _clamp(88.0 - uncertain_hits * 8.0, 0.0, 100.0)

    return {
        "repetition": round(repetition, 1),
        "tone": round(tone, 1),
        "clarity": round(clarity, 1),
        "causality": round(causality, 1),
        "detail": round(detail, 1),
        "factuality": round(factuality, 1),
    }


def _build_issues(
    text: str,
    metrics: Dict[str, Any],
    dimension_scores: Dict[str, float],
    quality_score: float,
) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []

    if metrics["template_sentence_ratio"] >= 0.45:
        issues.append(
            {
                "severity": "high" if metrics["template_sentence_ratio"] >= 0.7 else "medium",
                "type": "repetition",
                "evidence": f"template_sentence_ratio={metrics['template_sentence_ratio']}",
                "suggestion": "Vary sentence openings and rewrite repeated lines with fresh actions.",
            }
        )

    if metrics["conflict_points"] < 2:
        issues.append(
            {
                "severity": "medium",
                "type": "causality",
                "evidence": f"conflict_points={metrics['conflict_points']}",
                "suggestion": "Add explicit stakes and causal links between character actions and outcomes.",
            }
        )

    if metrics["visual_details"] < 3:
        issues.append(
            {
                "severity": "medium",
                "type": "detail",
                "evidence": f"visual_details={metrics['visual_details']}",
                "suggestion": "Add concrete visual cues (light, color, movement, setting anchors).",
            }
        )

    if metrics["dialogue_ratio"] < 0.03 and len(metrics["sentences"]) >= 4:
        issues.append(
            {
                "severity": "low",
                "type": "tone",
                "evidence": f"dialogue_ratio={metrics['dialogue_ratio']}",
                "suggestion": "Consider adding dialogue beats to improve voice rhythm.",
            }
        )

    if quality_score < 55 or dimension_scores["clarity"] < 45:
        issues.append(
            {
                "severity": "high",
                "type": "overall_quality",
                "evidence": f"quality_score={quality_score}",
                "suggestion": "Revise structure first: clarify sequence, sharpen conflict, then enrich details.",
            }
        )

    return issues


def _recommendation(metrics: Dict[str, Any], quality_score: float, issues: List[Dict[str, str]]) -> str:
    high_issues = sum(1 for issue in issues if issue["severity"] == "high")

    if metrics["template_sentence_ratio"] >= 0.8:
        return "block"
    if quality_score >= 74 and high_issues == 0:
        return "pass"
    if quality_score < 50 or high_issues >= 2:
        return "block"
    return "revise"


def _normalize_sentence(sentence: str) -> str:
    lowered = sentence.strip().lower()
    return re.sub(r"\s+", " ", lowered)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))

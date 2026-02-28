"""Heuristic novel quality evaluation for gateway quality-check endpoint."""

from __future__ import annotations

import re
from collections import Counter
from typing import Any, Dict, List, Literal

from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP
from src.workflow.state import NOVEL_QUALITY_WEIGHTS, NOVEL_QUALITY_THRESHOLDS

QualityMode = Literal["auto", "manual"]
QualityLevel = Literal["ultra", "high", "medium", "fluent"]

LEVEL_DIMENSION_MULTIPLIER: Dict[QualityLevel, Dict[str, float]] = {
    "ultra": {
        "repetition": 1.08,
        "tone": 1.0,
        "clarity": 1.0,
        "causality": 1.05,
        "detail": 1.08,
        "factuality": 1.0,
    },
    "high": {
        "repetition": 1.0,
        "tone": 1.0,
        "clarity": 1.0,
        "causality": 1.0,
        "detail": 1.0,
        "factuality": 1.0,
    },
    "medium": {
        "repetition": 0.95,
        "tone": 0.95,
        "clarity": 0.95,
        "causality": 0.95,
        "detail": 0.9,
        "factuality": 1.0,
    },
    "fluent": {
        "repetition": 0.88,
        "tone": 0.9,
        "clarity": 0.9,
        "causality": 0.88,
        "detail": 0.8,
        "factuality": 1.0,
    },
}


REPETITION_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["repetition"])
TONE_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["tone"])
CLARITY_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["clarity"])
CAUSALITY_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["causality"])
DETAIL_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["detail"])
FACTUALITY_WEIGHT = float(NOVEL_QUALITY_WEIGHTS["factuality"])

PASS_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["pass"])
BLOCK_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["block"])
BLOCK_TEMPLATE_RATIO = float(NOVEL_QUALITY_THRESHOLDS["block_template_ratio"])

REPETITION_ISSUE_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["repetition_issue"])
REPETITION_ISSUE_HIGH_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["repetition_issue_high"])
MIN_CONFLICT_POINTS = int(NOVEL_QUALITY_THRESHOLDS["min_conflict_points"])
MIN_VISUAL_DETAILS = int(NOVEL_QUALITY_THRESHOLDS["min_visual_details"])
MIN_DIALOGUE_RATIO = float(NOVEL_QUALITY_THRESHOLDS["min_dialogue_ratio"])
MIN_SENTENCES_FOR_TONE_ISSUE = int(NOVEL_QUALITY_THRESHOLDS["min_sentences_for_tone_issue"])
LOW_QUALITY_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["low_quality"])
LOW_CLARITY_THRESHOLD = float(NOVEL_QUALITY_THRESHOLDS["low_clarity"])

QUALITY_CONTRACT_KEYS = {
    "analysis_schema_version",
    "quality_score",
    "issues",
    "metrics",
    "publish_recommendation",
}

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


def evaluate_novel_quality(
    content: str,
    *,
    quality_level: str = "high",
    quality_mode: str = "auto",
    critical_gate_always_on: bool = True,
    degrade_reason: str = "",
) -> Dict[str, Any]:
    text = (content or "").strip()
    resolved_level = _normalize_quality_level(quality_level)
    resolved_mode = _normalize_quality_mode(quality_mode)
    if not text:
        return _empty_result(
            quality_level=resolved_level,
            quality_mode=resolved_mode,
            degrade_reason=degrade_reason,
        )

    metrics = _compute_metrics(text)
    dimension_scores = _compute_dimension_scores(text, metrics)
    adjusted_dimension_scores = _apply_quality_level_to_scores(dimension_scores, resolved_level)

    quality_score = _clamp(
        round(
            (
                adjusted_dimension_scores["repetition"] * REPETITION_WEIGHT
                + adjusted_dimension_scores["tone"] * TONE_WEIGHT
                + adjusted_dimension_scores["clarity"] * CLARITY_WEIGHT
                + adjusted_dimension_scores["causality"] * CAUSALITY_WEIGHT
                + adjusted_dimension_scores["detail"] * DETAIL_WEIGHT
                + adjusted_dimension_scores["factuality"] * FACTUALITY_WEIGHT
            ),
            1,
        ),
        0.0,
        100.0,
    )

    issues = _build_issues(text, metrics, adjusted_dimension_scores, quality_score)
    critical_issues = _extract_critical_issues(issues)
    publish_recommendation = _recommendation(
        metrics,
        quality_score,
        issues,
        critical_issues=critical_issues,
        critical_gate_always_on=critical_gate_always_on,
    )

    _ = LEGACY_DECISION_MAP.get(publish_recommendation, "no_go" if publish_recommendation == "block" else "go")

    degraded = bool(degrade_reason)
    result = {
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": quality_score,
        "issues": issues,
        "metrics": {
            "dialogue_ratio": metrics["dialogue_ratio"],
            "conflict_points": metrics["conflict_points"],
            "visual_details": metrics["visual_details"],
            "template_sentence_ratio": metrics["template_sentence_ratio"],
            "dimension_scores": adjusted_dimension_scores,
            "quality_level_used": resolved_level,
            "quality_mode_used": resolved_mode,
            "critical_gate_applied": bool(critical_gate_always_on),
            "critical_issue_count": len(critical_issues),
            "degraded": degraded,
            "degrade_reason": degrade_reason,
        },
        "publish_recommendation": publish_recommendation,
    }
    return result


def _build_default_dimension_scores() -> Dict[str, float]:
    return {
        "repetition": 0.0,
        "tone": 0.0,
        "clarity": 0.0,
        "causality": 0.0,
        "detail": 0.0,
        "factuality": 0.0,
    }


def _build_default_metrics(*, template_sentence_ratio: float = 0.0) -> Dict[str, Any]:
    return {
        "dialogue_ratio": 0.0,
        "conflict_points": 0,
        "visual_details": 0,
        "template_sentence_ratio": template_sentence_ratio,
        "dimension_scores": _build_default_dimension_scores(),
    }


def _empty_result(
    *,
    quality_level: str = "high",
    quality_mode: str = "auto",
    degrade_reason: str = "",
) -> Dict[str, Any]:
    resolved_level = _normalize_quality_level(quality_level)
    resolved_mode = _normalize_quality_mode(quality_mode)
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
            **_build_default_metrics(template_sentence_ratio=1.0),
            "quality_level_used": resolved_level,
            "quality_mode_used": resolved_mode,
            "critical_gate_applied": True,
            "critical_issue_count": 0,
            "degraded": bool(degrade_reason),
            "degrade_reason": degrade_reason,
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
        sentence_lower = sentence.strip().lower()
        if sentence_lower.startswith(_TEMPLATE_PREFIXES):
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
    _text: str,
    metrics: Dict[str, Any],
    dimension_scores: Dict[str, float],
    quality_score: float,
) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []

    if metrics["template_sentence_ratio"] >= REPETITION_ISSUE_THRESHOLD:
        severity = "high" if metrics["template_sentence_ratio"] >= REPETITION_ISSUE_HIGH_THRESHOLD else "medium"
        if metrics["template_sentence_ratio"] >= 0.9:
            severity = "critical"
        issues.append(
            {
                "severity": severity,
                "type": "repetition",
                "evidence": f"template_sentence_ratio={metrics['template_sentence_ratio']}",
                "suggestion": "Vary sentence openings and rewrite repeated lines with fresh actions.",
            }
        )

    if metrics["conflict_points"] < MIN_CONFLICT_POINTS:
        issues.append(
            {
                "severity": "medium",
                "type": "causality",
                "evidence": f"conflict_points={metrics['conflict_points']}",
                "suggestion": "Add explicit stakes and causal links between character actions and outcomes.",
            }
        )

    if metrics["visual_details"] < MIN_VISUAL_DETAILS:
        issues.append(
            {
                "severity": "medium",
                "type": "detail",
                "evidence": f"visual_details={metrics['visual_details']}",
                "suggestion": "Add concrete visual cues (light, color, movement, setting anchors).",
            }
        )

    if metrics["dialogue_ratio"] < MIN_DIALOGUE_RATIO and len(metrics["sentences"]) >= MIN_SENTENCES_FOR_TONE_ISSUE:
        issues.append(
            {
                "severity": "low",
                "type": "tone",
                "evidence": f"dialogue_ratio={metrics['dialogue_ratio']}",
                "suggestion": "Consider adding dialogue beats to improve voice rhythm.",
            }
        )

    if quality_score < LOW_QUALITY_THRESHOLD or dimension_scores["clarity"] < LOW_CLARITY_THRESHOLD:
        issues.append(
            {
                "severity": "high",
                "type": "overall_quality",
                "evidence": f"quality_score={quality_score}",
                "suggestion": "Revise structure first: clarify sequence, sharpen conflict, then enrich details.",
            }
        )

    return issues


def _recommendation(
    metrics: Dict[str, Any],
    quality_score: float,
    issues: List[Dict[str, str]],
    *,
    critical_issues: List[Dict[str, str]] | None = None,
    critical_gate_always_on: bool = True,
) -> str:
    critical_issues = critical_issues or []
    if critical_gate_always_on and critical_issues:
        return "block"

    high_issues = sum(1 for issue in issues if issue["severity"] == "high")

    if metrics["template_sentence_ratio"] >= BLOCK_TEMPLATE_RATIO:
        return "block"
    if quality_score >= PASS_THRESHOLD and high_issues == 0:
        return "pass"
    if quality_score < BLOCK_THRESHOLD or high_issues >= 2:
        return "block"
    return "revise"


def _normalize_quality_level(level: str) -> QualityLevel:
    level_lower = (level or "").strip().lower()
    if level_lower in LEVEL_DIMENSION_MULTIPLIER:
        return level_lower  # type: ignore[return-value]
    return "high"


def _normalize_quality_mode(mode: str) -> QualityMode:
    mode_lower = (mode or "").strip().lower()
    if mode_lower in {"auto", "manual"}:
        return mode_lower  # type: ignore[return-value]
    return "auto"


def _apply_quality_level_to_scores(scores: Dict[str, float], quality_level: QualityLevel) -> Dict[str, float]:
    multipliers = LEVEL_DIMENSION_MULTIPLIER[quality_level]
    adjusted: Dict[str, float] = {}
    for key, value in scores.items():
        factor = multipliers.get(key, 1.0)
        adjusted[key] = round(_clamp(value * factor, 0.0, 100.0), 1)
    return adjusted


def _extract_critical_issues(issues: List[Dict[str, str]]) -> List[Dict[str, str]]:
    return [
        issue
        for issue in issues
        if str(issue.get("severity", "")).lower() == "critical"
    ]


def _normalize_sentence(sentence: str) -> str:
    lowered = sentence.strip().lower()
    return re.sub(r"\s+", " ", lowered)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))

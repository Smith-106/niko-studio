"""
MCP Gateway Contract Normalization

Payload normalization, quality defaulting, and detection evasion guards
for the MCP gateway.
"""

import math
import os
from typing import Any, Dict, Optional

from src.config import get_config_value
from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP, ensure_contract_payload
from starlette.responses import JSONResponse


# ============ Contract Wrappers ============

def _with_contract(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure payload has contract fields."""
    return ensure_contract_payload(payload)


def _with_terminal_contract(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure payload has terminal contract fields."""
    normalized = _with_contract(payload)
    if "decision" not in normalized:
        normalized["decision"] = "go"
    if "terminal" not in normalized:
        normalized["terminal"] = "done"

    terminal = normalized.get("terminal")
    legacy_terminal = terminal
    if terminal == "interrupted":
        legacy_terminal = "aborted"
    elif terminal == "recovered":
        legacy_terminal = "done"

    legacy_fields = normalized.get("legacy_contract_fields")
    if not isinstance(legacy_fields, dict):
        legacy_fields = {}
    legacy_fields.setdefault("decision", normalized.get("decision"))
    legacy_fields.setdefault("terminal", legacy_terminal)
    legacy_fields.setdefault("terminal_state", legacy_terminal)
    normalized["legacy_contract_fields"] = legacy_fields
    normalized.setdefault("terminal_state", legacy_terminal)
    return normalized


# ============ Detection Evasion Guard ============

_PROHIBITED_DETECTION_KEYS = {
    "anti_detection",
    "bypass_detector",
    "pass_gptzero",
    "detector_bypass",
    "humanize_for_detector",
}

_PROHIBITED_DETECTION_TERMS = (
    "ai detection",
    "ai detector",
    "bypass detector",
    "bypass ai detector",
    "evade detector",
    "avoid detection",
    "pass gptzero",
    "检测对抗",
    "反检测",
    "规避检测",
)


def _contains_detection_evasion_intent(value: Any) -> bool:
    """Recursively check for detection evasion intent in payload."""
    if isinstance(value, dict):
        for key, nested in value.items():
            key_str = str(key).lower()
            if key_str in _PROHIBITED_DETECTION_KEYS:
                return True
            if _contains_detection_evasion_intent(nested):
                return True
        return False

    if isinstance(value, list):
        return any(_contains_detection_evasion_intent(item) for item in value)

    if isinstance(value, str):
        lowered = value.lower()
        return any(term in lowered for term in _PROHIBITED_DETECTION_TERMS)

    return False


def _resolve_detection_evasion_guard_enabled() -> bool:
    """Check if detection evasion guard is enabled."""
    raw = os.getenv("NIKO_DETECTION_EVASION_GUARD")
    if raw is not None:
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    return bool(get_config_value("gateway.detection_evasion_guard", True))


def _guard_detection_evasion_payload(
    payload: Dict[str, Any],
    enabled_override: Optional[bool] = None,
) -> Optional[JSONResponse]:
    """Guard against detection evasion requests."""
    guard_enabled = _resolve_detection_evasion_guard_enabled() if enabled_override is None else bool(enabled_override)
    if not guard_enabled:
        return None
    if _contains_detection_evasion_intent(payload):
        return JSONResponse(
            {
                "error": "DETECTION_EVASION_BLOCKED",
                "code": "COMPLIANCE_DETECTION_EVASION_BLOCKED",
                "message": "检测规避相关请求已被拦截。请改用质量增强目标（自然表达、可读性、风格一致性、逻辑连贯与可执行编辑建议）。",
            },
            status_code=400,
        )
    return None


# ============ Quality Payload Defaults ============

def _quality_default_payload() -> Dict[str, Any]:
    """Get default quality payload structure."""
    return {
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": 0.0,
        "issues": [],
        "metrics": {
            "dialogue_ratio": 0.0,
            "conflict_points": 0,
            "visual_details": 0,
            "template_sentence_ratio": 0.0,
            "dimension_scores": {
                "repetition": 0.0,
                "tone": 0.0,
                "clarity": 0.0,
                "causality": 0.0,
                "detail": 0.0,
                "factuality": 0.0,
            },
            "retrieval": {
                "stage1_candidates": 0,
                "stage2_selected": 0,
                "cited_count": 0,
                "effective_hit_rate": 0.0,
            },
            "context_budget": {
                "token_total": 0,
                "token_effective": 0,
                "utilization": 0.0,
            },
            "self_learning": {
                "strategy_adoption_rate": 0.0,
                "reflector_triggered": False,
                "curator_applied": False,
            },
        },
        "publish_recommendation": "revise",
    }


# ============ Normalization Helpers ============

def _clamp_float(value: float, low: float, high: float) -> float:
    """Clamp float value to range."""
    return max(low, min(high, value))


def _safe_float(value: Any, default: float) -> float:
    """Safely convert value to float."""
    if isinstance(value, bool):
        return float(default)
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return float(default)
    if not math.isfinite(parsed):
        return float(default)
    return parsed


def _safe_int(value: Any, default: int) -> int:
    """Safely convert value to int."""
    if isinstance(value, bool):
        return int(default)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return int(default)
    return parsed


def _normalize_quality_score(value: Any, default: float) -> float:
    """Normalize quality score to 0-100 range."""
    return _clamp_float(_safe_float(value, default), 0.0, 100.0)


def _normalize_ratio(value: Any, default: float) -> float:
    """Normalize ratio to 0-1 range."""
    return _clamp_float(_safe_float(value, default), 0.0, 1.0)


def _normalize_count(value: Any, default: int) -> int:
    """Normalize count to non-negative integer."""
    return max(0, _safe_int(value, default))


def _normalize_issue_text(value: Any, default: str) -> str:
    """Normalize issue text field."""
    if value is None:
        return default
    normalized = str(value).strip()
    return normalized if normalized else default


def _normalize_issue_severity(value: Any) -> str:
    """Normalize issue severity to valid values."""
    normalized = _normalize_issue_text(value, "medium").lower()
    if normalized in {"low", "medium", "high"}:
        return normalized
    return "medium"


def _normalize_issue_item(issue: Dict[str, Any]) -> Dict[str, str]:
    """Normalize issue item structure."""
    return {
        "severity": _normalize_issue_severity(issue.get("severity")),
        "type": _normalize_issue_text(issue.get("type"), "unknown"),
        "evidence": _normalize_issue_text(issue.get("evidence"), ""),
        "suggestion": _normalize_issue_text(issue.get("suggestion"), ""),
    }


def _normalize_retrieval_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize retrieval metrics structure."""
    if not isinstance(value, dict):
        value = {}
    return {
        "stage1_candidates": _normalize_count(value.get("stage1_candidates"), fallback.get("stage1_candidates", 0)),
        "stage2_selected": _normalize_count(value.get("stage2_selected"), fallback.get("stage2_selected", 0)),
        "cited_count": _normalize_count(value.get("cited_count"), fallback.get("cited_count", 0)),
        "effective_hit_rate": _normalize_ratio(value.get("effective_hit_rate"), fallback.get("effective_hit_rate", 0.0)),
    }


def _normalize_context_budget_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize context budget metrics structure."""
    if not isinstance(value, dict):
        value = {}
    return {
        "token_total": _normalize_count(value.get("token_total"), fallback.get("token_total", 0)),
        "token_effective": _normalize_count(value.get("token_effective"), fallback.get("token_effective", 0)),
        "utilization": _normalize_ratio(value.get("utilization"), fallback.get("utilization", 0.0)),
    }


def _normalize_self_learning_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize self-learning metrics structure."""
    if not isinstance(value, dict):
        value = {}
    return {
        "strategy_adoption_rate": _normalize_ratio(
            value.get("strategy_adoption_rate"),
            fallback.get("strategy_adoption_rate", 0.0),
        ),
        "reflector_triggered": bool(value.get("reflector_triggered", fallback.get("reflector_triggered", False))),
        "curator_applied": bool(value.get("curator_applied", fallback.get("curator_applied", False))),
    }


def _normalize_schema_version(payload: Dict[str, Any], contract_payload: Dict[str, Any]) -> str:
    """Normalize schema version from multiple sources."""
    candidates = [
        payload.get("analysis_schema_version"),
        payload.get("contract_version"),
        contract_payload.get("analysis_schema_version"),
        ANALYSIS_SCHEMA_VERSION,
    ]
    for candidate in candidates:
        if candidate is None:
            continue
        normalized = str(candidate).strip()
        if normalized:
            return normalized
    return ANALYSIS_SCHEMA_VERSION


def _normalize_publish_recommendation(payload: Dict[str, Any], fallback: str) -> str:
    """Normalize publish recommendation from decision fields."""
    decision_to_publish = {
        "go": "pass",
        "soft_go": "revise",
        "no_go": "block",
    }

    candidates = [
        payload.get("publish_recommendation"),
        payload.get("decision"),
        payload.get("decision_result"),
    ]
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        normalized = candidate.strip().lower()
        if normalized in {"pass", "revise", "block"}:
            return normalized
        mapped_decision = LEGACY_DECISION_MAP.get(normalized)
        if mapped_decision in decision_to_publish:
            return decision_to_publish[mapped_decision]

    return fallback


def _normalize_quality_payload(payload: Any) -> Dict[str, Any]:
    """Normalize quality payload to standard structure."""
    fallback = _quality_default_payload()
    if not isinstance(payload, dict):
        payload = {}

    raw_metrics = payload.get("metrics")
    if not isinstance(raw_metrics, dict):
        raw_metrics = {}

    raw_dim_scores = raw_metrics.get("dimension_scores")
    if not isinstance(raw_dim_scores, dict):
        raw_dim_scores = {}

    fallback_metrics = fallback["metrics"]
    fallback_dim_scores = fallback_metrics["dimension_scores"]

    normalized_dim_scores = {
        key: _normalize_quality_score(raw_dim_scores.get(key), default)
        for key, default in fallback_dim_scores.items()
    }

    normalized_metrics = {
        "dialogue_ratio": _normalize_ratio(raw_metrics.get("dialogue_ratio"), fallback_metrics["dialogue_ratio"]),
        "conflict_points": _normalize_count(raw_metrics.get("conflict_points"), fallback_metrics["conflict_points"]),
        "visual_details": _normalize_count(raw_metrics.get("visual_details"), fallback_metrics["visual_details"]),
        "template_sentence_ratio": _normalize_ratio(
            raw_metrics.get("template_sentence_ratio"),
            fallback_metrics["template_sentence_ratio"],
        ),
        "dimension_scores": normalized_dim_scores,
        "retrieval": _normalize_retrieval_metrics(raw_metrics.get("retrieval"), fallback_metrics["retrieval"]),
        "context_budget": _normalize_context_budget_metrics(
            raw_metrics.get("context_budget"),
            fallback_metrics["context_budget"],
        ),
        "self_learning": _normalize_self_learning_metrics(
            raw_metrics.get("self_learning"),
            fallback_metrics["self_learning"],
        ),
    }

    raw_issues = payload.get("issues")
    if not isinstance(raw_issues, list):
        raw_issues = []
    normalized_issues = [_normalize_issue_item(item) for item in raw_issues if isinstance(item, dict)]

    contract_payload = ensure_contract_payload(payload)
    if not isinstance(contract_payload, dict):
        contract_payload = {}
    schema_version = _normalize_schema_version(payload, contract_payload)

    return {
        "analysis_schema_version": schema_version,
        "quality_score": _normalize_quality_score(payload.get("quality_score"), fallback["quality_score"]),
        "issues": normalized_issues,
        "metrics": normalized_metrics,
        "publish_recommendation": _normalize_publish_recommendation(payload, fallback["publish_recommendation"]),
    }


def _merge_quality_sidecar(
    result: Any,
    retrieval_metadata: Any,
    context_budget: Any,
    self_learning: Any = None,
) -> Dict[str, Any]:
    """Merge quality sidecar metadata into result payload."""
    payload = result if isinstance(result, dict) else {}
    merged = dict(payload)

    metrics = merged.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    metrics = dict(metrics)

    if isinstance(retrieval_metadata, dict):
        metrics["retrieval"] = retrieval_metadata
    if isinstance(context_budget, dict):
        metrics["context_budget"] = context_budget
    if isinstance(self_learning, dict):
        metrics["self_learning"] = self_learning

    merged["metrics"] = metrics
    return merged


__all__ = [
    # Contract wrappers
    "_with_contract",
    "_with_terminal_contract",
    # Detection evasion guard
    "_PROHIBITED_DETECTION_KEYS",
    "_PROHIBITED_DETECTION_TERMS",
    "_contains_detection_evasion_intent",
    "_resolve_detection_evasion_guard_enabled",
    "_guard_detection_evasion_payload",
    # Quality defaults
    "_quality_default_payload",
    # Normalization helpers
    "_clamp_float",
    "_safe_float",
    "_safe_int",
    "_normalize_quality_score",
    "_normalize_ratio",
    "_normalize_count",
    "_normalize_issue_text",
    "_normalize_issue_severity",
    "_normalize_issue_item",
    "_normalize_retrieval_metrics",
    "_normalize_context_budget_metrics",
    "_normalize_self_learning_metrics",
    "_normalize_schema_version",
    "_normalize_publish_recommendation",
    "_normalize_quality_payload",
    "_merge_quality_sidecar",
]

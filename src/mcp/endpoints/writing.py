"""
Writing REST Endpoints

Writing-related HTTP endpoints for novel quality check and writing helper.
"""

import inspect
import logging
from typing import Dict, Any

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def novel_quality_check_endpoint(request: Request):
    """Novel quality check REST endpoint."""
    from src.mcp.gateway import (
        evaluate_novel_quality,
        _quality_default_payload,
        _normalize_quality_payload,
        _merge_quality_sidecar,
    )
    try:
        body = await request.json()
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}

    content = body.get("content", "")
    if not isinstance(content, str) or not content.strip():
        return JSONResponse({"error": "content is required"}, status_code=400)
    normalized_content = content.strip()
    retrieval_metadata = body.get("retrieval_metadata")
    context_budget = body.get("context_budget")
    self_learning = body.get("self_learning")

    quality_kwargs: Dict[str, Any] = {}
    if "quality_level" in body:
        quality_kwargs["quality_level"] = str(body.get("quality_level", "high"))
    if "quality_mode" in body:
        quality_kwargs["quality_mode"] = str(body.get("quality_mode", "auto"))
    if "critical_gate_always_on" in body:
        quality_kwargs["critical_gate_always_on"] = bool(body.get("critical_gate_always_on", True))
    if "degrade_reason" in body:
        quality_kwargs["degrade_reason"] = str(body.get("degrade_reason", ""))

    try:
        try:
            result = evaluate_novel_quality(normalized_content, **quality_kwargs)
        except TypeError as exc:
            if quality_kwargs and "unexpected keyword argument" in str(exc):
                result = evaluate_novel_quality(normalized_content)
            else:
                raise
        if inspect.isawaitable(result):
            result = await result
    except Exception:
        logger.exception("novel_quality_check_endpoint evaluator failed")
        result = _quality_default_payload()

    result = _merge_quality_sidecar(
        result,
        retrieval_metadata,
        context_budget,
        self_learning,
    )

    try:
        normalized_result = _normalize_quality_payload(result)
    except Exception:
        logger.exception("novel_quality_check_endpoint normalization failed")
        normalized_result = _quality_default_payload()
    return JSONResponse(normalized_result)


async def writing_helper_process_endpoint(request: Request):
    """Writing helper process REST endpoint."""
    from src.mcp.gateway import process_writing_helper, _guard_detection_evasion_payload, _resolve_detection_evasion_guard_enabled
    try:
        body = await request.json()
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}

    content = body.get("content", "")
    if not isinstance(content, str) or not content.strip():
        return JSONResponse({"error": "content is required"}, status_code=400)

    guard_enabled_override = body.get("detection_evasion_guard_enabled")
    if not isinstance(guard_enabled_override, bool):
        guard_enabled_override = None

    if guard_enabled_override is None:
        guard_enabled_override = _resolve_detection_evasion_guard_enabled()

    guard_response = _guard_detection_evasion_payload(body, enabled_override=guard_enabled_override)
    if guard_response is not None:
        return guard_response

    # Backward-compatible alias: mode takes precedence over action when both are present.
    mode = body.get("mode", body.get("action", "polish"))
    max_sentences = body.get("max_sentences", 3)
    max_items = body.get("max_items", 6)
    instruction = body.get("instruction", "")

    try:
        result = process_writing_helper(
            content=content,
            mode=mode,
            max_sentences=int(max_sentences),
            max_items=int(max_items),
            instruction=instruction if isinstance(instruction, str) else "",
        )
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return JSONResponse(result)


__all__ = [
    "novel_quality_check_endpoint",
    "writing_helper_process_endpoint",
]

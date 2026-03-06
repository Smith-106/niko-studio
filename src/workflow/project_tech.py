"""
project-tech metadata freshness helpers.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

PROJECT_TECH_RELATIVE_PATH = Path(".workflow") / "project-tech.json"
DEFAULT_PROJECT_TECH_TTL_HOURS = 168
PROJECT_TECH_SCHEMA_VERSION = "1.1.0"

_LANGUAGE_EXTENSION_MAP: Dict[str, set[str]] = {
    "Python": {".py"},
    "TypeScript": {".ts", ".tsx"},
    "Rust": {".rs"},
}
_SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
}


def _resolve_workspace_path(workspace: Path | str) -> Path:
    if isinstance(workspace, Path):
        return workspace.resolve()
    return Path(workspace).resolve()


def _project_tech_path(workspace: Path | str) -> Path:
    return _resolve_workspace_path(workspace) / PROJECT_TECH_RELATIVE_PATH


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso_datetime(raw: str) -> datetime:
    text = (raw or "").strip()
    if not text:
        raise ValueError("empty datetime")
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _iter_source_files(workspace_path: Path):
    for path in workspace_path.rglob("*"):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIR_NAMES for part in path.parts):
            continue
        yield path


def _collect_language_file_counts(workspace_path: Path) -> Dict[str, int]:
    counts = {lang: 0 for lang in _LANGUAGE_EXTENSION_MAP}
    extension_to_language = {
        ext: language
        for language, extensions in _LANGUAGE_EXTENSION_MAP.items()
        for ext in extensions
    }

    for path in _iter_source_files(workspace_path):
        language = extension_to_language.get(path.suffix.lower())
        if language:
            counts[language] += 1

    return counts


def _load_project_tech_payload(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"project-tech file not found: {path}")

    try:
        raw = path.read_text(encoding="utf-8")
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"project-tech JSON is invalid: {path}") from exc

    if not isinstance(payload, dict):
        raise ValueError("project-tech root payload must be a JSON object")
    return payload


def refresh_project_tech_metadata(
    workspace: Path | str,
    *,
    source: str,
    ttl_hours: int = DEFAULT_PROJECT_TECH_TTL_HOURS,
) -> Dict[str, Any]:
    workspace_path = _resolve_workspace_path(workspace)
    project_tech_path = _project_tech_path(workspace_path)

    if ttl_hours <= 0:
        raise ValueError("ttl_hours must be a positive integer")

    payload = _load_project_tech_payload(project_tech_path)
    generated_at = _utc_now_iso()
    normalized_source = (source or "").strip() or "manual"
    freshness = {
        "generated_at": generated_at,
        "source": normalized_source,
        "schema_version": PROJECT_TECH_SCHEMA_VERSION,
        "ttl_hours": ttl_hours,
    }

    language_counts = _collect_language_file_counts(workspace_path)
    tech_stack = payload.get("overview", {}).get("technology_stack", {})
    languages = tech_stack.get("languages")
    if isinstance(languages, list):
        for language_entry in languages:
            if not isinstance(language_entry, dict):
                continue
            language_name = str(language_entry.get("name") or "")
            if language_name in language_counts:
                language_entry["file_count"] = language_counts[language_name]

    payload["freshness"] = freshness

    metadata = payload.get("_metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    metadata["analysis_timestamp"] = generated_at
    metadata["analysis_mode"] = f"refresh:{normalized_source}"
    metadata.setdefault("initialized_by", "workflow:init-fallback")
    metadata.setdefault("version", "1.0.0")
    payload["_metadata"] = metadata

    statistics = payload.get("statistics")
    if isinstance(statistics, dict):
        statistics["last_updated"] = generated_at

    project_tech_path.parent.mkdir(parents=True, exist_ok=True)
    project_tech_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    return {
        "path": str(project_tech_path),
        "freshness": freshness,
        "language_file_counts": language_counts,
    }


def check_project_tech_freshness(
    workspace: Path | str,
    *,
    now: Optional[datetime] = None,
    strict: bool = False,
) -> Dict[str, Any]:
    project_tech_path = _project_tech_path(workspace)
    if not project_tech_path.exists():
        return {
            "status": "missing",
            "ok": True,
            "blocking": False,
            "path": str(project_tech_path),
            "message": "project-tech metadata file is missing; skip freshness gate",
        }

    try:
        payload = _load_project_tech_payload(project_tech_path)
    except (FileNotFoundError, ValueError) as exc:
        return {
            "status": "invalid",
            "ok": not strict,
            "blocking": bool(strict),
            "path": str(project_tech_path),
            "message": str(exc),
        }

    freshness = payload.get("freshness")
    freshness_payload = freshness if isinstance(freshness, dict) else {}
    metadata = payload.get("_metadata")
    metadata_payload = metadata if isinstance(metadata, dict) else {}

    generated_at = str(
        freshness_payload.get("generated_at")
        or metadata_payload.get("analysis_timestamp")
        or ""
    ).strip()
    source = str(
        freshness_payload.get("source")
        or metadata_payload.get("analysis_mode")
        or "unknown"
    ).strip()
    schema_version = str(
        freshness_payload.get("schema_version")
        or metadata_payload.get("version")
        or "legacy"
    ).strip()

    ttl_raw = freshness_payload.get("ttl_hours", DEFAULT_PROJECT_TECH_TTL_HOURS)
    try:
        ttl_hours = int(ttl_raw)
    except (TypeError, ValueError):
        ttl_hours = DEFAULT_PROJECT_TECH_TTL_HOURS
    if ttl_hours <= 0:
        ttl_hours = DEFAULT_PROJECT_TECH_TTL_HOURS

    if not generated_at:
        message = "project-tech freshness.generated_at is missing"
        return {
            "status": "invalid",
            "ok": not strict,
            "blocking": bool(strict),
            "path": str(project_tech_path),
            "source": source,
            "schema_version": schema_version,
            "ttl_hours": ttl_hours,
            "message": message,
        }

    try:
        generated_at_dt = _parse_iso_datetime(generated_at)
    except ValueError:
        message = f"project-tech freshness.generated_at is invalid: {generated_at}"
        return {
            "status": "invalid",
            "ok": not strict,
            "blocking": bool(strict),
            "path": str(project_tech_path),
            "generated_at": generated_at,
            "source": source,
            "schema_version": schema_version,
            "ttl_hours": ttl_hours,
            "message": message,
        }

    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)

    age_hours = max((current - generated_at_dt).total_seconds() / 3600.0, 0.0)
    stale = age_hours > float(ttl_hours)
    blocking = bool(strict and stale)

    if stale:
        message = (
            "project-tech metadata is stale "
            f"(age_hours={age_hours:.2f}, ttl_hours={ttl_hours})"
        )
    else:
        message = (
            "project-tech metadata is fresh "
            f"(age_hours={age_hours:.2f}, ttl_hours={ttl_hours})"
        )

    return {
        "status": "stale" if stale else "fresh",
        "ok": not blocking,
        "blocking": blocking,
        "path": str(project_tech_path),
        "generated_at": generated_at_dt.isoformat(),
        "source": source or "unknown",
        "schema_version": schema_version or "legacy",
        "ttl_hours": ttl_hours,
        "age_hours": round(age_hours, 2),
        "message": message,
    }

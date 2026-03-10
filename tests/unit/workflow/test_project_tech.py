"""project-tech freshness helper tests."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from src.workflow.project_tech import (
    check_project_tech_freshness,
    refresh_project_tech_metadata,
    _iter_source_files,
    _load_project_tech_payload,
    _parse_iso_datetime,
    _resolve_workspace_path,
)


def _write_project_tech(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _base_payload():
    return {
        "overview": {
            "technology_stack": {
                "languages": [
                    {"name": "Python"},
                    {"name": "TypeScript"},
                    {"name": "Rust"},
                ]
            }
        },
        "statistics": {},
        "_metadata": {
            "initialized_by": "unit-test",
            "version": "1.0.0",
        },
    }


def test_project_tech_loader_missing_file_branch(tmp_path):
    with pytest.raises(FileNotFoundError, match="project-tech file not found"):
        _load_project_tech_payload(tmp_path / ".workflow" / "missing-project-tech.json")


def test_refresh_project_tech_metadata_handles_non_dict_entries_and_metadata_type(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    payload = _base_payload()
    payload["overview"]["technology_stack"]["languages"] = ["bad", {"name": "Python"}]
    payload["_metadata"] = "invalid"
    _write_project_tech(project_tech_path, payload)

    (tmp_path / "src").mkdir(parents=True, exist_ok=True)
    (tmp_path / "src" / "a.py").write_text("print('ok')\n", encoding="utf-8")

    result = refresh_project_tech_metadata(tmp_path, source="unit:test", ttl_hours=24)
    assert result["language_file_counts"]["Python"] == 1

    persisted = json.loads(project_tech_path.read_text(encoding="utf-8"))
    assert persisted["overview"]["technology_stack"]["languages"][1]["file_count"] == 1
    assert isinstance(persisted["_metadata"], dict)


def test_check_project_tech_freshness_missing_file_is_non_blocking(tmp_path):
    result = check_project_tech_freshness(tmp_path, strict=True)

    assert result["status"] == "missing"
    assert result["ok"] is True
    assert result["blocking"] is False


def test_check_project_tech_freshness_invalid_json_respects_strict_mode(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    project_tech_path.parent.mkdir(parents=True, exist_ok=True)
    project_tech_path.write_text("{invalid", encoding="utf-8")

    result = check_project_tech_freshness(tmp_path, strict=True)

    assert result["status"] == "invalid"
    assert result["ok"] is False
    assert result["blocking"] is True


def test_check_project_tech_freshness_stale_blocks_when_strict(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    generated_at = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
    payload = _base_payload()
    payload["freshness"] = {
        "generated_at": generated_at,
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": 1,
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(
        tmp_path,
        now=datetime.now(timezone.utc),
        strict=True,
    )

    assert result["status"] == "stale"
    assert result["ok"] is False
    assert result["blocking"] is True
    assert result["ttl_hours"] == 1


def test_check_project_tech_freshness_missing_generated_at_strict(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    payload = _base_payload()
    payload["freshness"] = {
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": 2,
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(tmp_path, strict=True)

    assert result["status"] == "invalid"
    assert result["ok"] is False
    assert result["blocking"] is True


def test_check_project_tech_freshness_invalid_generated_at_strict(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    payload = _base_payload()
    payload["freshness"] = {
        "generated_at": "not-a-datetime",
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": 2,
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(tmp_path, strict=True)

    assert result["status"] == "invalid"
    assert result["ok"] is False
    assert result["blocking"] is True


def test_check_project_tech_freshness_invalid_ttl_falls_back_default(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    payload = _base_payload()
    payload["freshness"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": "bad-value",
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(tmp_path, strict=True)

    assert result["status"] == "fresh"
    assert result["ok"] is True
    assert result["ttl_hours"] == 168


def test_check_project_tech_freshness_fresh_when_within_ttl(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    generated_at = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    payload = _base_payload()
    payload["freshness"] = {
        "generated_at": generated_at,
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": 2,
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(
        tmp_path,
        now=datetime.now(timezone.utc),
        strict=True,
    )

    assert result["status"] == "fresh"
    assert result["ok"] is True
    assert result["blocking"] is False


def test_refresh_project_tech_metadata_rejects_non_positive_ttl(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    _write_project_tech(project_tech_path, _base_payload())

    with pytest.raises(ValueError, match="ttl_hours must be a positive integer"):
        refresh_project_tech_metadata(tmp_path, source="unit:test", ttl_hours=0)


def test_project_tech_payload_type_and_current_naive_time_paths(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    project_tech_path.parent.mkdir(parents=True, exist_ok=True)
    project_tech_path.write_text("[]", encoding="utf-8")

    with pytest.raises(ValueError, match="root payload"):
        _load_project_tech_payload(project_tech_path)

    payload = _base_payload()
    payload["freshness"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "unit:test",
        "schema_version": "1.1.0",
        "ttl_hours": -5,
    }
    _write_project_tech(project_tech_path, payload)

    result = check_project_tech_freshness(tmp_path, now=datetime.now(), strict=True)
    assert result["status"] == "fresh"
    assert result["ttl_hours"] == 168


def test_project_tech_helper_branches_parse_and_iter_and_resolve(tmp_path):
    parsed = _parse_iso_datetime("2026-01-01T00:00:00Z")
    assert parsed.tzinfo is not None

    parsed_naive = _parse_iso_datetime("2026-01-01T00:00:00")
    assert parsed_naive.tzinfo is not None

    with pytest.raises(ValueError, match="empty datetime"):
        _parse_iso_datetime("   ")

    resolved_from_str = _resolve_workspace_path(str(tmp_path))
    resolved_from_path = _resolve_workspace_path(tmp_path)
    assert resolved_from_str == resolved_from_path

    scan_root = tmp_path / "scan"
    (scan_root / "visible").mkdir(parents=True, exist_ok=True)
    (scan_root / "visible" / "a.py").write_text("print('ok')\n", encoding="utf-8")
    (scan_root / ".git").mkdir(parents=True, exist_ok=True)
    (scan_root / ".git" / "ignored.py").write_text("print('x')\n", encoding="utf-8")

    scanned = list(_iter_source_files(scan_root))
    names = {p.name for p in scanned}
    assert "a.py" in names
    assert "ignored.py" not in names



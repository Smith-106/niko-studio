"""project-tech freshness helper tests."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from src.workflow.project_tech import (
    check_project_tech_freshness,
    refresh_project_tech_metadata,
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


def test_refresh_project_tech_metadata_updates_freshness_and_counts(tmp_path):
    project_tech_path = tmp_path / ".workflow" / "project-tech.json"
    _write_project_tech(project_tech_path, _base_payload())

    (tmp_path / "src").mkdir(parents=True, exist_ok=True)
    (tmp_path / "src" / "a.py").write_text("print('ok')\n", encoding="utf-8")
    (tmp_path / "src" / "b.ts").write_text("export const a = 1;\n", encoding="utf-8")
    (tmp_path / "src" / "c.tsx").write_text("export const B = () => null;\n", encoding="utf-8")
    (tmp_path / "src" / "d.rs").write_text("fn main() {}\n", encoding="utf-8")

    (tmp_path / "node_modules").mkdir(parents=True, exist_ok=True)
    (tmp_path / "node_modules" / "skip.ts").write_text("export const skip = true;\n", encoding="utf-8")

    result = refresh_project_tech_metadata(tmp_path, source="unit:test", ttl_hours=24)

    assert result["freshness"]["source"] == "unit:test"
    assert result["freshness"]["ttl_hours"] == 24
    assert result["language_file_counts"] == {
        "Python": 1,
        "TypeScript": 2,
        "Rust": 1,
    }

    persisted = json.loads(project_tech_path.read_text(encoding="utf-8"))
    assert persisted["freshness"]["source"] == "unit:test"
    assert persisted["overview"]["technology_stack"]["languages"] == [
        {"name": "Python", "file_count": 1},
        {"name": "TypeScript", "file_count": 2},
        {"name": "Rust", "file_count": 1},
    ]


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

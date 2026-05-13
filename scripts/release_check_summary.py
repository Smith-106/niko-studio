#!/usr/bin/env python
"""Release readiness summary with deterministic Go/No-Go contract."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "release-check-summary.md"
RELEASE_EVIDENCE_DIR = PROJECT_ROOT / ".workflow" / "evidence" / "release"
RELEASE_READINESS_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"
AUTHORITY_ALIGNMENT_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "authority-alignment.json"
WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "writing-helper-acceptance.json"
PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "package-e2e-acceptance.json"
PACKAGED_APP_SMOKE_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "packaged-app-smoke.json"
GOVERNANCE_JUNIT_PATH = RELEASE_EVIDENCE_DIR / "governance-scripts.junit.xml"
PRODUCTION_GUARD_JUNIT_PATH = RELEASE_EVIDENCE_DIR / "vitest-production-guard.xml"
E2E_JUNIT_PATH = RELEASE_EVIDENCE_DIR / "vitest-e2e.xml"
ISSUE_HISTORY_PATH = PROJECT_ROOT / ".workflow" / "issues" / "issue-history.jsonl"
DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND = "npm --prefix desktop run check:local"
DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS = ["npm.cmd", "--prefix", "desktop", "run", "check:local"]
DESKTOP_LOCAL_SELFTEST_COMMAND = "npm --prefix desktop run local:selftest"
DESKTOP_PACKAGING_DRY_RUN_COMMAND = "npm --prefix desktop run validate:package:dry-run"
RELEASE_EVIDENCE_SCHEMA_VERSION = "evidence.v2"
RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS = 48
LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES = (
    "release_summary_report",
    "authority_alignment",
    "writing_helper_acceptance",
    "governance_scripts_regression",
)
ROADMAP_ISSUE_TERMINAL_STATUSES = ("completed", "closed", "resolved", "done")
SCORECARD_DIMENSIONS = (
    (
        "functional",
        "Functional closure",
        (
            "delivery_semantic_gate",
            "runtime_policy_conformance_signal",
            "external_e2e_smoke",
            "production_guard",
            "metrics_guard",
        ),
    ),
    (
        "testing",
        "Test gates",
        (
            "governance_scripts_regression",
            "baseline_tests_and_coverage",
        ),
    ),
    (
        "release",
        "Release readiness",
        (
            "desktop_check",
            "desktop_sidecar_readiness",
            "desktop_packaging_dry_run",
            "writing_helper_acceptance_signal",
            "package_e2e_acceptance_signal",
            "local_selftest_enforcement",
        ),
    ),
    (
        "governance",
        "Governance closure",
        (
            "authority_alignment_signal",
            "evidence_completeness_blocker_signal",
            "gate_score_or_critical_blocker_signal",
            "issue_pending_blocker_signal",
        ),
    ),
)


@dataclass(frozen=True)
class FileAnchorRule:
    file_path: str
    pattern: str
    reason: str
    required: bool = True


def run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=merged_env,
    )
    output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    return result.returncode, output.strip()


def parse_pytest_counts(output: str) -> tuple[str, str]:
    match = re.search(r"(\d+)\s+passed", output, flags=re.IGNORECASE)
    if match:
        return "passed", match.group(1)
    vitest_match = re.search(r"tests?\s+(\d+)\s+passed", output, flags=re.IGNORECASE)
    if vitest_match:
        return "passed", vitest_match.group(1)
    if "failed" in output.lower():
        fail_match = re.search(r"(\d+)\s+failed", output, flags=re.IGNORECASE)
        return "failed", fail_match.group(1) if fail_match else "unknown"
    return "unknown", "0"


def _read_project_text(path: str) -> str | None:
    target = PROJECT_ROOT / path
    if not target.exists():
        return None
    return target.read_text(encoding="utf-8", errors="replace")


def _run_file_anchor_guard(name: str, rules: list[FileAnchorRule]) -> tuple[int, str]:
    cache: dict[str, str | None] = {}
    failures: list[str] = []
    passed: list[str] = []

    for rule in rules:
        if rule.file_path not in cache:
            cache[rule.file_path] = _read_project_text(rule.file_path)
        content = cache[rule.file_path]
        if content is None:
            failures.append(f"[FAIL] 缺少门禁文件: {rule.file_path}")
            continue

        matched = bool(re.search(rule.pattern, content, flags=re.MULTILINE))
        if rule.required and not matched:
            failures.append(f"[FAIL] {rule.file_path}: {rule.reason}")
            continue
        if not rule.required and matched:
            failures.append(f"[FAIL] {rule.file_path}: {rule.reason}")
            continue

        passed.append(f"[PASS] {rule.file_path}: {rule.reason}")

    if failures:
        output = "\n".join([f"{name}: blocked", *failures])
        return 1, output

    output = "\n".join([f"{name}: ok", *passed])
    return 0, output


def parse_first_json_object(output: str) -> tuple[dict[str, object] | None, str | None]:
    decoder = json.JSONDecoder()
    for index, char in enumerate(output):
        if char != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(output[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload, None
        return None, "json payload is not an object"
    return None, "json payload not found in output"


def build_check_result(
    check_id: str,
    priority: str,
    blocking: bool,
    exit_code: int,
    detail: str,
    status_override: str | None = None,
) -> dict[str, object]:
    status = status_override if status_override else ("PASS" if exit_code == 0 else "FAIL")
    return {
        "check_id": check_id,
        "priority": priority,
        "blocking": blocking,
        "status": status,
        "exit_code": exit_code,
        "detail": detail,
    }


def normalize_release_evidence_status(status: str) -> str:
    normalized = str(status or "").strip().upper()
    if normalized == "PASSED":
        return "PASS"
    if normalized == "FAILED":
        return "FAIL"
    return normalized or "UNKNOWN"


def _count_non_template_markdown(directory: Path) -> int:
    if not directory.exists():
        return 0
    count = 0
    for path in directory.glob("*.md"):
        if path.name.startswith("TEMPLATE-"):
            continue
        count += 1
    return count


def _iter_non_template_markdown_paths(directories: list[Path]) -> list[Path]:
    paths: list[Path] = []
    for directory in directories:
        if not directory.exists():
            continue
        for path in directory.glob("*.md"):
            if path.name.startswith("TEMPLATE-"):
                continue
            paths.append(path)
    return paths


def _read_markdown_corpus(directories: list[Path]) -> str:
    corpus: list[str] = []
    for directory in directories:
        if not directory.exists():
            continue
        for path in directory.glob("*.md"):
            if path.name.startswith("TEMPLATE-"):
                continue
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                corpus.append(handle.read())
    return "\n".join(corpus)


def _missing_required_patterns(corpus: str, required_patterns: dict[str, str]) -> list[str]:
    return [key for key, pattern in required_patterns.items() if not re.search(pattern, corpus)]


def _has_traceable_link(corpus: str) -> bool:
    return bool(
        re.search(r"\[[^\]]+\]\([^)]+\)", corpus)
        or re.search(r"https?://", corpus)
        or re.search(r"[\w./-]+\.md", corpus)
    )


def _format_detail_pairs(pairs: list[tuple[str, object]]) -> str:
    return ",".join(f"{key}={value}" for key, value in pairs)


def _format_csv(values: list[str]) -> str:
    return ",".join(values)


def _build_scorecard_section(
    scorecard_dimensions: list[dict[str, object]],
    delivery_contract: dict[str, object] | None = None,
) -> str:
    lines = [
        "## 100% Scorecard Dimensions",
        "",
    ]
    if delivery_contract:
        lines.extend(
            [
                f"- Contract: {delivery_contract.get('contract_id', 'unknown')} — {delivery_contract.get('label', 'unknown')}",
                f"- Status: {delivery_contract.get('status', 'unknown')}",
                (
                    "- Completion: "
                    f"{delivery_contract.get('completion_percent', 0.0)}% "
                    f"({delivery_contract.get('passed_dimensions', 0)}/{delivery_contract.get('required_dimensions', 0)} dimensions passed)"
                ),
                f"- Decision rule: {delivery_contract.get('decision_rule', 'unknown')}",
                f"- Blocking signal: {delivery_contract.get('gate_signal', 'delivery_contract_100_signal')}",
                "",
            ]
        )
    lines.extend(
        [
            "| dimension_id | label | status | blocking_failures | non_pass_checks |",
            "|---|---|---|---|---|",
        ]
    )
    for dimension in scorecard_dimensions:
        lines.append(
            "| {dimension_id} | {label} | {status} | {blocking_failures} | {non_pass_checks} |".format(
                dimension_id=dimension.get("dimension_id", "unknown"),
                label=dimension.get("label", "unknown"),
                status=dimension.get("status", "unknown"),
                blocking_failures=_format_csv(
                    [str(item) for item in dimension.get("blocking_failures", [])]
                )
                or "none",
                non_pass_checks=_format_csv(
                    [str(item) for item in dimension.get("non_pass_checks", [])]
                )
                or "none",
            )
        )
    lines.extend(
        [
            "",
            "Single scorecard contract: functional + testing + release + governance must all be PASS before the repo can claim 100% completion.",
            "Verification path: release check + issue pending inspection + targeted governance regression.",
        ]
    )
    return "\n".join(lines)


def _build_delivery_contract(scorecard_dimensions: list[dict[str, object]]) -> dict[str, object]:
    required_dimensions = len(scorecard_dimensions)
    passed_dimensions = sum(
        1 for dimension in scorecard_dimensions if str(dimension.get("status") or "") == "PASS"
    )
    failed_dimensions = [
        str(dimension.get("dimension_id") or "unknown")
        for dimension in scorecard_dimensions
        if str(dimension.get("status") or "") != "PASS"
    ]
    completion_percent = (
        round(
            (passed_dimensions / required_dimensions) * 100,
            1,
        )
        if required_dimensions
        else 0.0
    )
    status = (
        "PASS" if required_dimensions > 0 and passed_dimensions == required_dimensions else "FAIL"
    )
    return {
        "contract_id": "ISS-20260423-001",
        "label": "100% delivery contract",
        "gate_signal": "delivery_contract_100_signal",
        "status": status,
        "decision_rule": "all scorecard dimensions must PASS",
        "required_dimensions": required_dimensions,
        "passed_dimensions": passed_dimensions,
        "failed_dimensions": failed_dimensions,
        "completion_percent": completion_percent,
    }


def delivery_contract_100_signal(delivery_contract: dict[str, object]) -> tuple[str, int, str]:
    status = str(delivery_contract.get("status") or "FAIL")
    exit_code = 0 if status == "PASS" else 1
    failed_dimensions = delivery_contract.get("failed_dimensions")
    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("contract_id", delivery_contract.get("contract_id") or "unknown"),
                ("label", delivery_contract.get("label") or "unknown"),
                ("required_dimensions", delivery_contract.get("required_dimensions") or 0),
                ("passed_dimensions", delivery_contract.get("passed_dimensions") or 0),
                (
                    "failed_dimensions",
                    _format_csv(failed_dimensions if isinstance(failed_dimensions, list) else [])
                    or "none",
                ),
                ("completion_percent", delivery_contract.get("completion_percent") or 0.0),
                ("decision", "go" if status == "PASS" else "no_go"),
            ]
        ),
    )


def _build_check_detail_summary_section(checks: list[dict[str, object]]) -> str:
    lines = ["### Check Detail Summary (from machine payload)", ""]
    if checks:
        lines.extend(
            f"- {item['check_id']}: status={item['status']}, detail={item['detail']}"
            for item in checks
        )
    else:
        lines.append("- no checks")
    return "\n".join(lines)


def _build_release_evidence_summary_section(release_evidence: dict[str, object]) -> str:
    evidence_sources = release_evidence.get("evidence_sources")
    source_rows = evidence_sources if isinstance(evidence_sources, list) else []
    lines = [
        "## Retained Release Evidence",
        "",
        f"- current_head_sha: {release_evidence.get('head_sha', 'unknown')}",
        f"- current_version: {release_evidence.get('version', 'unknown')}",
        f"- release_evidence_generated_at: {release_evidence.get('generated_at', 'unknown')}",
        f"- freshness_window_hours: {release_evidence.get('freshness_window_hours', 'unknown')}",
        f"- release_evidence_status: {release_evidence.get('status', 'unknown')}",
        f"- blocking_sources: {_format_csv(release_evidence.get('blocking_sources', [])) or 'none'}",
        "",
        "| source_id | status | freshness_status | supersession_status | evidence_state |",
        "|---|---|---|---|---|",
    ]
    lines.extend(
        "| {source_id} | {status} | {freshness_status} | {supersession_status} | {evidence_state} |".format(
            source_id=row.get("source_id", "unknown"),
            status=row.get("status", "unknown"),
            freshness_status=row.get("freshness_status", "unknown"),
            supersession_status=row.get("supersession_status", "unknown"),
            evidence_state=row.get("evidence_state", "unknown"),
        )
        for row in source_rows
        if isinstance(row, dict)
    )
    return "\n".join(lines)


def _trace_path(path: Path) -> str:
    try:
        relative_path = path.relative_to(PROJECT_ROOT)
        return str(relative_path).replace("\\", "/")
    except ValueError:
        return path.resolve().as_posix()


def _read_json_version(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    version = payload.get("version")
    if isinstance(version, str):
        return version.strip() or None
    return None


def _current_release_version() -> str | None:
    return _read_json_version(PROJECT_ROOT / "desktop" / "package.json")


def _parse_iso_datetime(raw_value: str) -> tuple[datetime | None, str | None]:
    value = raw_value.strip()
    if not value:
        return None, "missing"
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        return None, str(exc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc), None


def _evaluate_retained_evidence(
    generated_at: str,
    head_sha: str,
    current_head_sha: str | None,
    *,
    freshness_window_hours: int,
    now: datetime | None = None,
    version: str | None = None,
    current_version: str | None = None,
) -> dict[str, object]:
    now_dt = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    parsed_generated_at, generated_at_parse_error = _parse_iso_datetime(generated_at)

    freshness_status = "unknown"
    freshness_age_hours: float | str = "unknown"
    if parsed_generated_at is not None:
        age_seconds = max(0.0, (now_dt - parsed_generated_at).total_seconds())
        freshness_age_hours = round(age_seconds / 3600, 2)
        freshness_status = "fresh" if age_seconds <= freshness_window_hours * 3600 else "stale"

    supersession_reasons: list[str] = []
    supersession_status = "unknown"
    if head_sha and current_head_sha:
        supersession_status = "current"
        if head_sha != current_head_sha:
            supersession_status = "superseded"
            supersession_reasons.append("head_mismatch")
    elif head_sha:
        supersession_reasons.append("current_head_unknown")
    else:
        supersession_reasons.append("head_sha_missing")

    if version and current_version and version != current_version:
        supersession_status = "superseded"
        supersession_reasons.append("version_mismatch")

    evidence_state = "unknown"
    if freshness_status == "fresh" and supersession_status == "current":
        evidence_state = "fresh_current"
    elif freshness_status == "stale" and supersession_status == "current":
        evidence_state = "stale_current"
    elif freshness_status == "fresh" and supersession_status == "superseded":
        evidence_state = "fresh_superseded"
    elif freshness_status == "stale" and supersession_status == "superseded":
        evidence_state = "stale_superseded"
    elif freshness_status == "unknown" and supersession_status == "current":
        evidence_state = "unknown_current"
    elif freshness_status == "unknown" and supersession_status == "superseded":
        evidence_state = "unknown_superseded"

    return {
        "freshness_window_hours": freshness_window_hours,
        "freshness_status": freshness_status,
        "freshness_age_hours": freshness_age_hours,
        "supersession_status": supersession_status,
        "supersession_reasons": supersession_reasons,
        "evidence_state": evidence_state,
        "generated_at_parse_error": None
        if generated_at_parse_error == "missing"
        else generated_at_parse_error,
        "is_fresh": freshness_status == "fresh",
        "is_current": supersession_status == "current",
    }


def _build_release_readiness_artifact(
    decision: str,
    go_no_go_reasons: list[str],
    generated_at: str,
    head_sha: str | None,
    version: str | None,
    checks: list[dict[str, object]],
    release_evidence: dict[str, object],
    report_path: Path,
) -> dict[str, object]:
    return {
        "artifact_type": "release_readiness",
        "schema_version": RELEASE_EVIDENCE_SCHEMA_VERSION,
        "decision": decision,
        "go_no_go_reasons": go_no_go_reasons,
        "generated_at": generated_at,
        "head_sha": head_sha,
        "version": version,
        "freshness_window_hours": RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        "checks": checks,
        "release_evidence": release_evidence,
        "trace": {
            "trace_id": f"release-readiness-{generated_at}",
            "session_id": "release-summary",
            "run_id": "release-check-summary",
            "artifact_path": _trace_path(RELEASE_READINESS_ARTIFACT_PATH),
            "report_path": _trace_path(report_path),
        },
    }


def _write_release_readiness_artifact(
    decision: str,
    go_no_go_reasons: list[str],
    generated_at: str,
    head_sha: str | None,
    version: str | None,
    checks: list[dict[str, object]],
    release_evidence: dict[str, object],
    report_path: Path,
) -> Path:
    RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    artifact_payload = _build_release_readiness_artifact(
        decision=decision,
        go_no_go_reasons=go_no_go_reasons,
        generated_at=generated_at,
        head_sha=head_sha,
        version=version,
        checks=checks,
        release_evidence=release_evidence,
        report_path=report_path,
    )
    RELEASE_READINESS_ARTIFACT_PATH.write_text(
        json.dumps(artifact_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return RELEASE_READINESS_ARTIFACT_PATH


def _write_json_artifact(path: Path, payload: dict[str, object]) -> Path:
    RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def _write_authority_alignment_artifact(
    payload: dict[str, object] | None,
    parse_error: str | None,
    raw_output: str,
) -> Path:
    artifact_payload: dict[str, object]
    if payload is None:
        artifact_payload = {
            "status": "FAIL",
            "parse_error": parse_error or "unknown",
            "raw_output": raw_output,
        }
    else:
        artifact_payload = payload
    return _write_json_artifact(AUTHORITY_ALIGNMENT_ARTIFACT_PATH, artifact_payload)


def _read_json_artifact(path: Path) -> tuple[dict[str, object] | None, str | None]:
    if not path.exists():
        return None, None

    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig", errors="replace"))
    except json.JSONDecodeError as exc:
        return None, str(exc)

    if not isinstance(payload, dict):
        return None, "json payload is not an object"

    return payload, None


def _current_head_sha() -> str | None:
    code, output = run_cmd(["git", "rev-parse", "HEAD"])
    if code != 0:
        return None
    head_sha = output.strip()
    return head_sha or None


def _build_release_evidence_source(
    source_id: str,
    artifact_path: Path,
    status: str,
    generated_at: str,
    head_sha: str | None,
    current_head_sha: str | None,
    *,
    source_type: str,
    now: datetime | None = None,
    version: str | None = None,
    current_version: str | None = None,
) -> dict[str, object]:
    retained_evidence = _evaluate_retained_evidence(
        generated_at,
        head_sha or "",
        current_head_sha,
        freshness_window_hours=RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        now=now,
        version=version,
        current_version=current_version,
    )
    return {
        "source_id": source_id,
        "source_type": source_type,
        "artifact_path": _trace_path(artifact_path),
        "status": status,
        "generated_at": generated_at or "missing",
        "head_sha": head_sha or "missing",
        "version": version or "unknown",
        "freshness_window_hours": retained_evidence["freshness_window_hours"],
        "freshness_status": retained_evidence["freshness_status"],
        "freshness_age_hours": retained_evidence["freshness_age_hours"],
        "supersession_status": retained_evidence["supersession_status"],
        "supersession_reasons": retained_evidence["supersession_reasons"],
        "evidence_state": retained_evidence["evidence_state"],
        "is_fresh": retained_evidence["is_fresh"],
        "is_current": retained_evidence["is_current"],
        "generated_at_parse_error": retained_evidence["generated_at_parse_error"] or "none",
    }


def _read_issue_history_entries(
    issue_history_path: Path = ISSUE_HISTORY_PATH,
) -> list[dict[str, object]]:
    if not issue_history_path.exists():
        return []

    entries: list[dict[str, object]] = []
    for raw_line in issue_history_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            entries.append(payload)
    return entries


def issue_pending_blocker_signal(
    issue_history_path: Path = ISSUE_HISTORY_PATH,
) -> tuple[str, int, str]:
    entries = _read_issue_history_entries(issue_history_path)
    roadmap_entries = [
        entry
        for entry in entries
        if isinstance(entry.get("id"), str) and entry["id"].startswith("ISS-20260423-")
    ]
    pending_entries = [
        entry
        for entry in roadmap_entries
        if str(entry.get("status") or "").strip().lower() not in ROADMAP_ISSUE_TERMINAL_STATUSES
    ]
    pending_ids = [str(entry.get("id") or "unknown") for entry in pending_entries]

    has_blocker = bool(pending_entries)
    return (
        "FAIL" if has_blocker else "PASS",
        1 if has_blocker else 0,
        _format_detail_pairs(
            [
                ("issue_history", _trace_path(issue_history_path)),
                ("roadmap_issues_checked", len(roadmap_entries)),
                ("pending_issues", len(pending_entries)),
                ("pending_issue_ids", _format_csv(pending_ids) or "none"),
                ("terminal_statuses", _format_csv(list(ROADMAP_ISSUE_TERMINAL_STATUSES))),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def _build_scorecard_dimensions(
    checks: list[dict[str, object]],
) -> list[dict[str, object]]:
    check_map = {str(item.get("check_id") or ""): item for item in checks if isinstance(item, dict)}
    dimensions: list[dict[str, object]] = []

    for dimension_id, label, check_ids in SCORECARD_DIMENSIONS:
        rows = [check_map[check_id] for check_id in check_ids if check_id in check_map]
        blocking_failures = [
            str(row.get("check_id") or "unknown")
            for row in rows
            if bool(row.get("blocking")) and str(row.get("status") or "") == "FAIL"
        ]
        non_pass = [
            str(row.get("check_id") or "unknown")
            for row in rows
            if str(row.get("status") or "") != "PASS"
        ]
        dimensions.append(
            {
                "dimension_id": dimension_id,
                "label": label,
                "status": "PASS" if not blocking_failures and not non_pass else "FAIL",
                "check_ids": list(check_ids),
                "blocking_failures": blocking_failures,
                "non_pass_checks": non_pass,
            }
        )

    return dimensions


def _run_governance_scripts_regression(junit_output_path: Path) -> tuple[int, str]:
    return run_cmd(
        [
            sys.executable,
            "scripts/run_targeted_pytest.py",
            "tests/unit/scripts/test_governance_scripts.py",
            "-q",
            f"--junitxml={junit_output_path.resolve()}",
        ]
    )


def _run_release_runtime_guard(junit_output_path: Path) -> tuple[int, str]:
    return run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "src-ts",
            "exec",
            "--",
            "vitest",
            "run",
            "tests/gateway-server.runtime.test.ts",
            "tests/mcp/health-endpoints.test.ts",
            "--reporter=basic",
            "--reporter=junit",
            f"--outputFile.junit={junit_output_path.resolve()}",
        ],
        env={
            "NIKO_ENV": "production",
            "NIKO_CORS_PROD_ORIGINS": "https://app.example.com,https://gray.example.com",
            "NIKO_GATEWAY_METRICS_ENABLED": "true",
        },
    )


def _extract_policy_contract_from_docs(quality_doc: Path, pdd_doc: Path) -> dict[str, object]:
    quality_text = (
        quality_doc.read_text(encoding="utf-8", errors="replace") if quality_doc.exists() else ""
    )
    pdd_text = pdd_doc.read_text(encoding="utf-8", errors="replace") if pdd_doc.exists() else ""

    quality_pass_match = re.search(
        r"quality\s+pass\s+threshold\s*:\s*>=\s*(\d+(?:\.\d+)?)", quality_text, flags=re.IGNORECASE
    )
    pdd_ranges = re.findall(r"(\d+(?:\.\d+)?)\s*<=\s*total_score\s*<\s*(\d+(?:\.\d+)?)", pdd_text)
    rewrite_candidates = [
        float(value)
        for value in re.findall(r"total_score\s*<\s*(\d+(?:\.\d+)?)", pdd_text, flags=re.IGNORECASE)
    ]

    human_review_lower = None
    revise_lower = None
    if len(pdd_ranges) >= 2:
        human_review_lower = float(pdd_ranges[0][0])
        revise_lower = float(pdd_ranges[1][0])

    rewrite_below = min(rewrite_candidates) if rewrite_candidates else None

    return {
        "quality_pass_score": float(quality_pass_match.group(1)) if quality_pass_match else None,
        "human_review_score": human_review_lower,
        "revise_lower_bound": revise_lower,
        "rewrite_below": rewrite_below,
        "blocked_semantics_declared": "=> `BLOCKED`" in pdd_text,
    }


def _runtime_policy_contract() -> dict[str, object]:
    novel_state_text = _read_project_text("src-ts/workflow/novel-state.ts") or ""
    novel_quality_text = _read_project_text("src-ts/workflow/novel-quality.ts") or ""
    contract_text = _read_project_text("src-ts/mcp/contract.ts") or ""
    workflow_engine_text = _read_project_text("src-ts/workflow/workflow-engine.ts") or ""
    workflow_risk_text = _read_project_text("src-ts/workflow/engine/risk.ts") or ""

    pass_score = _extract_first_float(
        r"export const NOVEL_PASS_SCORE = (\d+(?:\.\d+)?)", novel_state_text
    )
    human_review_score = _extract_first_float(
        r"export const NOVEL_HUMAN_REVIEW_SCORE = (\d+(?:\.\d+)?)",
        novel_state_text,
    )
    block_threshold = _extract_first_float(r"block:\s*(\d+(?:\.\d+)?)", novel_state_text)
    novel_quality_pass_threshold = (
        pass_score
        if "const PASS_THRESHOLD = NOVEL_QUALITY_THRESHOLDS.pass;" in novel_quality_text
        else None
    )

    default_pass_bound = bool(re.search(r"pass_score:\s*NOVEL_PASS_SCORE\b", novel_state_text))
    default_review_bound = bool(
        re.search(r"human_review_score:\s*NOVEL_HUMAN_REVIEW_SCORE\b", novel_state_text)
    )
    public_entry_api_present = bool(
        re.search(
            r"ENGINE_PUBLIC_ENTRY_API\s*=\s*\['route',\s*'plan',\s*'execute',\s*'run',\s*'run_stream'\]",
            workflow_engine_text,
        )
    )
    workflow_hard_gate_present = (
        "WorkflowDecision.NO_GO" in workflow_engine_text
        or "WorkflowDecision.NO_GO" in workflow_risk_text
    ) and "confirm_required: true" in workflow_risk_text
    quality_mode_consistent = (
        "const qualityMode = options?.qualityMode ?? 'auto';" in novel_quality_text
        and "const resolvedMode = _normalizeQualityMode(qualityMode);" in novel_quality_text
        and "quality_mode_used: resolvedMode" in novel_quality_text
    )
    terminal_default_decision = (
        "go"
        if "if (normalized.decision === undefined) normalized.decision = 'go';" in contract_text
        else None
    )
    terminal_no_go_preserved = bool(
        re.search(
            r"if \(normalized\.decision === undefined\) normalized\.decision = 'go';",
            contract_text,
        )
        and re.search(
            r"if \(lf\.decision === undefined\) lf\.decision = normalized\.decision;", contract_text
        )
    )

    return {
        "quality_pass_score": pass_score,
        "human_review_score": human_review_score,
        "revise_lower_bound": block_threshold,
        "rewrite_below": block_threshold,
        "novel_quality_pass_threshold": novel_quality_pass_threshold,
        "default_pass_score": pass_score if default_pass_bound else None,
        "default_human_review_score": human_review_score if default_review_bound else None,
        "publish_from_go": "pass" if re.search(r"go:\s*'pass'", contract_text) else None,
        "publish_from_soft_go": "revise"
        if re.search(r"soft_go:\s*'revise'", contract_text)
        else None,
        "publish_from_no_go": "block" if re.search(r"no_go:\s*'block'", contract_text) else None,
        "terminal_default_decision": terminal_default_decision,
        "terminal_no_go_preserved": terminal_no_go_preserved,
        "workflow_hard_gate_present": workflow_hard_gate_present,
        "public_entry_api_present": public_entry_api_present,
        "quality_mode_consistent": quality_mode_consistent,
        "blocked_semantics_declared": workflow_hard_gate_present,
    }


def runtime_policy_conformance_signal(
    quality_doc: Path | None = None,
    pdd_doc: Path | None = None,
    runtime_contract: dict[str, object] | None = None,
) -> tuple[str, int, str]:
    quality_path = quality_doc or (PROJECT_ROOT / "docs" / "quality" / "QUALITY_CRITERIA.md")
    pdd_path = pdd_doc or (PROJECT_ROOT / "docs" / "PDD.md")

    policy_contract = _extract_policy_contract_from_docs(quality_path, pdd_path)
    runtime = runtime_contract if runtime_contract is not None else _runtime_policy_contract()

    mismatches: list[str] = []

    if runtime.get("quality_pass_score") != policy_contract.get("quality_pass_score"):
        mismatches.append("quality_pass_score")
    if runtime.get("human_review_score") != policy_contract.get("human_review_score"):
        mismatches.append("human_review_score")
    if runtime.get("revise_lower_bound") != policy_contract.get("revise_lower_bound"):
        mismatches.append("revise_lower_bound")
    if runtime.get("rewrite_below") != policy_contract.get("rewrite_below"):
        mismatches.append("rewrite_below")

    if runtime.get("default_pass_score") != runtime.get("quality_pass_score"):
        mismatches.append("default_pass_score")
    if runtime.get("default_human_review_score") != runtime.get("human_review_score"):
        mismatches.append("default_human_review_score")

    if runtime.get("novel_quality_pass_threshold") != runtime.get("quality_pass_score"):
        mismatches.append("novel_quality_pass_threshold")

    if runtime.get("publish_from_go") != "pass":
        mismatches.append("publish_from_go")
    if runtime.get("publish_from_soft_go") != "revise":
        mismatches.append("publish_from_soft_go")
    if runtime.get("publish_from_no_go") != "block":
        mismatches.append("publish_from_no_go")

    terminal_default_decision = str(runtime.get("terminal_default_decision") or "").strip().lower()
    if not terminal_default_decision:
        mismatches.append("terminal_default_decision")
    if runtime.get("terminal_no_go_preserved") is not True:
        mismatches.append("terminal_no_go_preserved")
    if runtime.get("quality_mode_consistent") is not True:
        mismatches.append("quality_mode_consistent")

    if policy_contract.get("blocked_semantics_declared") is not True:
        mismatches.append("blocked_semantics_declared")
    if runtime.get("workflow_hard_gate_present") is not True:
        mismatches.append("workflow_hard_gate_present")
    if runtime.get("public_entry_api_present") is not True:
        mismatches.append("public_entry_api_present")

    has_mismatch = len(mismatches) > 0
    status = "FAIL" if has_mismatch else "PASS"
    exit_code = 1 if has_mismatch else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("policy_pass", policy_contract.get("quality_pass_score")),
                ("runtime_pass", runtime.get("quality_pass_score")),
                ("policy_human_review", policy_contract.get("human_review_score")),
                ("runtime_human_review", runtime.get("human_review_score")),
                ("policy_revise_lower", policy_contract.get("revise_lower_bound")),
                ("runtime_revise_lower", runtime.get("revise_lower_bound")),
                ("policy_rewrite_below", policy_contract.get("rewrite_below")),
                ("runtime_rewrite_below", runtime.get("rewrite_below")),
                ("publish_from_go", runtime.get("publish_from_go")),
                ("publish_from_soft_go", runtime.get("publish_from_soft_go")),
                ("publish_from_no_go", runtime.get("publish_from_no_go")),
                ("terminal_default_decision", terminal_default_decision or "missing"),
                (
                    "terminal_no_go_preserved",
                    "yes" if runtime.get("terminal_no_go_preserved") else "no",
                ),
                (
                    "quality_mode_consistent",
                    "yes" if runtime.get("quality_mode_consistent") else "no",
                ),
                (
                    "workflow_hard_gate_present",
                    "yes" if runtime.get("workflow_hard_gate_present") else "no",
                ),
                (
                    "public_entry_api_present",
                    "yes" if runtime.get("public_entry_api_present") else "no",
                ),
                ("mismatches", _format_csv(mismatches)),
                ("decision", "no_go" if has_mismatch else "go"),
            ]
        ),
    )


def _extract_first_float(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, flags=re.MULTILINE)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _typescript_production_guard() -> tuple[int, str]:
    return _run_file_anchor_guard(
        "production guard",
        [
            FileAnchorRule(
                "src-ts/mcp/config.ts",
                r"export function resolveReloadEnabled\(\): boolean",
                "缺少 resolveReloadEnabled 定义",
            ),
            FileAnchorRule(
                "src-ts/mcp/config.ts",
                r"if \(isProductionEnv\(\)\)\s*return false;",
                "生产环境未显式关闭 reload",
            ),
            FileAnchorRule(
                "src-ts/mcp/config.ts",
                r"export function resolveCorsOrigins\(\): string\[\]",
                "缺少 resolveCorsOrigins 定义",
            ),
            FileAnchorRule(
                "src-ts/mcp/config.ts",
                r"const forbidden = new Set\(\['\*', 'http://localhost:3000', 'http://127.0.0.1:3000'\]\);",
                "生产 CORS 黑名单锚点缺失",
            ),
            FileAnchorRule(
                "src-ts/mcp/config.ts",
                r"Production CORS origins are empty",
                "生产 CORS 为空时未显式抛错",
            ),
        ],
    )


def _typescript_metrics_guard() -> tuple[int, str]:
    return _run_file_anchor_guard(
        "metrics guard",
        [
            FileAnchorRule(
                "src-ts/mcp/endpoints/health.ts",
                r"export async function metricsEndpoint",
                "缺少 metricsEndpoint 入口",
            ),
            FileAnchorRule(
                "src-ts/mcp/endpoints/health.ts",
                r"metricsEnabled = !!gw\.getConfigValue\('gateway\.metrics_enabled', true\);",
                "缺少 metrics_enabled 守卫读取",
            ),
            FileAnchorRule(
                "src-ts/mcp/endpoints/health.ts",
                r"return jsonResponse\(\{ status: 'disabled' \}, 404\);",
                "缺少 metrics 禁用态 404 响应守卫",
            ),
            FileAnchorRule(
                "src-ts/mcp/endpoints/health.ts",
                r"metrics: gw\.getMetricsSnapshot\(\),",
                "缺少 metrics 快照输出",
            ),
            FileAnchorRule(
                "src-ts/mcp/routes/platform.ts",
                r"pattern:\s*/\^\\/metrics\$/\s*,\s*handler:\s*metricsEndpoint",
                "缺少 /metrics 路由注册",
            ),
        ],
    )


def slo_baseline_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "ttft": r"\bttft\b",
        "e2e": r"\be2e\b",
        "effective_hit_rate": r"effective[_\s-]?hit[_\s-]?rate",
        "context_budget_utilization": r"context[_\s-]?budget[_\s-]?utilization",
        "gate consistency": r"gate[_\s-]?consisten",
    }

    missing = _missing_required_patterns(corpus, required_patterns)

    if not missing:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    (
                        "keywords_present",
                        "ttft,e2e,effective_hit_rate,context_budget_utilization,gate consistency",
                    ),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("missing_keywords", _format_csv(missing)),
            ]
        ),
    )


def evidence_links_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir])
    lowered = corpus.lower()

    has_evidence_links_key = "evidence_links" in lowered
    has_traceable_link = _has_traceable_link(corpus)

    if has_evidence_links_key and has_traceable_link:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("evidence_links_key", "present"),
                    ("traceable_link", "present"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("evidence_links_key", "present" if has_evidence_links_key else "missing"),
                ("traceable_link", "present" if has_traceable_link else "missing"),
            ]
        ),
    )


def self_learning_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "reflector": r"\breflector\b",
        "curator": r"\bcurator\b",
        "playbook": r"\bplaybook\b",
    }

    missing = _missing_required_patterns(corpus, required_patterns)

    if not missing:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("fields_present", "reflector,curator,playbook"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("missing_fields", _format_csv(missing)),
            ]
        ),
    )


def _extract_metric_value(corpus: str, metric_key: str) -> float | None:
    pattern = rf"\b{re.escape(metric_key)}\b\s*[:=]\s*(-?\d+(?:\.\d+)?)"
    match = re.search(pattern, corpus, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def memory_observability_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir])

    metric_keys = ["c_effective", "s_final", "r_memory"]
    missing: list[str] = []
    invalid: list[str] = []

    for key in metric_keys:
        value = _extract_metric_value(corpus, key)
        if value is None:
            missing.append(key)
            continue
        if not (0.0 <= value <= 1.0):
            invalid.append(key)

    if not missing and not invalid:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("metrics_present", "c_effective,s_final,r_memory"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("missing_metrics", _format_csv(missing)),
                ("invalid_metrics", _format_csv(invalid)),
            ]
        ),
    )


def compliance_keywords_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "rbac": r"\brbac\b",
        "audit": r"\baudit\b",
        "rollback": r"\brollback\b",
    }

    missing = _missing_required_patterns(corpus, required_patterns)

    if not missing:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("keywords_present", "rbac,audit,rollback"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("missing_keywords", _format_csv(missing)),
            ]
        ),
    )


def migration_rollback_evidence_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_migration = bool(re.search(r"\bmigration\b|\bmigrate\b|\bschema\b", corpus))
    has_rollback = bool(re.search(r"\brollback\b|\broll[-_\s]?back\b|\brevert\b", corpus))
    has_traceable_link = _has_traceable_link(corpus)

    if has_migration and has_rollback and has_traceable_link:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("migration", "present"),
                    ("rollback", "present"),
                    ("traceable_link", "present"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("migration", "present" if has_migration else "missing"),
                ("rollback", "present" if has_rollback else "missing"),
                ("traceable_link", "present" if has_traceable_link else "missing"),
            ]
        ),
    )


def quality_level_trace_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    effective_match = re.search(
        r"effective[_\s-]?quality[_\s-]?level\s*[:=]\s*(ultra|high|medium|fluent)", corpus
    )
    used_match = re.search(
        r"quality[_\s-]?level[_\s-]?used\s*[:=]\s*(ultra|high|medium|fluent)", corpus
    )

    effective_value = effective_match.group(1) if effective_match else "missing"
    used_value = used_match.group(1) if used_match else "missing"

    if effective_match and used_match:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("effective_quality_level", effective_value),
                    ("quality_level_used", used_value),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("effective_quality_level", effective_value),
                ("quality_level_used", used_value),
            ]
        ),
    )


def degrade_trace_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_degrade_reason = bool(re.search(r"degrade[_\s-]?reason", corpus))
    has_degrade_steps = bool(re.search(r"degrade[_\s-]?steps", corpus))

    if has_degrade_reason and has_degrade_steps:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("degrade_reason", "present"),
                    ("degrade_steps", "present"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("degrade_reason", "present" if has_degrade_reason else "missing"),
                ("degrade_steps", "present" if has_degrade_steps else "missing"),
            ]
        ),
    )


def critical_gate_enforcement_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_critical_gate_config = bool(
        re.search(
            r"critical[_\s-]?gate[_\s-]?always[_\s-]?on\s*[:=]\s*(true|yes|enabled|on)", corpus
        )
    )
    has_critical_gate_statement = bool(
        re.search(r"critical[_\s-]?gate", corpus) and re.search(r"always[_\s-]?on|enforc", corpus)
    )

    if has_critical_gate_config or has_critical_gate_statement:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("critical_gate", "enforced"),
                ]
            ),
        )

    return (
        "WARN",
        0,
        _format_detail_pairs(
            [
                ("critical_gate", "missing"),
            ]
        ),
    )


def chapter_gate_scoring_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    quality_score = _extract_metric_value(corpus, "quality_score")
    recommendation_match = re.search(
        r"publish[_\s-]?recommendation\s*[:=]\s*(pass|revise|block)", corpus
    )
    critical_count_match = re.search(r"critical[_\s-]?issue[_\s-]?count\s*[:=]\s*(\d+)", corpus)

    recommendation = recommendation_match.group(1) if recommendation_match else "missing"
    critical_issue_count = int(critical_count_match.group(1)) if critical_count_match else None

    complete = quality_score is not None and recommendation_match and critical_count_match
    score_ok = quality_score is not None and quality_score >= 99.0
    recommendation_ok = recommendation == "pass"
    critical_ok = critical_issue_count == 0

    gate_pass = bool(complete and score_ok and recommendation_ok and critical_ok)
    status = "PASS" if gate_pass else "WARN"

    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("quality_score", quality_score if quality_score is not None else "missing"),
                ("threshold", 99.0),
                ("publish_recommendation", recommendation),
                (
                    "critical_issue_count",
                    critical_issue_count if critical_issue_count is not None else "missing",
                ),
                ("decision", "go" if gate_pass else "no_go"),
            ]
        ),
    )


def cycle_time_kpi_measurement_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "baseline_window_days": r"baseline[_\s-]?window[_\s-]?days\s*[:=]\s*7",
        "measurement_window_days": r"measurement[_\s-]?window[_\s-]?days\s*[:=]\s*7",
        "baseline_state": r"baseline[_\s-]?state\s*[:=]\s*(ready|insufficient_sample|not_ready)",
        "cycle_time_baseline_median": r"cycle[_\s-]?time[_\s-]?baseline[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "cycle_time_current_median": r"cycle[_\s-]?time[_\s-]?current[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "eligible_samples": r"eligible[_\s-]?samples\s*[:=]\s*(\d+)",
    }

    missing_rules = _missing_required_patterns(corpus, required_patterns)

    exclusion_reason_codes = [
        "missing_timestamps",
        "aborted_run",
        "missing_quality_evidence",
        "missing_release_evidence",
        "duplicate_gate_mapping",
    ]
    present_reason_codes = [
        code for code in exclusion_reason_codes if re.search(rf"\b{re.escape(code)}\b", corpus)
    ]

    status = "PASS" if not missing_rules and len(present_reason_codes) >= 1 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("window_policy", "full_7_day_only"),
                ("manual_override", "forbidden"),
                ("missing_rules", _format_csv(missing_rules)),
                ("present_exclusion_reason_codes", _format_csv(present_reason_codes)),
            ]
        ),
    )


def comparable_quality_rubric_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    quality_score = _extract_metric_value(corpus, "quality_score")
    recommendation_match = re.search(
        r"publish[_\s-]?recommendation\s*[:=]\s*(pass|revise|block)", corpus
    )
    critical_count_match = re.search(r"critical[_\s-]?issue[_\s-]?count\s*[:=]\s*(\d+)", corpus)

    effective_level_match = re.search(
        r"effective[_\s-]?quality[_\s-]?level\s*[:=]\s*(ultra|high|medium|fluent)", corpus
    )
    used_level_match = re.search(
        r"quality[_\s-]?level[_\s-]?used\s*[:=]\s*(ultra|high|medium|fluent)", corpus
    )

    recommendation = recommendation_match.group(1) if recommendation_match else "missing"
    critical_issue_count = int(critical_count_match.group(1)) if critical_count_match else None
    effective_level = effective_level_match.group(1) if effective_level_match else "missing"
    used_level = used_level_match.group(1) if used_level_match else "missing"

    quality_score_ok = quality_score is not None and quality_score >= 99.0
    critical_ok = critical_issue_count == 0
    recommendation_ok = recommendation == "pass"
    quality_level_match = (
        effective_level_match is not None
        and used_level_match is not None
        and effective_level == used_level
    )

    has_degrade_reason = bool(re.search(r"degrade[_\s-]?reason", corpus))
    has_degrade_steps = bool(re.search(r"degrade[_\s-]?steps", corpus))
    degrade_trace_complete = (has_degrade_reason and has_degrade_steps) or (
        not has_degrade_reason and not has_degrade_steps
    )

    comparable = all(
        [
            quality_score_ok,
            critical_ok,
            recommendation_ok,
            quality_level_match,
            degrade_trace_complete,
        ]
    )

    status = "PASS" if comparable else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("rubric_version", "v1"),
                ("quality_score", quality_score if quality_score is not None else "missing"),
                ("threshold", 99.0),
                (
                    "critical_issue_count",
                    critical_issue_count if critical_issue_count is not None else "missing",
                ),
                ("publish_recommendation", recommendation),
                ("quality_level_match", "yes" if quality_level_match else "no"),
                ("degrade_trace_complete", "yes" if degrade_trace_complete else "no"),
                ("decision", "comparable" if comparable else "not_comparable"),
            ]
        ),
    )


def weekly_kpi_dashboard_schema_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "schema_version": r"schema[_\s-]?version\s*[:=]\s*weekly[_\s-]?kpi[_\s-]?dashboard\.v1",
        "window_label": r"window[_\s-]?label\s*[:=]\s*\d{4}-w\d{2}",
        "baseline_state": r"baseline[_\s-]?state\s*[:=]\s*(ready|insufficient_sample|not_ready)",
        "cycle_time_baseline_median": r"cycle[_\s-]?time[_\s-]?baseline[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "cycle_time_current_median": r"cycle[_\s-]?time[_\s-]?current[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "cycle_time_trend": r"cycle[_\s-]?time[_\s-]?trend\s*[:=]\s*(up|down|flat)",
        "comparability_decision": r"comparability[_\s-]?decision\s*[:=]\s*(comparable|not_comparable)",
        "chapter_gate_aggregation_result": r"chapter[_\s-]?gate[_\s-]?aggregation[_\s-]?result\s*[:=]\s*(aggregated|insufficient_data)",
        "evidence_links": r"evidence[_\s-]?links",
    }

    missing_fields = _missing_required_patterns(corpus, required_patterns)
    status = "PASS" if not missing_fields else "WARN"

    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("schema_name", "weekly_kpi_dashboard"),
                ("schema_version", "v1"),
                ("manual_override", "forbidden"),
                ("missing_fields", _format_csv(missing_fields)),
            ]
        ),
    )


def weekly_kpi_rollup_readiness_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "window_label": r"window[_\s-]?label\s*[:=]\s*\d{4}-w\d{2}",
        "baseline_state": r"baseline[_\s-]?state\s*[:=]\s*(ready|insufficient_sample|not_ready)",
        "cycle_time_baseline_median": r"cycle[_\s-]?time[_\s-]?baseline[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "cycle_time_current_median": r"cycle[_\s-]?time[_\s-]?current[_\s-]?median\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        "cycle_time_trend": r"cycle[_\s-]?time[_\s-]?trend\s*[:=]\s*(up|down|flat)",
    }

    missing_fields = _missing_required_patterns(corpus, required_patterns)
    baseline_state_match = re.search(required_patterns["baseline_state"], corpus)
    trend_match = re.search(required_patterns["cycle_time_trend"], corpus)
    status = "PASS" if not missing_fields else "WARN"

    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("rollup_source", "canonical_evidence"),
                ("manual_override", "forbidden"),
                (
                    "baseline_state",
                    baseline_state_match.group(1) if baseline_state_match else "missing",
                ),
                ("cycle_time_trend", trend_match.group(1) if trend_match else "missing"),
                ("missing_fields", _format_csv(missing_fields)),
            ]
        ),
    )


def weekly_kpi_comparability_visibility_signal(
    weekly_dir: Path, quality_dir: Path
) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "comparability_decision": r"comparability[_\s-]?decision\s*[:=]\s*(comparable|not_comparable)",
        "cycle_time_trend": r"cycle[_\s-]?time[_\s-]?trend\s*[:=]\s*(up|down|flat)",
        "baseline_state": r"baseline[_\s-]?state\s*[:=]\s*(ready|insufficient_sample|not_ready)",
    }

    missing_fields = _missing_required_patterns(corpus, required_patterns)
    comparability_match = re.search(required_patterns["comparability_decision"], corpus)
    trend_match = re.search(required_patterns["cycle_time_trend"], corpus)
    baseline_state_match = re.search(required_patterns["baseline_state"], corpus)
    status = "PASS" if not missing_fields else "WARN"

    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("visibility_source", "comparable_quality_plus_cycle_time"),
                ("manual_override", "forbidden"),
                (
                    "comparability_decision",
                    comparability_match.group(1) if comparability_match else "missing",
                ),
                ("cycle_time_trend", trend_match.group(1) if trend_match else "missing"),
                (
                    "baseline_state",
                    baseline_state_match.group(1) if baseline_state_match else "missing",
                ),
                ("missing_fields", _format_csv(missing_fields)),
            ]
        ),
    )


def evidence_freshness_signal(
    weekly_dir: Path, quality_dir: Path, now: datetime | None = None
) -> tuple[str, int, str]:
    paths = _iter_non_template_markdown_paths([weekly_dir, quality_dir])
    if not paths:
        return (
            "WARN",
            0,
            _format_detail_pairs(
                [
                    ("fresh_files", 0),
                    ("stale_files", 0),
                    ("window_days", 14),
                ]
            ),
        )

    now_dt = now if now is not None else datetime.now(timezone.utc)
    freshness_window_seconds = 14 * 24 * 60 * 60

    fresh = 0
    stale = 0
    for path in paths:
        age_seconds = now_dt.timestamp() - path.stat().st_mtime
        if age_seconds <= freshness_window_seconds:
            fresh += 1
        else:
            stale += 1

    status = "PASS" if fresh >= 1 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("fresh_files", fresh),
                ("stale_files", stale),
                ("window_days", 14),
            ]
        ),
    )


def tasks_completion_signal(
    tasks_code: int,
    tasks_payload: dict[str, object] | None,
    tasks_parse_error: str | None,
) -> tuple[str, int, str]:
    tasks_checked = tasks_payload.get("total_checked") if tasks_payload else None
    tasks_unchecked = tasks_payload.get("total_unchecked") if tasks_payload else None
    tasks_ratio = tasks_payload.get("completion_ratio") if tasks_payload else None

    if tasks_code != 0:
        return (
            "FAIL",
            tasks_code,
            _format_detail_pairs(
                [
                    ("checker_exit", tasks_code),
                    ("json_parse_error", tasks_parse_error or "none"),
                ]
            ),
        )

    if not tasks_payload:
        return (
            "WARN",
            0,
            _format_detail_pairs(
                [
                    ("checker_exit", 0),
                    ("json_parse_error", tasks_parse_error or "unknown"),
                ]
            ),
        )

    status = "PASS" if isinstance(tasks_unchecked, int) and tasks_unchecked == 0 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("checked", tasks_checked if tasks_checked is not None else "n/a"),
                ("unchecked", tasks_unchecked if tasks_unchecked is not None else "n/a"),
                ("completion_ratio", f"{tasks_ratio}%" if tasks_ratio is not None else "n/a"),
                ("json_parse_error", tasks_parse_error or "none"),
            ]
        ),
    )


def authority_alignment_signal(
    authority_code: int,
    authority_payload: dict[str, object] | None,
    authority_parse_error: str | None,
) -> tuple[str, int, str]:
    checked_rules = authority_payload.get("checked_rules") if authority_payload else None
    passed_rules = authority_payload.get("passed_rules") if authority_payload else None
    failed_rules = authority_payload.get("failed_rules") if authority_payload else None
    mismatches = authority_payload.get("mismatches") if authority_payload else None
    checked_files = authority_payload.get("checked_files") if authority_payload else None

    mismatch_list = mismatches if isinstance(mismatches, list) else []
    checked_file_count = len(checked_files) if isinstance(checked_files, list) else "n/a"

    if authority_code != 0:
        return (
            "FAIL",
            authority_code,
            _format_detail_pairs(
                [
                    ("checked_rules", checked_rules if checked_rules is not None else "n/a"),
                    ("passed_rules", passed_rules if passed_rules is not None else "n/a"),
                    ("failed_rules", failed_rules if failed_rules is not None else "n/a"),
                    ("checked_files", checked_file_count),
                    ("mismatches", _format_csv(mismatch_list)),
                    ("json_parse_error", authority_parse_error or "none"),
                ]
            ),
        )

    if not authority_payload:
        return (
            "WARN",
            0,
            _format_detail_pairs(
                [
                    ("checker_exit", 0),
                    ("json_parse_error", authority_parse_error or "unknown"),
                ]
            ),
        )

    status = "PASS" if authority_payload.get("status") == "PASS" and failed_rules == 0 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("checked_rules", checked_rules if checked_rules is not None else "n/a"),
                ("passed_rules", passed_rules if passed_rules is not None else "n/a"),
                ("failed_rules", failed_rules if failed_rules is not None else "n/a"),
                ("checked_files", checked_file_count),
                ("mismatches", _format_csv(mismatch_list)),
                ("json_parse_error", authority_parse_error or "none"),
            ]
        ),
    )


def writing_helper_acceptance_signal(
    artifact_exists: bool,
    artifact_payload: dict[str, object] | None,
    current_head_sha: str | None,
    artifact_parse_error: str | None,
    current_version: str | None = None,
    now: datetime | None = None,
) -> tuple[str, int, str]:
    if not artifact_exists:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)),
                    ("strict", "missing"),
                    ("head_sha", "missing"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "missing"),
                    ("supersession_status", "missing"),
                    ("evidence_state", "missing"),
                    ("missing_keys", "artifact"),
                    ("json_parse_error", artifact_parse_error or "none"),
                    ("decision", "no_go"),
                ]
            ),
        )

    if artifact_parse_error:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)),
                    ("strict", "unknown"),
                    ("head_sha", "unknown"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "unknown"),
                    ("supersession_status", "unknown"),
                    ("evidence_state", "unknown"),
                    ("missing_keys", "n/a"),
                    ("json_parse_error", artifact_parse_error),
                    ("decision", "no_go"),
                ]
            ),
        )

    if artifact_payload is None:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)),
                    ("strict", "unknown"),
                    ("head_sha", "unknown"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "unknown"),
                    ("supersession_status", "unknown"),
                    ("evidence_state", "unknown"),
                    ("missing_keys", "payload"),
                    ("json_parse_error", "unknown"),
                    ("decision", "no_go"),
                ]
            ),
        )

    required_keys = [
        "status",
        "strict",
        "generated_at",
        "head_sha",
        "total_cases",
        "passed_cases",
        "failed_cases",
    ]
    missing_keys = [key for key in required_keys if key not in artifact_payload]

    status_value = str(artifact_payload.get("status") or "").upper()
    strict_value = artifact_payload.get("strict")
    head_sha = str(artifact_payload.get("head_sha") or "").strip()
    generated_at = str(artifact_payload.get("generated_at") or "").strip()
    version = str(artifact_payload.get("version") or "").strip()
    total_cases = artifact_payload.get("total_cases")
    passed_cases = artifact_payload.get("passed_cases")
    failed_cases = artifact_payload.get("failed_cases")
    failed_cases_path = artifact_payload.get("failed_cases_path")
    retained_evidence = _evaluate_retained_evidence(
        generated_at,
        head_sha,
        current_head_sha,
        freshness_window_hours=RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        now=now,
        version=version or None,
        current_version=current_version,
    )

    has_blocker = bool(missing_keys)
    if strict_value is not True:
        has_blocker = True
    if status_value != "PASS":
        has_blocker = True
    if not generated_at:
        has_blocker = True
    if not head_sha or not current_head_sha or head_sha != current_head_sha:
        has_blocker = True
    if not retained_evidence["is_fresh"] or not retained_evidence["is_current"]:
        has_blocker = True
    if not isinstance(total_cases, int) or total_cases <= 0:
        has_blocker = True
    if not isinstance(passed_cases, int) or not isinstance(failed_cases, int):
        has_blocker = True
    elif passed_cases + failed_cases != total_cases or failed_cases != 0:
        has_blocker = True

    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("artifact", _trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)),
                ("strict", strict_value if strict_value is not None else "missing"),
                ("status", status_value or "missing"),
                ("head_sha", head_sha or "missing"),
                ("current_head_sha", current_head_sha or "unknown"),
                ("version", version or "missing"),
                ("current_version", current_version or "unknown"),
                ("generated_at", generated_at or "missing"),
                ("freshness_window_hours", retained_evidence["freshness_window_hours"]),
                ("freshness_status", retained_evidence["freshness_status"]),
                ("freshness_age_hours", retained_evidence["freshness_age_hours"]),
                ("supersession_status", retained_evidence["supersession_status"]),
                ("supersession_reasons", _format_csv(retained_evidence["supersession_reasons"])),
                ("evidence_state", retained_evidence["evidence_state"]),
                (
                    "generated_at_parse_error",
                    retained_evidence["generated_at_parse_error"] or "none",
                ),
                ("total_cases", total_cases if total_cases is not None else "missing"),
                ("passed_cases", passed_cases if passed_cases is not None else "missing"),
                ("failed_cases", failed_cases if failed_cases is not None else "missing"),
                ("failed_cases_path", failed_cases_path if failed_cases_path else "none"),
                ("missing_keys", _format_csv(missing_keys)),
                ("json_parse_error", artifact_parse_error or "none"),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def package_app_smoke_signal(
    artifact_exists: bool,
    artifact_payload: dict[str, object] | None,
    current_version: str | None = None,
    artifact_parse_error: str | None = None,
) -> tuple[str, int, str]:
    """ISS-20260430-002 Layer 4 packaged-app smoke signal (advisory-first).

    PASS-by-absence semantics: when the smoke evidence artifact is missing
    (e.g. local invocation with no recent CI run, or the CI lane has not yet
    been promoted), this signal returns PASS with status=advisory_unavailable
    so it does not block the release scorecard. When the artifact exists, the
    signal mirrors the artifact's own PASS/FAIL verdict.

    Promote to blocking by:
      1. Wiring this signal into SCORECARD_DIMENSIONS["release"].
      2. Switching the artifact-missing branch from PASS to FAIL.
    Do that only after the CI lane is observed stable end-to-end.
    """
    if not artifact_exists:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGED_APP_SMOKE_ARTIFACT_PATH)),
                    ("status", "advisory_unavailable"),
                    ("mode", "advisory_first"),
                    (
                        "note",
                        "no smoke artifact yet — packaged-app-smoke CI lane is advisory until stability is observed",
                    ),
                    ("decision", "advisory_pass"),
                ]
            ),
        )

    if artifact_parse_error:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGED_APP_SMOKE_ARTIFACT_PATH)),
                    ("status", "advisory_parse_error"),
                    ("mode", "advisory_first"),
                    ("json_parse_error", artifact_parse_error),
                    ("decision", "advisory_pass"),
                ]
            ),
        )

    if artifact_payload is None:
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGED_APP_SMOKE_ARTIFACT_PATH)),
                    ("status", "advisory_empty_payload"),
                    ("mode", "advisory_first"),
                    ("decision", "advisory_pass"),
                ]
            ),
        )

    artifact_status = str(artifact_payload.get("status") or "").upper()
    artifact_version = str(artifact_payload.get("package_version") or "").strip()
    install_verified = bool(artifact_payload.get("install_verified"))
    launch_verified = bool(artifact_payload.get("launch_verified"))
    health_version_verified = bool(artifact_payload.get("health_version_verified"))
    services_verified = bool(artifact_payload.get("services_verified"))
    cors_verified = bool(artifact_payload.get("cors_verified"))
    failures = artifact_payload.get("failures") or []

    version_drift = bool(
        current_version and artifact_version and artifact_version != current_version
    )

    detail_pairs = [
        ("artifact", _trace_path(PACKAGED_APP_SMOKE_ARTIFACT_PATH)),
        ("status", artifact_status or "unknown"),
        ("package_version", artifact_version or "unknown"),
        ("current_version", current_version or "unknown"),
        ("version_drift", str(version_drift).lower()),
        ("install_verified", str(install_verified).lower()),
        ("launch_verified", str(launch_verified).lower()),
        ("health_version_verified", str(health_version_verified).lower()),
        ("services_verified", str(services_verified).lower()),
        ("cors_verified", str(cors_verified).lower()),
        ("failure_count", len(failures) if isinstance(failures, list) else 0),
        ("mode", "advisory_first"),
    ]

    if artifact_status == "PASS" and not version_drift:
        detail_pairs.append(("decision", "go"))
        return ("PASS", 0, _format_detail_pairs(detail_pairs))

    detail_pairs.append(("decision", "advisory_fail_observed"))
    # Advisory-mode FAIL: still return PASS exit code so it does not block.
    # Surface as ADVISORY status so the scorecard reader can distinguish.
    return ("ADVISORY", 0, _format_detail_pairs(detail_pairs))


def package_e2e_acceptance_signal(
    artifact_exists: bool,
    artifact_payload: dict[str, object] | None,
    current_head_sha: str | None,
    artifact_parse_error: str | None,
    current_version: str | None = None,
    now: datetime | None = None,
) -> tuple[str, int, str]:
    if not artifact_exists:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)),
                    ("status", "missing"),
                    ("head_sha", "missing"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "missing"),
                    ("supersession_status", "missing"),
                    ("evidence_state", "missing"),
                    ("missing_keys", "artifact"),
                    ("json_parse_error", artifact_parse_error or "none"),
                    ("decision", "no_go"),
                ]
            ),
        )

    if artifact_parse_error:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)),
                    ("status", "unknown"),
                    ("head_sha", "unknown"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "unknown"),
                    ("supersession_status", "unknown"),
                    ("evidence_state", "unknown"),
                    ("missing_keys", "n/a"),
                    ("json_parse_error", artifact_parse_error),
                    ("decision", "no_go"),
                ]
            ),
        )

    if artifact_payload is None:
        return (
            "FAIL",
            1,
            _format_detail_pairs(
                [
                    ("artifact", _trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)),
                    ("status", "unknown"),
                    ("head_sha", "unknown"),
                    ("current_head_sha", current_head_sha or "unknown"),
                    ("freshness_window_hours", RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS),
                    ("freshness_status", "unknown"),
                    ("supersession_status", "unknown"),
                    ("evidence_state", "unknown"),
                    ("missing_keys", "payload"),
                    ("json_parse_error", "unknown"),
                    ("decision", "no_go"),
                ]
            ),
        )

    required_keys = [
        "status",
        "generated_at",
        "head_sha",
        "version",
        "tester",
        "artifact_path",
        "artifact_sha256",
        "install_verified",
        "launch_verified",
        "core_flow_verified",
        "shutdown_verified",
    ]
    missing_keys = [key for key in required_keys if key not in artifact_payload]

    status_value = str(artifact_payload.get("status") or "").upper()
    generated_at = str(artifact_payload.get("generated_at") or "").strip()
    head_sha = str(artifact_payload.get("head_sha") or "").strip()
    version = str(artifact_payload.get("version") or "").strip()
    tester = str(artifact_payload.get("tester") or "").strip()
    artifact_path = str(artifact_payload.get("artifact_path") or "").strip()
    artifact_sha256 = str(artifact_payload.get("artifact_sha256") or "").strip()
    install_verified = artifact_payload.get("install_verified")
    launch_verified = artifact_payload.get("launch_verified")
    core_flow_verified = artifact_payload.get("core_flow_verified")
    shutdown_verified = artifact_payload.get("shutdown_verified")
    notes = str(artifact_payload.get("notes") or "").strip()
    retained_evidence = _evaluate_retained_evidence(
        generated_at,
        head_sha,
        current_head_sha,
        freshness_window_hours=RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        now=now,
        version=version or None,
        current_version=current_version,
    )

    has_blocker = bool(missing_keys)
    if status_value != "PASS":
        has_blocker = True
    if not generated_at:
        has_blocker = True
    if not head_sha or not current_head_sha or head_sha != current_head_sha:
        has_blocker = True
    if not retained_evidence["is_fresh"] or not retained_evidence["is_current"]:
        has_blocker = True
    if not version or (current_version and version != current_version):
        has_blocker = True
    if not tester:
        has_blocker = True
    if not artifact_path:
        has_blocker = True
    if not artifact_sha256:
        has_blocker = True
    if install_verified is not True:
        has_blocker = True
    if launch_verified is not True:
        has_blocker = True
    if core_flow_verified is not True:
        has_blocker = True
    if shutdown_verified is not True:
        has_blocker = True

    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("artifact", _trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)),
                ("status", status_value or "missing"),
                ("head_sha", head_sha or "missing"),
                ("current_head_sha", current_head_sha or "unknown"),
                ("version", version or "missing"),
                ("current_version", current_version or "unknown"),
                ("tester", tester or "missing"),
                ("artifact_path", artifact_path or "missing"),
                ("artifact_sha256", artifact_sha256 or "missing"),
                ("generated_at", generated_at or "missing"),
                ("freshness_window_hours", retained_evidence["freshness_window_hours"]),
                ("freshness_status", retained_evidence["freshness_status"]),
                ("freshness_age_hours", retained_evidence["freshness_age_hours"]),
                ("supersession_status", retained_evidence["supersession_status"]),
                ("supersession_reasons", _format_csv(retained_evidence["supersession_reasons"])),
                ("evidence_state", retained_evidence["evidence_state"]),
                (
                    "generated_at_parse_error",
                    retained_evidence["generated_at_parse_error"] or "none",
                ),
                (
                    "install_verified",
                    install_verified if install_verified is not None else "missing",
                ),
                ("launch_verified", launch_verified if launch_verified is not None else "missing"),
                (
                    "core_flow_verified",
                    core_flow_verified if core_flow_verified is not None else "missing",
                ),
                (
                    "shutdown_verified",
                    shutdown_verified if shutdown_verified is not None else "missing",
                ),
                ("notes", notes or "none"),
                ("missing_keys", _format_csv(missing_keys)),
                ("json_parse_error", artifact_parse_error or "none"),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def local_selftest_enforcement_signal(
    release_evidence: dict[str, object],
) -> tuple[str, int, str]:
    evidence_sources = release_evidence.get("evidence_sources")
    source_rows = evidence_sources if isinstance(evidence_sources, list) else []
    source_map: dict[str, dict[str, object]] = {}
    for row in source_rows:
        if not isinstance(row, dict):
            continue
        source_id = str(row.get("source_id") or "").strip()
        if source_id:
            source_map[source_id] = row

    blocking_sources: list[str] = []
    for source_id in LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES:
        source = source_map.get(source_id)
        if source is None:
            blocking_sources.append(f"{source_id}:missing")
            continue
        if source.get("status") != "PASS":
            blocking_sources.append(f"{source_id}:status={source.get('status', 'unknown')}")
            continue
        if not bool(source.get("is_fresh")):
            blocking_sources.append(
                f"{source_id}:freshness={source.get('freshness_status', 'unknown')}"
            )
            continue
        if not bool(source.get("is_current")):
            blocking_sources.append(
                f"{source_id}:supersession={source.get('supersession_status', 'unknown')}"
            )

    has_blocker = bool(blocking_sources)
    return (
        "FAIL" if has_blocker else "PASS",
        1 if has_blocker else 0,
        _format_detail_pairs(
            [
                ("command", DESKTOP_LOCAL_SELFTEST_COMMAND),
                (
                    "required_when",
                    "retained_release_evidence_for_release_sign_off_is_not_fresh_current",
                ),
                ("proof_binding", "same_head_fresh_current_release_evidence"),
                ("release_evidence_status", str(release_evidence.get("status") or "unknown")),
                ("bound_sources", _format_csv(list(LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES))),
                ("blocking_sources", _format_csv(blocking_sources) or "none"),
                ("proof_state", "missing_or_non_green" if has_blocker else "fresh_current"),
                (
                    "decision",
                    "run_local_selftest_before_go"
                    if has_blocker
                    else "optional_with_fresh_current_evidence",
                ),
            ]
        ),
    )


def evidence_coverage_signal(
    quality_non_template: int, weekly_non_template: int
) -> tuple[str, int, str]:
    status = "PASS" if quality_non_template >= 1 and weekly_non_template >= 2 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("quality_non_template", quality_non_template),
                ("weekly_non_template", weekly_non_template),
            ]
        ),
    )


def evidence_completeness_blocker_signal(
    quality_non_template: int,
    weekly_non_template: int,
    machine_payload_available: bool,
) -> tuple[str, int, str]:
    missing_evidence_classes: list[str] = []
    if quality_non_template < 1:
        missing_evidence_classes.append("quality_evidence")
    if weekly_non_template < 2:
        missing_evidence_classes.append("weekly_review_evidence")
    if not machine_payload_available:
        missing_evidence_classes.append("release_machine_payload")

    has_blocker = len(missing_evidence_classes) > 0
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("quality_non_template", quality_non_template),
                ("weekly_non_template", weekly_non_template),
                ("machine_payload_available", "yes" if machine_payload_available else "no"),
                ("missing_evidence_classes", _format_csv(missing_evidence_classes)),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def gate_score_or_critical_blocker_signal(
    chapter_gate_status: str,
    critical_conflict_status: str,
    unresolved_triage_status: str,
) -> tuple[str, int, str]:
    has_blocker = (
        chapter_gate_status == "FAIL"
        or critical_conflict_status == "FAIL"
        or unresolved_triage_status == "FAIL"
    )
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("chapter_gate_status", chapter_gate_status),
                ("critical_conflict_status", critical_conflict_status),
                ("unresolved_triage_status", unresolved_triage_status),
                ("blocker_semantics", "chapter_gate_or_critical_or_unresolved_triage_is_fail"),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def codecov_signal(coverage_exists: bool, token_present: bool) -> tuple[str, int, str, bool]:
    strict_mode = token_present

    if coverage_exists:
        status = "PASS"
        exit_code = 0
        result = "coverage_available"
    elif strict_mode:
        status = "FAIL"
        exit_code = 1
        result = "coverage_missing_in_strict_mode"
    else:
        status = "WARN"
        exit_code = 0
        result = "coverage_missing_in_soft_mode"

    detail = _format_detail_pairs(
        [
            ("strict_mode", str(strict_mode).lower()),
            ("token_present", str(token_present).lower()),
            ("coverage_xml", "yes" if coverage_exists else "no"),
            ("result", result),
        ]
    )
    return status, exit_code, detail, strict_mode


def feedback_artifact_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return (
            "WARN",
            0,
            _format_detail_pairs(
                [
                    ("snapshots_scanned", 0),
                    ("linked_feedback_artifacts", 0),
                    ("invalid_snapshots", 0),
                ]
            ),
        )

    snapshot_paths = list(sessions_root.glob("active/*/.data/generation-snapshots/*-feedback.json"))
    linked_count = 0
    invalid_count = 0

    for snapshot_path in snapshot_paths:
        try:
            payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            invalid_count += 1
            continue

        if not isinstance(payload, dict):
            invalid_count += 1
            continue

        artifact_type = payload.get("artifact_type")
        evidence_links = payload.get("evidence_links")
        trace = payload.get("trace")
        output = payload.get("output")
        feedback_artifacts = output.get("feedback_artifacts") if isinstance(output, dict) else None

        trace_ok = isinstance(trace, dict) and all(
            str(trace.get(key) or "").strip() for key in ("session_id", "run_id", "revision_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1
        feedback_ok = isinstance(feedback_artifacts, list)

        if artifact_type == "quality_feedback" and trace_ok and links_ok and feedback_ok:
            linked_count += 1
        else:
            invalid_count += 1

    status = "PASS" if linked_count >= 1 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("snapshots_scanned", len(snapshot_paths)),
                ("linked_feedback_artifacts", linked_count),
                ("invalid_snapshots", invalid_count),
            ]
        ),
    )


def _scan_conflict_artifact_linkage(sessions_root: Path) -> tuple[int, int, int, int]:
    if not sessions_root.exists():
        return 0, 0, 0, 0

    snapshot_paths = list(sessions_root.glob("active/*/.data/generation-snapshots/*.json"))
    linked_count = 0
    critical_linked_count = 0
    invalid_count = 0

    for snapshot_path in snapshot_paths:
        try:
            payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            invalid_count += 1
            continue

        if not isinstance(payload, dict):
            invalid_count += 1
            continue

        output = payload.get("output")
        if not isinstance(output, dict):
            continue

        conflicts = output.get("canonical_conflicts")
        trace = payload.get("trace")
        evidence_links = payload.get("evidence_links")

        if not isinstance(conflicts, list) or not conflicts:
            continue

        trace_ok = isinstance(trace, dict) and all(
            str(trace.get(key) or "").strip() for key in ("session_id", "run_id", "revision_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1

        if not trace_ok or not links_ok:
            invalid_count += 1
            continue

        linked_count += 1
        if any(
            str(item.get("severity") or "").strip().lower() == "critical"
            for item in conflicts
            if isinstance(item, dict)
        ):
            critical_linked_count += 1

    return len(snapshot_paths), linked_count, critical_linked_count, invalid_count


def conflict_artifact_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    snapshots_scanned, linked_count, critical_linked_count, invalid_count = (
        _scan_conflict_artifact_linkage(sessions_root)
    )

    status = "PASS" if linked_count >= 1 else "WARN"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("snapshots_scanned", snapshots_scanned),
                ("linked_conflict_artifacts", linked_count),
                ("critical_conflicts_linked", critical_linked_count),
                ("invalid_snapshots", invalid_count),
            ]
        ),
    )


def critical_conflict_blocker_signal(sessions_root: Path) -> tuple[str, int, str]:
    snapshots_scanned, linked_count, critical_linked_count, invalid_count = (
        _scan_conflict_artifact_linkage(sessions_root)
    )

    has_blocker = critical_linked_count > 0
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("snapshots_scanned", snapshots_scanned),
                ("linked_conflict_artifacts", linked_count),
                ("critical_conflicts_linked", critical_linked_count),
                ("invalid_snapshots", invalid_count),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def unresolved_triage_blocker_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return (
            "PASS",
            0,
            _format_detail_pairs(
                [
                    ("state_files_scanned", 0),
                    ("linked_triage_records", 0),
                    ("unresolved_triage_records", 0),
                    ("invalid_state_files", 0),
                    ("ignored_legacy_records", 0),
                    (
                        "blocker_semantics",
                        "current_parseable_triage_state_not_in_{resolved,rejected}_and_not_legacy_noise",
                    ),
                    ("decision", "go"),
                ]
            ),
        )

    state_paths = list(sessions_root.glob("active/*/.data/state.json"))
    linked_count = 0
    unresolved_count = 0
    invalid_count = 0
    ignored_legacy_count = 0

    for state_path in state_paths:
        try:
            payload = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            invalid_count += 1
            continue

        if not isinstance(payload, dict):
            invalid_count += 1
            continue

        session_status = str(payload.get("status") or "").strip().lower()
        if session_status in {"completed", "archived", "superseded"}:
            ignored_legacy_count += 1
            continue

        metadata = payload.get("metadata")
        triage_state = ""
        if isinstance(metadata, dict):
            triage_state = str(metadata.get("triage_state") or "").strip().lower()

        if not triage_state:
            triage_state = str(payload.get("triage_state") or "").strip().lower()

        if not triage_state:
            handoff = payload.get("handoff_package")
            if isinstance(handoff, dict):
                triage_state = str(handoff.get("triage_state") or "").strip().lower()

        if triage_state in {"legacy", "invalid", "superseded", "stale"}:
            ignored_legacy_count += 1
            continue

        if not triage_state:
            invalid_count += 1
            continue

        linked_count += 1
        if triage_state not in {"resolved", "rejected"}:
            unresolved_count += 1

    has_blocker = unresolved_count > 0
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0
    return (
        status,
        exit_code,
        _format_detail_pairs(
            [
                ("state_files_scanned", len(state_paths)),
                ("linked_triage_records", linked_count),
                ("unresolved_triage_records", unresolved_count),
                ("invalid_state_files", invalid_count),
                ("ignored_legacy_records", ignored_legacy_count),
                (
                    "blocker_semantics",
                    "current_parseable_triage_state_not_in_{resolved,rejected}_and_not_legacy_noise",
                ),
                ("decision", "no_go" if has_blocker else "go"),
            ]
        ),
    )


def chapter_gate_evidence_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return (
            "WARN",
            0,
            _format_detail_pairs(
                [
                    ("snapshots_scanned", 0),
                    ("eligible_release_gate_runs", 0),
                    ("chapter_gate_checks_linked", 0),
                    ("aggregation_window", "active_sessions"),
                    ("result", "insufficient_data"),
                    ("invalid_snapshots", 0),
                ]
            ),
        )

    snapshot_paths = list(sessions_root.glob("active/*/.data/generation-snapshots/*.json"))
    eligible_release_gate_runs = 0
    chapter_gate_checks_linked = 0
    invalid_count = 0

    for snapshot_path in snapshot_paths:
        try:
            payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            invalid_count += 1
            continue

        if not isinstance(payload, dict):
            invalid_count += 1
            continue

        if payload.get("artifact_type") != "release_gate_run":
            continue

        trace = payload.get("trace")
        evidence_links = payload.get("evidence_links")

        trace_ok = isinstance(trace, dict) and all(
            str(trace.get(key) or "").strip() for key in ("session_id", "run_id", "check_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1

        if not trace_ok or not links_ok:
            invalid_count += 1
            continue

        eligible_release_gate_runs += 1

        trace_check_id = str(trace.get("check_id") or "").strip()
        output = payload.get("output")
        output_check_id = (
            str(output.get("check_id") or "").strip() if isinstance(output, dict) else ""
        )
        output_checks = output.get("checks") if isinstance(output, dict) else None
        checks_has_chapter_gate = isinstance(output_checks, list) and any(
            isinstance(item, dict)
            and str(item.get("check_id") or "").strip() == "chapter_gate_scoring_signal"
            for item in output_checks
        )

        if (
            trace_check_id == "chapter_gate_scoring_signal"
            or output_check_id == "chapter_gate_scoring_signal"
            or checks_has_chapter_gate
        ):
            chapter_gate_checks_linked += 1

    status = "PASS" if chapter_gate_checks_linked >= 1 else "WARN"
    result = "aggregated" if chapter_gate_checks_linked >= 1 else "insufficient_data"
    return (
        status,
        0,
        _format_detail_pairs(
            [
                ("snapshots_scanned", len(snapshot_paths)),
                ("eligible_release_gate_runs", eligible_release_gate_runs),
                ("chapter_gate_checks_linked", chapter_gate_checks_linked),
                ("aggregation_window", "active_sessions"),
                ("result", result),
                ("invalid_snapshots", invalid_count),
            ]
        ),
    )


def main() -> int:
    version_code, version_output = run_cmd([sys.executable, "scripts/check_versions.py"])
    delivery_code, delivery_output = run_cmd([sys.executable, "scripts/delivery_gate.py"])
    RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    governance_code, governance_output = _run_governance_scripts_regression(GOVERNANCE_JUNIT_PATH)
    governance_status, governance_passed = parse_pytest_counts(governance_output)

    baseline_code, baseline_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "src-ts",
            "run",
            "test:coverage:phase4",
            "--",
            "--coverage.reporter=text",
            "--coverage.reporter=json",
            "--coverage.reporter=html",
            "--coverage.reporter=cobertura",
        ]
    )

    desktop_bootstrap_code, desktop_bootstrap_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "desktop",
            "run",
            "ensure-deps",
        ]
    )
    desktop_sidecar_build_code, desktop_sidecar_build_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "desktop",
            "run",
            "build:sidecar",
        ]
    )
    desktop_sidecar_validate_code, desktop_sidecar_validate_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "desktop",
            "run",
            "validate:sidecar-contract",
        ]
    )
    desktop_packaging_code, desktop_packaging_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "desktop",
            "run",
            "validate:package:dry-run",
        ]
    )
    desktop_check_code, desktop_check_output = run_cmd(DESKTOP_AUTHORITATIVE_LOCAL_GATE_ARGS)
    desktop_output = "\n\n".join(
        part for part in [desktop_bootstrap_output, desktop_check_output] if part
    )
    desktop_sidecar_readiness_code = (
        desktop_sidecar_build_code
        if desktop_sidecar_build_code != 0
        else desktop_sidecar_validate_code
    )
    desktop_sidecar_readiness_output = "\n\n".join(
        part for part in [desktop_sidecar_build_output, desktop_sidecar_validate_output] if part
    )

    e2e_code, e2e_output = run_cmd(
        [
            "npm.cmd",
            "--prefix",
            "src-ts",
            "exec",
            "--",
            "vitest",
            "run",
            "tests/mcp/workflow-endpoints.integration.test.ts",
            "tests/mcp/workflow-critic-smoke.integration.test.ts",
            "--reporter=basic",
            "--reporter=junit",
            f"--outputFile.junit={E2E_JUNIT_PATH.resolve()}",
        ]
    )

    prod_guard_code, prod_guard_output = _run_release_runtime_guard(PRODUCTION_GUARD_JUNIT_PATH)
    prod_guard_status, prod_guard_passed = parse_pytest_counts(prod_guard_output)
    metrics_guard_code = prod_guard_code
    metrics_guard_output = prod_guard_output

    tasks_code, tasks_output = run_cmd([sys.executable, "scripts/check_tasks_completion.py"])
    tasks_payload, tasks_parse_error = parse_first_json_object(tasks_output)
    authority_alignment_code, authority_alignment_output = run_cmd(
        [sys.executable, "scripts/check_authority_alignment.py"]
    )
    authority_alignment_payload, authority_alignment_parse_error = parse_first_json_object(
        authority_alignment_output
    )

    weekly_evidence_dir = PROJECT_ROOT / ".workflow" / "evidence" / "weekly"
    quality_evidence_dir = PROJECT_ROOT / ".workflow" / "evidence" / "quality"
    report_root = REPORT_PATH.parent
    sessions_root = report_root / ".writing" / "sessions"

    evidence_quality_count = _count_non_template_markdown(quality_evidence_dir)
    evidence_weekly_review_count = _count_non_template_markdown(weekly_evidence_dir)

    slo_status, slo_exit, slo_detail = slo_baseline_signal(
        weekly_evidence_dir, quality_evidence_dir
    )
    evidence_links_status, evidence_links_exit, evidence_links_detail = evidence_links_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    self_learning_status, self_learning_exit, self_learning_detail = self_learning_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    memory_observability_status, memory_observability_exit, memory_observability_detail = (
        memory_observability_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    compliance_keywords_status, compliance_keywords_exit, compliance_keywords_detail = (
        compliance_keywords_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )

    migration_rollback_status, migration_rollback_exit, migration_rollback_detail = (
        migration_rollback_evidence_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )

    quality_level_trace_status, quality_level_trace_exit, quality_level_trace_detail = (
        quality_level_trace_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    degrade_trace_status, degrade_trace_exit, degrade_trace_detail = degrade_trace_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    critical_gate_status, critical_gate_exit, critical_gate_detail = (
        critical_gate_enforcement_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    chapter_gate_status, chapter_gate_exit, chapter_gate_detail = chapter_gate_scoring_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    cycle_time_kpi_status, cycle_time_kpi_exit, cycle_time_kpi_detail = (
        cycle_time_kpi_measurement_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    (
        comparable_quality_rubric_status,
        comparable_quality_rubric_exit,
        comparable_quality_rubric_detail,
    ) = comparable_quality_rubric_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    (
        weekly_kpi_dashboard_schema_status,
        weekly_kpi_dashboard_schema_exit,
        weekly_kpi_dashboard_schema_detail,
    ) = weekly_kpi_dashboard_schema_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    weekly_kpi_rollup_status, weekly_kpi_rollup_exit, weekly_kpi_rollup_detail = (
        weekly_kpi_rollup_readiness_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    weekly_kpi_visibility_status, weekly_kpi_visibility_exit, weekly_kpi_visibility_detail = (
        weekly_kpi_comparability_visibility_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )
    (
        critical_conflict_blocker_status,
        critical_conflict_blocker_exit,
        critical_conflict_blocker_detail,
    ) = critical_conflict_blocker_signal(
        sessions_root,
    )
    (
        unresolved_triage_blocker_status,
        unresolved_triage_blocker_exit,
        unresolved_triage_blocker_detail,
    ) = unresolved_triage_blocker_signal(
        sessions_root,
    )
    feedback_linkage_status, feedback_linkage_exit, feedback_linkage_detail = (
        feedback_artifact_linkage_signal(
            sessions_root,
        )
    )
    conflict_linkage_status, conflict_linkage_exit, conflict_linkage_detail = (
        conflict_artifact_linkage_signal(
            sessions_root,
        )
    )

    chapter_gate_linkage_status, chapter_gate_linkage_exit, chapter_gate_linkage_detail = (
        chapter_gate_evidence_linkage_signal(
            sessions_root,
        )
    )
    evidence_freshness_status, evidence_freshness_exit, evidence_freshness_detail = (
        evidence_freshness_signal(
            weekly_evidence_dir,
            quality_evidence_dir,
        )
    )

    tasks_status, tasks_exit, tasks_detail = tasks_completion_signal(
        tasks_code,
        tasks_payload,
        tasks_parse_error,
    )
    issue_pending_status, issue_pending_exit, issue_pending_detail = issue_pending_blocker_signal()
    current_head_sha = _current_head_sha()
    current_release_version = _current_release_version()
    writing_helper_acceptance_payload, writing_helper_acceptance_parse_error = _read_json_artifact(
        WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH
    )
    (
        writing_helper_acceptance_status,
        writing_helper_acceptance_exit,
        writing_helper_acceptance_detail,
    ) = writing_helper_acceptance_signal(
        WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH.exists(),
        writing_helper_acceptance_payload,
        current_head_sha,
        writing_helper_acceptance_parse_error,
        current_version=current_release_version,
    )
    package_e2e_acceptance_payload, package_e2e_acceptance_parse_error = _read_json_artifact(
        PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH
    )
    (
        package_e2e_acceptance_status,
        package_e2e_acceptance_exit,
        package_e2e_acceptance_detail,
    ) = package_e2e_acceptance_signal(
        PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH.exists(),
        package_e2e_acceptance_payload,
        current_head_sha,
        package_e2e_acceptance_parse_error,
        current_version=current_release_version,
    )
    packaged_app_smoke_payload, packaged_app_smoke_parse_error = _read_json_artifact(
        PACKAGED_APP_SMOKE_ARTIFACT_PATH
    )
    (
        packaged_app_smoke_status,
        packaged_app_smoke_exit,
        packaged_app_smoke_detail,
    ) = package_app_smoke_signal(
        PACKAGED_APP_SMOKE_ARTIFACT_PATH.exists(),
        packaged_app_smoke_payload,
        current_version=current_release_version,
        artifact_parse_error=packaged_app_smoke_parse_error,
    )
    authority_alignment_status, authority_alignment_exit, authority_alignment_detail = (
        authority_alignment_signal(
            authority_alignment_code,
            authority_alignment_payload,
            authority_alignment_parse_error,
        )
    )

    evidence_status, evidence_exit, evidence_detail = evidence_coverage_signal(
        evidence_quality_count,
        evidence_weekly_review_count,
    )
    evidence_completeness_status, evidence_completeness_exit, evidence_completeness_detail = (
        evidence_completeness_blocker_signal(
            evidence_quality_count,
            evidence_weekly_review_count,
            machine_payload_available=True,
        )
    )
    gate_score_or_critical_status, gate_score_or_critical_exit, gate_score_or_critical_detail = (
        gate_score_or_critical_blocker_signal(
            chapter_gate_status,
            critical_conflict_blocker_status,
            unresolved_triage_blocker_status,
        )
    )
    (
        runtime_policy_conformance_status,
        runtime_policy_conformance_exit,
        runtime_policy_conformance_detail,
    ) = runtime_policy_conformance_signal()

    coverage_candidates = (
        PROJECT_ROOT / "coverage.xml",
        PROJECT_ROOT / "src-ts" / "coverage" / "cobertura-coverage.xml",
    )
    coverage_exists = any(path.exists() for path in coverage_candidates)
    codecov_token_present = bool(os.environ.get("CODECOV_TOKEN", "").strip())
    codecov_status, codecov_exit, codecov_detail, codecov_strict_mode = codecov_signal(
        coverage_exists,
        codecov_token_present,
    )

    baseline_status, baseline_passed = parse_pytest_counts(baseline_output)
    e2e_status, e2e_passed = parse_pytest_counts(e2e_output)

    checks = [
        build_check_result(
            "version_consistency",
            "P0",
            True,
            version_code,
            _format_detail_pairs(
                [
                    ("script", "scripts/check_versions.py"),
                ]
            ),
        ),
        build_check_result(
            "delivery_semantic_gate",
            "P0",
            True,
            delivery_code,
            _format_detail_pairs(
                [
                    ("script", "scripts/delivery_gate.py"),
                ]
            ),
        ),
        build_check_result(
            "governance_scripts_regression",
            "P0",
            True,
            governance_code,
            _format_detail_pairs(
                [
                    (
                        "script",
                        "scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q",
                    ),
                    ("status", governance_status),
                    ("passed_count", governance_passed),
                    ("junitxml", _trace_path(GOVERNANCE_JUNIT_PATH)),
                ]
            ),
        ),
        build_check_result(
            "baseline_tests_and_coverage",
            "P0",
            True,
            baseline_code,
            _format_detail_pairs(
                [
                    ("command", "npm --prefix src-ts run test:coverage:phase4"),
                    ("status", baseline_status),
                    ("passed_count", baseline_passed),
                ]
            ),
        ),
        build_check_result(
            "desktop_check",
            "P0",
            True,
            desktop_check_code,
            _format_detail_pairs(
                [
                    ("command", DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND),
                    ("package_script", "desktop/package.json -> scripts.check:local"),
                ]
            ),
        ),
        build_check_result(
            "desktop_sidecar_readiness",
            "P0",
            True,
            desktop_sidecar_readiness_code,
            _format_detail_pairs(
                [
                    (
                        "command",
                        "npm --prefix desktop run build:sidecar && npm --prefix desktop run validate:sidecar-contract",
                    ),
                    ("artifact", "desktop/src-tauri/bin/niko-gateway"),
                ]
            ),
        ),
        build_check_result(
            "desktop_packaging_dry_run",
            "P0",
            True,
            desktop_packaging_code,
            _format_detail_pairs(
                [
                    ("command", DESKTOP_PACKAGING_DRY_RUN_COMMAND),
                    ("target", "x86_64-pc-windows-msvc"),
                    ("signing", "unsigned_local_dry_run"),
                ]
            ),
        ),
        build_check_result(
            "writing_helper_acceptance_signal",
            "P0",
            True,
            writing_helper_acceptance_exit,
            writing_helper_acceptance_detail,
            status_override=writing_helper_acceptance_status,
        ),
        build_check_result(
            "package_e2e_acceptance_signal",
            "P0",
            True,
            package_e2e_acceptance_exit,
            package_e2e_acceptance_detail,
            status_override=package_e2e_acceptance_status,
        ),
        build_check_result(
            "package_app_smoke_signal",
            "P1",
            False,
            packaged_app_smoke_exit,
            packaged_app_smoke_detail,
            status_override=packaged_app_smoke_status,
        ),
        build_check_result(
            "external_e2e_smoke",
            "P0",
            True,
            e2e_code,
            _format_detail_pairs(
                [
                    ("status", e2e_status),
                    ("passed_count", e2e_passed),
                ]
            ),
        ),
        build_check_result(
            "production_guard",
            "P0",
            True,
            prod_guard_code,
            _format_detail_pairs(
                [
                    (
                        "command",
                        "npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts",
                    ),
                    ("status", prod_guard_status),
                    ("passed_count", prod_guard_passed),
                    ("junitxml", _trace_path(PRODUCTION_GUARD_JUNIT_PATH)),
                ]
            ),
        ),
        build_check_result(
            "metrics_guard",
            "P0",
            True,
            metrics_guard_code,
            _format_detail_pairs(
                [
                    (
                        "command",
                        "npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts",
                    ),
                    ("status", prod_guard_status),
                    ("passed_count", prod_guard_passed),
                    ("junitxml", _trace_path(PRODUCTION_GUARD_JUNIT_PATH)),
                ]
            ),
        ),
        build_check_result(
            "codecov_signal",
            "P0" if codecov_strict_mode else "P1",
            codecov_strict_mode,
            codecov_exit,
            codecov_detail,
            status_override=codecov_status,
        ),
        build_check_result(
            "evidence_completeness_blocker_signal",
            "P0",
            True,
            evidence_completeness_exit,
            evidence_completeness_detail,
            status_override=evidence_completeness_status,
        ),
        build_check_result(
            "gate_score_or_critical_blocker_signal",
            "P0",
            True,
            gate_score_or_critical_exit,
            gate_score_or_critical_detail,
            status_override=gate_score_or_critical_status,
        ),
        build_check_result(
            "runtime_policy_conformance_signal",
            "P0",
            True,
            runtime_policy_conformance_exit,
            runtime_policy_conformance_detail,
            status_override=runtime_policy_conformance_status,
        ),
        build_check_result(
            "authority_alignment_signal",
            "P0",
            True,
            authority_alignment_exit,
            authority_alignment_detail,
            status_override=authority_alignment_status,
        ),
        build_check_result(
            "issue_pending_blocker_signal",
            "P0",
            True,
            issue_pending_exit,
            issue_pending_detail,
            status_override=issue_pending_status,
        ),
        build_check_result(
            "evidence_coverage_signal",
            "P1",
            False,
            evidence_exit,
            evidence_detail,
            status_override=evidence_status,
        ),
        build_check_result(
            "slo_baseline_signal",
            "P1",
            False,
            slo_exit,
            slo_detail,
            status_override=slo_status,
        ),
        build_check_result(
            "evidence_links_signal",
            "P1",
            False,
            evidence_links_exit,
            evidence_links_detail,
            status_override=evidence_links_status,
        ),
        build_check_result(
            "self_learning_signal",
            "P1",
            False,
            self_learning_exit,
            self_learning_detail,
            status_override=self_learning_status,
        ),
        build_check_result(
            "memory_observability_signal",
            "P1",
            False,
            memory_observability_exit,
            memory_observability_detail,
            status_override=memory_observability_status,
        ),
        build_check_result(
            "quality_level_trace_signal",
            "P1",
            False,
            quality_level_trace_exit,
            quality_level_trace_detail,
            status_override=quality_level_trace_status,
        ),
        build_check_result(
            "degrade_trace_signal",
            "P1",
            False,
            degrade_trace_exit,
            degrade_trace_detail,
            status_override=degrade_trace_status,
        ),
        build_check_result(
            "critical_gate_enforcement_signal",
            "P1",
            False,
            critical_gate_exit,
            critical_gate_detail,
            status_override=critical_gate_status,
        ),
        build_check_result(
            "chapter_gate_scoring_signal",
            "P1",
            False,
            chapter_gate_exit,
            chapter_gate_detail,
            status_override=chapter_gate_status,
        ),
        build_check_result(
            "cycle_time_kpi_measurement_signal",
            "P1",
            False,
            cycle_time_kpi_exit,
            cycle_time_kpi_detail,
            status_override=cycle_time_kpi_status,
        ),
        build_check_result(
            "comparable_quality_rubric_signal",
            "P1",
            False,
            comparable_quality_rubric_exit,
            comparable_quality_rubric_detail,
            status_override=comparable_quality_rubric_status,
        ),
        build_check_result(
            "weekly_kpi_dashboard_schema_signal",
            "P1",
            False,
            weekly_kpi_dashboard_schema_exit,
            weekly_kpi_dashboard_schema_detail,
            status_override=weekly_kpi_dashboard_schema_status,
        ),
        build_check_result(
            "weekly_kpi_rollup_readiness_signal",
            "P1",
            False,
            weekly_kpi_rollup_exit,
            weekly_kpi_rollup_detail,
            status_override=weekly_kpi_rollup_status,
        ),
        build_check_result(
            "weekly_kpi_comparability_visibility_signal",
            "P1",
            False,
            weekly_kpi_visibility_exit,
            weekly_kpi_visibility_detail,
            status_override=weekly_kpi_visibility_status,
        ),
        build_check_result(
            "critical_conflict_blocker_signal",
            "P0",
            True,
            critical_conflict_blocker_exit,
            critical_conflict_blocker_detail,
            status_override=critical_conflict_blocker_status,
        ),
        build_check_result(
            "unresolved_triage_blocker_signal",
            "P0",
            True,
            unresolved_triage_blocker_exit,
            unresolved_triage_blocker_detail,
            status_override=unresolved_triage_blocker_status,
        ),
        build_check_result(
            "feedback_artifact_linkage_signal",
            "P1",
            False,
            feedback_linkage_exit,
            feedback_linkage_detail,
            status_override=feedback_linkage_status,
        ),
        build_check_result(
            "conflict_artifact_linkage_signal",
            "P1",
            False,
            conflict_linkage_exit,
            conflict_linkage_detail,
            status_override=conflict_linkage_status,
        ),
        build_check_result(
            "chapter_gate_evidence_linkage_signal",
            "P1",
            False,
            chapter_gate_linkage_exit,
            chapter_gate_linkage_detail,
            status_override=chapter_gate_linkage_status,
        ),
        build_check_result(
            "evidence_freshness_signal",
            "P1",
            False,
            evidence_freshness_exit,
            evidence_freshness_detail,
            status_override=evidence_freshness_status,
        ),
        build_check_result(
            "migration_rollback_evidence_signal",
            "P1",
            False,
            migration_rollback_exit,
            migration_rollback_detail,
            status_override=migration_rollback_status,
        ),
        build_check_result(
            "compliance_keywords_signal",
            "P1",
            False,
            compliance_keywords_exit,
            compliance_keywords_detail,
            status_override=compliance_keywords_status,
        ),
        build_check_result(
            "tasks_completion_signal",
            "P1",
            False,
            tasks_exit,
            tasks_detail,
            status_override=tasks_status,
        ),
    ]

    machine_payload_generated_at = datetime.now(timezone.utc).isoformat()
    preliminary_no_go_reasons = [
        check["check_id"] for check in checks if check["blocking"] and check["status"] == "FAIL"
    ]
    preliminary_decision = "GO" if not preliminary_no_go_reasons else "NO_GO"
    writing_helper_generated_at = (
        str(writing_helper_acceptance_payload.get("generated_at") or "").strip()
        if writing_helper_acceptance_payload
        else ""
    )
    writing_helper_head_sha = (
        str(writing_helper_acceptance_payload.get("head_sha") or "").strip()
        if writing_helper_acceptance_payload
        else ""
    )
    writing_helper_version = (
        str(writing_helper_acceptance_payload.get("version") or "").strip()
        if writing_helper_acceptance_payload
        else ""
    )
    evidence_sources = [
        _build_release_evidence_source(
            "release_summary_report",
            REPORT_PATH,
            "PASS" if preliminary_decision == "GO" else "FAIL",
            machine_payload_generated_at,
            current_head_sha,
            current_head_sha,
            source_type="report",
            version=current_release_version,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "authority_alignment",
            AUTHORITY_ALIGNMENT_ARTIFACT_PATH,
            normalize_release_evidence_status(authority_alignment_status),
            machine_payload_generated_at,
            current_head_sha,
            current_head_sha,
            source_type="retained_artifact",
            version=current_release_version,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "writing_helper_acceptance",
            WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH,
            normalize_release_evidence_status(writing_helper_acceptance_status),
            writing_helper_generated_at,
            writing_helper_head_sha,
            current_head_sha,
            source_type="retained_artifact",
            version=writing_helper_version or None,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "package_e2e_acceptance",
            PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH,
            normalize_release_evidence_status(package_e2e_acceptance_status),
            str(package_e2e_acceptance_payload.get("generated_at") or "").strip()
            if package_e2e_acceptance_payload
            else "",
            str(package_e2e_acceptance_payload.get("head_sha") or "").strip()
            if package_e2e_acceptance_payload
            else "",
            current_head_sha,
            source_type="retained_artifact",
            version=(
                str(package_e2e_acceptance_payload.get("version") or "").strip()
                if package_e2e_acceptance_payload
                else ""
            )
            or None,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "governance_scripts_regression",
            GOVERNANCE_JUNIT_PATH,
            normalize_release_evidence_status(governance_status),
            machine_payload_generated_at,
            current_head_sha,
            current_head_sha,
            source_type="junit",
            version=current_release_version,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "production_guard",
            PRODUCTION_GUARD_JUNIT_PATH,
            normalize_release_evidence_status(prod_guard_status),
            machine_payload_generated_at,
            current_head_sha,
            current_head_sha,
            source_type="junit",
            version=current_release_version,
            current_version=current_release_version,
        ),
        _build_release_evidence_source(
            "external_e2e_smoke",
            E2E_JUNIT_PATH,
            normalize_release_evidence_status(e2e_status),
            machine_payload_generated_at,
            current_head_sha,
            current_head_sha,
            source_type="junit",
            version=current_release_version,
            current_version=current_release_version,
        ),
    ]
    release_evidence_blocking_sources = [
        str(source.get("source_id"))
        for source in evidence_sources
        if source.get("status") != "PASS"
        or not bool(source.get("is_fresh"))
        or not bool(source.get("is_current"))
    ]
    release_evidence = {
        "status": "fresh_current" if not release_evidence_blocking_sources else "non_green",
        "blocking_sources": release_evidence_blocking_sources,
        "head_sha": current_head_sha or "unknown",
        "version": current_release_version or "unknown",
        "generated_at": machine_payload_generated_at,
        "freshness_window_hours": RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        "evidence_sources": evidence_sources,
    }
    local_selftest_status, local_selftest_exit, local_selftest_detail = (
        local_selftest_enforcement_signal(release_evidence)
    )
    checks.append(
        build_check_result(
            "local_selftest_enforcement",
            "P0",
            True,
            local_selftest_exit,
            local_selftest_detail,
            status_override=local_selftest_status,
        )
    )
    scorecard_dimensions = _build_scorecard_dimensions(checks)
    delivery_contract = _build_delivery_contract(scorecard_dimensions)
    delivery_contract_status, delivery_contract_exit, delivery_contract_detail = (
        delivery_contract_100_signal(delivery_contract)
    )
    checks.append(
        build_check_result(
            "delivery_contract_100_signal",
            "P0",
            True,
            delivery_contract_exit,
            delivery_contract_detail,
            status_override=delivery_contract_status,
        )
    )
    no_go_reasons = [
        check["check_id"] for check in checks if check["blocking"] and check["status"] == "FAIL"
    ]
    decision = "GO" if not no_go_reasons else "NO_GO"
    machine_payload = {
        "decision": decision,
        "go_no_go_reasons": no_go_reasons,
        "generated_at": machine_payload_generated_at,
        "head_sha": current_head_sha,
        "version": current_release_version,
        "freshness_window_hours": RELEASE_EVIDENCE_FRESHNESS_WINDOW_HOURS,
        "delivery_contract": delivery_contract,
        "scorecard_dimensions": scorecard_dimensions,
        "checks": checks,
        "release_evidence": release_evidence,
    }

    table_lines = [
        "| check_id | priority | blocking | status |",
        "|---|---|---|---|",
    ]
    table_lines.extend(
        f"| {item['check_id']} | {item['priority']} | {str(item['blocking']).lower()} | {item['status']} |"
        for item in checks
    )
    table = "\n".join(table_lines)

    check_details_block = _build_check_detail_summary_section(checks)
    scorecard_block = _build_scorecard_section(scorecard_dimensions, delivery_contract)
    release_evidence_block = _build_release_evidence_summary_section(release_evidence)

    report = f"""# Release Check Summary

- Decision: {decision}
- Go/No-Go rule: any blocking FAIL => NO_GO
- Codecov strict mode: {"enabled" if codecov_strict_mode else "disabled"}

## Deterministic Check Results

{table}

## Machine-Readable Decision

```json
{json.dumps(machine_payload, ensure_ascii=False, indent=2)}
```

{scorecard_block}

{release_evidence_block}

## Details

{check_details_block}

### Command Outputs

#### version_consistency output

```text
{version_output}
```

#### delivery_semantic_gate output

```text
{delivery_output}
```

#### governance_scripts_regression output

```text
{governance_output}
```

#### baseline_tests_and_coverage output

```text
{baseline_output}
```

#### desktop_check output

```text
{desktop_output}
```

#### desktop_sidecar_readiness output

```text
{desktop_sidecar_readiness_output}
```

#### desktop_packaging_dry_run output

```text
{desktop_packaging_output}
```

#### writing_helper_acceptance_signal output

```text
{json.dumps(writing_helper_acceptance_payload, ensure_ascii=False, indent=2) if writing_helper_acceptance_payload else (writing_helper_acceptance_parse_error or "artifact missing")}
```

#### external_e2e_smoke output

```text
{e2e_output}
```

#### production_guard output

```text
{prod_guard_output}
```

#### metrics_guard output

```text
{metrics_guard_output}
```

#### authority_alignment_signal output

```text
{authority_alignment_output}
```

### 18) External Release Authority

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: repository contract in `.github/workflows/external-release-gate.yml` plus the local snapshot generated by this script.
- workflow_path: `.github/workflows/external-release-gate.yml`
- acceptance_workflow: `.github/workflows/writing-helper-acceptance.yml`
- policy_doc: `docs/release/RELEASE_NOTES.md`
- signoff_doc: `docs/release/SIGN_OFF.md`
- contract_docs: `README.md`, `desktop/README.md`, `docs/release/RELEASE_NOTES.md`, `docs/operations/DESKTOP_RUNBOOK.md`, `docs/operations/ROLLBACK.md`
- contract_labels: `Supported runtime`, `Supported launcher`, `Advisory compatibility surfaces`, `Deprecated surface`
- release_state_model:
  - `unsigned_local_proof`: repo-visible gates are green while `desktop/src-tauri/tauri.conf.json` still keeps `certificateThumbprint=null` and `timestampUrl=""`; valid local proof only, not a signed external shipment.
  - `prerequisite_missing_hold`: hold external shipment whenever any release prerequisite is missing [certificate thumbprint, timestamp URL, hydrated packaged compatibility artifact, Windows packaging host/toolchain].
  - `signed_external_release`: all repo-visible gates stay green and a Windows-hosted `npm --prefix desktop run tauri:build` completes with release-private signing inputs outside git.
- authority_alignment_checker: `scripts/check_authority_alignment.py`
- desktop_authoritative_local_gate: `{DESKTOP_AUTHORITATIVE_LOCAL_GATE_COMMAND}` (from `desktop/package.json` `check:local`, which currently resolves to `check:release`)
- desktop_local_selftest: `{DESKTOP_LOCAL_SELFTEST_COMMAND}` (required whenever retained release evidence for `release_summary_report`, `authority_alignment`, `writing_helper_acceptance`, or `governance_scripts_regression` is not already `fresh_current` for the current HEAD)
- packaging_dry_run: `{DESKTOP_PACKAGING_DRY_RUN_COMMAND}` (`tauri build --debug --no-bundle --target x86_64-pc-windows-msvc`)
- package_e2e_checklist: `npm --prefix desktop run package:e2e:checklist` (records installed-package install/start/use acceptance for the exact retained package artifact)
- formal_evidence_dir: `{_trace_path(RELEASE_EVIDENCE_DIR)}`
- retained_production_contract_evidence: `release-check-summary.md`, `{_trace_path(RELEASE_READINESS_ARTIFACT_PATH)}`, `{_trace_path(AUTHORITY_ALIGNMENT_ARTIFACT_PATH)}`, `{_trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)}`, `{_trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)}`, `{_trace_path(PRODUCTION_GUARD_JUNIT_PATH)}`, `{_trace_path(E2E_JUNIT_PATH)}`, `{_trace_path(GOVERNANCE_JUNIT_PATH)}`
- authority_alignment_artifact: `{_trace_path(AUTHORITY_ALIGNMENT_ARTIFACT_PATH)}`
- writing_helper_acceptance_artifact: `{_trace_path(WRITING_HELPER_ACCEPTANCE_ARTIFACT_PATH)}`
- package_e2e_acceptance_artifact: `{_trace_path(PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH)}`
- governance_junit: `{_trace_path(GOVERNANCE_JUNIT_PATH)}`
- production_guard_junit: `{_trace_path(PRODUCTION_GUARD_JUNIT_PATH)}`
- external_smoke_junit: `{_trace_path(E2E_JUNIT_PATH)}`
- signing_prerequisite: `desktop/src-tauri/tauri.conf.json` keeps `certificateThumbprint=null` and `timestampUrl=""` for unsigned local proof; signed external bundles require release-private override material outside git.
"""

    REPORT_PATH.write_text(report, encoding="utf-8")
    artifact_path = _write_release_readiness_artifact(
        decision=decision,
        go_no_go_reasons=no_go_reasons,
        generated_at=machine_payload_generated_at,
        head_sha=current_head_sha,
        version=current_release_version,
        checks=checks,
        release_evidence=release_evidence,
        report_path=REPORT_PATH,
    )
    authority_artifact_path = _write_authority_alignment_artifact(
        payload=authority_alignment_payload,
        parse_error=authority_alignment_parse_error,
        raw_output=authority_alignment_output,
    )
    print(f"Report generated: {REPORT_PATH}")
    print(f"Release readiness artifact generated: {artifact_path}")
    print(f"Authority alignment artifact generated: {authority_artifact_path}")
    return 0 if decision == "GO" else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python
"""Release readiness summary with deterministic Go/No-Go contract."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "release-check-summary.md"
RELEASE_EVIDENCE_DIR = PROJECT_ROOT / ".workflow" / "evidence" / "release"
RELEASE_READINESS_ARTIFACT_PATH = RELEASE_EVIDENCE_DIR / "release-readiness-artifact.json"


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
    match = re.search(r"(\d+)\s+passed", output)
    if match:
        return "passed", match.group(1)
    if "failed" in output.lower():
        fail_match = re.search(r"(\d+)\s+failed", output)
        return "failed", fail_match.group(1) if fail_match else "unknown"
    return "unknown", "0"


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
    return [
        key
        for key, pattern in required_patterns.items()
        if not re.search(pattern, corpus)
    ]


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


def _trace_path(path: Path) -> str:
    try:
        relative_path = path.relative_to(PROJECT_ROOT)
        return str(relative_path).replace("\\", "/")
    except ValueError:
        return path.resolve().as_posix()


def _build_release_readiness_artifact(
    decision: str,
    go_no_go_reasons: list[str],
    generated_at: str,
    checks: list[dict[str, object]],
    report_path: Path,
) -> dict[str, object]:
    return {
        "artifact_type": "release_readiness",
        "schema_version": "evidence.v1",
        "decision": decision,
        "go_no_go_reasons": go_no_go_reasons,
        "generated_at": generated_at,
        "checks": checks,
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
    checks: list[dict[str, object]],
    report_path: Path,
) -> Path:
    RELEASE_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    artifact_payload = _build_release_readiness_artifact(
        decision=decision,
        go_no_go_reasons=go_no_go_reasons,
        generated_at=generated_at,
        checks=checks,
        report_path=report_path,
    )
    RELEASE_READINESS_ARTIFACT_PATH.write_text(
        json.dumps(artifact_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return RELEASE_READINESS_ARTIFACT_PATH


def _extract_policy_contract_from_docs(quality_doc: Path, pdd_doc: Path) -> dict[str, object]:
    quality_text = quality_doc.read_text(encoding="utf-8", errors="replace") if quality_doc.exists() else ""
    pdd_text = pdd_doc.read_text(encoding="utf-8", errors="replace") if pdd_doc.exists() else ""

    quality_pass_match = re.search(r"quality\s+pass\s+threshold\s*:\s*>=\s*(\d+(?:\.\d+)?)", quality_text, flags=re.IGNORECASE)
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
    from src.workflow.novel_quality import BLOCK_THRESHOLD, PASS_THRESHOLD, evaluate_novel_quality
    from src.workflow.state import DEFAULT_CONFIG, NOVEL_HUMAN_REVIEW_SCORE, NOVEL_PASS_SCORE
    from src.mcp import gateway as gateway_module
    from src.mcp import contract as contract_module

    sample_text = (
        '"Open the door," she whispered. '
        "Moonlight spilled across the wet street and painted sharp shadows under the arch. "
        "Because he betrayed the pact, the argument turned into open conflict. "
        "Therefore she crossed the square, eyes fixed on the only lit window."
    )
    auto_eval = evaluate_novel_quality(sample_text, quality_mode="auto")
    manual_eval = evaluate_novel_quality(sample_text, quality_mode="manual")

    return {
        "quality_pass_score": float(NOVEL_PASS_SCORE),
        "human_review_score": float(NOVEL_HUMAN_REVIEW_SCORE),
        "revise_lower_bound": float(BLOCK_THRESHOLD),
        "rewrite_below": float(BLOCK_THRESHOLD),
        "novel_quality_pass_threshold": float(PASS_THRESHOLD),
        "default_pass_score": float(DEFAULT_CONFIG.get("pass_score", 0)),
        "default_human_review_score": float(DEFAULT_CONFIG.get("human_review_score", 0)),
        "publish_from_go": contract_module._normalize_publish_recommendation({"decision": "go"}, "revise"),
        "publish_from_soft_go": contract_module._normalize_publish_recommendation({"decision": "soft_go"}, "pass"),
        "publish_from_no_go": contract_module._normalize_publish_recommendation({"decision": "no_go"}, "pass"),
        "terminal_default_decision": gateway_module._with_terminal_contract({"status": "completed"}).get("decision"),
        "terminal_no_go_preserved": gateway_module._with_terminal_contract({"terminal": "interrupted", "decision": "no_go"}).get("decision") == "no_go",
        "quality_mode_consistent": auto_eval.get("publish_recommendation") == manual_eval.get("publish_recommendation"),
        "blocked_semantics_declared": True,
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

    has_mismatch = len(mismatches) > 0
    status = "FAIL" if has_mismatch else "PASS"
    exit_code = 1 if has_mismatch else 0

    return status, exit_code, _format_detail_pairs([
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
        ("terminal_no_go_preserved", "yes" if runtime.get("terminal_no_go_preserved") else "no"),
        ("quality_mode_consistent", "yes" if runtime.get("quality_mode_consistent") else "no"),
        ("mismatches", _format_csv(mismatches)),
        ("decision", "no_go" if has_mismatch else "go"),
    ])


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
        return "PASS", 0, _format_detail_pairs([
            ("keywords_present", "ttft,e2e,effective_hit_rate,context_budget_utilization,gate consistency"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("missing_keywords", _format_csv(missing)),
    ])


def evidence_links_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir])
    lowered = corpus.lower()

    has_evidence_links_key = "evidence_links" in lowered
    has_traceable_link = _has_traceable_link(corpus)

    if has_evidence_links_key and has_traceable_link:
        return "PASS", 0, _format_detail_pairs([
            ("evidence_links_key", "present"),
            ("traceable_link", "present"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("evidence_links_key", "present" if has_evidence_links_key else "missing"),
        ("traceable_link", "present" if has_traceable_link else "missing"),
    ])


def self_learning_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "reflector": r"\breflector\b",
        "curator": r"\bcurator\b",
        "playbook": r"\bplaybook\b",
    }

    missing = _missing_required_patterns(corpus, required_patterns)

    if not missing:
        return "PASS", 0, _format_detail_pairs([
            ("fields_present", "reflector,curator,playbook"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("missing_fields", _format_csv(missing)),
    ])


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
        return "PASS", 0, _format_detail_pairs([
            ("metrics_present", "c_effective,s_final,r_memory"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("missing_metrics", _format_csv(missing)),
        ("invalid_metrics", _format_csv(invalid)),
    ])


def compliance_keywords_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    required_patterns = {
        "rbac": r"\brbac\b",
        "audit": r"\baudit\b",
        "rollback": r"\brollback\b",
    }

    missing = _missing_required_patterns(corpus, required_patterns)

    if not missing:
        return "PASS", 0, _format_detail_pairs([
            ("keywords_present", "rbac,audit,rollback"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("missing_keywords", _format_csv(missing)),
    ])


def migration_rollback_evidence_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_migration = bool(re.search(r"\bmigration\b|\bmigrate\b|\bschema\b", corpus))
    has_rollback = bool(re.search(r"\brollback\b|\broll[-_\s]?back\b|\brevert\b", corpus))
    has_traceable_link = _has_traceable_link(corpus)

    if has_migration and has_rollback and has_traceable_link:
        return "PASS", 0, _format_detail_pairs([
            ("migration", "present"),
            ("rollback", "present"),
            ("traceable_link", "present"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("migration", "present" if has_migration else "missing"),
        ("rollback", "present" if has_rollback else "missing"),
        ("traceable_link", "present" if has_traceable_link else "missing"),
    ])


def quality_level_trace_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    effective_match = re.search(r"effective[_\s-]?quality[_\s-]?level\s*[:=]\s*(ultra|high|medium|fluent)", corpus)
    used_match = re.search(r"quality[_\s-]?level[_\s-]?used\s*[:=]\s*(ultra|high|medium|fluent)", corpus)

    effective_value = effective_match.group(1) if effective_match else "missing"
    used_value = used_match.group(1) if used_match else "missing"

    if effective_match and used_match:
        return "PASS", 0, _format_detail_pairs([
            ("effective_quality_level", effective_value),
            ("quality_level_used", used_value),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("effective_quality_level", effective_value),
        ("quality_level_used", used_value),
    ])


def degrade_trace_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_degrade_reason = bool(re.search(r"degrade[_\s-]?reason", corpus))
    has_degrade_steps = bool(re.search(r"degrade[_\s-]?steps", corpus))

    if has_degrade_reason and has_degrade_steps:
        return "PASS", 0, _format_detail_pairs([
            ("degrade_reason", "present"),
            ("degrade_steps", "present"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("degrade_reason", "present" if has_degrade_reason else "missing"),
        ("degrade_steps", "present" if has_degrade_steps else "missing"),
    ])


def critical_gate_enforcement_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    has_critical_gate_config = bool(re.search(r"critical[_\s-]?gate[_\s-]?always[_\s-]?on\s*[:=]\s*(true|yes|enabled|on)", corpus))
    has_critical_gate_statement = bool(
        re.search(r"critical[_\s-]?gate", corpus) and re.search(r"always[_\s-]?on|enforc", corpus)
    )

    if has_critical_gate_config or has_critical_gate_statement:
        return "PASS", 0, _format_detail_pairs([
            ("critical_gate", "enforced"),
        ])

    return "WARN", 0, _format_detail_pairs([
        ("critical_gate", "missing"),
    ])


def chapter_gate_scoring_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    quality_score = _extract_metric_value(corpus, "quality_score")
    recommendation_match = re.search(r"publish[_\s-]?recommendation\s*[:=]\s*(pass|revise|block)", corpus)
    critical_count_match = re.search(r"critical[_\s-]?issue[_\s-]?count\s*[:=]\s*(\d+)", corpus)

    recommendation = recommendation_match.group(1) if recommendation_match else "missing"
    critical_issue_count = int(critical_count_match.group(1)) if critical_count_match else None

    complete = quality_score is not None and recommendation_match and critical_count_match
    score_ok = quality_score is not None and quality_score >= 99.0
    recommendation_ok = recommendation == "pass"
    critical_ok = critical_issue_count == 0

    gate_pass = bool(complete and score_ok and recommendation_ok and critical_ok)
    status = "PASS" if gate_pass else "WARN"

    return status, 0, _format_detail_pairs([
        ("quality_score", quality_score if quality_score is not None else "missing"),
        ("threshold", 99.0),
        ("publish_recommendation", recommendation),
        ("critical_issue_count", critical_issue_count if critical_issue_count is not None else "missing"),
        ("decision", "go" if gate_pass else "no_go"),
    ])


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
        code
        for code in exclusion_reason_codes
        if re.search(rf"\b{re.escape(code)}\b", corpus)
    ]

    status = "PASS" if not missing_rules and len(present_reason_codes) >= 1 else "WARN"
    return status, 0, _format_detail_pairs([
        ("window_policy", "full_7_day_only"),
        ("manual_override", "forbidden"),
        ("missing_rules", _format_csv(missing_rules)),
        ("present_exclusion_reason_codes", _format_csv(present_reason_codes)),
    ])


def comparable_quality_rubric_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
    corpus = _read_markdown_corpus([weekly_dir, quality_dir]).lower()

    quality_score = _extract_metric_value(corpus, "quality_score")
    recommendation_match = re.search(r"publish[_\s-]?recommendation\s*[:=]\s*(pass|revise|block)", corpus)
    critical_count_match = re.search(r"critical[_\s-]?issue[_\s-]?count\s*[:=]\s*(\d+)", corpus)

    effective_level_match = re.search(r"effective[_\s-]?quality[_\s-]?level\s*[:=]\s*(ultra|high|medium|fluent)", corpus)
    used_level_match = re.search(r"quality[_\s-]?level[_\s-]?used\s*[:=]\s*(ultra|high|medium|fluent)", corpus)

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
    degrade_trace_complete = (has_degrade_reason and has_degrade_steps) or (not has_degrade_reason and not has_degrade_steps)

    comparable = all([
        quality_score_ok,
        critical_ok,
        recommendation_ok,
        quality_level_match,
        degrade_trace_complete,
    ])

    status = "PASS" if comparable else "WARN"
    return status, 0, _format_detail_pairs([
        ("rubric_version", "v1"),
        ("quality_score", quality_score if quality_score is not None else "missing"),
        ("threshold", 99.0),
        ("critical_issue_count", critical_issue_count if critical_issue_count is not None else "missing"),
        ("publish_recommendation", recommendation),
        ("quality_level_match", "yes" if quality_level_match else "no"),
        ("degrade_trace_complete", "yes" if degrade_trace_complete else "no"),
        ("decision", "comparable" if comparable else "not_comparable"),
    ])


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

    return status, 0, _format_detail_pairs([
        ("schema_name", "weekly_kpi_dashboard"),
        ("schema_version", "v1"),
        ("manual_override", "forbidden"),
        ("missing_fields", _format_csv(missing_fields)),
    ])


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

    return status, 0, _format_detail_pairs([
        ("rollup_source", "canonical_evidence"),
        ("manual_override", "forbidden"),
        ("baseline_state", baseline_state_match.group(1) if baseline_state_match else "missing"),
        ("cycle_time_trend", trend_match.group(1) if trend_match else "missing"),
        ("missing_fields", _format_csv(missing_fields)),
    ])


def weekly_kpi_comparability_visibility_signal(weekly_dir: Path, quality_dir: Path) -> tuple[str, int, str]:
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

    return status, 0, _format_detail_pairs([
        ("visibility_source", "comparable_quality_plus_cycle_time"),
        ("manual_override", "forbidden"),
        ("comparability_decision", comparability_match.group(1) if comparability_match else "missing"),
        ("cycle_time_trend", trend_match.group(1) if trend_match else "missing"),
        ("baseline_state", baseline_state_match.group(1) if baseline_state_match else "missing"),
        ("missing_fields", _format_csv(missing_fields)),
    ])


def evidence_freshness_signal(weekly_dir: Path, quality_dir: Path, now: datetime | None = None) -> tuple[str, int, str]:
    paths = _iter_non_template_markdown_paths([weekly_dir, quality_dir])
    if not paths:
        return "WARN", 0, _format_detail_pairs([
            ("fresh_files", 0),
            ("stale_files", 0),
            ("window_days", 14),
        ])

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
    return status, 0, _format_detail_pairs([
        ("fresh_files", fresh),
        ("stale_files", stale),
        ("window_days", 14),
    ])


def tasks_completion_signal(
    tasks_code: int,
    tasks_payload: dict[str, object] | None,
    tasks_parse_error: str | None,
) -> tuple[str, int, str]:
    tasks_checked = tasks_payload.get("total_checked") if tasks_payload else None
    tasks_unchecked = tasks_payload.get("total_unchecked") if tasks_payload else None
    tasks_ratio = tasks_payload.get("completion_ratio") if tasks_payload else None

    if tasks_code != 0:
        return "FAIL", tasks_code, _format_detail_pairs([
            ("checker_exit", tasks_code),
            ("json_parse_error", tasks_parse_error or "none"),
        ])

    if not tasks_payload:
        return "WARN", 0, _format_detail_pairs([
            ("checker_exit", 0),
            ("json_parse_error", tasks_parse_error or "unknown"),
        ])

    status = "PASS" if isinstance(tasks_unchecked, int) and tasks_unchecked == 0 else "WARN"
    return status, 0, _format_detail_pairs([
        ("checked", tasks_checked if tasks_checked is not None else "n/a"),
        ("unchecked", tasks_unchecked if tasks_unchecked is not None else "n/a"),
        ("completion_ratio", f"{tasks_ratio}%" if tasks_ratio is not None else "n/a"),
        ("json_parse_error", tasks_parse_error or "none"),
    ])


def evidence_coverage_signal(quality_non_template: int, weekly_non_template: int) -> tuple[str, int, str]:
    status = "PASS" if quality_non_template >= 1 and weekly_non_template >= 2 else "WARN"
    return status, 0, _format_detail_pairs([
        ("quality_non_template", quality_non_template),
        ("weekly_non_template", weekly_non_template),
    ])


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

    return status, exit_code, _format_detail_pairs([
        ("quality_non_template", quality_non_template),
        ("weekly_non_template", weekly_non_template),
        ("machine_payload_available", "yes" if machine_payload_available else "no"),
        ("missing_evidence_classes", _format_csv(missing_evidence_classes)),
        ("decision", "no_go" if has_blocker else "go"),
    ])


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

    return status, exit_code, _format_detail_pairs([
        ("chapter_gate_status", chapter_gate_status),
        ("critical_conflict_status", critical_conflict_status),
        ("unresolved_triage_status", unresolved_triage_status),
        ("blocker_semantics", "chapter_gate_or_critical_or_unresolved_triage_is_fail"),
        ("decision", "no_go" if has_blocker else "go"),
    ])


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

    detail = _format_detail_pairs([
        ("strict_mode", str(strict_mode).lower()),
        ("token_present", str(token_present).lower()),
        ("coverage_xml", "yes" if coverage_exists else "no"),
        ("result", result),
    ])
    return status, exit_code, detail, strict_mode


def feedback_artifact_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return "WARN", 0, _format_detail_pairs([
            ("snapshots_scanned", 0),
            ("linked_feedback_artifacts", 0),
            ("invalid_snapshots", 0),
        ])

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
            str(trace.get(key) or "").strip()
            for key in ("session_id", "run_id", "revision_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1
        feedback_ok = isinstance(feedback_artifacts, list)

        if artifact_type == "quality_feedback" and trace_ok and links_ok and feedback_ok:
            linked_count += 1
        else:
            invalid_count += 1

    status = "PASS" if linked_count >= 1 else "WARN"
    return status, 0, _format_detail_pairs([
        ("snapshots_scanned", len(snapshot_paths)),
        ("linked_feedback_artifacts", linked_count),
        ("invalid_snapshots", invalid_count),
    ])


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
            str(trace.get(key) or "").strip()
            for key in ("session_id", "run_id", "revision_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1

        if not trace_ok or not links_ok:
            invalid_count += 1
            continue

        linked_count += 1
        if any(str(item.get("severity") or "").strip().lower() == "critical" for item in conflicts if isinstance(item, dict)):
            critical_linked_count += 1

    return len(snapshot_paths), linked_count, critical_linked_count, invalid_count


def conflict_artifact_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    snapshots_scanned, linked_count, critical_linked_count, invalid_count = _scan_conflict_artifact_linkage(sessions_root)

    status = "PASS" if linked_count >= 1 else "WARN"
    return status, 0, _format_detail_pairs([
        ("snapshots_scanned", snapshots_scanned),
        ("linked_conflict_artifacts", linked_count),
        ("critical_conflicts_linked", critical_linked_count),
        ("invalid_snapshots", invalid_count),
    ])


def critical_conflict_blocker_signal(sessions_root: Path) -> tuple[str, int, str]:
    snapshots_scanned, linked_count, critical_linked_count, invalid_count = _scan_conflict_artifact_linkage(sessions_root)

    has_blocker = critical_linked_count > 0
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0

    return status, exit_code, _format_detail_pairs([
        ("snapshots_scanned", snapshots_scanned),
        ("linked_conflict_artifacts", linked_count),
        ("critical_conflicts_linked", critical_linked_count),
        ("invalid_snapshots", invalid_count),
        ("decision", "no_go" if has_blocker else "go"),
    ])


def unresolved_triage_blocker_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return "PASS", 0, _format_detail_pairs([
            ("state_files_scanned", 0),
            ("linked_triage_records", 0),
            ("unresolved_triage_records", 0),
            ("invalid_state_files", 0),
            ("blocker_semantics", "triage_state_not_in_{resolved,rejected}"),
            ("decision", "go"),
        ])

    state_paths = list(sessions_root.glob("active/*/.data/state.json"))
    linked_count = 0
    unresolved_count = 0
    invalid_count = 0

    for state_path in state_paths:
        try:
            payload = json.loads(state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            invalid_count += 1
            continue

        if not isinstance(payload, dict):
            invalid_count += 1
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

        if not triage_state:
            invalid_count += 1
            continue

        linked_count += 1
        if triage_state not in {"resolved", "rejected"}:
            unresolved_count += 1

    has_blocker = unresolved_count > 0
    status = "FAIL" if has_blocker else "PASS"
    exit_code = 1 if has_blocker else 0
    return status, exit_code, _format_detail_pairs([
        ("state_files_scanned", len(state_paths)),
        ("linked_triage_records", linked_count),
        ("unresolved_triage_records", unresolved_count),
        ("invalid_state_files", invalid_count),
        ("blocker_semantics", "triage_state_not_in_{resolved,rejected}"),
        ("decision", "no_go" if has_blocker else "go"),
    ])


def chapter_gate_evidence_linkage_signal(sessions_root: Path) -> tuple[str, int, str]:
    if not sessions_root.exists():
        return "WARN", 0, _format_detail_pairs([
            ("snapshots_scanned", 0),
            ("eligible_release_gate_runs", 0),
            ("chapter_gate_checks_linked", 0),
            ("aggregation_window", "active_sessions"),
            ("result", "insufficient_data"),
            ("invalid_snapshots", 0),
        ])

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
            str(trace.get(key) or "").strip()
            for key in ("session_id", "run_id", "check_id")
        )
        links_ok = isinstance(evidence_links, list) and len(evidence_links) >= 1

        if not trace_ok or not links_ok:
            invalid_count += 1
            continue

        eligible_release_gate_runs += 1

        trace_check_id = str(trace.get("check_id") or "").strip()
        output = payload.get("output")
        output_check_id = str(output.get("check_id") or "").strip() if isinstance(output, dict) else ""
        output_checks = output.get("checks") if isinstance(output, dict) else None
        checks_has_chapter_gate = isinstance(output_checks, list) and any(
            isinstance(item, dict) and str(item.get("check_id") or "").strip() == "chapter_gate_scoring_signal"
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
    return status, 0, _format_detail_pairs([
        ("snapshots_scanned", len(snapshot_paths)),
        ("eligible_release_gate_runs", eligible_release_gate_runs),
        ("chapter_gate_checks_linked", chapter_gate_checks_linked),
        ("aggregation_window", "active_sessions"),
        ("result", result),
        ("invalid_snapshots", invalid_count),
    ])


def main() -> int:
    version_code, version_output = run_cmd([sys.executable, "scripts/check_versions.py"])
    delivery_code, delivery_output = run_cmd([sys.executable, "scripts/delivery_gate.py"])

    baseline_code, baseline_output = run_cmd([
        sys.executable,
        "-m",
        "pytest",
        "-o",
        "addopts=",
        "tests/unit",
        "tests/integration",
        "-m",
        "not e2e",
        "--cov=src",
        "--cov-report=xml",
        "--cov-fail-under=80",
        "-q",
        "--tb=no",
    ])

    desktop_bootstrap_code, desktop_bootstrap_output = run_cmd([
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "ensure-deps",
    ])
    desktop_sidecar_build_code, desktop_sidecar_build_output = run_cmd([
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "build:sidecar",
    ])
    desktop_check_code, desktop_check_output = run_cmd([
        "npm.cmd",
        "--prefix",
        "desktop",
        "run",
        "check",
    ])
    desktop_code = (
        desktop_bootstrap_code
        if desktop_bootstrap_code != 0
        else (desktop_sidecar_build_code if desktop_sidecar_build_code != 0 else desktop_check_code)
    )
    desktop_output = "\n\n".join(
        part
        for part in [desktop_bootstrap_output, desktop_sidecar_build_output, desktop_check_output]
        if part
    )

    e2e_code, e2e_output = run_cmd([
        sys.executable,
        "-m",
        "pytest",
        "-o",
        "addopts=",
        "-m",
        "e2e",
        "tests/integration/test_e2e_workflow.py",
        "-q",
        "--tb=no",
    ])

    prod_guard_code, prod_guard_output = run_cmd([
        sys.executable,
        "-c",
        (
            "from src.mcp.gateway import _resolve_reload_enabled, _resolve_cors_origins;"
            "from src.config import init_config;"
            "init_config(config_path='config/niko-studio.production.yaml', hot_reload=False);"
            "assert _resolve_reload_enabled() is False;"
            "origins = _resolve_cors_origins();"
            "assert origins and all(o not in {'*','http://localhost:3000','http://127.0.0.1:3000'} for o in origins);"
            "print('production guard ok')"
        ),
    ], env={
        "NIKO_ENV": "production",
        "NIKO_CORS_PROD_ORIGINS": "https://app.example.com,https://gray.example.com",
    })

    metrics_guard_code, metrics_guard_output = run_cmd([
        sys.executable,
        "-c",
        (
            "from src.config import init_config, get_config_value;"
            "init_config(config_path='config/niko-studio.production.yaml', hot_reload=False);"
            "assert bool(get_config_value('gateway.metrics_enabled', True)) is True;"
            "print('metrics guard ok')"
        ),
    ], env={
        "NIKO_ENV": "production",
        "NIKO_GATEWAY_METRICS_ENABLED": "true",
    })

    tasks_code, tasks_output = run_cmd([sys.executable, "scripts/check_tasks_completion.py"])
    tasks_payload, tasks_parse_error = parse_first_json_object(tasks_output)

    weekly_evidence_dir = PROJECT_ROOT / ".workflow" / "evidence" / "weekly"
    quality_evidence_dir = PROJECT_ROOT / ".workflow" / "evidence" / "quality"
    report_root = REPORT_PATH.parent
    sessions_root = report_root / ".writing" / "sessions"

    evidence_quality_count = _count_non_template_markdown(quality_evidence_dir)
    evidence_weekly_review_count = _count_non_template_markdown(weekly_evidence_dir)

    slo_status, slo_exit, slo_detail = slo_baseline_signal(weekly_evidence_dir, quality_evidence_dir)
    evidence_links_status, evidence_links_exit, evidence_links_detail = evidence_links_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    self_learning_status, self_learning_exit, self_learning_detail = self_learning_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    memory_observability_status, memory_observability_exit, memory_observability_detail = memory_observability_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    compliance_keywords_status, compliance_keywords_exit, compliance_keywords_detail = compliance_keywords_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )

    migration_rollback_status, migration_rollback_exit, migration_rollback_detail = migration_rollback_evidence_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )

    quality_level_trace_status, quality_level_trace_exit, quality_level_trace_detail = quality_level_trace_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    degrade_trace_status, degrade_trace_exit, degrade_trace_detail = degrade_trace_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    critical_gate_status, critical_gate_exit, critical_gate_detail = critical_gate_enforcement_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    chapter_gate_status, chapter_gate_exit, chapter_gate_detail = chapter_gate_scoring_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    cycle_time_kpi_status, cycle_time_kpi_exit, cycle_time_kpi_detail = cycle_time_kpi_measurement_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    comparable_quality_rubric_status, comparable_quality_rubric_exit, comparable_quality_rubric_detail = comparable_quality_rubric_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    weekly_kpi_dashboard_schema_status, weekly_kpi_dashboard_schema_exit, weekly_kpi_dashboard_schema_detail = weekly_kpi_dashboard_schema_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    weekly_kpi_rollup_status, weekly_kpi_rollup_exit, weekly_kpi_rollup_detail = weekly_kpi_rollup_readiness_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    weekly_kpi_visibility_status, weekly_kpi_visibility_exit, weekly_kpi_visibility_detail = weekly_kpi_comparability_visibility_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )
    critical_conflict_blocker_status, critical_conflict_blocker_exit, critical_conflict_blocker_detail = critical_conflict_blocker_signal(
        sessions_root,
    )
    unresolved_triage_blocker_status, unresolved_triage_blocker_exit, unresolved_triage_blocker_detail = unresolved_triage_blocker_signal(
        sessions_root,
    )
    feedback_linkage_status, feedback_linkage_exit, feedback_linkage_detail = feedback_artifact_linkage_signal(
        sessions_root,
    )
    conflict_linkage_status, conflict_linkage_exit, conflict_linkage_detail = conflict_artifact_linkage_signal(
        sessions_root,
    )

    chapter_gate_linkage_status, chapter_gate_linkage_exit, chapter_gate_linkage_detail = chapter_gate_evidence_linkage_signal(
        sessions_root,
    )
    evidence_freshness_status, evidence_freshness_exit, evidence_freshness_detail = evidence_freshness_signal(
        weekly_evidence_dir,
        quality_evidence_dir,
    )

    tasks_status, tasks_exit, tasks_detail = tasks_completion_signal(
        tasks_code,
        tasks_payload,
        tasks_parse_error,
    )

    tasks_checked = tasks_payload.get("total_checked") if tasks_payload else None
    tasks_unchecked = tasks_payload.get("total_unchecked") if tasks_payload else None
    tasks_ratio = tasks_payload.get("completion_ratio") if tasks_payload else None

    evidence_status, evidence_exit, evidence_detail = evidence_coverage_signal(
        evidence_quality_count,
        evidence_weekly_review_count,
    )
    evidence_completeness_status, evidence_completeness_exit, evidence_completeness_detail = evidence_completeness_blocker_signal(
        evidence_quality_count,
        evidence_weekly_review_count,
        machine_payload_available=True,
    )
    gate_score_or_critical_status, gate_score_or_critical_exit, gate_score_or_critical_detail = gate_score_or_critical_blocker_signal(
        chapter_gate_status,
        critical_conflict_blocker_status,
        unresolved_triage_blocker_status,
    )
    runtime_policy_conformance_status, runtime_policy_conformance_exit, runtime_policy_conformance_detail = runtime_policy_conformance_signal()

    coverage_xml = PROJECT_ROOT / "coverage.xml"
    coverage_exists = coverage_xml.exists()
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
            _format_detail_pairs([
                ("script", "scripts/check_versions.py"),
            ]),
        ),
        build_check_result(
            "delivery_semantic_gate",
            "P0",
            True,
            delivery_code,
            _format_detail_pairs([
                ("script", "scripts/delivery_gate.py"),
            ]),
        ),
        build_check_result(
            "baseline_tests_and_coverage",
            "P0",
            True,
            baseline_code,
            _format_detail_pairs([
                ("status", baseline_status),
                ("passed_count", baseline_passed),
            ]),
        ),
        build_check_result(
            "desktop_check",
            "P0",
            True,
            desktop_code,
            _format_detail_pairs([
                ("command", "npm --prefix desktop run build:sidecar && npm --prefix desktop run check"),
            ]),
        ),
        build_check_result(
            "desktop_sidecar_readiness",
            "P0",
            True,
            desktop_sidecar_build_code,
            _format_detail_pairs([
                ("command", "npm --prefix desktop run build:sidecar"),
                ("artifact", "desktop/src-tauri/bin/niko-gateway"),
            ]),
        ),
        build_check_result(
            "external_e2e_smoke",
            "P1",
            False,
            e2e_code,
            _format_detail_pairs([
                ("status", e2e_status),
                ("passed_count", e2e_passed),
            ]),
        ),
        build_check_result(
            "production_guard",
            "P1",
            False,
            prod_guard_code,
            _format_detail_pairs([
                ("guard", "reload_cors_production"),
            ]),
        ),
        build_check_result(
            "metrics_guard",
            "P1",
            False,
            metrics_guard_code,
            _format_detail_pairs([
                ("guard", "gateway_metrics_production"),
            ]),
        ),
        build_check_result(
            "codecov_signal",
            "P1",
            False,
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

    no_go_reasons = [
        check["check_id"]
        for check in checks
        if check["blocking"] and check["status"] == "FAIL"
    ]
    decision = "GO" if not no_go_reasons else "NO_GO"

    machine_payload_generated_at = datetime.now(timezone.utc).isoformat()
    machine_payload = {
        "decision": decision,
        "go_no_go_reasons": no_go_reasons,
        "generated_at": machine_payload_generated_at,
        "checks": checks,
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

    report = f"""# Release Check Summary

- Decision: {decision}
- Go/No-Go rule: any P0 FAIL => NO_GO
- Codecov strict mode: {'enabled' if codecov_strict_mode else 'disabled'}

## Deterministic Check Results

{table}

## Machine-Readable Decision

```json
{json.dumps(machine_payload, ensure_ascii=False, indent=2)}
```

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

#### baseline_tests_and_coverage output

```text
{baseline_output}
```

#### desktop_check output

```text
{desktop_output}
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

### 18) CI Integration Tests latest

- policy: do not write back dynamic run_id / run_url to repository files.
- source_of_truth: GitHub Actions `Integration Tests` latest result.
- workflow_url: https://github.com/Smith-106/niko-studio/actions/workflows/integration-tests.yml
"""

    REPORT_PATH.write_text(report, encoding="utf-8")
    artifact_path = _write_release_readiness_artifact(
        decision=decision,
        go_no_go_reasons=no_go_reasons,
        generated_at=machine_payload_generated_at,
        checks=checks,
        report_path=REPORT_PATH,
    )
    print(f"Report generated: {REPORT_PATH}")
    print(f"Release readiness artifact generated: {artifact_path}")
    return 0 if decision == "GO" else 1


if __name__ == "__main__":
    raise SystemExit(main())

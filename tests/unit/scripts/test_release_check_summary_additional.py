from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_script_module(relative_path: str, module_name: str) -> ModuleType:
    script_path = PROJECT_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def write_state_payload(sessions_root: Path, session_name: str, payload: object) -> Path:
    state_path = sessions_root / "active" / session_name / ".data" / "state.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return state_path


def write_snapshot_payload(
    sessions_root: Path,
    session_name: str,
    snapshot_name: str,
    payload: object,
    *,
    raw: str | None = None,
) -> Path:
    snapshot_path = (
        sessions_root / "active" / session_name / ".data" / "generation-snapshots" / snapshot_name
    )
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    if raw is not None:
        snapshot_path.write_text(raw, encoding="utf-8")
    else:
        snapshot_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return snapshot_path


def write_markdown_payload(path: Path, content: str, *, mtime: float | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return path


def test_release_check_summary_parse_helpers_and_retained_evidence_states() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_parse_helpers_additional",
    )

    assert module.parse_pytest_counts("19 passed, 2 skipped") == ("passed", "19")
    assert module.parse_pytest_counts("Tests 7 passed in 1.2s") == ("passed", "7")
    assert module.parse_pytest_counts("2 failed, 5 collected") == ("failed", "2")
    assert module.parse_pytest_counts("no structured summary here") == ("unknown", "0")

    payload, error = module.parse_first_json_object("INFO start\n{\"decision\":\"GO\"}\nINFO end")
    assert payload == {"decision": "GO"}
    assert error is None

    payload, error = module.parse_first_json_object("INFO start\n[]\nINFO end")
    assert payload is None
    assert error == "json payload not found in output"

    current_head_unknown = module._evaluate_retained_evidence(
      "2026-06-03T00:00:00+00:00",
      "deadbeef",
      None,
      freshness_window_hours=48,
      now=datetime(2026, 6, 3, 6, 0, tzinfo=timezone.utc),
    )
    assert current_head_unknown["freshness_status"] == "fresh"
    assert current_head_unknown["supersession_status"] == "unknown"
    assert current_head_unknown["supersession_reasons"] == ["current_head_unknown"]
    assert current_head_unknown["evidence_state"] == "unknown"

    head_missing = module._evaluate_retained_evidence(
      "",
      "",
      "cafebabe",
      freshness_window_hours=48,
      now=datetime(2026, 6, 3, 6, 0, tzinfo=timezone.utc),
      version="11.0.0",
      current_version="11.0.1",
    )
    assert head_missing["freshness_status"] == "unknown"
    assert head_missing["supersession_status"] == "superseded"
    assert head_missing["supersession_reasons"] == ["head_sha_missing", "version_mismatch"]
    assert head_missing["evidence_state"] == "unknown_superseded"
    assert head_missing["generated_at_parse_error"] is None

    source = module._build_release_evidence_source(
      "package_e2e_acceptance",
      PROJECT_ROOT / ".workflow" / "evidence" / "release" / "package-e2e-acceptance.json",
      "PASS",
      "2026-06-03T00:00:00+00:00",
      "deadbeef",
      "deadbeef",
      source_type="artifact",
      now=datetime(2026, 6, 3, 1, 0, tzinfo=timezone.utc),
      version="11.0.0",
      current_version="11.0.0",
    )
    assert source["source_id"] == "package_e2e_acceptance"
    assert source["source_type"] == "artifact"
    assert source["freshness_status"] == "fresh"
    assert source["supersession_status"] == "current"
    assert source["generated_at_parse_error"] == "none"


def test_release_check_summary_helper_branches_cover_run_cmd_and_anchor_guards(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_helpers_additional",
    )
    recorded: dict[str, object] = {}

    def fake_run(cmd, cwd, capture_output, text, encoding, errors, env):  # noqa: ANN001
        recorded["cmd"] = cmd
        recorded["cwd"] = cwd
        recorded["env"] = env
        return SimpleNamespace(returncode=7, stdout="hello", stderr="world")

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    exit_code, output = module.run_cmd(["python", "tool.py"], {"NIKO_TEST": "1"})
    assert exit_code == 7
    assert output == "hello\nworld"
    assert recorded["cwd"] == PROJECT_ROOT
    assert recorded["env"]["NIKO_TEST"] == "1"

    monkeypatch.setattr(module, "PROJECT_ROOT", tmp_path)
    (tmp_path / "good.txt").write_text("READY\n", encoding="utf-8")
    (tmp_path / "blocked.txt").write_text("BLOCKED\n", encoding="utf-8")
    rules = [
        module.FileAnchorRule("good.txt", r"READY", "good rule"),
        module.FileAnchorRule("blocked.txt", r"BLOCK", "optional rule", required=False),
        module.FileAnchorRule("missing.txt", r"READY", "missing rule"),
    ]
    exit_code, detail = module._run_file_anchor_guard("guard", rules)
    assert exit_code == 1
    assert "guard: blocked" in detail
    assert "missing.txt" in detail

    ok_rules = [module.FileAnchorRule("good.txt", r"READY", "good rule")]
    exit_code, detail = module._run_file_anchor_guard("guard", ok_rules)
    assert exit_code == 0
    assert "guard: ok" in detail
    assert "[PASS] good.txt: good rule" in detail

    mismatch_rules = [module.FileAnchorRule("good.txt", r"BLOCKED", "required mismatch")]
    exit_code, detail = module._run_file_anchor_guard("guard", mismatch_rules)
    assert exit_code == 1
    assert "[FAIL] good.txt: required mismatch" in detail


def test_release_check_summary_parser_and_markdown_helpers_cover_edge_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_markdown_helpers_additional",
    )

    payload, error = module.parse_first_json_object("noise {invalid json")
    assert payload is None
    assert error == "json payload not found in output"

    class FakeDecoder:
        def raw_decode(self, _text: str) -> tuple[list[str], int]:
            return ["not", "object"], 0

    monkeypatch.setattr(module.json, "JSONDecoder", lambda: FakeDecoder())
    payload, error = module.parse_first_json_object("{\"decision\":\"GO\"}")
    assert payload is None
    assert error == "json payload is not an object"

    default_result = module.build_check_result("check", "P0", True, 0, "detail")
    override_result = module.build_check_result(
        "check",
        "P1",
        False,
        1,
        "detail",
        status_override="WARN",
    )
    assert default_result["status"] == "PASS"
    assert override_result["status"] == "WARN"

    docs_a = tmp_path / "docs-a"
    docs_b = tmp_path / "docs-b"
    docs_a.mkdir()
    docs_b.mkdir()
    (docs_a / "TEMPLATE-note.md").write_text("skip", encoding="utf-8")
    (docs_a / "alpha.md").write_text("alpha", encoding="utf-8")
    (docs_b / "beta.md").write_text("beta", encoding="utf-8")

    assert module._count_non_template_markdown(tmp_path / "missing") == 0
    assert module._count_non_template_markdown(docs_a) == 1
    assert module.normalize_release_evidence_status("") == "UNKNOWN"

    paths = module._iter_non_template_markdown_paths([tmp_path / "missing", docs_a, docs_b])
    assert [path.name for path in paths] == ["alpha.md", "beta.md"]
    corpus = module._read_markdown_corpus([tmp_path / "missing", docs_a, docs_b])
    assert "alpha" in corpus
    assert "beta" in corpus


def test_release_check_summary_signal_helpers_cover_warn_and_strict_paths() -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_signal_helpers_additional",
    )

    status, exit_code, detail = module.evidence_coverage_signal(1, 2)
    assert status == "PASS"
    assert exit_code == 0
    assert "quality_non_template=1" in detail
    assert "weekly_non_template=2" in detail

    status, exit_code, detail = module.evidence_coverage_signal(0, 1)
    assert status == "WARN"
    assert exit_code == 0
    assert "quality_non_template=0" in detail
    assert "weekly_non_template=1" in detail

    status, exit_code, detail, strict_mode = module.codecov_signal(True, False)
    assert (status, exit_code, strict_mode) == ("PASS", 0, False)
    assert "result=coverage_available" in detail

    status, exit_code, detail, strict_mode = module.codecov_signal(False, True)
    assert (status, exit_code, strict_mode) == ("FAIL", 1, True)
    assert "strict_mode=true" in detail
    assert "result=coverage_missing_in_strict_mode" in detail

    status, exit_code, detail, strict_mode = module.codecov_signal(False, False)
    assert (status, exit_code, strict_mode) == ("WARN", 0, False)
    assert "result=coverage_missing_in_soft_mode" in detail


def test_unresolved_triage_blocker_signal_counts_invalid_and_checkpoint_noise_records(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_triage_invalid_and_noise",
    )

    sessions_root = tmp_path / ".writing" / "sessions"

    write_state_payload(
        sessions_root,
        "checkpoint-noise",
        {
            "status": "active",
            "metadata": {"triage_state": "open"},
            "plan_status": "running",
            "runner_state": "running",
            "steps": [
                {"name": "write tests", "status": "done"},
                {"name": "checkpoint", "status": "planned"},
            ],
        },
    )
    write_state_payload(
        sessions_root,
        "missing-triage",
        {
            "status": "active",
            "metadata": {},
        },
    )

    bad_json_path = sessions_root / "active" / "bad-json" / ".data" / "state.json"
    bad_json_path.parent.mkdir(parents=True, exist_ok=True)
    bad_json_path.write_text("{broken", encoding="utf-8")

    non_dict_path = sessions_root / "active" / "non-dict" / ".data" / "state.json"
    non_dict_path.parent.mkdir(parents=True, exist_ok=True)
    non_dict_path.write_text(json.dumps(["unexpected"]), encoding="utf-8")

    status, exit_code, detail = module.unresolved_triage_blocker_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert "state_files_scanned=4" in detail
    assert "linked_triage_records=0" in detail
    assert "unresolved_triage_records=0" in detail
    assert "invalid_state_files=3" in detail
    assert "ignored_legacy_records=1" in detail
    assert "decision=go" in detail


def test_chapter_gate_evidence_linkage_signal_aggregates_multiple_link_patterns(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_chapter_gate_aggregate",
    )

    sessions_root = tmp_path / ".writing" / "sessions"

    write_snapshot_payload(sessions_root, "invalid-json", "broken.json", {}, raw="{broken")
    write_snapshot_payload(sessions_root, "non-dict", "array.json", ["unexpected"])
    write_snapshot_payload(
        sessions_root,
        "missing-links",
        "missing-links.json",
        {
            "artifact_type": "release_gate_run",
            "trace": {"session_id": "s-1", "run_id": "r-1", "check_id": "chapter_gate_scoring_signal"},
            "evidence_links": [],
        },
    )
    write_snapshot_payload(
        sessions_root,
        "wrong-type",
        "wrong-type.json",
        {
            "artifact_type": "draft_snapshot",
            "trace": {"session_id": "s-2", "run_id": "r-2", "check_id": "chapter_gate_scoring_signal"},
            "evidence_links": ["trace.md"],
        },
    )
    write_snapshot_payload(
        sessions_root,
        "trace-match",
        "trace-match.json",
        {
            "artifact_type": "release_gate_run",
            "trace": {"session_id": "s-3", "run_id": "r-3", "check_id": "chapter_gate_scoring_signal"},
            "evidence_links": ["trace.md"],
        },
    )
    write_snapshot_payload(
        sessions_root,
        "output-match",
        "output-match.json",
        {
            "artifact_type": "release_gate_run",
            "trace": {"session_id": "s-4", "run_id": "r-4", "check_id": "other_signal"},
            "evidence_links": ["trace.md"],
            "output": {"check_id": "chapter_gate_scoring_signal"},
        },
    )
    write_snapshot_payload(
        sessions_root,
        "checks-match",
        "checks-match.json",
        {
            "artifact_type": "release_gate_run",
            "trace": {"session_id": "s-5", "run_id": "r-5", "check_id": "other_signal"},
            "evidence_links": ["trace.md"],
            "output": {
                "checks": [
                    {"check_id": "another_signal"},
                    {"check_id": "chapter_gate_scoring_signal"},
                ]
            },
        },
    )

    status, exit_code, detail = module.chapter_gate_evidence_linkage_signal(sessions_root)

    assert status == "PASS"
    assert exit_code == 0
    assert "snapshots_scanned=7" in detail
    assert "eligible_release_gate_runs=3" in detail
    assert "chapter_gate_checks_linked=3" in detail
    assert "invalid_snapshots=3" in detail
    assert "result=aggregated" in detail


def test_chapter_gate_evidence_linkage_signal_warns_when_no_chapter_gate_links_exist(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_chapter_gate_warn",
    )

    sessions_root = tmp_path / ".writing" / "sessions"
    write_snapshot_payload(
        sessions_root,
        "non-linking-run",
        "non-linking-run.json",
        {
            "artifact_type": "release_gate_run",
            "trace": {"session_id": "s-6", "run_id": "r-6", "check_id": "metrics_guard"},
            "evidence_links": ["trace.md"],
            "output": {"check_id": "metrics_guard"},
        },
    )

    status, exit_code, detail = module.chapter_gate_evidence_linkage_signal(sessions_root)

    assert status == "WARN"
    assert exit_code == 0
    assert "eligible_release_gate_runs=1" in detail
    assert "chapter_gate_checks_linked=0" in detail
    assert "result=insufficient_data" in detail


def test_release_check_summary_additional_file_and_wrapper_helpers(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_more_helpers",
    )

    class FakeMatch:
        def __init__(self, value: str) -> None:
            self.value = value

        def group(self, _index: int) -> str:
            return self.value

    original_search = module.re.search

    def fake_search(pattern: str, text: str, flags: int = 0):  # noqa: ANN001
        if pattern == r"(\d+)\s+passed":
            return None
        if pattern == r"tests?\s+(\d+)\s+passed":
            return FakeMatch("11")
        return original_search(pattern, text, flags)

    monkeypatch.setattr(module.re, "search", fake_search)
    assert module.parse_pytest_counts("vitest summary without generic matcher") == ("passed", "11")

    assert "- no checks" in module._build_check_detail_summary_section([])

    missing_path = tmp_path / "missing-version.json"
    assert module._read_json_version(missing_path) is None

    broken_path = tmp_path / "broken-version.json"
    broken_path.write_text("{broken", encoding="utf-8")
    assert module._read_json_version(broken_path) is None

    numeric_path = tmp_path / "numeric-version.json"
    numeric_path.write_text(json.dumps({"version": 9}), encoding="utf-8")
    assert module._read_json_version(numeric_path) is None

    parsed, parse_error = module._parse_iso_datetime("not-a-date")
    assert parsed is None
    assert parse_error is not None

    parsed, parse_error = module._parse_iso_datetime("2026-06-03T08:00:00")
    assert parse_error is None
    assert parsed is not None
    assert parsed.tzinfo == timezone.utc

    stale_current = module._evaluate_retained_evidence(
        "2026-06-01T00:00:00+00:00",
        "deadbeef",
        "deadbeef",
        freshness_window_hours=24,
        now=datetime(2026, 6, 3, 6, 0, tzinfo=timezone.utc),
    )
    assert stale_current["freshness_status"] == "stale"
    assert stale_current["supersession_status"] == "current"
    assert stale_current["evidence_state"] == "stale_current"

    authority_artifact_path = tmp_path / "authority-alignment.json"
    release_dir = tmp_path / "release"
    monkeypatch.setattr(module, "AUTHORITY_ALIGNMENT_ARTIFACT_PATH", authority_artifact_path)
    monkeypatch.setattr(module, "RELEASE_EVIDENCE_DIR", release_dir)
    module._write_authority_alignment_artifact(None, "bad-json", "raw authority output")
    authority_payload = json.loads(authority_artifact_path.read_text(encoding="utf-8"))
    assert authority_payload["status"] == "FAIL"
    assert authority_payload["parse_error"] == "bad-json"
    assert authority_payload["raw_output"] == "raw authority output"

    artifact_path = tmp_path / "artifact.json"
    payload, error = module._read_json_artifact(artifact_path)
    assert payload is None
    assert error is None

    artifact_path.write_text("{broken", encoding="utf-8")
    payload, error = module._read_json_artifact(artifact_path)
    assert payload is None
    assert error is not None

    artifact_path.write_text(json.dumps(["unexpected"]), encoding="utf-8")
    payload, error = module._read_json_artifact(artifact_path)
    assert payload is None
    assert error == "json payload is not an object"

    monkeypatch.setattr(module, "run_cmd", lambda _cmd, env=None: (1, "fatal"))  # noqa: ARG005
    assert module._current_head_sha() is None

    issue_history = tmp_path / "issue-history.jsonl"
    issue_history.write_text(
        "\n".join(
            [
                "",
                "{broken",
                json.dumps({"id": "ISS-1", "status": "open"}),
                json.dumps(["unexpected"]),
            ]
        ),
        encoding="utf-8",
    )
    entries = module._read_issue_history_entries(issue_history)
    assert entries == [{"id": "ISS-1", "status": "open"}]

    captured: list[tuple[list[str], dict[str, str] | None]] = []

    def fake_run_cmd(cmd: list[str], env: dict[str, str] | None = None) -> tuple[int, str]:
        captured.append((cmd, env))
        return 0, "ok"

    monkeypatch.setattr(module, "run_cmd", fake_run_cmd)
    junit_a = tmp_path / "governance.junit.xml"
    junit_b = tmp_path / "runtime.junit.xml"
    assert module._run_governance_scripts_regression(junit_a) == (0, "ok")
    assert module._run_release_runtime_guard(junit_b) == (0, "ok")
    assert captured[0][0][1:4] == ["scripts/run_targeted_pytest.py", "tests/unit/scripts/test_governance_scripts.py", "-q"]
    assert str(junit_a.resolve()) in captured[0][0][-1]
    assert captured[1][0][:5] == ["npm.cmd", "--prefix", "src-ts", "exec", "--"]
    assert captured[1][1] == {
        "NIKO_ENV": "production",
        "NIKO_CORS_PROD_ORIGINS": "https://app.example.com,https://gray.example.com",
        "NIKO_GATEWAY_METRICS_ENABLED": "true",
    }


def test_release_check_summary_warn_and_mismatch_signal_paths(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_warn_paths",
    )

    quality_doc = tmp_path / "QUALITY_CRITERIA.md"
    pdd_doc = tmp_path / "PDD.md"
    quality_doc.write_text("quality pass threshold: >= 95", encoding="utf-8")
    pdd_doc.write_text(
        "\n".join(
            [
                "80 <= total_score < 95",
                "60 <= total_score < 80",
                "total_score < 60",
            ]
        ),
        encoding="utf-8",
    )
    runtime_contract = {
        "quality_pass_score": 94.0,
        "human_review_score": 79.0,
        "revise_lower_bound": 50.0,
        "rewrite_below": 40.0,
        "default_pass_score": 93.0,
        "default_human_review_score": 70.0,
        "novel_quality_pass_threshold": 92.0,
        "publish_from_go": "allow",
        "publish_from_soft_go": "pass",
        "publish_from_no_go": "revise",
        "terminal_default_decision": "",
        "terminal_no_go_preserved": False,
        "quality_mode_consistent": False,
        "workflow_hard_gate_present": False,
        "public_entry_api_present": False,
    }
    status, exit_code, detail = module.runtime_policy_conformance_signal(
        quality_doc,
        pdd_doc,
        runtime_contract=runtime_contract,
    )
    assert status == "FAIL"
    assert exit_code == 1
    assert "mismatches=quality_pass_score,human_review_score,revise_lower_bound,rewrite_below,default_pass_score,default_human_review_score,novel_quality_pass_threshold,publish_from_go,publish_from_soft_go,publish_from_no_go,terminal_default_decision,terminal_no_go_preserved,quality_mode_consistent,blocked_semantics_declared,workflow_hard_gate_present,public_entry_api_present" in detail

    original_search = module.re.search
    assert module._extract_first_float(r"missing", "no match here") is None

    class BadFloatMatch:
        def group(self, _index: int) -> str:
            return "abc"

    monkeypatch.setattr(module.re, "search", lambda *_args, **_kwargs: BadFloatMatch())
    assert module._extract_first_float(r"value", "value = abc") is None
    monkeypatch.setattr(module.re, "search", original_search)

    monkeypatch.setattr(module.re, "search", lambda *_args, **_kwargs: BadFloatMatch())
    assert module._extract_metric_value("c_effective: abc", "c_effective") is None
    monkeypatch.setattr(module.re, "search", original_search)

    captured: list[tuple[str, list[object]]] = []

    def fake_anchor_guard(name: str, rules: list[object]) -> tuple[int, str]:
        captured.append((name, rules))
        return 9, f"{name}: delegated"

    monkeypatch.setattr(module, "_run_file_anchor_guard", fake_anchor_guard)
    assert module._typescript_production_guard() == (9, "production guard: delegated")
    assert module._typescript_metrics_guard() == (9, "metrics guard: delegated")
    assert captured[0][0] == "production guard"
    assert captured[1][0] == "metrics guard"
    assert len(captured[0][1]) == 5
    assert len(captured[1][1]) == 5

    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    write_markdown_payload(
        weekly_dir / "summary.md",
        "\n".join(
            [
                "migration plan only",
                "quality_level_used: high",
                "c_effective: 1.2",
                "s_final: 0.5",
                "rbac present",
            ]
        ),
    )

    assert module.slo_baseline_signal(weekly_dir, quality_dir)[0] == "WARN"
    assert "missing_keywords=ttft,e2e,effective_hit_rate,context_budget_utilization,gate consistency" in module.slo_baseline_signal(weekly_dir, quality_dir)[2]

    status, _, detail = module.evidence_links_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "evidence_links_key=missing" in detail
    assert "traceable_link=missing" in detail

    status, _, detail = module.self_learning_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "missing_fields=reflector,curator,playbook" in detail

    status, _, detail = module.memory_observability_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "missing_metrics=r_memory" in detail
    assert "invalid_metrics=c_effective" in detail

    status, _, detail = module.compliance_keywords_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "missing_keywords=audit,rollback" in detail

    status, _, detail = module.migration_rollback_evidence_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "migration=present" in detail
    assert "rollback=missing" in detail
    assert "traceable_link=missing" in detail

    status, _, detail = module.quality_level_trace_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "effective_quality_level=missing" in detail
    assert "quality_level_used=high" in detail

    status, _, detail = module.degrade_trace_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "degrade_reason=missing" in detail
    assert "degrade_steps=missing" in detail

    status, _, detail = module.critical_gate_enforcement_signal(weekly_dir, quality_dir)
    assert status == "WARN"
    assert "critical_gate=missing" in detail


def test_release_check_summary_artifact_and_observability_signal_branches(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_artifact_paths",
    )

    status, _, detail = module.evidence_freshness_signal(tmp_path / "missing-weekly", tmp_path / "missing-quality")
    assert status == "WARN"
    assert "fresh_files=0" in detail
    assert "stale_files=0" in detail

    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    stale_time = datetime(2026, 5, 1, tzinfo=timezone.utc).timestamp()
    write_markdown_payload(weekly_dir / "old.md", "old note", mtime=stale_time)
    status, _, detail = module.evidence_freshness_signal(
        weekly_dir,
        quality_dir,
        now=datetime(2026, 6, 3, tzinfo=timezone.utc),
    )
    assert status == "WARN"
    assert "fresh_files=0" in detail
    assert "stale_files=1" in detail

    status, exit_code, detail = module.tasks_completion_signal(2, None, "bad json")
    assert (status, exit_code) == ("FAIL", 2)
    assert "checker_exit=2" in detail
    assert "json_parse_error=bad json" in detail

    status, exit_code, detail = module.tasks_completion_signal(0, None, None)
    assert (status, exit_code) == ("WARN", 0)
    assert "checker_exit=0" in detail
    assert "json_parse_error=unknown" in detail

    status, exit_code, detail = module.authority_alignment_signal(0, None, None)
    assert (status, exit_code) == ("WARN", 0)
    assert "checker_exit=0" in detail
    assert "json_parse_error=unknown" in detail

    status, exit_code, detail = module.writing_helper_acceptance_signal(False, None, "deadbeef", None)
    assert (status, exit_code) == ("FAIL", 1)
    assert "missing_keys=artifact" in detail

    status, exit_code, detail = module.writing_helper_acceptance_signal(True, None, "deadbeef", None)
    assert (status, exit_code) == ("FAIL", 1)
    assert "missing_keys=payload" in detail

    status, exit_code, detail = module.writing_helper_acceptance_signal(
        True,
        {
            "status": "FAIL",
            "strict": False,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "head_sha": "deadbeef",
            "version": "9.0.8",
            "total_cases": 3,
            "passed_cases": 1,
            "failed_cases": 1,
            "failed_cases_path": None,
        },
        "deadbeef",
        None,
        "9.0.8",
        now=datetime.now(timezone.utc),
    )
    assert (status, exit_code) == ("FAIL", 1)
    assert "strict=False" in detail
    assert "status=FAIL" in detail
    assert "failed_cases=1" in detail
    assert "decision=no_go" in detail

    status, exit_code, detail = module.package_app_smoke_signal(False, None, current_version="9.0.8")
    assert (status, exit_code) == ("PASS", 0)
    assert "status=advisory_unavailable" in detail

    status, exit_code, detail = module.package_app_smoke_signal(
        True,
        {"status": "PASS"},
        current_version="9.0.8",
        artifact_parse_error="broken json",
    )
    assert (status, exit_code) == ("PASS", 0)
    assert "status=advisory_parse_error" in detail

    status, exit_code, detail = module.package_app_smoke_signal(
        True,
        None,
        current_version="9.0.8",
    )
    assert (status, exit_code) == ("PASS", 0)
    assert "status=advisory_empty_payload" in detail

    status, exit_code, detail = module.package_app_smoke_signal(
        True,
        {
            "status": "FAIL",
            "package_version": "9.0.8",
            "install_verified": False,
            "launch_verified": False,
            "health_version_verified": False,
            "services_verified": False,
            "cors_verified": False,
            "failures": ["install", "launch"],
        },
        current_version="9.0.8",
    )
    assert (status, exit_code) == ("ADVISORY", 0)
    assert "decision=advisory_fail_observed" in detail
    assert "failure_count=2" in detail

    status, exit_code, detail = module.package_e2e_acceptance_signal(False, None, "deadbeef", None)
    assert (status, exit_code) == ("FAIL", 1)
    assert "status=missing" in detail

    status, exit_code, detail = module.package_e2e_acceptance_signal(
        True,
        None,
        "deadbeef",
        "broken json",
    )
    assert (status, exit_code) == ("FAIL", 1)
    assert "json_parse_error=broken json" in detail

    status, exit_code, detail = module.package_e2e_acceptance_signal(
        True,
        None,
        "deadbeef",
        None,
    )
    assert (status, exit_code) == ("FAIL", 1)
    assert "missing_keys=payload" in detail

    status, exit_code, detail = module.package_e2e_acceptance_signal(
        True,
        {
            "status": "FAIL",
            "generated_at": "",
            "head_sha": "",
            "version": "",
            "tester": "",
            "artifact_path": "",
            "artifact_sha256": "",
            "install_verified": False,
            "launch_verified": False,
            "core_flow_verified": False,
            "shutdown_verified": False,
        },
        "deadbeef",
        None,
        current_version="9.0.8",
        now=datetime.now(timezone.utc),
    )
    assert (status, exit_code) == ("FAIL", 1)
    assert "status=FAIL" in detail
    assert "generated_at=missing" in detail
    assert "head_sha=missing" in detail
    assert "tester=missing" in detail
    assert "artifact_path=missing" in detail
    assert "artifact_sha256=missing" in detail
    assert "decision=no_go" in detail


def test_release_check_summary_release_evidence_and_linkage_helpers(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/release_check_summary.py",
        "test_release_check_summary_linkage_helpers",
    )

    release_evidence = {
        "status": "non_green",
        "evidence_sources": [
            "noise",
            {
                "source_id": "release_summary_report",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
            {
                "source_id": "authority_alignment",
                "status": "PASS",
                "is_fresh": True,
                "is_current": False,
                "freshness_status": "fresh",
                "supersession_status": "superseded",
            },
            {
                "source_id": "writing_helper_acceptance",
                "status": "PASS",
                "is_fresh": True,
                "is_current": True,
                "freshness_status": "fresh",
                "supersession_status": "current",
            },
        ],
    }
    status, exit_code, detail = module.local_selftest_enforcement_signal(release_evidence)
    assert (status, exit_code) == ("FAIL", 1)
    assert "authority_alignment:supersession=superseded" in detail
    assert "governance_scripts_regression:missing" in detail

    status, exit_code, detail = module.evidence_completeness_blocker_signal(0, 1, False)
    assert (status, exit_code) == ("FAIL", 1)
    assert "missing_evidence_classes=quality_evidence,weekly_review_evidence,release_machine_payload" in detail

    sessions_root = tmp_path / ".writing" / "sessions"
    write_snapshot_payload(sessions_root, "feedback-bad-json", "broken-feedback.json", {}, raw="{broken")
    write_snapshot_payload(sessions_root, "feedback-non-dict", "array-feedback.json", ["unexpected"])
    write_snapshot_payload(
        sessions_root,
        "feedback-invalid",
        "invalid-feedback.json",
        {
            "artifact_type": "quality_feedback",
            "trace": {"session_id": "", "run_id": "run", "revision_id": "rev"},
            "evidence_links": [],
            "output": {"feedback_artifacts": []},
        },
    )
    write_snapshot_payload(
        sessions_root,
        "feedback-valid",
        "valid-feedback.json",
        {
            "artifact_type": "quality_feedback",
            "trace": {"session_id": "s-1", "run_id": "run", "revision_id": "rev"},
            "evidence_links": ["trace.md"],
            "output": {"feedback_artifacts": [{"path": "feedback.md"}]},
        },
    )
    status, exit_code, detail = module.feedback_artifact_linkage_signal(sessions_root)
    assert (status, exit_code) == ("PASS", 0)
    assert "snapshots_scanned=4" in detail
    assert "linked_feedback_artifacts=1" in detail
    assert "invalid_snapshots=3" in detail

    write_snapshot_payload(sessions_root, "conflict-bad-json", "broken-conflict.json", {}, raw="{broken")
    write_snapshot_payload(sessions_root, "conflict-non-dict", "array-conflict.json", ["unexpected"])
    write_snapshot_payload(
        sessions_root,
        "conflict-output-missing",
        "output-missing.json",
        {"output": []},
    )
    write_snapshot_payload(
        sessions_root,
        "conflict-no-conflicts",
        "no-conflicts.json",
        {"output": {"canonical_conflicts": []}},
    )
    write_snapshot_payload(
        sessions_root,
        "conflict-invalid-linkage",
        "invalid-linkage.json",
        {
            "trace": {"session_id": "", "run_id": "run", "revision_id": "rev"},
            "evidence_links": [],
            "output": {"canonical_conflicts": [{"severity": "major"}]},
        },
    )
    write_snapshot_payload(
        sessions_root,
        "conflict-valid-noncritical",
        "valid-noncritical.json",
        {
            "trace": {"session_id": "s-1", "run_id": "run", "revision_id": "rev"},
            "evidence_links": ["trace.md"],
            "output": {"canonical_conflicts": [{"severity": "major"}]},
        },
    )
    write_snapshot_payload(
        sessions_root,
        "conflict-valid-critical",
        "valid-critical.json",
        {
            "trace": {"session_id": "s-2", "run_id": "run", "revision_id": "rev"},
            "evidence_links": ["trace.md"],
            "output": {"canonical_conflicts": [{"severity": "critical"}]},
        },
    )

    snapshots_scanned, linked_count, critical_count, invalid_count = module._scan_conflict_artifact_linkage(
        sessions_root
    )
    assert (snapshots_scanned, linked_count, critical_count, invalid_count) == (11, 2, 1, 5)

    status, exit_code, detail = module.conflict_artifact_linkage_signal(sessions_root)
    assert (status, exit_code) == ("PASS", 0)
    assert "linked_conflict_artifacts=2" in detail
    assert "critical_conflicts_linked=1" in detail
    assert "invalid_snapshots=5" in detail

    status, exit_code, detail = module.critical_conflict_blocker_signal(sessions_root)
    assert (status, exit_code) == ("FAIL", 1)
    assert "critical_conflicts_linked=1" in detail
    assert "decision=no_go" in detail


def test_release_check_summary_main_guard_executes_as_entrypoint() -> None:
    script_path = PROJECT_ROOT / "scripts" / "release_check_summary.py"
    source_lines = script_path.read_text(encoding="utf-8").splitlines()
    source_lines[3817] = "main = lambda: 0"
    source = "\n".join(source_lines) + "\n"

    with pytest.raises(SystemExit) as excinfo:
        exec(compile(source, str(script_path), "exec"), {"__name__": "__main__", "__file__": str(script_path)})

    assert excinfo.value.code == 0

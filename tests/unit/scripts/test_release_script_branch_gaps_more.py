from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load(relative_path: str, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / relative_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def _write_state_payload(sessions_root: Path, session_name: str, payload: object) -> Path:
    state_path = sessions_root / "active" / session_name / ".data" / "state.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return state_path


def _write_markdown_payload(path: Path, content: str, *, mtime: float | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    if mtime is not None:
        os.utime(path, (mtime, mtime))
    return path


def test_packaged_app_smoke_skips_uninstall_hits_and_marks_unknown_service_entries_unhealthy(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _load(
        "scripts/packaged_app_smoke.py",
        "_test_packaged_app_smoke_branch_gaps_more",
    )

    install_dir = tmp_path / "install"
    install_dir.mkdir()
    (install_dir / "Niko-Studio-Uninstall.exe").write_text("binary", encoding="utf-8")
    assert module.find_installed_executable(install_dir) is None

    report = module.SmokeReport()
    payload = {
        "version": "9.9.9",
        "services": {
            "memory": 1,
            "graph": "healthy",
            "search": {"status": "ready"},
            "workflow": {"state": "ok"},
            "critic": True,
            "agent": "ok",
            "skills": {"status": "healthy"},
        },
    }
    monkeypatch.setattr(module, "http_get_json", lambda *args, **kwargs: (200, payload, {}))

    module.assert_health_contract(5882, "9.9.9", report)

    assert any("unhealthy services in /health: memory" in failure for failure in report.failures)


def test_packaged_app_smoke_main_system_exit_and_unexpected_error_without_report(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load(
        "scripts/packaged_app_smoke.py",
        "_test_packaged_app_smoke_branch_error_paths",
    )

    monkeypatch.setattr(module, "read_package_version", lambda: "9.9.9")
    monkeypatch.setattr(module, "terminate", lambda process: None)
    monkeypatch.setattr(module.sys, "argv", ["packaged_app_smoke.py", "--skip-launch"])
    monkeypatch.setattr(
        module,
        "wait_for_port_listening",
        lambda *args, **kwargs: (_ for _ in ()).throw(SystemExit(2)),
    )

    with pytest.raises(SystemExit, match="2"):
        module.main()

    stderr = io.StringIO()
    monkeypatch.setattr(
        module,
        "wait_for_port_listening",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    with redirect_stderr(stderr):
        assert module.main() == module.EXIT_SETUP_ERROR

    assert "[smoke] RuntimeError: boom" in stderr.getvalue()


def test_refresh_release_evidence_accepts_newer_mtimes_and_skips_success_banner(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _load(
        "scripts/refresh_release_evidence.py",
        "_test_refresh_release_evidence_branch_gaps_more",
    )

    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"
    report_path.write_text("# summary\n", encoding="utf-8")
    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")

    mtimes = iter([20, 30])
    monkeypatch.setattr(module, "_mtime_ns", lambda _path: next(mtimes))

    assert (
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, 10, 10) == "GO"
    )

    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0),
    )
    stdout = io.StringIO()
    with redirect_stdout(stdout):
        assert module.run_step("quiet step", ["python", "tool.py"], announce_success=False) == 0
    assert "[PASS] quiet step" not in stdout.getvalue()


def test_refresh_release_evidence_timeout_without_last_error_and_windows_taskkill_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load(
        "scripts/refresh_release_evidence.py",
        "_test_refresh_release_evidence_branch_timeout",
    )

    class FakeResponse:
        status = 500

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
            return False

    monotonic_values = iter([0.0, 0.1, 0.2, 1.1])
    monkeypatch.setattr(module.urllib.request, "urlopen", lambda *args, **kwargs: FakeResponse())
    monkeypatch.setattr(module.time, "monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr(module.time, "sleep", lambda _seconds: None)

    with pytest.raises(RuntimeError, match="Gateway did not become healthy") as exc_info:
        module._wait_for_gateway_health("127.0.0.1", 18080, 1)
    assert "Last error" not in str(exc_info.value)

    class FakeProcess:
        pid = 42

        def __init__(self) -> None:
            self.calls: list[str] = []

        def poll(self) -> None:
            return None

        def terminate(self) -> None:
            self.calls.append("terminate")

        def wait(self, timeout: int) -> None:
            self.calls.append(f"wait:{timeout}")

    process = FakeProcess()
    monkeypatch.setattr(module.sys, "platform", "win32")
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=1),
    )

    module._stop_gateway(process)

    assert process.calls == ["terminate", "wait:10"]


def test_refresh_release_evidence_main_go_path_omits_no_go_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _load(
        "scripts/refresh_release_evidence.py",
        "_test_refresh_release_evidence_main_go",
    )

    class FakeProcess:
        pid = 5151

    monkeypatch.setattr(module, "_resolve_powershell", lambda: "pwsh")
    monkeypatch.setattr(module, "_mtime_ns", lambda _path: 101)
    monkeypatch.setattr(module, "_wait_for_gateway_health", lambda *args, **kwargs: None)
    monkeypatch.setattr(module, "_stop_gateway", lambda process: None)
    monkeypatch.setattr(
        module,
        "run_step",
        lambda *args, **kwargs: 0,
    )
    monkeypatch.setattr(
        module,
        "_validate_consolidated_summary_refresh",
        lambda *args, **kwargs: "GO",
    )
    monkeypatch.setattr(
        module.subprocess,
        "Popen",
        lambda *args, **kwargs: FakeProcess(),
    )

    stdout = io.StringIO()
    with redirect_stdout(stdout):
        assert module.main([]) == 0

    assert "Release evidence refresh: PASS" in stdout.getvalue()
    assert "Current release decision remains NO_GO" not in stdout.getvalue()


def test_release_check_summary_branch_helpers_cover_remaining_release_paths(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _load(
        "scripts/release_check_summary.py",
        "_test_release_check_summary_branch_gaps_more",
    )

    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="ok\n", stderr=""),
    )
    assert module.run_cmd(["python", "tool.py"]) == (0, "ok")

    sample_file = tmp_path / "sample.txt"
    sample_file.write_text("hello\n", encoding="utf-8")
    rules = [
        module.FileAnchorRule(str(sample_file), r"hello", "must contain hello"),
        module.FileAnchorRule(str(sample_file), r"forbidden", "must not contain forbidden", required=False),
    ]
    exit_code, detail = module._run_file_anchor_guard("guard", rules)
    assert exit_code == 0
    assert "guard" in detail

    scorecard = module._build_scorecard_section(
        [
            {
                "dimension_id": "testing",
                "label": "Testing",
                "status": "PASS",
                "blocking_failures": [],
                "non_pass_checks": [],
            }
        ]
    )
    assert "## 100% Scorecard Dimensions" in scorecard
    assert "- Contract:" not in scorecard

    quality_doc = tmp_path / "quality.md"
    pdd_doc = tmp_path / "pdd.md"
    quality_doc.write_text("quality pass threshold: >= 92\n", encoding="utf-8")
    pdd_doc.write_text("70 <= total_score < 85\nand total_score < 40\n", encoding="utf-8")
    policy = module._extract_policy_contract_from_docs(quality_doc, pdd_doc)
    assert policy["quality_pass_score"] == 92.0
    assert policy["human_review_score"] is None
    assert policy["revise_lower_bound"] is None
    assert policy["rewrite_below"] == 40.0

    weekly_dir = tmp_path / "weekly"
    quality_dir = tmp_path / "quality"
    fresh_time = datetime(2026, 6, 2, tzinfo=timezone.utc).timestamp()
    _write_markdown_payload(weekly_dir / "fresh.md", "fresh note", mtime=fresh_time)
    status, _, detail = module.evidence_freshness_signal(
        weekly_dir,
        quality_dir,
        now=datetime(2026, 6, 3, tzinfo=timezone.utc),
    )
    assert status == "PASS"
    assert "fresh_files=1" in detail
    assert "stale_files=0" in detail

    release_evidence = {
        "status": "fresh_current",
        "evidence_sources": [
            {"source_id": "   ", "status": "PASS", "is_fresh": True, "is_current": True},
            *[
                {
                    "source_id": source_id,
                    "status": "PASS",
                    "is_fresh": True,
                    "is_current": True,
                    "freshness_status": "fresh",
                    "supersession_status": "current",
                }
                for source_id in module.LOCAL_SELFTEST_REQUIRED_RELEASE_SOURCES
            ],
        ],
    }
    status, exit_code, detail = module.local_selftest_enforcement_signal(release_evidence)
    assert (status, exit_code) == ("PASS", 0)
    assert "blocking_sources=none" in detail

    sessions_root = tmp_path / ".writing" / "sessions"
    _write_state_payload(
        sessions_root,
        "open-running-session",
        {
            "status": "active",
            "plan_status": "running",
            "runner_state": "running",
            "metadata": {"triage_state": "open"},
            "steps": [
                {"name": "draft", "status": "done"},
                {"name": "review", "status": "planned"},
            ],
        },
    )
    status, exit_code, detail = module.unresolved_triage_blocker_signal(sessions_root)
    assert (status, exit_code) == ("FAIL", 1)
    assert "linked_triage_records=1" in detail
    assert "unresolved_triage_records=1" in detail

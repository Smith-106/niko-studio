from __future__ import annotations

import importlib.util
import io
import json
import sys
from contextlib import redirect_stdout
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


def test_resolve_powershell_prefers_the_first_available_binary(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_resolve_powershell",
    )
    calls: list[str] = []

    def fake_which(candidate: str) -> str | None:
        calls.append(candidate)
        if candidate == "pwsh":
            return r"C:\Program Files\PowerShell\7\pwsh.exe"
        return None

    monkeypatch.setattr(module.shutil, "which", fake_which)

    assert module._resolve_powershell() == "pwsh"
    assert calls == ["pwsh"]


def test_resolve_powershell_raises_when_no_binary_is_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_missing_powershell",
    )
    monkeypatch.setattr(module.shutil, "which", lambda _candidate: None)

    with pytest.raises(RuntimeError, match="PowerShell executable not found"):
        module._resolve_powershell()


def test_run_step_formats_commands_and_merges_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_run_step",
    )
    recorded: dict[str, object] = {}

    def fake_run(command, cwd, env, check):  # noqa: ANN001
        recorded["command"] = command
        recorded["cwd"] = cwd
        recorded["env"] = env
        recorded["check"] = check
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(module.subprocess, "run", fake_run)

    stdout = io.StringIO()
    with redirect_stdout(stdout):
        exit_code = module.run_step(
            "desktop local self-test",
            ["python", "tool.py", "--flag"],
            env={"NIKO_TEST_FLAG": "enabled"},
        )

    assert exit_code == 0
    assert recorded["command"] == ["python", "tool.py", "--flag"]
    assert recorded["cwd"] == PROJECT_ROOT
    assert recorded["check"] is False
    assert recorded["env"]["NIKO_TEST_FLAG"] == "enabled"
    assert "==> desktop local self-test" in stdout.getvalue()
    assert "$ python tool.py --flag" in stdout.getvalue()
    assert "[PASS] desktop local self-test" in stdout.getvalue()


def test_run_step_raises_when_exit_code_is_not_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_run_step_failure",
    )
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=3),
    )

    with pytest.raises(RuntimeError, match="desktop local self-test failed"):
        module.run_step("desktop local self-test", ["python", "tool.py"])


def test_mtime_ns_returns_none_when_stat_raises() -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_mtime_oserror",
    )

    class BrokenPath:
        def stat(self):  # noqa: ANN201
            raise OSError("denied")

    assert module._mtime_ns(BrokenPath()) is None


def test_wait_for_gateway_health_reports_success(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_wait_health_success",
    )

    class FakeResponse:
        status = 204

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
            return False

    calls: list[tuple[str, int]] = []

    def fake_urlopen(url: str, timeout: int = 5) -> FakeResponse:
        calls.append((url, timeout))
        return FakeResponse()

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)

    stdout = io.StringIO()
    with redirect_stdout(stdout):
        module._wait_for_gateway_health("127.0.0.1", 18080, 5)

    assert calls == [("http://127.0.0.1:18080/health", 5)]
    assert "Gateway health ready: http://127.0.0.1:18080/health" in stdout.getvalue()


def test_wait_for_gateway_health_surfaces_timeout_with_last_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_wait_health_timeout",
    )
    timeline = iter([0.0, 0.2, 0.6, 1.2])

    monkeypatch.setattr(
        module.urllib.request,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(module.urllib.error.URLError("connection refused")),
    )
    monkeypatch.setattr(module.time, "monotonic", lambda: next(timeline))
    monkeypatch.setattr(module.time, "sleep", lambda _seconds: None)

    with pytest.raises(RuntimeError, match="Gateway did not become healthy") as excinfo:
        module._wait_for_gateway_health("127.0.0.1", 18080, 1)

    assert "Last error" in str(excinfo.value)
    assert "connection refused" in str(excinfo.value)


def test_wait_for_gateway_health_surfaces_oserror(monkeypatch: pytest.MonkeyPatch) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_wait_health_oserror",
    )
    timeline = iter([0.0, 0.4, 1.2])

    monkeypatch.setattr(
        module.urllib.request,
        "urlopen",
        lambda *args, **kwargs: (_ for _ in ()).throw(OSError("socket closed")),
    )
    monkeypatch.setattr(module.time, "monotonic", lambda: next(timeline))
    monkeypatch.setattr(module.time, "sleep", lambda _seconds: None)

    with pytest.raises(RuntimeError, match="socket closed"):
        module._wait_for_gateway_health("127.0.0.1", 18080, 1)


def test_stop_gateway_uses_taskkill_on_windows_when_available(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_stop_gateway_windows",
    )

    class FakeProcess:
        pid = 4242

        def __init__(self) -> None:
            self.wait_calls: list[int] = []

        def poll(self) -> None:
            return None

        def wait(self, timeout: int) -> None:
            self.wait_calls.append(timeout)

    process = FakeProcess()
    recorded: dict[str, object] = {}

    monkeypatch.setattr(module.sys, "platform", "win32")

    def fake_run(command, cwd, check, capture_output, text, encoding, errors):  # noqa: ANN001
        recorded["command"] = command
        recorded["cwd"] = cwd
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(module.subprocess, "run", fake_run)

    module._stop_gateway(process)

    assert recorded["command"] == ["taskkill", "/PID", "4242", "/T", "/F"]
    assert recorded["cwd"] == PROJECT_ROOT
    assert process.wait_calls == [10]


def test_stop_gateway_returns_when_process_is_missing_or_already_exited(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_stop_gateway_early_return",
    )

    class ExitedProcess:
        def __init__(self) -> None:
            self.calls: list[str] = []

        def poll(self) -> int:
            self.calls.append("poll")
            return 0

        def terminate(self) -> None:
            self.calls.append("terminate")

    process = ExitedProcess()
    module._stop_gateway(None)
    module._stop_gateway(process)
    assert process.calls == ["poll"]


def test_stop_gateway_swallows_windows_wait_timeout_after_taskkill(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_stop_gateway_windows_timeout",
    )

    class FakeProcess:
        pid = 5252

        def __init__(self) -> None:
            self.wait_calls: list[int] = []

        def poll(self) -> None:
            return None

        def wait(self, timeout: int) -> None:
            self.wait_calls.append(timeout)
            raise module.subprocess.TimeoutExpired(cmd="taskkill", timeout=timeout)

    monkeypatch.setattr(module.sys, "platform", "win32")
    monkeypatch.setattr(
        module.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=0),
    )

    process = FakeProcess()
    module._stop_gateway(process)

    assert process.wait_calls == [10]


def test_stop_gateway_falls_back_to_terminate_and_kill_after_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_stop_gateway_fallback",
    )

    class FakeProcess:
        pid = 4343

        def __init__(self) -> None:
            self.calls: list[str] = []
            self.wait_attempts = 0

        def poll(self) -> None:
            return None

        def terminate(self) -> None:
            self.calls.append("terminate")

        def wait(self, timeout: int) -> None:
            self.calls.append(f"wait:{timeout}")
            self.wait_attempts += 1
            if self.wait_attempts == 1:
                raise module.subprocess.TimeoutExpired(cmd="launcher", timeout=timeout)

        def kill(self) -> None:
            self.calls.append("kill")

    process = FakeProcess()
    monkeypatch.setattr(module.sys, "platform", "linux")

    module._stop_gateway(process)

    assert process.calls == ["terminate", "wait:10", "kill", "wait:10"]


def test_validate_consolidated_summary_refresh_rejects_missing_and_invalid_artifacts(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_errors",
    )
    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"

    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="did not write"):
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)

    report_path.write_text("# summary\n", encoding="utf-8")
    artifact_path.unlink()
    with pytest.raises(RuntimeError, match="did not write"):
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)

    artifact_path.write_text("{invalid", encoding="utf-8")
    with pytest.raises(RuntimeError, match="unreadable artifact"):
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)


def test_validate_consolidated_summary_refresh_rejects_invalid_exit_code(tmp_path: Path) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_invalid_exit_code",
    )

    with pytest.raises(RuntimeError, match="failed \\(exit=2\\)"):
        module._validate_consolidated_summary_refresh(
            2,
            tmp_path / "release-check-summary.md",
            tmp_path / "release-readiness-artifact.json",
            None,
            None,
        )


def test_validate_consolidated_summary_refresh_rejects_decision_mismatches(tmp_path: Path) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_decision_mismatch",
    )
    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"
    report_path.write_text("# summary\n", encoding="utf-8")

    artifact_path.write_text(json.dumps({"decision": "MAYBE"}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="unknown decision"):
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)

    artifact_path.write_text(json.dumps({"decision": "NO_GO"}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="exited 0 but artifact decision is NO_GO"):
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)

    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")
    with pytest.raises(RuntimeError, match="exited 1 but artifact decision is GO"):
        module._validate_consolidated_summary_refresh(1, report_path, artifact_path, None, None)


def test_validate_consolidated_summary_refresh_rejects_stale_artifact_timestamp(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_stale_artifact_timestamp",
    )
    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"
    report_path.write_text("# summary\n", encoding="utf-8")
    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")
    previous_artifact_mtime_ns = artifact_path.stat().st_mtime_ns

    with pytest.raises(RuntimeError, match="did not refresh"):
        module._validate_consolidated_summary_refresh(
            0,
            report_path,
            artifact_path,
            None,
            previous_artifact_mtime_ns,
        )


def test_validate_consolidated_summary_refresh_rejects_stale_report_timestamp(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_stale_report_timestamp",
    )
    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"
    report_path.write_text("# summary\n", encoding="utf-8")
    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")
    previous_report_mtime_ns = report_path.stat().st_mtime_ns

    with pytest.raises(RuntimeError, match="did not refresh"):
        module._validate_consolidated_summary_refresh(
            0,
            report_path,
            artifact_path,
            previous_report_mtime_ns,
            None,
        )


def test_validate_consolidated_summary_refresh_returns_decision_on_success(
    tmp_path: Path,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_validate_success",
    )
    report_path = tmp_path / "release-check-summary.md"
    artifact_path = tmp_path / "release-readiness-artifact.json"
    report_path.write_text("# summary\n", encoding="utf-8")
    artifact_path.write_text(json.dumps({"decision": "GO"}), encoding="utf-8")

    assert (
        module._validate_consolidated_summary_refresh(0, report_path, artifact_path, None, None)
        == "GO"
    )


def test_main_refreshes_release_evidence_and_reports_no_go(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = load_script_module(
        "scripts/refresh_release_evidence.py",
        "test_refresh_release_evidence_main_no_go",
    )
    commands: list[dict[str, object]] = []
    stop_calls: list[int | None] = []
    wait_calls: list[tuple[str, int, int]] = []
    popen_calls: list[dict[str, object]] = []
    validate_calls: list[tuple[object, ...]] = []
    mtimes = iter([101, 202])

    class FakeProcess:
        pid = 5151

    monkeypatch.setattr(module, "_resolve_powershell", lambda: "pwsh")
    monkeypatch.setattr(module, "_mtime_ns", lambda _path: next(mtimes))
    monkeypatch.setattr(
        module,
        "_wait_for_gateway_health",
        lambda host, port, timeout: wait_calls.append((host, port, timeout)),
    )
    monkeypatch.setattr(
        module,
        "_stop_gateway",
        lambda process: stop_calls.append(None if process is None else process.pid),
    )

    def fake_run_step(label, command, env=None, *, allowed_exit_codes=(0,), announce_success=True):  # noqa: ANN001
        commands.append(
            {
                "label": label,
                "command": command,
                "env": env,
                "allowed_exit_codes": allowed_exit_codes,
                "announce_success": announce_success,
            }
        )
        return 1 if label == "consolidated release summary" else 0

    monkeypatch.setattr(module, "run_step", fake_run_step)

    def fake_validate(exit_code, report_path, artifact_path, previous_report, previous_artifact):  # noqa: ANN001
        validate_calls.append(
            (exit_code, report_path, artifact_path, previous_report, previous_artifact)
        )
        return "NO_GO"

    monkeypatch.setattr(module, "_validate_consolidated_summary_refresh", fake_validate)

    def fake_popen(command, cwd, env):  # noqa: ANN001
        popen_calls.append({"command": command, "cwd": cwd, "env": env})
        return FakeProcess()

    monkeypatch.setattr(module.subprocess, "Popen", fake_popen)

    stdout = io.StringIO()
    with redirect_stdout(stdout):
      exit_code = module.main(
          ["--host", "0.0.0.0", "--port", "19090", "--log-level", "info", "--health-timeout", "5"]
      )

    assert exit_code == 0
    assert wait_calls == [("0.0.0.0", 19090, 5)]
    assert stop_calls == [5151]
    assert popen_calls[0]["cwd"] == PROJECT_ROOT
    assert popen_calls[0]["env"]["NIKO_GATEWAY_RUNTIME"] == "node"
    assert commands[0]["label"] == "desktop local self-test"
    assert commands[1]["label"] == "writing-helper acceptance refresh"
    assert commands[1]["command"][0] == "pwsh"
    assert commands[2]["label"] == "consolidated release summary"
    assert commands[2]["allowed_exit_codes"] == (0, 1)
    assert commands[2]["announce_success"] is False
    assert validate_calls == [
        (
            1,
            module.REPORT_PATH,
            module.RELEASE_READINESS_ARTIFACT_PATH,
            101,
            202,
        )
    ]
    assert "Release evidence refresh: PASS" in stdout.getvalue()
    assert "Current release decision remains NO_GO" in stdout.getvalue()

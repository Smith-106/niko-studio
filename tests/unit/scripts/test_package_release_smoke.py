from __future__ import annotations

import hashlib
import importlib.util
import json
import runpy
import sys
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


@pytest.fixture
def package_e2e_checklist() -> ModuleType:
    return _load("scripts/package_e2e_checklist.py", "_test_package_e2e_checklist")


@pytest.fixture
def packaged_app_smoke() -> ModuleType:
    return _load("scripts/packaged_app_smoke.py", "_test_packaged_app_smoke")


class _Response:
    def __init__(self, status: int, body: str, headers: dict[str, str] | None = None) -> None:
        self.status = status
        self._body = body
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body.encode("utf-8")

    def __enter__(self) -> "_Response":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


class _FixedDatetime:
    @classmethod
    def now(cls, tz=None) -> datetime:
        return datetime(2026, 6, 3, 1, 2, 3, tzinfo=timezone.utc)


class TestPackageE2EChecklist:
    def test_current_head_sha_returns_trimmed_value(
        self, package_e2e_checklist, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            package_e2e_checklist.subprocess,
            "run",
            lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout="abc123\n"),
        )

        assert package_e2e_checklist._current_head_sha() == "abc123"

    def test_current_head_sha_returns_none_on_git_failure(
        self, package_e2e_checklist, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            package_e2e_checklist.subprocess,
            "run",
            lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout=""),
        )

        assert package_e2e_checklist._current_head_sha() is None

    def test_current_version_reads_desktop_package_json(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop"
        desktop_dir.mkdir()
        (desktop_dir / "package.json").write_text(
            json.dumps({"version": " 9.9.9 "}),
            encoding="utf-8",
        )
        monkeypatch.setattr(package_e2e_checklist, "PROJECT_ROOT", tmp_path)

        assert package_e2e_checklist._current_version() == "9.9.9"

    def test_sha256_hashes_file_contents(self, package_e2e_checklist, tmp_path) -> None:
        artifact = tmp_path / "artifact.bin"
        artifact.write_bytes(b"hello smoke")

        assert package_e2e_checklist._sha256(artifact) == hashlib.sha256(
            b"hello smoke"
        ).hexdigest()

    def test_current_version_returns_none_for_non_string_version(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop"
        desktop_dir.mkdir()
        (desktop_dir / "package.json").write_text(json.dumps({"version": 123}), encoding="utf-8")
        monkeypatch.setattr(package_e2e_checklist, "PROJECT_ROOT", tmp_path)

        assert package_e2e_checklist._current_version() is None

    def test_main_without_arguments_prints_guidance(
        self, package_e2e_checklist, capsys
    ) -> None:
        assert package_e2e_checklist.main([]) == 0
        output = capsys.readouterr().out
        assert "Installed-package E2E verification checklist:" in output
        assert "package-e2e-acceptance.json" in output

    def test_main_writes_pass_acceptance_payload(
        self, package_e2e_checklist, tmp_path, monkeypatch, capsys
    ) -> None:
        artifact = tmp_path / "Niko-Studio_9.9.9_x64-setup.exe"
        artifact.write_bytes(b"installer-bytes")
        evidence_dir = tmp_path / "evidence"
        output_path = evidence_dir / "package-e2e-acceptance.json"
        checklist_path = tmp_path / "docs" / "E2E_VERIFICATION.md"
        checklist_path.parent.mkdir(parents=True)
        checklist_path.write_text("checklist", encoding="utf-8")

        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.9.9")
        monkeypatch.setattr(package_e2e_checklist, "RELEASE_EVIDENCE_DIR", evidence_dir)
        monkeypatch.setattr(
            package_e2e_checklist,
            "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH",
            output_path,
        )
        monkeypatch.setattr(package_e2e_checklist, "CHECKLIST_PATH", checklist_path)
        monkeypatch.setattr(package_e2e_checklist, "datetime", _FixedDatetime)

        rc = package_e2e_checklist.main(
            [
                "--artifact-path",
                str(artifact),
                "--tester",
                "qa-user",
                "--result",
                "pass",
                "--install-verified",
                "--launch-verified",
                "--core-flow-verified",
                "--shutdown-verified",
            ]
        )

        assert rc == 0
        payload = json.loads(output_path.read_text(encoding="utf-8"))
        assert payload["status"] == "PASS"
        assert payload["head_sha"] == "deadbeef"
        assert payload["version"] == "9.9.9"
        assert payload["tester"] == "qa-user"
        assert payload["artifact_path"] == artifact.resolve().as_posix()
        assert payload["artifact_sha256"] == hashlib.sha256(b"installer-bytes").hexdigest()
        assert payload["install_verified"] is True
        assert payload["launch_verified"] is True
        assert payload["core_flow_verified"] is True
        assert payload["shutdown_verified"] is True
        assert payload["generated_at"] == "2026-06-03T01:02:03+00:00"
        assert payload["trace"]["artifact_path"] == output_path.as_posix()
        output = capsys.readouterr().out
        assert "Recorded package-level E2E acceptance evidence:" in output

    def test_main_requires_notes_for_fail_results(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        artifact = tmp_path / "artifact.exe"
        artifact.write_bytes(b"x")
        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.9.9")

        with pytest.raises(SystemExit):
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa-user",
                    "--result",
                    "fail",
                ]
            )

    def test_main_requires_all_pass_flags(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        artifact = tmp_path / "artifact.exe"
        artifact.write_bytes(b"x")
        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.9.9")

        with pytest.raises(SystemExit):
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa-user",
                    "--result",
                    "pass",
                    "--install-verified",
                ]
            )

    @pytest.mark.parametrize(
        ("argv", "pattern"),
        [
            (["--tester", "qa-user"], "`--artifact-path` is required"),
            (["--artifact-path", "artifact.exe", "--result", "fail", "--notes", "x"], "`--tester` is required"),
            (["--artifact-path", "artifact.exe", "--tester", "qa-user"], "`--result` is required"),
        ],
    )
    def test_main_validates_required_recording_arguments(
        self,
        package_e2e_checklist,
        tmp_path,
        argv: list[str],
        pattern: str,
        capsys,
    ) -> None:
        artifact = tmp_path / "artifact.exe"
        artifact.write_bytes(b"x")
        normalized_argv = [str(artifact) if part == "artifact.exe" else part for part in argv]

        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(normalized_argv)
        assert excinfo.value.code == 2
        assert pattern in capsys.readouterr().err

    def test_main_rejects_missing_artifact_head_and_version(
        self, package_e2e_checklist, tmp_path, monkeypatch, capsys
    ) -> None:
        missing = tmp_path / "missing.exe"
        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(missing),
                    "--tester",
                    "qa-user",
                    "--result",
                    "fail",
                    "--notes",
                    "missing",
                ]
            )
        assert excinfo.value.code == 2
        assert "Package artifact does not exist" in capsys.readouterr().err

        artifact = tmp_path / "artifact.exe"
        artifact.write_bytes(b"x")
        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: None)
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.9.9")
        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa-user",
                    "--result",
                    "fail",
                    "--notes",
                    "blocked",
                ]
            )
        assert excinfo.value.code == 2
        assert "Unable to determine current git HEAD" in capsys.readouterr().err

        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: None)
        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa-user",
                    "--result",
                    "fail",
                    "--notes",
                    "blocked",
                ]
            )
        assert excinfo.value.code == 2
        assert "Unable to determine desktop package version" in capsys.readouterr().err


class TestPackagedAppSmoke:
    def test_read_package_version_reads_trimmed_value(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        package_json = tmp_path / "package.json"
        package_json.write_text(json.dumps({"version": " 9.8.7 "}), encoding="utf-8")
        monkeypatch.setattr(packaged_app_smoke, "DESKTOP_PACKAGE_JSON", package_json)

        assert packaged_app_smoke.read_package_version() == "9.8.7"

    def test_read_package_version_requires_package_json(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        monkeypatch.setattr(packaged_app_smoke, "DESKTOP_PACKAGE_JSON", tmp_path / "missing.json")

        with pytest.raises(SystemExit, match="desktop/package.json not found"):
            packaged_app_smoke.read_package_version()

    def test_read_package_version_stringifies_truthy_non_string_versions(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        package_json = tmp_path / "package.json"
        package_json.write_text(json.dumps({"version": 12}), encoding="utf-8")
        monkeypatch.setattr(packaged_app_smoke, "DESKTOP_PACKAGE_JSON", package_json)

        assert packaged_app_smoke.read_package_version() == "12"

    def test_silent_install_marks_report_when_launcher_is_found(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        installer = tmp_path / "setup.exe"
        installer.write_bytes(b"installer")
        install_dir = tmp_path / "install"
        report = packaged_app_smoke.SmokeReport()
        captured: dict[str, object] = {}

        def fake_run(cmd, check, timeout):
            # Simulate NSIS creating the launcher binary.
            install_dir.mkdir(parents=True, exist_ok=True)
            (install_dir / "Niko-Studio.exe").write_text("binary", encoding="utf-8")
            captured["cmd"] = cmd
            captured["check"] = check
            captured["timeout"] = timeout
            return SimpleNamespace(returncode=0)

        # Skip _kill_sidecar_processes (non-Windows path).
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(packaged_app_smoke.subprocess, "run", fake_run)

        packaged_app_smoke.silent_install(installer, install_dir, report)

        assert captured["cmd"] == [str(installer), "/S", f"/D={install_dir}"]
        assert captured["check"] is True
        assert captured["timeout"] == 180
        assert report.install_verified is True
        assert report.install_dir == str(install_dir)
        assert any("Installed launcher" in note for note in report.notes)

    def test_silent_install_raises_setup_error_when_launcher_missing(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        installer = tmp_path / "setup.exe"
        installer.write_bytes(b"installer")
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(
            packaged_app_smoke.subprocess,
            "run",
            lambda *args, **kwargs: SimpleNamespace(returncode=0),
        )

        with pytest.raises(SystemExit) as exc_info:
            packaged_app_smoke.silent_install(installer, tmp_path / "install", report)

        assert exc_info.value.code == packaged_app_smoke.EXIT_SETUP_ERROR
        assert report.failures == [f"installed executable not found under {tmp_path / 'install'}"]

    def test_silent_install_rejects_missing_installer_and_failed_subprocess(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        missing = tmp_path / "missing.exe"
        with pytest.raises(SystemExit, match="installer not found"):
            packaged_app_smoke.silent_install(missing, tmp_path / "install", report)

        installer = tmp_path / "setup.exe"
        installer.write_bytes(b"installer")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(
            packaged_app_smoke.subprocess,
            "run",
            lambda *args, **kwargs: (_ for _ in ()).throw(
                packaged_app_smoke.subprocess.CalledProcessError(returncode=9, cmd="setup.exe")
            ),
        )
        with pytest.raises(packaged_app_smoke.subprocess.CalledProcessError):
            packaged_app_smoke.silent_install(installer, tmp_path / "install", report)

        assert any("NSIS silent install failed (exit=9)" in failure for failure in report.failures)

    def test_find_installed_executable_uses_glob_fallback(
        self, packaged_app_smoke, tmp_path
    ) -> None:
        install_dir = tmp_path / "app"
        nested_dir = install_dir / "nested"
        nested_dir.mkdir(parents=True)
        launcher = nested_dir / "niko-studio-desktop.exe"
        launcher.write_text("binary", encoding="utf-8")

        assert packaged_app_smoke.find_installed_executable(install_dir) == launcher

    def test_find_installed_executable_returns_direct_hit_and_none_when_absent(
        self, packaged_app_smoke, tmp_path
    ) -> None:
        install_dir = tmp_path / "install"
        install_dir.mkdir()
        direct = install_dir / "Niko-Studio.exe"
        direct.write_text("binary", encoding="utf-8")
        assert packaged_app_smoke.find_installed_executable(install_dir) == direct

        direct.unlink()
        assert packaged_app_smoke.find_installed_executable(install_dir) is None

    def test_launch_app_sets_gateway_environment(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        executable = tmp_path / "Niko-Studio.exe"
        executable.write_text("binary", encoding="utf-8")
        report = packaged_app_smoke.SmokeReport()
        captured: dict[str, object] = {}

        def fake_popen(command, cwd, stdout, stderr, creationflags, env):
            captured["command"] = command
            captured["cwd"] = cwd
            captured["stdout"] = stdout
            captured["stderr"] = stderr
            captured["creationflags"] = creationflags
            captured["env"] = env
            return SimpleNamespace(pid=4321)

        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(packaged_app_smoke.subprocess, "Popen", fake_popen)

        process = packaged_app_smoke.launch_app(executable, report, 6123)

        assert process is not None
        assert captured["command"] == [str(executable)]
        assert captured["cwd"] == str(executable.parent)
        assert captured["stdout"] is packaged_app_smoke.subprocess.DEVNULL
        assert captured["stderr"] is packaged_app_smoke.subprocess.DEVNULL
        assert captured["creationflags"] == 0
        assert captured["env"]["NIKO_GATEWAY_PORT"] == "6123"
        assert captured["env"]["NIKO_GATEWAY_HOST"] == "127.0.0.1"
        assert any("Spawned PID 4321" in note for note in report.notes)

    def test_wait_for_port_listening_returns_false_after_timeout(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        class FakeSocket:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def settimeout(self, _value) -> None:
                return None

            def connect(self, _address) -> None:
                raise ConnectionRefusedError("still closed")

        time_values = iter([0.0, 0.5, 1.1])
        monkeypatch.setattr(packaged_app_smoke.socket, "socket", lambda *_args: FakeSocket())
        monkeypatch.setattr(packaged_app_smoke.time, "time", lambda: next(time_values))
        monkeypatch.setattr(packaged_app_smoke.time, "sleep", lambda _seconds: None)

        assert packaged_app_smoke.wait_for_port_listening(5882, 1) is False

    def test_http_get_json_handles_success_and_http_errors(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            packaged_app_smoke.urllib.request,
            "urlopen",
            lambda request, timeout: _Response(
                200,
                '{"status":"ok"}',
                {"Content-Type": "application/json"},
            ),
        )

        status, payload, headers = packaged_app_smoke.http_get_json("http://example.test/health")
        assert status == 200
        assert payload == {"status": "ok"}
        assert headers["content-type"] == "application/json"

        def raise_http_error(request, timeout):
            raise packaged_app_smoke.urllib.error.HTTPError(
                request.full_url,
                404,
                "not found",
                hdrs=None,
                fp=None,
            )

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_http_error)
        status, payload, headers = packaged_app_smoke.http_get_json("http://example.test/health")
        assert status == 404
        assert payload is None
        assert headers == {}

    def test_http_get_json_returns_none_payload_on_invalid_json(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            packaged_app_smoke.urllib.request,
            "urlopen",
            lambda request, timeout: _Response(200, "{invalid", {"Content-Type": "application/json"}),
        )

        status, payload, headers = packaged_app_smoke.http_get_json("http://example.test/health")
        assert status == 200
        assert payload is None
        assert headers["content-type"] == "application/json"

    def test_http_options_cors_handles_success_and_url_error(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            packaged_app_smoke.urllib.request,
            "urlopen",
            lambda request, timeout: _Response(
                204,
                "",
                {"Access-Control-Allow-Origin": "tauri://localhost"},
            ),
        )

        status, headers = packaged_app_smoke.http_options_cors(
            "http://example.test/health",
            packaged_app_smoke.WEBVIEW_ORIGIN,
        )
        assert status == 204
        assert headers["access-control-allow-origin"] == packaged_app_smoke.WEBVIEW_ORIGIN

        def raise_url_error(request, timeout):
            raise packaged_app_smoke.urllib.error.URLError("offline")

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_url_error)
        status, headers = packaged_app_smoke.http_options_cors(
            "http://example.test/health",
            packaged_app_smoke.WEBVIEW_ORIGIN,
        )
        assert status == 0
        assert headers == {}

    def test_http_options_cors_handles_http_error_without_iterable_headers(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        def raise_http_error(request, timeout):
            raise packaged_app_smoke.urllib.error.HTTPError(
                request.full_url,
                403,
                "blocked",
                hdrs=None,
                fp=None,
            )

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_http_error)
        status, headers = packaged_app_smoke.http_options_cors(
            "http://example.test/health",
            packaged_app_smoke.WEBVIEW_ORIGIN,
        )
        assert status == 403
        assert headers == {}

    def test_assert_health_contract_marks_ready_services(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        payload = {
            "version": "9.9.9",
            "services": {
                "memory": True,
                "graph": "healthy",
                "search": {"status": "ready"},
                "workflow": {"state": "ok"},
                "critic": True,
                "agent": "ok",
                "skills": {"status": "healthy"},
            },
        }
        monkeypatch.setattr(packaged_app_smoke, "http_get_json", lambda *args, **kwargs: (200, payload, {}))

        packaged_app_smoke.assert_health_contract(5882, "9.9.9", report)

        assert report.launch_verified is True
        assert report.health_version_verified is True
        assert report.services_verified is True
        assert report.failures == []
        assert report.health_response == payload

    def test_assert_health_contract_records_version_and_service_failures(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        payload = {
            "version": "8.0.0",
            "services": {
                "memory": False,
                "graph": "offline",
                "workflow": {"status": "broken"},
            },
        }
        monkeypatch.setattr(packaged_app_smoke, "http_get_json", lambda *args, **kwargs: (200, payload, {}))

        packaged_app_smoke.assert_health_contract(5882, "9.9.9", report)

        assert any("/health.version='8.0.0'" in failure for failure in report.failures)
        assert any("missing services in /health" in failure for failure in report.failures)
        assert any("unhealthy services in /health" in failure for failure in report.failures)
        assert report.services_verified is False

    def test_assert_health_contract_handles_unavailable_payload_and_non_dict_services(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(packaged_app_smoke, "http_get_json", lambda *args, **kwargs: (503, None, {}))
        packaged_app_smoke.assert_health_contract(5882, "9.9.9", report)
        assert any("/health returned status=503" in failure for failure in report.failures)

        report = packaged_app_smoke.SmokeReport()
        payload = {"version": "9.9.9", "services": ["memory", "graph"]}
        monkeypatch.setattr(packaged_app_smoke, "http_get_json", lambda *args, **kwargs: (200, payload, {}))
        packaged_app_smoke.assert_health_contract(5882, "9.9.9", report)
        assert any("missing services in /health" in failure for failure in report.failures)

        report = packaged_app_smoke.SmokeReport()
        payload = {"version": "9.9.9", "services": "unexpected"}
        monkeypatch.setattr(packaged_app_smoke, "http_get_json", lambda *args, **kwargs: (200, payload, {}))
        packaged_app_smoke.assert_health_contract(5882, "9.9.9", report)
        assert any("unexpected shape" in note for note in report.notes)

    def test_assert_cors_contract_accepts_expected_origin(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_options_cors",
            lambda *args, **kwargs: (
                204,
                {"access-control-allow-origin": packaged_app_smoke.WEBVIEW_ORIGIN},
            ),
        )

        packaged_app_smoke.assert_cors_contract(5882, report)

        assert report.cors_verified is True
        assert report.failures == []

    def test_assert_cors_contract_rejects_disallowed_origin(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_options_cors",
            lambda *args, **kwargs: (200, {"access-control-allow-origin": "https://example.test"}),
        )

        packaged_app_smoke.assert_cors_contract(5882, report)

        assert report.cors_verified is False
        assert any("does not allow tauri://localhost" in failure for failure in report.failures)

    def test_assert_cors_contract_rejects_unexpected_status(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_options_cors",
            lambda *args, **kwargs: (403, {"access-control-allow-origin": "*"}),
        )

        packaged_app_smoke.assert_cors_contract(5882, report)

        assert any("CORS preflight returned status=403" in failure for failure in report.failures)

    def test_terminate_kills_process_after_timeout(self, packaged_app_smoke, monkeypatch) -> None:
        calls: list[str] = []

        class FakeProcess:
            pid = 0

            def terminate(self) -> None:
                calls.append("terminate")

            def wait(self, timeout: int) -> None:
                calls.append(f"wait:{timeout}")
                raise packaged_app_smoke.subprocess.TimeoutExpired("launcher", timeout)

            def kill(self) -> None:
                calls.append("kill")

        # On non-Windows, terminate() uses the terminate/wait/kill path.
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        packaged_app_smoke.terminate(FakeProcess())

        assert calls == ["terminate", "wait:5", "kill"]

    def test_terminate_uses_taskkill_on_windows(self, packaged_app_smoke, monkeypatch) -> None:
        calls: list[str] = []

        class FakeProcess:
            pid = 9999

            def wait(self, timeout: int) -> None:
                calls.append(f"wait:{timeout}")

        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(
            packaged_app_smoke.subprocess,
            "run",
            lambda *args, **kwargs: (calls.append(f"taskkill:{args}") or SimpleNamespace(returncode=0)),
        )

        packaged_app_smoke.terminate(FakeProcess())

        assert any("taskkill" in c for c in calls)
        assert any("wait" in c for c in calls)

    def test_terminate_swallows_unexpected_errors(self, packaged_app_smoke, monkeypatch) -> None:
        class BrokenProcess:
            pid = 0

            def terminate(self) -> None:
                raise RuntimeError("denied")

        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        packaged_app_smoke.terminate(BrokenProcess())

    def test_main_returns_setup_error_on_non_windows_without_skip_launch(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            ["packaged_app_smoke.py"],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

    def test_main_requires_installer_without_skip_launch(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            ["packaged_app_smoke.py", "--health-poll-seconds", "1"],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

    def test_main_skip_launch_writes_pass_report(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "smoke-report.json"

        def fake_health(port: int, expected_version: str, report) -> None:
            report.health_version_verified = True
            report.services_verified = True
            report.health_response = {"version": expected_version}

        def fake_cors(port: int, report) -> None:
            report.cors_verified = True
            report.cors_response = {"status": 204}

        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "wait_for_port_listening", lambda *args, **kwargs: True)
        monkeypatch.setattr(packaged_app_smoke, "assert_health_contract", fake_health)
        monkeypatch.setattr(packaged_app_smoke, "assert_cors_contract", fake_cors)
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda process: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            [
                "packaged_app_smoke.py",
                "--skip-launch",
                "--report",
                str(report_path),
                "--smoke-port",
                "6005",
            ],
        )

        rc = packaged_app_smoke.main()

        assert rc == packaged_app_smoke.EXIT_PASS
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "PASS"
        assert payload["package_version"] == "9.9.9"
        assert payload["runtime_port"] == 6005
        assert payload["health_version_verified"] is True
        assert payload["services_verified"] is True
        assert payload["cors_verified"] is True

    def test_main_skip_launch_returns_contract_fail_when_port_never_binds(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "smoke-report.json"
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "wait_for_port_listening", lambda *args, **kwargs: False)
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda process: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            [
                "packaged_app_smoke.py",
                "--skip-launch",
                "--report",
                str(report_path),
                "--health-poll-seconds",
                "1",
            ],
        )

        rc = packaged_app_smoke.main()

        assert rc == packaged_app_smoke.EXIT_CONTRACT_FAIL
        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "FAIL"
        assert any("sidecar did not bind 127.0.0.1:5882 within 1s" in failure for failure in payload["failures"])

    def test_main_returns_setup_error_when_launcher_or_process_is_missing(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        installer = tmp_path / "setup.exe"
        installer.write_bytes(b"installer")

        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(packaged_app_smoke, "silent_install", lambda *_args: None)
        monkeypatch.setattr(packaged_app_smoke, "find_installed_executable", lambda _install_dir: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            ["packaged_app_smoke.py", "--installer-path", str(installer)],
        )
        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

        monkeypatch.setattr(
            packaged_app_smoke, "find_installed_executable", lambda _install_dir: tmp_path / "Niko-Studio.exe"
        )
        monkeypatch.setattr(packaged_app_smoke, "launch_app", lambda *_args: None)
        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

    def test_main_reraises_system_exit_and_writes_setup_report(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "smoke-report.json"
        timestamps = iter(["2026-06-03T00:00:00+00:00", "2026-06-03T00:01:00+00:00"])
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.9.9")
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(
            packaged_app_smoke,
            "wait_for_port_listening",
            lambda *args, **kwargs: (_ for _ in ()).throw(SystemExit(2)),
        )
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda process: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            ["packaged_app_smoke.py", "--skip-launch", "--report", str(report_path)],
        )

        with pytest.raises(SystemExit, match="2"):
            packaged_app_smoke.main()

        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "SETUP_ERROR"
        assert payload["finished_at"] == "2026-06-03T00:01:00+00:00"

    def test_package_e2e_checklist_script_entrypoint_runs_under_main(self, monkeypatch) -> None:
        script_path = PROJECT_ROOT / "scripts" / "package_e2e_checklist.py"
        monkeypatch.setattr(sys, "argv", [str(script_path)])

        with pytest.raises(SystemExit) as excinfo:
            runpy.run_path(str(script_path), run_name="__main__")

        assert excinfo.value.code == 0

    def test_packaged_app_smoke_script_entrypoint_runs_under_main(self, monkeypatch) -> None:
        script_path = PROJECT_ROOT / "scripts" / "packaged_app_smoke.py"
        monkeypatch.setattr(sys, "argv", [str(script_path), "--skip-launch"])
        monkeypatch.setattr(sys, "platform", "linux")

        with pytest.raises(SystemExit) as excinfo:
            runpy.run_path(str(script_path), run_name="__main__")

        assert excinfo.value.code == 1

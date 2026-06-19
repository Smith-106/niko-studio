from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import urllib.error
from pathlib import Path
from types import ModuleType, SimpleNamespace
from urllib.error import HTTPError

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


class TestPackageE2EChecklistHelpers:
    def test_current_head_sha_returns_trimmed_head(
        self, package_e2e_checklist, monkeypatch
    ) -> None:
        def fake_run(*_args, **_kwargs):
            return SimpleNamespace(returncode=0, stdout="abc123\n")

        monkeypatch.setattr(package_e2e_checklist.subprocess, "run", fake_run)

        assert package_e2e_checklist._current_head_sha() == "abc123"

    def test_current_head_sha_returns_none_on_git_failure(
        self, package_e2e_checklist, monkeypatch
    ) -> None:
        monkeypatch.setattr(
            package_e2e_checklist.subprocess,
            "run",
            lambda *_args, **_kwargs: SimpleNamespace(returncode=1, stdout=""),
        )

        assert package_e2e_checklist._current_head_sha() is None

    def test_current_version_reads_package_json(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop"
        desktop_dir.mkdir()
        (desktop_dir / "package.json").write_text('{"version":" 9.2.1 "}', encoding="utf-8")
        monkeypatch.setattr(package_e2e_checklist, "PROJECT_ROOT", tmp_path)

        assert package_e2e_checklist._current_version() == "9.2.1"

    def test_current_version_returns_none_for_invalid_json(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop"
        desktop_dir.mkdir()
        (desktop_dir / "package.json").write_text("{invalid", encoding="utf-8")
        monkeypatch.setattr(package_e2e_checklist, "PROJECT_ROOT", tmp_path)

        assert package_e2e_checklist._current_version() is None

    def test_sha256_hashes_file_contents(self, package_e2e_checklist, tmp_path) -> None:
        artifact = tmp_path / "artifact.bin"
        artifact.write_bytes(b"sidecar-bundle")

        assert (
            package_e2e_checklist._sha256(artifact) == hashlib.sha256(b"sidecar-bundle").hexdigest()
        )


class TestPackageE2EChecklistMain:
    def test_main_without_arguments_prints_guidance(
        self, package_e2e_checklist, monkeypatch
    ) -> None:
        called: list[str] = []
        monkeypatch.setattr(package_e2e_checklist, "_print_guidance", lambda: called.append("yes"))

        assert package_e2e_checklist.main([]) == 0
        assert called == ["yes"]

    def test_main_rejects_pass_without_all_verification_flags(
        self, package_e2e_checklist, tmp_path, capsys
    ) -> None:
        artifact = tmp_path / "Niko-Studio.exe"
        artifact.write_bytes(b"binary")

        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa",
                    "--result",
                    "pass",
                ]
            )

        assert excinfo.value.code == 2
        assert "PASS results must include all verification flags" in capsys.readouterr().err

    def test_main_requires_notes_for_fail_result(
        self, package_e2e_checklist, tmp_path, capsys
    ) -> None:
        artifact = tmp_path / "Niko-Studio.exe"
        artifact.write_bytes(b"binary")

        with pytest.raises(SystemExit) as excinfo:
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa",
                    "--result",
                    "fail",
                ]
            )

        assert excinfo.value.code == 2
        assert "`--notes` is required when recording a FAIL result." in capsys.readouterr().err

    def test_main_records_pass_payload(self, package_e2e_checklist, tmp_path, monkeypatch) -> None:
        artifact = tmp_path / "retained-installer.exe"
        artifact.write_bytes(b"installer-bytes")

        evidence_dir = tmp_path / ".workflow" / "evidence" / "release"
        artifact_path = evidence_dir / "package-e2e-acceptance.json"
        monkeypatch.setattr(package_e2e_checklist, "RELEASE_EVIDENCE_DIR", evidence_dir)
        monkeypatch.setattr(
            package_e2e_checklist,
            "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH",
            artifact_path,
        )
        monkeypatch.setattr(
            package_e2e_checklist,
            "CHECKLIST_PATH",
            tmp_path / "docs" / "operations" / "E2E_VERIFICATION.md",
        )
        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.2.1")

        assert (
            package_e2e_checklist.main(
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
            == 0
        )

        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        assert payload["status"] == "PASS"
        assert payload["tester"] == "qa-user"
        assert payload["artifact_name"] == "retained-installer.exe"
        assert payload["artifact_kind"] == "exe"
        assert payload["artifact_size_bytes"] == len(b"installer-bytes")
        assert payload["artifact_sha256"] == hashlib.sha256(b"installer-bytes").hexdigest()
        assert payload["install_verified"] is True
        assert payload["launch_verified"] is True
        assert payload["core_flow_verified"] is True
        assert payload["shutdown_verified"] is True
        assert payload["trace"]["artifact_path"] == artifact_path.as_posix()

    def test_main_records_fail_payload_with_unknown_artifact_kind(
        self, package_e2e_checklist, tmp_path, monkeypatch
    ) -> None:
        artifact = tmp_path / "retained-artifact"
        artifact.write_bytes(b"evidence")

        evidence_dir = tmp_path / ".workflow" / "evidence" / "release"
        artifact_path = evidence_dir / "package-e2e-acceptance.json"
        monkeypatch.setattr(package_e2e_checklist, "RELEASE_EVIDENCE_DIR", evidence_dir)
        monkeypatch.setattr(
            package_e2e_checklist,
            "PACKAGE_E2E_ACCEPTANCE_ARTIFACT_PATH",
            artifact_path,
        )
        monkeypatch.setattr(package_e2e_checklist, "_current_head_sha", lambda: "deadbeef")
        monkeypatch.setattr(package_e2e_checklist, "_current_version", lambda: "9.2.1")

        assert (
            package_e2e_checklist.main(
                [
                    "--artifact-path",
                    str(artifact),
                    "--tester",
                    "qa-user",
                    "--result",
                    "fail",
                    "--notes",
                    "launch blocked by policy prompt",
                ]
            )
            == 0
        )

        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        assert payload["status"] == "FAIL"
        assert payload["artifact_kind"] == "unknown"
        assert payload["notes"] == "launch blocked by policy prompt"
        assert payload["install_verified"] is False


class TestPackagedAppSmokeHelpers:
    def test_read_package_version_returns_trimmed_value(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        package_json = tmp_path / "package.json"
        package_json.write_text('{"version":" 9.2.1 "}', encoding="utf-8")
        monkeypatch.setattr(packaged_app_smoke, "DESKTOP_PACKAGE_JSON", package_json)

        assert packaged_app_smoke.read_package_version() == "9.2.1"

    def test_read_package_version_requires_version_field(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        package_json = tmp_path / "package.json"
        package_json.write_text('{"name":"niko-studio"}', encoding="utf-8")
        monkeypatch.setattr(packaged_app_smoke, "DESKTOP_PACKAGE_JSON", package_json)

        with pytest.raises(SystemExit, match="missing 'version' field"):
            packaged_app_smoke.read_package_version()

    def test_silent_install_marks_install_verified(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        installer = tmp_path / "bundle.exe"
        installer.write_bytes(b"installer")
        install_dir = tmp_path / "install"
        installed_exe = install_dir / "Niko-Studio.exe"
        report = packaged_app_smoke.SmokeReport()

        def fake_run(cmd, check, timeout):
            assert cmd == [str(installer), "/S", f"/D={install_dir}"]
            assert check is True
            assert timeout == 180
            install_dir.mkdir(parents=True, exist_ok=True)
            installed_exe.write_bytes(b"installed")
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(packaged_app_smoke.subprocess, "run", fake_run)

        packaged_app_smoke.silent_install(installer, install_dir, report)

        assert report.install_verified is True
        assert report.install_dir == str(install_dir)
        assert any("Installed launcher:" in note for note in report.notes)

    def test_silent_install_times_out(self, packaged_app_smoke, tmp_path, monkeypatch) -> None:
        installer = tmp_path / "bundle.exe"
        installer.write_bytes(b"installer")
        report = packaged_app_smoke.SmokeReport()

        def fake_run(*_args, **_kwargs):
            raise packaged_app_smoke.subprocess.TimeoutExpired(cmd="bundle.exe", timeout=180)

        monkeypatch.setattr(packaged_app_smoke.subprocess, "run", fake_run)

        with pytest.raises(packaged_app_smoke.subprocess.TimeoutExpired):
            packaged_app_smoke.silent_install(installer, tmp_path / "install", report)

        assert report.failures == ["NSIS silent install timed out after 180s"]

    def test_find_installed_executable_ignores_uninstall_binary(
        self, packaged_app_smoke, tmp_path
    ) -> None:
        install_dir = tmp_path / "install"
        nested_dir = install_dir / "nested"
        nested_dir.mkdir(parents=True)
        (nested_dir / "studio-uninstall.exe").write_bytes(b"noop")
        expected = nested_dir / "niko-studio-desktop.exe"
        expected.write_bytes(b"app")

        assert packaged_app_smoke.find_installed_executable(install_dir) == expected

    def test_wait_for_port_listening_retries_until_success(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        attempts: list[tuple[str, int]] = []

        class FakeSocket:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def settimeout(self, _value) -> None:
                return None

            def connect(self, address: tuple[str, int]) -> None:
                attempts.append(address)
                if len(attempts) == 1:
                    raise ConnectionRefusedError("not ready")

        time_values = iter([100.0, 100.0, 101.0])
        monkeypatch.setattr(packaged_app_smoke.socket, "socket", lambda *_args: FakeSocket())
        monkeypatch.setattr(packaged_app_smoke.time, "time", lambda: next(time_values))
        monkeypatch.setattr(packaged_app_smoke.time, "sleep", lambda _seconds: None)

        assert packaged_app_smoke.wait_for_port_listening(5882, 5) is True
        assert attempts == [("127.0.0.1", 5882), ("127.0.0.1", 5882)]

    def test_launch_app_sets_gateway_env_and_creationflags(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        executable = tmp_path / "Niko-Studio.exe"
        executable.write_bytes(b"launcher")
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

        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(
            packaged_app_smoke.subprocess,
            "CREATE_NEW_PROCESS_GROUP",
            64,
            raising=False,
        )
        monkeypatch.setattr(packaged_app_smoke.subprocess, "Popen", fake_popen)

        process = packaged_app_smoke.launch_app(executable, report, 5882)

        assert process.pid == 4321
        assert captured["command"] == [str(executable)]
        assert captured["cwd"] == str(executable.parent)
        assert captured["creationflags"] == 64
        assert captured["env"]["NIKO_GATEWAY_PORT"] == "5882"
        assert captured["env"]["NIKO_GATEWAY_HOST"] == "127.0.0.1"
        assert any("Spawned PID 4321" in note for note in report.notes)

    def test_launch_app_records_spawn_failure(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        executable = tmp_path / "Niko-Studio.exe"
        executable.write_bytes(b"launcher")
        report = packaged_app_smoke.SmokeReport()

        def fake_popen(*_args, **_kwargs):
            raise OSError("spawn denied")

        monkeypatch.setattr(packaged_app_smoke.subprocess, "Popen", fake_popen)

        assert packaged_app_smoke.launch_app(executable, report, 5882) is None
        assert report.failures == ["failed to spawn launcher: spawn denied"]

    def test_http_get_json_returns_payload_and_headers(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        class FakeResponse:
            status = 200
            headers = {"Content-Type": "application/json", "X-Test": "yes"}

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self) -> bytes:
                return b'{"status":"ok"}'

        monkeypatch.setattr(
            packaged_app_smoke.urllib.request,
            "urlopen",
            lambda _req, timeout=5.0: FakeResponse(),
        )

        status, payload, headers = packaged_app_smoke.http_get_json("http://127.0.0.1/health")

        assert status == 200
        assert payload == {"status": "ok"}
        assert headers == {"content-type": "application/json", "x-test": "yes"}

    def test_http_get_json_handles_http_and_url_errors(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        def raise_http(_req, timeout=5.0):
            raise HTTPError("http://127.0.0.1/health", 503, "down", hdrs=None, fp=None)

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_http)
        assert packaged_app_smoke.http_get_json("http://127.0.0.1/health") == (503, None, {})

        def raise_url(_req, timeout=5.0):
            raise urllib.error.URLError("offline")

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_url)
        assert packaged_app_smoke.http_get_json("http://127.0.0.1/health") == (0, None, {})

    def test_http_options_cors_handles_success_and_http_error(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        class FakeResponse:
            status = 204
            headers = {"Access-Control-Allow-Origin": "tauri://localhost"}

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        monkeypatch.setattr(
            packaged_app_smoke.urllib.request,
            "urlopen",
            lambda _req, timeout=5.0: FakeResponse(),
        )
        assert packaged_app_smoke.http_options_cors(
            "http://127.0.0.1/health", "tauri://localhost"
        ) == (204, {"access-control-allow-origin": "tauri://localhost"})

        def raise_http(_req, timeout=5.0):
            raise HTTPError(
                "http://127.0.0.1/health",
                403,
                "forbidden",
                hdrs={"Access-Control-Allow-Origin": "https://blocked"},
                fp=None,
            )

        monkeypatch.setattr(packaged_app_smoke.urllib.request, "urlopen", raise_http)
        assert packaged_app_smoke.http_options_cors(
            "http://127.0.0.1/health", "tauri://localhost"
        ) == (403, {"access-control-allow-origin": "https://blocked"})

    def test_assert_health_contract_marks_success(self, packaged_app_smoke, monkeypatch) -> None:
        report = packaged_app_smoke.SmokeReport()
        payload = {
            "version": "9.2.1",
            "services": {
                "memory": True,
                "graph": "ok",
                "search": {"status": "healthy"},
                "workflow": "ready",
                "critic": {"state": "ready"},
                "agent": True,
                "skills": "healthy",
            },
        }
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_get_json",
            lambda _url, timeout=8.0: (200, payload, {}),
        )

        packaged_app_smoke.assert_health_contract(5882, "9.2.1", report)

        assert report.health_response == payload
        assert report.launch_verified is True
        assert report.health_version_verified is True
        assert report.services_verified is True
        assert report.failures == []

    def test_assert_health_contract_reports_version_and_service_failures(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        payload = {
            "version": "8.0.0",
            "services": {
                "memory": True,
                "graph": False,
            },
        }
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_get_json",
            lambda _url, timeout=8.0: (200, payload, {}),
        )

        packaged_app_smoke.assert_health_contract(5882, "9.2.1", report)

        assert any("/health.version='8.0.0'" in failure for failure in report.failures)
        assert any("missing services in /health:" in failure for failure in report.failures)
        assert any("unhealthy services in /health: graph" in failure for failure in report.failures)

    def test_assert_cors_contract_accepts_wildcard_origin(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_options_cors",
            lambda _url, _origin, timeout=5.0: (204, {"access-control-allow-origin": "*"}),
        )

        packaged_app_smoke.assert_cors_contract(5882, report)

        assert report.cors_verified is True
        assert report.cors_response == {
            "status": 204,
            "headers": {"access-control-allow-origin": "*"},
        }

    def test_assert_cors_contract_reports_disallowed_origin(
        self, packaged_app_smoke, monkeypatch
    ) -> None:
        report = packaged_app_smoke.SmokeReport()
        monkeypatch.setattr(
            packaged_app_smoke,
            "http_options_cors",
            lambda _url, _origin, timeout=5.0: (
                200,
                {"access-control-allow-origin": "https://blocked.example"},
            ),
        )

        packaged_app_smoke.assert_cors_contract(5882, report)

        assert any("does not allow tauri://localhost" in failure for failure in report.failures)

    def test_terminate_kills_process_after_timeout(self, packaged_app_smoke) -> None:
        calls: list[str] = []

        class FakeProcess:
            def terminate(self) -> None:
                calls.append("terminate")

            def wait(self, timeout: int) -> None:
                calls.append(f"wait:{timeout}")
                raise packaged_app_smoke.subprocess.TimeoutExpired(cmd="launcher", timeout=timeout)

            def kill(self) -> None:
                calls.append("kill")

        packaged_app_smoke.terminate(FakeProcess())

        assert calls == ["terminate", "wait:5", "kill"]


class TestPackagedAppSmokeMain:
    def test_main_returns_setup_error_on_non_windows_without_skip_launch(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "report.json"
        timestamps = iter(["2026-06-03T00:00:00+00:00"])
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.2.1")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: False)
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            ["packaged_app_smoke.py", "--report", str(report_path)],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

        assert report_path.exists() is False

    def test_main_requires_installer_when_launching(self, packaged_app_smoke, monkeypatch) -> None:
        timestamps = iter(["2026-06-03T00:00:00+00:00", "2026-06-03T00:01:00+00:00"])
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.2.1")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda _process: None)
        monkeypatch.setattr(packaged_app_smoke.sys, "argv", ["packaged_app_smoke.py"])

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

    def test_main_returns_contract_failure_when_sidecar_never_binds(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "report.json"
        timestamps = iter(["2026-06-03T00:00:00+00:00", "2026-06-03T00:01:00+00:00"])
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.2.1")
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(packaged_app_smoke, "wait_for_port_listening", lambda *_args: False)
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda _process: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            [
                "packaged_app_smoke.py",
                "--skip-launch",
                "--report",
                str(report_path),
            ],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_CONTRACT_FAIL

        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "FAIL"
        assert any("sidecar did not bind" in failure for failure in payload["failures"])

    def test_main_runs_launch_flow_and_reports_pass(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        installer = tmp_path / "Niko-Studio-setup.exe"
        installer.write_bytes(b"installer")
        report_path = tmp_path / "report.json"
        timestamps = iter(["2026-06-03T00:00:00+00:00", "2026-06-03T00:01:00+00:00"])
        fake_process = SimpleNamespace(pid=9988)
        terminated: list[object] = []

        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.2.1")
        monkeypatch.setattr(packaged_app_smoke, "is_windows", lambda: True)
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(packaged_app_smoke, "silent_install", lambda *_args: None)
        monkeypatch.setattr(
            packaged_app_smoke,
            "find_installed_executable",
            lambda _install_dir: tmp_path / "installed" / "Niko-Studio.exe",
        )
        monkeypatch.setattr(
            packaged_app_smoke,
            "launch_app",
            lambda _executable, _report, _port: fake_process,
        )
        monkeypatch.setattr(packaged_app_smoke, "wait_for_port_listening", lambda *_args: True)
        monkeypatch.setattr(
            packaged_app_smoke,
            "assert_health_contract",
            lambda _port, _version, report: setattr(report, "health_version_verified", True),
        )
        monkeypatch.setattr(
            packaged_app_smoke,
            "assert_cors_contract",
            lambda _port, report: setattr(report, "cors_verified", True),
        )
        monkeypatch.setattr(
            packaged_app_smoke, "terminate", lambda process: terminated.append(process)
        )
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            [
                "packaged_app_smoke.py",
                "--installer-path",
                str(installer),
                "--report",
                str(report_path),
            ],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_PASS
        assert terminated == [fake_process]

        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "PASS"
        assert payload["installer_path"] == str(installer)
        assert payload["launch_verified"] is True
        assert payload["health_version_verified"] is True
        assert payload["cors_verified"] is True

    def test_main_captures_unexpected_exception(
        self, packaged_app_smoke, tmp_path, monkeypatch
    ) -> None:
        report_path = tmp_path / "report.json"
        timestamps = iter(["2026-06-03T00:00:00+00:00", "2026-06-03T00:01:00+00:00"])
        monkeypatch.setattr(packaged_app_smoke, "read_package_version", lambda: "9.2.1")
        monkeypatch.setattr(packaged_app_smoke, "utc_now_iso", lambda: next(timestamps))
        monkeypatch.setattr(packaged_app_smoke, "wait_for_port_listening", lambda *_args: True)
        monkeypatch.setattr(
            packaged_app_smoke,
            "assert_health_contract",
            lambda *_args: (_ for _ in ()).throw(ValueError("boom")),
        )
        monkeypatch.setattr(packaged_app_smoke, "terminate", lambda _process: None)
        monkeypatch.setattr(
            packaged_app_smoke.sys,
            "argv",
            [
                "packaged_app_smoke.py",
                "--skip-launch",
                "--report",
                str(report_path),
            ],
        )

        assert packaged_app_smoke.main() == packaged_app_smoke.EXIT_SETUP_ERROR

        payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert payload["status"] == "SETUP_ERROR"
        assert any(
            "unexpected error: ValueError: boom" in failure for failure in payload["failures"]
        )

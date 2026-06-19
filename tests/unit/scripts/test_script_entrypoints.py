from __future__ import annotations

import importlib.util
import json
import sys
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
def run_targeted_pytest() -> ModuleType:
    return _load("scripts/run_targeted_pytest.py", "_test_run_targeted_pytest")


@pytest.fixture
def run_local_pre_commit() -> ModuleType:
    return _load("scripts/run_local_pre_commit.py", "_test_run_local_pre_commit")


@pytest.fixture
def generate_signed_tauri_config() -> ModuleType:
    return _load("scripts/generate_signed_tauri_config.py", "_test_generate_signed_tauri_config")


class TestRunTargetedPytest:
    @pytest.mark.parametrize(
        ("args", "expected"),
        [
            ([], False),
            (["-q"], False),
            (["-o", "addopts="], True),
            (["-o", "addopts=-q"], True),
            (["-o", "cache_dir=.pytest_cache"], False),
            (["--override-ini=addopts=-q"], True),
            (["--override-ini=cache_dir=.pytest_cache"], False),
        ],
    )
    def test_has_addopts_override(self, run_targeted_pytest, args, expected) -> None:
        assert run_targeted_pytest._has_addopts_override(args) is expected

    @pytest.mark.parametrize(
        ("args", "expected"),
        [
            ([], False),
            (["-q"], False),
            (["--no-cov"], True),
            (["--cov"], True),
            (["--cov=scripts"], True),
            (["--cov-report=term"], True),
        ],
    )
    def test_has_cov_directive(self, run_targeted_pytest, args, expected) -> None:
        assert run_targeted_pytest._has_cov_directive(args) is expected

    def test_main_adds_default_addopts_and_no_cov(
        self, run_targeted_pytest, tmp_path, monkeypatch
    ) -> None:
        captured: dict[str, object] = {}

        def fake_run(cmd, cwd):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            return SimpleNamespace(returncode=3)

        monkeypatch.setattr(run_targeted_pytest, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(run_targeted_pytest.subprocess, "run", fake_run)
        monkeypatch.setattr(
            run_targeted_pytest.sys,
            "argv",
            ["run_targeted_pytest.py", "tests/unit/scripts/test_ci_checks.py", "-q"],
        )

        assert run_targeted_pytest.main() == 3
        assert captured["cmd"] == [
            sys.executable,
            "-m",
            "pytest",
            "-o",
            "addopts=",
            "--no-cov",
            "tests/unit/scripts/test_ci_checks.py",
            "-q",
        ]
        assert captured["cwd"] == tmp_path

    def test_main_keeps_user_overrides(self, run_targeted_pytest, tmp_path, monkeypatch) -> None:
        captured: dict[str, object] = {}

        def fake_run(cmd, cwd):
            captured["cmd"] = cmd
            captured["cwd"] = cwd
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(run_targeted_pytest, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(run_targeted_pytest.subprocess, "run", fake_run)
        monkeypatch.setattr(
            run_targeted_pytest.sys,
            "argv",
            [
                "run_targeted_pytest.py",
                "-o",
                "addopts=-q",
                "--cov=scripts",
                "tests/unit/scripts/test_governance_scripts.py",
            ],
        )

        assert run_targeted_pytest.main() == 0
        assert captured["cmd"] == [
            sys.executable,
            "-m",
            "pytest",
            "-o",
            "addopts=-q",
            "--cov=scripts",
            "tests/unit/scripts/test_governance_scripts.py",
        ]
        assert captured["cwd"] == tmp_path


class TestRunLocalPreCommit:
    def test_npm_cmd_uses_platform_specific_binary(self, run_local_pre_commit, monkeypatch) -> None:
        monkeypatch.setattr(run_local_pre_commit.sys, "platform", "win32")
        assert run_local_pre_commit._npm_cmd() == "npm.cmd"

        monkeypatch.setattr(run_local_pre_commit.sys, "platform", "linux")
        assert run_local_pre_commit._npm_cmd() == "npm"

    def test_run_step_reports_pass(
        self, run_local_pre_commit, tmp_path, monkeypatch, capsys
    ) -> None:
        def fake_run(command, cwd, check):
            assert command == ["python", "-m", "ruff", "check"]
            assert cwd == tmp_path
            assert check is False
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(run_local_pre_commit, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(run_local_pre_commit.subprocess, "run", fake_run)

        assert run_local_pre_commit.run_step("lint", ["python", "-m", "ruff", "check"]) == 0
        out = capsys.readouterr().out
        assert "==> lint" in out
        assert "$ python -m ruff check" in out
        assert "[PASS] lint" in out

    def test_run_step_reports_failure(
        self, run_local_pre_commit, tmp_path, monkeypatch, capsys
    ) -> None:
        monkeypatch.setattr(run_local_pre_commit, "PROJECT_ROOT", tmp_path)
        monkeypatch.setattr(
            run_local_pre_commit.subprocess,
            "run",
            lambda *_args, **_kwargs: SimpleNamespace(returncode=7),
        )

        assert run_local_pre_commit.run_step("lint", ["python", "-m", "ruff", "check"]) == 7
        out = capsys.readouterr().out
        assert "[FAIL] lint (exit=7)" in out

    def test_main_runs_all_steps_in_order(self, run_local_pre_commit, monkeypatch, capsys) -> None:
        calls: list[tuple[str, list[str]]] = []

        def fake_run_step(label: str, command: list[str]) -> int:
            calls.append((label, command))
            return 0

        monkeypatch.setattr(run_local_pre_commit, "_npm_cmd", lambda: "npm")
        monkeypatch.setattr(run_local_pre_commit, "run_step", fake_run_step)

        assert run_local_pre_commit.main() == 0
        assert calls == [
            ("desktop pre-commit gate", ["npm", "--prefix", "desktop", "run", "check:pre-commit"]),
            ("src-ts pre-commit gate", ["npm", "--prefix", "src-ts", "run", "check:pre-commit"]),
            (
                "python static lint",
                [
                    sys.executable,
                    "-m",
                    "ruff",
                    "check",
                    "--select",
                    "F,I",
                    "scripts",
                    "tests/unit/scripts",
                ],
            ),
            (
                "python static format check",
                [
                    sys.executable,
                    "-m",
                    "ruff",
                    "format",
                    "--check",
                    "scripts",
                    "tests/unit/scripts",
                ],
            ),
        ]
        out = capsys.readouterr().out
        assert "Running lightweight local pre-commit checks." in out
        assert "Local pre-commit checks: PASS" in out

    def test_main_stops_at_first_failed_step(
        self, run_local_pre_commit, monkeypatch, capsys
    ) -> None:
        seen: list[str] = []

        def fake_run_step(label: str, _command: list[str]) -> int:
            seen.append(label)
            return 11 if label == "src-ts pre-commit gate" else 0

        monkeypatch.setattr(run_local_pre_commit, "_npm_cmd", lambda: "npm")
        monkeypatch.setattr(run_local_pre_commit, "run_step", fake_run_step)

        assert run_local_pre_commit.main() == 11
        assert seen == ["desktop pre-commit gate", "src-ts pre-commit gate"]
        out = capsys.readouterr().out
        assert "Local pre-commit checks: PASS" not in out


class TestGenerateSignedTauriConfig:
    def test_npm_cmd_uses_platform_specific_binary(
        self, generate_signed_tauri_config, monkeypatch
    ) -> None:
        monkeypatch.setattr(generate_signed_tauri_config.sys, "platform", "win32")
        assert generate_signed_tauri_config._npm_cmd() == "npm.cmd"

        monkeypatch.setattr(generate_signed_tauri_config.sys, "platform", "linux")
        assert generate_signed_tauri_config._npm_cmd() == "npm"

    def test_generate_signed_config_requires_thumbprint(
        self, generate_signed_tauri_config, monkeypatch
    ) -> None:
        monkeypatch.delenv("NIKO_WINDOWS_CERT_THUMBPRINT", raising=False)
        monkeypatch.setenv("NIKO_WINDOWS_TIMESTAMP_URL", "https://timestamp.example")

        with pytest.raises(SystemExit, match="Missing NIKO_WINDOWS_CERT_THUMBPRINT"):
            generate_signed_tauri_config.generate_signed_config()

    def test_generate_signed_config_requires_timestamp(
        self, generate_signed_tauri_config, monkeypatch
    ) -> None:
        monkeypatch.setenv("NIKO_WINDOWS_CERT_THUMBPRINT", "abc123")
        monkeypatch.delenv("NIKO_WINDOWS_TIMESTAMP_URL", raising=False)

        with pytest.raises(SystemExit, match="Missing NIKO_WINDOWS_TIMESTAMP_URL"):
            generate_signed_tauri_config.generate_signed_config()

    def test_generate_signed_config_writes_signed_fields(
        self, generate_signed_tauri_config, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop" / "src-tauri"
        desktop_dir.mkdir(parents=True)
        source_path = desktop_dir / "tauri.conf.json"
        output_path = desktop_dir / "tauri.signed.local.generated.json"
        source_path.write_text('{"bundle":{"windows":{"existing":"value"}}}', encoding="utf-8")

        monkeypatch.setattr(generate_signed_tauri_config, "TAURI_CONFIG_PATH", source_path)
        monkeypatch.setattr(generate_signed_tauri_config, "OUTPUT_CONFIG_PATH", output_path)
        monkeypatch.setenv("NIKO_WINDOWS_CERT_THUMBPRINT", "thumb-123")
        monkeypatch.setenv("NIKO_WINDOWS_TIMESTAMP_URL", "https://timestamp.example")
        monkeypatch.delenv("NIKO_WINDOWS_SIGNTOOL_PATH", raising=False)

        written_path = generate_signed_tauri_config.generate_signed_config()

        assert written_path == output_path
        payload = json.loads(output_path.read_text(encoding="utf-8"))
        windows = payload["bundle"]["windows"]
        assert windows["existing"] == "value"
        assert windows["certificateThumbprint"] == "thumb-123"
        assert windows["timestampUrl"] == "https://timestamp.example"
        assert "signCommand" not in windows

    def test_generate_signed_config_adds_sign_command_when_configured(
        self, generate_signed_tauri_config, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop" / "src-tauri"
        desktop_dir.mkdir(parents=True)
        source_path = desktop_dir / "tauri.conf.json"
        output_path = desktop_dir / "tauri.signed.local.generated.json"
        source_path.write_text("{}", encoding="utf-8")

        monkeypatch.setattr(generate_signed_tauri_config, "TAURI_CONFIG_PATH", source_path)
        monkeypatch.setattr(generate_signed_tauri_config, "OUTPUT_CONFIG_PATH", output_path)
        monkeypatch.setenv("NIKO_WINDOWS_CERT_THUMBPRINT", "thumb-123")
        monkeypatch.setenv("NIKO_WINDOWS_TIMESTAMP_URL", "https://timestamp.example")
        monkeypatch.setenv(
            "NIKO_WINDOWS_SIGNTOOL_PATH",
            r"C:\Program Files (x86)\Windows Kits\10\bin\signtool.exe",
        )

        generate_signed_tauri_config.generate_signed_config()

        payload = json.loads(output_path.read_text(encoding="utf-8"))
        sign_command = payload["bundle"]["windows"]["signCommand"]
        assert sign_command["cmd"].endswith("signtool.exe")
        assert sign_command["args"] == [
            "sign",
            "/fd",
            "sha256",
            "/sha1",
            "thumb-123",
            "/tr",
            "https://timestamp.example",
            "/td",
            "sha256",
            "%1",
        ]

    def test_run_signed_build_invokes_tauri_with_generated_config(
        self, generate_signed_tauri_config, tmp_path, monkeypatch
    ) -> None:
        desktop_dir = tmp_path / "desktop"
        config_path = desktop_dir / "src-tauri" / "tauri.signed.local.generated.json"
        config_path.parent.mkdir(parents=True)
        config_path.write_text("{}", encoding="utf-8")

        captured: dict[str, object] = {}

        def fake_run(command, cwd, env, check):
            captured["command"] = command
            captured["cwd"] = cwd
            captured["env"] = env
            captured["check"] = check
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(generate_signed_tauri_config, "DESKTOP_DIR", desktop_dir)
        monkeypatch.setattr(generate_signed_tauri_config.subprocess, "run", fake_run)
        monkeypatch.setattr(generate_signed_tauri_config, "_npm_cmd", lambda: "npm")

        generate_signed_tauri_config.run_signed_build(config_path)

        assert captured["command"] == [
            "npm",
            "run",
            "tauri",
            "--",
            "build",
            "--config",
            "src-tauri/tauri.signed.local.generated.json",
        ]
        assert captured["cwd"] == desktop_dir
        assert captured["check"] is True
        assert isinstance(captured["env"], dict)

    def test_main_prints_path_and_optionally_runs_build(
        self, generate_signed_tauri_config, tmp_path, monkeypatch, capsys
    ) -> None:
        config_path = tmp_path / "desktop" / "src-tauri" / "tauri.signed.local.generated.json"
        config_path.parent.mkdir(parents=True)

        seen: dict[str, object] = {}

        monkeypatch.setattr(
            generate_signed_tauri_config,
            "generate_signed_config",
            lambda: config_path,
        )
        monkeypatch.setattr(
            generate_signed_tauri_config,
            "run_signed_build",
            lambda path: seen.setdefault("path", path),
        )
        monkeypatch.setattr(
            generate_signed_tauri_config.sys,
            "argv",
            ["generate_signed_tauri_config.py", "--run-build"],
        )

        generate_signed_tauri_config.main()

        assert seen["path"] == config_path
        out = capsys.readouterr().out
        assert str(config_path) in out

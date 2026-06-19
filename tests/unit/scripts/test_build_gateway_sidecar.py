"""Unit tests for scripts/build_gateway_sidecar.py."""

from __future__ import annotations

import importlib.util
import os
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
def build_gateway_sidecar() -> ModuleType:
    return _load("scripts/build_gateway_sidecar.py", "_test_build_gateway_sidecar")


class TestHelpers:
    def test_project_root_matches_repository_root(self, build_gateway_sidecar) -> None:
        assert build_gateway_sidecar._project_root() == PROJECT_ROOT

    def test_is_windows_matches_platform_name(self, build_gateway_sidecar, monkeypatch) -> None:
        monkeypatch.setattr(build_gateway_sidecar.platform, "system", lambda: "Windows")
        assert build_gateway_sidecar._is_windows() is True

        monkeypatch.setattr(build_gateway_sidecar.platform, "system", lambda: "Linux")
        assert build_gateway_sidecar._is_windows() is False

    @pytest.mark.parametrize(
        ("machine", "expected"),
        [
            ("AMD64", "x86_64-pc-windows-msvc"),
            ("x86_64", "x86_64-pc-windows-msvc"),
            ("ARM64", "aarch64-pc-windows-msvc"),
            ("mips64", "x86_64-pc-windows-msvc"),
        ],
    )
    def test_target_triple_for_windows_architectures(
        self, build_gateway_sidecar, monkeypatch, machine, expected
    ) -> None:
        monkeypatch.setattr(build_gateway_sidecar.platform, "system", lambda: "Windows")
        monkeypatch.setattr(build_gateway_sidecar.platform, "machine", lambda: machine)

        assert build_gateway_sidecar._target_triple() == expected

    def test_target_triple_is_empty_off_windows(
        self, build_gateway_sidecar, monkeypatch
    ) -> None:
        monkeypatch.setattr(build_gateway_sidecar.platform, "system", lambda: "Linux")
        monkeypatch.setattr(build_gateway_sidecar.platform, "machine", lambda: "x86_64")

        assert build_gateway_sidecar._target_triple() == ""

    def test_build_parser_reads_legacy_entry_default_from_environment(
        self, build_gateway_sidecar, monkeypatch
    ) -> None:
        monkeypatch.setenv("NIKO_LEGACY_SIDECAR_ENTRY", "custom/legacy-entry.py")

        args = build_gateway_sidecar._build_parser().parse_args([])

        assert args.legacy_entry == "custom/legacy-entry.py"

    def test_resolve_legacy_entry_supports_relative_and_absolute_paths(
        self, build_gateway_sidecar, tmp_path
    ) -> None:
        relative = build_gateway_sidecar._resolve_legacy_entry(tmp_path, "src/mcp/sidecar_entry.py")
        absolute_input = tmp_path / "external" / "sidecar_entry.py"
        absolute = build_gateway_sidecar._resolve_legacy_entry(tmp_path, str(absolute_input))

        assert relative == (tmp_path / "src" / "mcp" / "sidecar_entry.py").resolve()
        assert absolute == absolute_input.resolve()


class TestMain:
    def test_exits_when_legacy_entry_is_missing(
        self, build_gateway_sidecar, tmp_path, monkeypatch
    ) -> None:
        parser = SimpleNamespace(parse_args=lambda: SimpleNamespace(legacy_entry="missing.py"))
        monkeypatch.setattr(build_gateway_sidecar, "_build_parser", lambda: parser)
        monkeypatch.setattr(build_gateway_sidecar, "_project_root", lambda: tmp_path)

        with pytest.raises(SystemExit) as excinfo:
            build_gateway_sidecar.main()

        assert "Missing legacy entry" in str(excinfo.value)

    def test_builds_windows_sidecar_and_triple_variant(
        self, build_gateway_sidecar, tmp_path, monkeypatch, capsys
    ) -> None:
        entry = tmp_path / "src" / "mcp" / "sidecar_entry.py"
        entry.parent.mkdir(parents=True)
        entry.write_text("print('sidecar')\n", encoding="utf-8")
        stale_build_dir = tmp_path / ".build" / "pyinstaller" / "niko-gateway"
        stale_build_dir.mkdir(parents=True)
        (stale_build_dir / "stale.txt").write_text("old\n", encoding="utf-8")

        parser = SimpleNamespace(
            parse_args=lambda: SimpleNamespace(legacy_entry="src/mcp/sidecar_entry.py")
        )
        captured: dict[str, object] = {}

        def fake_run(cmd, check, env, cwd):
            captured["cmd"] = cmd
            captured["check"] = check
            captured["env"] = env
            captured["cwd"] = cwd
            produced = (
                tmp_path
                / ".build"
                / "pyinstaller"
                / "niko-gateway"
                / "dist"
                / "niko-gateway.exe"
            )
            produced.parent.mkdir(parents=True, exist_ok=True)
            produced.write_text("binary\n", encoding="utf-8")
            return SimpleNamespace(returncode=0)

        monkeypatch.setattr(build_gateway_sidecar, "_build_parser", lambda: parser)
        monkeypatch.setattr(build_gateway_sidecar, "_project_root", lambda: tmp_path)
        monkeypatch.setattr(build_gateway_sidecar, "_is_windows", lambda: True)
        monkeypatch.setattr(
            build_gateway_sidecar, "_target_triple", lambda: "x86_64-pc-windows-msvc"
        )
        monkeypatch.setattr(build_gateway_sidecar.subprocess, "run", fake_run)

        build_gateway_sidecar.main()

        out_dir = tmp_path / "desktop" / "src-tauri" / "bin"
        assert (out_dir / "niko-gateway.exe").exists()
        assert (out_dir / "niko-gateway-x86_64-pc-windows-msvc.exe").exists()
        assert captured["check"] is True
        assert captured["cwd"] == str(tmp_path)
        assert captured["cmd"] == [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--name",
            "niko-gateway",
            "--distpath",
            str(tmp_path / ".build" / "pyinstaller" / "niko-gateway" / "dist"),
            "--workpath",
            str(tmp_path / ".build" / "pyinstaller" / "niko-gateway" / "build"),
            "--specpath",
            str(tmp_path / ".build" / "pyinstaller" / "niko-gateway"),
            str(entry.resolve()),
        ]
        pythonpath = captured["env"]["PYTHONPATH"]
        assert pythonpath.split(os.pathsep)[0] == str(tmp_path)
        assert "Sidecar built:" in capsys.readouterr().out

    def test_exits_when_pyinstaller_output_is_missing(
        self, build_gateway_sidecar, tmp_path, monkeypatch
    ) -> None:
        entry = tmp_path / "src" / "mcp" / "sidecar_entry.py"
        entry.parent.mkdir(parents=True)
        entry.write_text("print('sidecar')\n", encoding="utf-8")
        parser = SimpleNamespace(
            parse_args=lambda: SimpleNamespace(legacy_entry="src/mcp/sidecar_entry.py")
        )

        monkeypatch.setattr(build_gateway_sidecar, "_build_parser", lambda: parser)
        monkeypatch.setattr(build_gateway_sidecar, "_project_root", lambda: tmp_path)
        monkeypatch.setattr(build_gateway_sidecar, "_is_windows", lambda: False)
        monkeypatch.setattr(build_gateway_sidecar.subprocess, "run", lambda *a, **kw: None)

        with pytest.raises(SystemExit) as excinfo:
            build_gateway_sidecar.main()

        assert "PyInstaller output not found" in str(excinfo.value)

    def test_module_entrypoint_executes_main_guard(self, monkeypatch) -> None:
        import runpy

        target_script = PROJECT_ROOT / "scripts" / "build_gateway_sidecar.py"
        original_exists = Path.exists

        def fake_exists(path: Path) -> bool:
            if path == (PROJECT_ROOT / "src" / "mcp" / "sidecar_entry.py"):
                return False
            return original_exists(path)

        monkeypatch.setattr(Path, "exists", fake_exists)
        monkeypatch.setattr(sys, "argv", ["build_gateway_sidecar.py"])

        with pytest.raises(SystemExit) as excinfo:
            runpy.run_path(str(target_script), run_name="__main__")

        assert "Missing legacy entry" in str(excinfo.value)

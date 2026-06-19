"""Additional branch coverage tests for release and packaging scripts."""

from __future__ import annotations

import importlib.util
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


def test_build_gateway_sidecar_main_skips_triple_copy_off_windows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    module = _load("scripts/build_gateway_sidecar.py", "_test_build_gateway_sidecar_branch_tail")

    entry = tmp_path / "src" / "mcp" / "sidecar_entry.py"
    entry.parent.mkdir(parents=True)
    entry.write_text("print('legacy sidecar')\n", encoding="utf-8")

    parser = SimpleNamespace(
        parse_args=lambda: SimpleNamespace(legacy_entry="src/mcp/sidecar_entry.py")
    )

    def fake_run(cmd, check, env, cwd) -> None:
        produced = tmp_path / ".build" / "pyinstaller" / "niko-gateway" / "dist" / "niko-gateway"
        produced.parent.mkdir(parents=True, exist_ok=True)
        produced.write_text("binary\n", encoding="utf-8")

    monkeypatch.setattr(module, "_build_parser", lambda: parser)
    monkeypatch.setattr(module, "_project_root", lambda: tmp_path)
    monkeypatch.setattr(module.platform, "system", lambda: "Linux")
    monkeypatch.setattr(module.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(module.subprocess, "run", fake_run)

    module.main()

    out_dir = tmp_path / "desktop" / "src-tauri" / "bin"
    assert (out_dir / "niko-gateway").exists()
    assert list(out_dir.glob("niko-gateway-*.exe")) == []


def test_check_i18n_extract_keys_ignores_invalid_identifiers() -> None:
    module = _load("scripts/check_i18n_keys.py", "_test_check_i18n_branch_tail")

    content = """export const translations = {
  zh: {
    valid_key: "ok",
    bad key: "skip",
    "quoted-key": "skip",
  },
  en: {},
};
"""

    assert module._extract_keys("zh", content) == {"valid_key"}


def test_generate_signed_tauri_config_main_without_run_build(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _load(
        "scripts/generate_signed_tauri_config.py",
        "_test_generate_signed_tauri_config_branch_tail",
    )

    config_path = tmp_path / "desktop" / "src-tauri" / "tauri.signed.local.generated.json"
    config_path.parent.mkdir(parents=True)
    config_path.write_text("{}\n", encoding="utf-8")

    called = {"run_build": False}

    monkeypatch.setattr(
        module.sys,
        "argv",
        ["generate_signed_tauri_config.py"],
    )
    monkeypatch.setattr(module, "generate_signed_config", lambda: config_path)
    monkeypatch.setattr(
        module,
        "run_signed_build",
        lambda _config_path: called.__setitem__("run_build", True),
    )

    module.main()

    assert called["run_build"] is False
    assert capsys.readouterr().out.strip() == str(config_path)


def test_finalize_release_state_sync_local_artifact_skips_non_dict_nested_values() -> None:
    module = _load("scripts/finalize_release_state.py", "_test_finalize_release_state_branch_tail")

    payload = {
        "release_evidence": ["unexpected"],
        "trace": "unexpected",
    }
    state = module.ReleaseState(
        head_sha="deadbeef",
        release_tag="v9.9.9",
        release_url="https://example.test/releases/v9.9.9",
        asset_names=(),
    )

    updated = module.sync_local_artifact(payload, state)

    assert updated["head_sha"] == "deadbeef"
    assert isinstance(updated["generated_at"], str)
    assert updated["release_evidence"] == ["unexpected"]
    assert updated["trace"] == "unexpected"

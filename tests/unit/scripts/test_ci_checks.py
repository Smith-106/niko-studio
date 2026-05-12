"""Unit tests for CI gate scripts: check_versions.py and check_i18n_keys.py.

Both scripts are first-line CI gates (.github/workflows/integration-tests.yml),
so a regression here breaks every PR.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _load(relative_path: str, module_name: str) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, PROJECT_ROOT / relative_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# check_versions.py
# ---------------------------------------------------------------------------


@pytest.fixture
def check_versions() -> ModuleType:
    return _load("scripts/check_versions.py", "_test_check_versions")


class TestReadTypescriptAppVersion:
    def test_extracts_version_from_const(self, check_versions, tmp_path, monkeypatch):
        config_dir = tmp_path / "src-ts" / "config"
        config_dir.mkdir(parents=True)
        (config_dir / "index.ts").write_text(
            'export const APP_VERSION = "1.2.3";\n', encoding="utf-8"
        )
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)
        assert check_versions.read_typescript_app_version() == "1.2.3"

    def test_handles_single_quotes(self, check_versions, tmp_path, monkeypatch):
        config_dir = tmp_path / "src-ts" / "config"
        config_dir.mkdir(parents=True)
        (config_dir / "index.ts").write_text("const APP_VERSION = '9.9.9';\n", encoding="utf-8")
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)
        assert check_versions.read_typescript_app_version() == "9.9.9"

    def test_raises_when_app_version_missing(self, check_versions, tmp_path, monkeypatch):
        config_dir = tmp_path / "src-ts" / "config"
        config_dir.mkdir(parents=True)
        (config_dir / "index.ts").write_text("// no version here\n", encoding="utf-8")
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)
        with pytest.raises(RuntimeError, match="未在.*找到 APP_VERSION"):
            check_versions.read_typescript_app_version()


class TestReadJsonVersion:
    def test_returns_version_field(self, check_versions, tmp_path):
        path = tmp_path / "package.json"
        path.write_text('{"name": "x", "version": "4.5.6"}', encoding="utf-8")
        assert check_versions.read_json_version(path) == "4.5.6"

    def test_raises_on_missing_version(self, check_versions, tmp_path):
        path = tmp_path / "package.json"
        path.write_text('{"name": "x"}', encoding="utf-8")
        with pytest.raises(KeyError):
            check_versions.read_json_version(path)


class TestReadCargoVersion:
    def test_extracts_root_version(self, check_versions, tmp_path):
        path = tmp_path / "Cargo.toml"
        path.write_text(
            '[package]\nname = "niko"\nversion = "9.2.0"\nedition = "2021"\n', encoding="utf-8"
        )
        assert check_versions.read_cargo_version(path) == "9.2.0"

    def test_raises_when_version_missing(self, check_versions, tmp_path):
        path = tmp_path / "Cargo.toml"
        path.write_text('[package]\nname = "niko"\n', encoding="utf-8")
        with pytest.raises(RuntimeError, match="未在.*找到 version"):
            check_versions.read_cargo_version(path)


class TestReadYamlVersion:
    def test_extracts_top_level_version(self, check_versions, tmp_path):
        path = tmp_path / "config.yaml"
        path.write_text("version: 7.8.9\nother: value\n", encoding="utf-8")
        assert check_versions.read_yaml_version(path) == "7.8.9"

    def test_coerces_int_version_to_string(self, check_versions, tmp_path):
        path = tmp_path / "config.yaml"
        path.write_text("version: 8\n", encoding="utf-8")
        assert check_versions.read_yaml_version(path) == "8"

    def test_raises_on_empty_file(self, check_versions, tmp_path):
        path = tmp_path / "config.yaml"
        path.write_text("", encoding="utf-8")
        with pytest.raises(RuntimeError, match="未在.*找到 version"):
            check_versions.read_yaml_version(path)

    def test_raises_when_version_key_absent(self, check_versions, tmp_path):
        path = tmp_path / "config.yaml"
        path.write_text("name: niko\n", encoding="utf-8")
        with pytest.raises(RuntimeError, match="未在.*找到 version"):
            check_versions.read_yaml_version(path)


def _seed_consistent_repo(root: Path, version: str) -> None:
    """Create the minimal file tree expected by check_versions.main()."""
    (root / "src-ts" / "config").mkdir(parents=True)
    (root / "src-ts" / "config" / "index.ts").write_text(
        f'export const APP_VERSION = "{version}";\n', encoding="utf-8"
    )
    (root / "src-ts" / "package.json").write_text(
        f'{{"name":"backend","version":"{version}"}}', encoding="utf-8"
    )
    (root / "config").mkdir(parents=True)
    (root / "config" / "niko-studio.yaml").write_text(f"version: {version}\n", encoding="utf-8")
    (root / "config" / "niko-studio.production.yaml").write_text(
        f"version: {version}\n", encoding="utf-8"
    )
    (root / "desktop" / "src-tauri").mkdir(parents=True)
    (root / "desktop" / "package.json").write_text(
        f'{{"name":"desktop","version":"{version}"}}', encoding="utf-8"
    )
    (root / "desktop" / "src-tauri" / "tauri.conf.json").write_text(
        f'{{"version":"{version}"}}', encoding="utf-8"
    )
    (root / "desktop" / "src-tauri" / "Cargo.toml").write_text(
        f'[package]\nname = "niko"\nversion = "{version}"\n', encoding="utf-8"
    )


class TestCheckVersionsMain:
    def test_returns_zero_when_all_aligned(
        self, check_versions, tmp_path, monkeypatch, capsys
    ) -> None:
        _seed_consistent_repo(tmp_path, "9.9.9")
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)
        assert check_versions.main() == 0
        captured = capsys.readouterr()
        assert check_versions.AUTHORITATIVE_VERSION_SOURCE in captured.out
        assert "9.9.9" in captured.out
        assert "通过" in captured.out

    def test_returns_one_when_mismatch(self, check_versions, tmp_path, monkeypatch, capsys) -> None:
        _seed_consistent_repo(tmp_path, "9.9.9")
        # Drift desktop/package.json
        (tmp_path / "desktop" / "package.json").write_text(
            '{"name":"desktop","version":"1.0.0"}', encoding="utf-8"
        )
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)
        assert check_versions.main() == 1
        captured = capsys.readouterr()
        assert "desktop/package.json" in captured.out
        assert "1.0.0" in captured.out

    def test_treats_app_version_as_authoritative_release_source(
        self, check_versions, tmp_path, monkeypatch, capsys
    ) -> None:
        _seed_consistent_repo(tmp_path, "9.13.0")
        (tmp_path / "src-ts" / "config" / "index.ts").write_text(
            'export const APP_VERSION = "9.2.5";\n', encoding="utf-8"
        )
        monkeypatch.setattr(check_versions, "PROJECT_ROOT", tmp_path)

        assert check_versions.main() == 1

        captured = capsys.readouterr()
        assert check_versions.AUTHORITATIVE_VERSION_SOURCE in captured.out
        assert "expected version: 9.2.5" in captured.out
        assert "src-ts/package.json" in captured.out
        assert "desktop/package.json" in captured.out


# ---------------------------------------------------------------------------
# check_i18n_keys.py
# ---------------------------------------------------------------------------


@pytest.fixture
def check_i18n() -> ModuleType:
    return _load("scripts/check_i18n_keys.py", "_test_check_i18n_keys")


def _build_translations(zh_keys: list[str], en_keys: list[str]) -> str:
    def section(name: str, keys: list[str]) -> str:
        body = "\n".join(f'    {k}: "v",' for k in keys)
        return f"  {name}: {{\n{body}\n  }}"

    return (
        "export const translations = {\n"
        + section("zh", zh_keys)
        + ",\n"
        + section("en", en_keys)
        + ",\n};\n"
    )


class TestExtractKeys:
    def test_extracts_simple_keys(self, check_i18n) -> None:
        content = _build_translations(["welcome", "save", "cancel"], [])
        assert check_i18n._extract_keys("zh", content) == {"welcome", "save", "cancel"}

    def test_skips_comment_lines(self, check_i18n) -> None:
        content = 'export const t = {\n  zh: {\n    // a comment\n    welcome: "v",\n  }\n};'
        assert check_i18n._extract_keys("zh", content) == {"welcome"}

    def test_handles_underscore_and_hyphen_keys(self, check_i18n) -> None:
        content = _build_translations(["save_now", "user-name", "btn1"], [])
        assert check_i18n._extract_keys("zh", content) == {"save_now", "user-name", "btn1"}

    def test_handles_nested_object_values(self, check_i18n) -> None:
        # The function should follow the brace depth and stop at the closing of
        # the section, while still capturing nested keys.
        content = (
            "const t = {\n"
            "  zh: {\n"
            '    title: "Hi",\n'
            "    nested: {\n"
            '      inner: "v",\n'
            "    },\n"
            "  },\n"
            "  en: {},\n"
            "};\n"
        )
        keys = check_i18n._extract_keys("zh", content)
        assert "title" in keys
        assert "nested" in keys
        assert "inner" in keys

    def test_raises_on_missing_marker(self, check_i18n) -> None:
        with pytest.raises(RuntimeError, match="Missing section marker"):
            check_i18n._extract_keys("zh", "no zh section here")

    def test_raises_on_unbalanced_braces(self, check_i18n) -> None:
        content = 'zh: {\n  welcome: "v",\n  // missing close\n'
        with pytest.raises(RuntimeError, match="Unbalanced braces"):
            check_i18n._extract_keys("zh", content)


class TestI18nMain:
    def _seed(self, root: Path, content: str) -> Path:
        target = root / "desktop" / "src" / "i18n"
        target.mkdir(parents=True)
        f = target / "translations.ts"
        f.write_text(content, encoding="utf-8")
        return f

    def test_ok_when_keys_match(self, check_i18n, tmp_path, monkeypatch, capsys) -> None:
        f = self._seed(tmp_path, _build_translations(["a", "b"], ["a", "b"]))
        monkeypatch.setattr(check_i18n, "TRANSLATIONS_FILE", f)
        assert check_i18n.main() == 0
        out = capsys.readouterr().out
        assert "ok" in out
        assert "keys count: 2" in out

    def test_fails_when_zh_only_keys_present(
        self, check_i18n, tmp_path, monkeypatch, capsys
    ) -> None:
        f = self._seed(tmp_path, _build_translations(["a", "b", "extra_zh"], ["a", "b"]))
        monkeypatch.setattr(check_i18n, "TRANSLATIONS_FILE", f)
        assert check_i18n.main() == 1
        out = capsys.readouterr().out
        assert "failed" in out
        assert "extra_zh" in out

    def test_fails_when_en_only_keys_present(
        self, check_i18n, tmp_path, monkeypatch, capsys
    ) -> None:
        f = self._seed(tmp_path, _build_translations(["a"], ["a", "extra_en"]))
        monkeypatch.setattr(check_i18n, "TRANSLATIONS_FILE", f)
        assert check_i18n.main() == 1
        out = capsys.readouterr().out
        assert "extra_en" in out

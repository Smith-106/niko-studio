#!/usr/bin/env python
"""版本一致性校验脚本。"""

import json
import re
import sys
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def read_python_version() -> str:
    init_file = PROJECT_ROOT / "src" / "__init__.py"
    text = init_file.read_text(encoding="utf-8")
    match = re.search(r'__version__\s*=\s*"([^"]+)"', text)
    if not match:
        raise RuntimeError(f"未在 {init_file} 找到 __version__")
    return match.group(1)


def read_json_version(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["version"]


def read_cargo_version(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, flags=re.MULTILINE)
    if not match:
        raise RuntimeError(f"未在 {path} 找到 version")
    return match.group(1)


def read_yaml_version(path: Path) -> str:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    version = data.get("version")
    if not version:
        raise RuntimeError(f"未在 {path} 找到 version")
    return str(version)


def main() -> int:
    expected = read_python_version()

    checks = {
        "python.__version__": expected,
        "config/niko-studio.yaml": read_yaml_version(PROJECT_ROOT / "config" / "niko-studio.yaml"),
        "desktop/package.json": read_json_version(PROJECT_ROOT / "desktop" / "package.json"),
        "desktop/src-tauri/tauri.conf.json": read_json_version(PROJECT_ROOT / "desktop" / "src-tauri" / "tauri.conf.json"),
        "desktop/src-tauri/Cargo.toml": read_cargo_version(PROJECT_ROOT / "desktop" / "src-tauri" / "Cargo.toml"),
    }

    mismatches = {name: value for name, value in checks.items() if value != expected}

    print(f"expected version: {expected}")
    for name, value in checks.items():
        print(f"- {name}: {value}")

    if mismatches:
        print("\n版本不一致：")
        for name, value in mismatches.items():
            print(f"  * {name} = {value} (expected {expected})")
        return 1

    print("\n版本一致性检查通过。")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DESKTOP_DIR = PROJECT_ROOT / "desktop"
TAURI_CONFIG_PATH = DESKTOP_DIR / "src-tauri" / "tauri.conf.json"
OUTPUT_CONFIG_PATH = DESKTOP_DIR / "src-tauri" / "tauri.signed.local.generated.json"


def _npm_cmd() -> str:
    return "npm.cmd" if sys.platform.startswith("win") else "npm"


def generate_signed_config() -> Path:
    thumbprint = os.getenv("NIKO_WINDOWS_CERT_THUMBPRINT", "").strip()
    timestamp_url = os.getenv("NIKO_WINDOWS_TIMESTAMP_URL", "").strip()
    signtool_path = os.getenv("NIKO_WINDOWS_SIGNTOOL_PATH", "").strip()

    if not thumbprint:
        raise SystemExit("Missing NIKO_WINDOWS_CERT_THUMBPRINT")
    if not timestamp_url:
        raise SystemExit("Missing NIKO_WINDOWS_TIMESTAMP_URL")

    config = json.loads(TAURI_CONFIG_PATH.read_text(encoding="utf-8"))
    bundle = config.setdefault("bundle", {})
    windows = bundle.setdefault("windows", {})
    windows["certificateThumbprint"] = thumbprint
    windows["timestampUrl"] = timestamp_url

    # Optional: explicit signCommand overrides Tauri bundler's KitsRoot10 lookup.
    # Use when the registry KitsRoot10 entry does not match the actual signtool location
    # (common when Windows SDK was installed via Visual Studio installer to the (x86) tree).
    if signtool_path:
        # Tauri 2 supports an object form for signCommand.
        # Use it on Windows so executable paths with spaces are passed as a
        # single argv entry without relying on string splitting.
        windows["signCommand"] = {
            "cmd": signtool_path,
            "args": [
                "sign",
                "/fd",
                "sha256",
                "/sha1",
                thumbprint,
                "/tr",
                timestamp_url,
                "/td",
                "sha256",
                "%1",
            ],
        }

    OUTPUT_CONFIG_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return OUTPUT_CONFIG_PATH


def run_signed_build(config_path: Path) -> None:
    env = os.environ.copy()
    relative_config = str(config_path.relative_to(DESKTOP_DIR)).replace("\\", "/")
    subprocess.run(
        [_npm_cmd(), "run", "tauri", "--", "build", "--config", relative_config],
        cwd=DESKTOP_DIR,
        env=env,
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--run-build",
        action="store_true",
        help="Run `npm run tauri -- build` with TAURI_CONFIG pointed at the generated signed config.",
    )
    args = parser.parse_args()

    config_path = generate_signed_config()
    print(config_path)

    if args.run_build:
        run_signed_build(config_path)


if __name__ == "__main__":
    main()

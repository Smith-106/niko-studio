#!/usr/bin/env python
"""Lightweight local pre-commit checks for the current Niko Studio authority surface."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _npm_cmd() -> str:
    return "npm.cmd" if sys.platform.startswith("win") else "npm"


def run_step(label: str, command: list[str]) -> int:
    print(f"\n==> {label}")
    print("$", " ".join(command))
    completed = subprocess.run(command, cwd=PROJECT_ROOT, check=False)
    if completed.returncode != 0:
        print(f"\n[FAIL] {label} (exit={completed.returncode})")
        return completed.returncode
    print(f"[PASS] {label}")
    return 0


def main() -> int:
    steps = [
        (
            "desktop pre-commit gate",
            [_npm_cmd(), "--prefix", "desktop", "run", "check:pre-commit"],
        ),
        (
            "src-ts pre-commit gate",
            [_npm_cmd(), "--prefix", "src-ts", "run", "check:pre-commit"],
        ),
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
            [sys.executable, "-m", "ruff", "format", "--check", "scripts", "tests/unit/scripts"],
        ),
    ]

    print("Running lightweight local pre-commit checks.")
    print(
        "Heavy release/runtime checks remain in L2/L3/L4 gates and are intentionally not part of the commit hook."
    )

    for label, command in steps:
        exit_code = run_step(label, command)
        if exit_code != 0:
            return exit_code

    print("\nLocal pre-commit checks: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

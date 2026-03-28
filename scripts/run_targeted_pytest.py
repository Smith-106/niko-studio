#!/usr/bin/env python
"""本地定点 pytest 入口：默认绕开 pytest.ini addopts 与全局覆盖率门槛。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _has_addopts_override(args: list[str]) -> bool:
    for idx, arg in enumerate(args):
        if arg == "-o" and idx + 1 < len(args) and args[idx + 1].startswith("addopts"):
            return True
        if arg.startswith("--override-ini="):
            value = arg.split("=", 1)[1]
            if value.startswith("addopts"):
                return True
    return False


def _has_cov_directive(args: list[str]) -> bool:
    for arg in args:
        if arg == "--no-cov" or arg.startswith("--cov"):
            return True
    return False


def main() -> int:
    user_args = sys.argv[1:]

    cmd = [sys.executable, "-m", "pytest"]

    if not _has_addopts_override(user_args):
        cmd.extend(["-o", "addopts="])

    if not _has_cov_directive(user_args):
        cmd.append("--no-cov")

    cmd.extend(user_args)

    result = subprocess.run(cmd, cwd=PROJECT_ROOT)
    return int(result.returncode)


if __name__ == "__main__":
    raise SystemExit(main())

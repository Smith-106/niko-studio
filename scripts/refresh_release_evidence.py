#!/usr/bin/env python
"""Single-path helper to refresh retained release evidence before sign-off."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 18080
DEFAULT_LOG_LEVEL = "warning"
DEFAULT_HEALTH_TIMEOUT_SECONDS = 60


def _npm_cmd() -> str:
    return "npm.cmd" if sys.platform.startswith("win") else "npm"


def _resolve_powershell() -> str:
    for candidate in ("pwsh", "powershell.exe", "powershell"):
        if shutil.which(candidate):
            return candidate
    raise RuntimeError(
        "PowerShell executable not found. Use the granular fallback commands in docs/release/SIGN_OFF.md."
    )


def _format_command(command: list[str]) -> str:
    return " ".join(command)


def run_step(label: str, command: list[str], env: dict[str, str] | None = None) -> None:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    print(f"\n==> {label}")
    print(f"$ {_format_command(command)}")
    completed = subprocess.run(command, cwd=PROJECT_ROOT, env=merged_env, check=False)
    if completed.returncode != 0:
        raise RuntimeError(f"{label} failed (exit={completed.returncode}).")
    print(f"[PASS] {label}")


def _wait_for_gateway_health(host: str, port: int, timeout_seconds: int) -> None:
    url = f"http://{host}:{port}/health"
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None

    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                if 200 <= response.status < 500:
                    print(f"Gateway health ready: {url}")
                    return
        except urllib.error.URLError as exc:
            last_error = exc
        except OSError as exc:
            last_error = exc
        time.sleep(1)

    message = f"Gateway did not become healthy at {url} within {timeout_seconds}s."
    if last_error is not None:
        message += f" Last error: {last_error}"
    raise RuntimeError(message)


def _stop_gateway(process: subprocess.Popen[str] | None) -> None:
    if process is None or process.poll() is not None:
        return

    if sys.platform.startswith("win"):
        completed = subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            cwd=PROJECT_ROOT,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.returncode == 0:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
            return

    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Refresh retained release evidence through one operator-facing path."
    )
    parser.add_argument(
        "--host", default=DEFAULT_HOST, help="Gateway host for strict writing-helper acceptance"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help="Gateway port for strict writing-helper acceptance",
    )
    parser.add_argument(
        "--log-level",
        default=DEFAULT_LOG_LEVEL,
        help="Gateway log level forwarded to scripts/start_gateway.py",
    )
    parser.add_argument(
        "--health-timeout",
        type=int,
        default=DEFAULT_HEALTH_TIMEOUT_SECONDS,
        help="Seconds to wait for gateway health before failing",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    powershell = _resolve_powershell()

    print("Refreshing retained release evidence through the single operator path.")

    run_step(
        "desktop local self-test",
        [_npm_cmd(), "--prefix", "desktop", "run", "local:selftest"],
    )

    gateway_command = [
        sys.executable,
        "scripts/start_gateway.py",
        "--host",
        args.host,
        "--port",
        str(args.port),
        "--log-level",
        args.log_level,
    ]
    gateway_env = os.environ.copy()
    gateway_env["NIKO_GATEWAY_RUNTIME"] = "node"

    gateway_process: subprocess.Popen[str] | None = None
    try:
        print("\n==> start authoritative gateway")
        print(f"$ {_format_command(gateway_command)}")
        gateway_process = subprocess.Popen(gateway_command, cwd=PROJECT_ROOT, env=gateway_env)
        _wait_for_gateway_health(args.host, args.port, args.health_timeout)

        run_step(
            "writing-helper acceptance refresh",
            [
                powershell,
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                ".\\scripts\\check-writing-helper.ps1",
                "-Strict",
                "-Port",
                str(args.port),
                "-Host",
                args.host,
            ],
        )
    finally:
        _stop_gateway(gateway_process)

    run_step(
        "consolidated release summary",
        [sys.executable, "scripts/release_check_summary.py"],
    )

    print("\nRelease evidence refresh: PASS")
    print("Primary artifacts:")
    print("- .workflow/evidence/release/writing-helper-acceptance.json")
    print("- .workflow/evidence/release/authority-alignment.json")
    print("- .workflow/evidence/release/release-readiness-artifact.json")
    print("- release-check-summary.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

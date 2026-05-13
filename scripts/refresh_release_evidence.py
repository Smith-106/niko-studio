#!/usr/bin/env python
"""Single-path helper to refresh retained release evidence before sign-off."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = PROJECT_ROOT / "release-check-summary.md"
RELEASE_READINESS_ARTIFACT_PATH = (
    PROJECT_ROOT / ".workflow" / "evidence" / "release" / "release-readiness-artifact.json"
)
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


def _mtime_ns(path: Path) -> int | None:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return None


def _validate_consolidated_summary_refresh(
    exit_code: int,
    report_path: Path,
    artifact_path: Path,
    previous_report_mtime_ns: int | None,
    previous_artifact_mtime_ns: int | None,
) -> str:
    if exit_code not in {0, 1}:
        raise RuntimeError(f"consolidated release summary failed (exit={exit_code}).")

    if not report_path.exists():
        raise RuntimeError(f"consolidated release summary did not write {report_path}.")
    if not artifact_path.exists():
        raise RuntimeError(f"consolidated release summary did not write {artifact_path}.")

    report_mtime_ns = _mtime_ns(report_path)
    artifact_mtime_ns = _mtime_ns(artifact_path)
    if previous_report_mtime_ns is not None and report_mtime_ns is not None:
        if report_mtime_ns <= previous_report_mtime_ns:
            raise RuntimeError(f"consolidated release summary did not refresh {report_path}.")
    if previous_artifact_mtime_ns is not None and artifact_mtime_ns is not None:
        if artifact_mtime_ns <= previous_artifact_mtime_ns:
            raise RuntimeError(f"consolidated release summary did not refresh {artifact_path}.")

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            f"consolidated release summary wrote an unreadable artifact: {artifact_path} ({exc})"
        ) from exc

    decision = str(payload.get("decision") or "").strip().upper()
    if decision not in {"GO", "NO_GO"}:
        raise RuntimeError(
            f"consolidated release summary produced an unknown decision: {decision or 'missing'}"
        )
    if exit_code == 0 and decision != "GO":
        raise RuntimeError(
            f"consolidated release summary exited 0 but artifact decision is {decision}."
        )
    if exit_code == 1 and decision != "NO_GO":
        raise RuntimeError(
            f"consolidated release summary exited 1 but artifact decision is {decision}."
        )

    return decision


def run_step(
    label: str,
    command: list[str],
    env: dict[str, str] | None = None,
    *,
    allowed_exit_codes: tuple[int, ...] = (0,),
    announce_success: bool = True,
) -> int:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)

    print(f"\n==> {label}")
    print(f"$ {_format_command(command)}")
    completed = subprocess.run(command, cwd=PROJECT_ROOT, env=merged_env, check=False)
    if completed.returncode not in allowed_exit_codes:
        raise RuntimeError(f"{label} failed (exit={completed.returncode}).")
    if announce_success:
        print(f"[PASS] {label}")
    return completed.returncode


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

    previous_report_mtime_ns = _mtime_ns(REPORT_PATH)
    previous_artifact_mtime_ns = _mtime_ns(RELEASE_READINESS_ARTIFACT_PATH)
    summary_exit_code = run_step(
        "consolidated release summary",
        [sys.executable, "scripts/release_check_summary.py"],
        allowed_exit_codes=(0, 1),
        announce_success=False,
    )
    decision = _validate_consolidated_summary_refresh(
        summary_exit_code,
        REPORT_PATH,
        RELEASE_READINESS_ARTIFACT_PATH,
        previous_report_mtime_ns,
        previous_artifact_mtime_ns,
    )
    print(f"[PASS] consolidated release summary ({decision})")

    print("\nRelease evidence refresh: PASS")
    print("Primary artifacts:")
    print("- .workflow/evidence/release/writing-helper-acceptance.json")
    print("- .workflow/evidence/release/authority-alignment.json")
    print("- .workflow/evidence/release/release-readiness-artifact.json")
    print("- release-check-summary.md")
    if decision != "GO":
        print(
            "Current release decision remains NO_GO; retained evidence is refreshed and blockers are current-head accurate."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

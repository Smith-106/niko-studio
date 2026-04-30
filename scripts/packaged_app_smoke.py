#!/usr/bin/env python
"""Layer 4 packaged-app smoke launcher (ISS-20260430-002).

Installs an NSIS installer to a temp directory on a Windows host, launches the
installed Niko-Studio Desktop binary, and asserts the bundled sidecar passes
three contracts:

    1. /health responds with HTTP 200 and JSON.
    2. /health.version matches desktop/package.json version (catches the
       v9.2.1 ISS-20260430-001 class where a stale Python compat sidecar
       reports 8.0.0 instead of the current package version).
    3. CORS preflight from origin "tauri://localhost" is allowed by the
       sidecar (catches CORS-rejection class breaking WebView2 fetches).

Optionally asserts that the 7 expected services (memory/graph/search/workflow/
critic/agent/skills) all report healthy on first launch.

Exit codes:
    0  — all assertions pass; sidecar contract honored.
    1  — one or more contract violations.
    2  — environment / setup error (installer missing, port unavailable, ...).

Designed for windows-latest GitHub runners, but degrades gracefully when run
locally on a Windows dev box for fast iteration.

Usage:
    python scripts/packaged_app_smoke.py \\
        --installer-path desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.2.1_x64-setup.exe \\
        [--launch-timeout-seconds 60] \\
        [--health-poll-seconds 90] \\
        [--smoke-port 5882] \\
        [--report path/to/report.json] \\
        [--skip-launch]
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DESKTOP_PACKAGE_JSON = PROJECT_ROOT / "desktop" / "package.json"
EXPECTED_SERVICES = (
    "memory",
    "graph",
    "search",
    "workflow",
    "critic",
    "agent",
    "skills",
)
WEBVIEW_ORIGIN = "tauri://localhost"
DEFAULT_HEALTH_POLL_SECONDS = 90
DEFAULT_LAUNCH_TIMEOUT_SECONDS = 60
DEFAULT_SMOKE_PORT = 5882

EXIT_PASS = 0
EXIT_CONTRACT_FAIL = 1
EXIT_SETUP_ERROR = 2


@dataclass
class SmokeReport:
    status: str = "PENDING"
    started_at: str = ""
    finished_at: str = ""
    package_version: str | None = None
    installer_path: str | None = None
    install_dir: str | None = None
    runtime_port: int | None = None
    health_response: dict[str, Any] | None = None
    cors_response: dict[str, Any] | None = None
    install_verified: bool = False
    launch_verified: bool = False
    health_version_verified: bool = False
    services_verified: bool = False
    cors_verified: bool = False
    failures: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def add_failure(self, message: str) -> None:
        self.failures.append(message)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_package_version() -> str:
    if not DESKTOP_PACKAGE_JSON.exists():
        raise SystemExit(f"desktop/package.json not found at {DESKTOP_PACKAGE_JSON}")
    payload = json.loads(DESKTOP_PACKAGE_JSON.read_text(encoding="utf-8"))
    version = payload.get("version")
    if not version:
        raise SystemExit("desktop/package.json missing 'version' field")
    return str(version).strip()


def is_windows() -> bool:
    return sys.platform.startswith("win")


def silent_install(installer: Path, install_dir: Path, report: SmokeReport) -> None:
    """Run NSIS silent install with /S flag.

    NSIS supports /S (silent) and /D=<path> (destination). The /D flag must be
    the LAST argument and must NOT use quotes — it consumes the rest of the
    command line literally. We construct argv manually to honor that quirk.
    """
    if not installer.exists():
        raise SystemExit(f"installer not found: {installer}")
    install_dir.mkdir(parents=True, exist_ok=True)

    # NSIS quirk: /D=<path> must be last and unquoted.
    cmd = [str(installer), "/S", f"/D={install_dir}"]
    print(f"[smoke] silent install: {' '.join(cmd)}", flush=True)
    try:
        subprocess.run(cmd, check=True, timeout=180)
    except subprocess.CalledProcessError as exc:
        report.add_failure(f"NSIS silent install failed (exit={exc.returncode})")
        raise
    except subprocess.TimeoutExpired:
        report.add_failure("NSIS silent install timed out after 180s")
        raise

    # Locate installed exe — NSIS layout puts the launcher at the install root.
    candidates = [
        install_dir / "Niko-Studio.exe",
        install_dir / "niko-studio.exe",
        install_dir / "niko-studio-desktop.exe",
    ]
    found = next((c for c in candidates if c.exists()), None)
    if not found:
        # Fall back to glob — rare layout variations.
        glob_hits = list(install_dir.rglob("*.exe"))
        found = next((p for p in glob_hits if "studio" in p.name.lower()), None)
    if not found:
        report.add_failure(f"installed executable not found under {install_dir}")
        raise SystemExit(EXIT_SETUP_ERROR)

    report.install_dir = str(install_dir)
    report.install_verified = True
    report.notes.append(f"Installed launcher: {found}")


def find_installed_executable(install_dir: Path) -> Path | None:
    candidates = [
        install_dir / "Niko-Studio.exe",
        install_dir / "niko-studio.exe",
        install_dir / "niko-studio-desktop.exe",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    glob_hits = list(install_dir.rglob("*.exe"))
    for hit in glob_hits:
        name = hit.name.lower()
        if "studio" in name and "uninstall" not in name:
            return hit
    return None


def wait_for_port_listening(port: int, timeout_seconds: int) -> bool:
    """Poll TCP port 127.0.0.1:<port> until it accepts a connection or times out."""
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            try:
                sock.connect(("127.0.0.1", port))
                return True
            except (ConnectionRefusedError, socket.timeout, OSError):
                time.sleep(1.0)
    return False


def launch_app(executable: Path, report: SmokeReport) -> subprocess.Popen | None:
    print(f"[smoke] launching: {executable}", flush=True)
    creationflags = 0
    if is_windows():
        # CREATE_NEW_PROCESS_GROUP avoids the launcher inheriting our console.
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    try:
        process = subprocess.Popen(
            [str(executable)],
            cwd=str(executable.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )
    except OSError as exc:
        report.add_failure(f"failed to spawn launcher: {exc}")
        return None
    report.notes.append(f"Spawned PID {process.pid}")
    return process


def http_get_json(url: str, timeout: float = 5.0) -> tuple[int, dict[str, Any] | None, dict[str, str]]:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            headers = {k.lower(): v for k, v in resp.headers.items()}
            try:
                payload = json.loads(body) if body else None
            except json.JSONDecodeError:
                payload = None
            return resp.status, payload, headers
    except urllib.error.HTTPError as exc:
        return exc.code, None, {}
    except urllib.error.URLError:
        return 0, None, {}


def http_options_cors(url: str, origin: str, timeout: float = 5.0) -> tuple[int, dict[str, str]]:
    req = urllib.request.Request(url, method="OPTIONS")
    req.add_header("Origin", origin)
    req.add_header("Access-Control-Request-Method", "GET")
    req.add_header("Access-Control-Request-Headers", "content-type")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, {k.lower(): v for k, v in exc.headers.items()}
        except Exception:
            return exc.code, {}
    except urllib.error.URLError:
        return 0, {}


def assert_health_contract(port: int, expected_version: str, report: SmokeReport) -> None:
    url = f"http://127.0.0.1:{port}/health"
    status, payload, _ = http_get_json(url, timeout=8.0)
    if status != 200 or payload is None:
        report.add_failure(
            f"/health returned status={status} payload={'present' if payload else 'missing'} (expected 200)"
        )
        return
    report.health_response = payload
    report.launch_verified = True

    actual_version = str(payload.get("version") or "").strip()
    if actual_version != expected_version:
        report.add_failure(
            f"/health.version='{actual_version}' but desktop/package.json='{expected_version}' "
            "(ISS-20260430-001 class — bundled sidecar drift)"
        )
    else:
        report.health_version_verified = True

    services = payload.get("services") or payload.get("ready_services") or {}
    missing_services: list[str] = []
    unhealthy_services: list[str] = []
    if isinstance(services, dict):
        for name in EXPECTED_SERVICES:
            entry = services.get(name)
            if entry is None:
                missing_services.append(name)
                continue
            healthy = False
            if isinstance(entry, bool):
                healthy = entry
            elif isinstance(entry, str):
                healthy = entry.lower() in {"ok", "healthy", "ready"}
            elif isinstance(entry, dict):
                status_field = entry.get("status") or entry.get("state")
                healthy = str(status_field).lower() in {"ok", "healthy", "ready"}
            if not healthy:
                unhealthy_services.append(name)
    elif isinstance(services, list):
        listed = {str(item).lower() for item in services}
        for name in EXPECTED_SERVICES:
            if name not in listed:
                missing_services.append(name)
    else:
        report.notes.append(f"/health services field has unexpected shape: {type(services).__name__}")

    if missing_services:
        report.add_failure(f"missing services in /health: {', '.join(missing_services)}")
    if unhealthy_services:
        report.add_failure(f"unhealthy services in /health: {', '.join(unhealthy_services)}")
    if not missing_services and not unhealthy_services:
        report.services_verified = True


def assert_cors_contract(port: int, report: SmokeReport) -> None:
    url = f"http://127.0.0.1:{port}/health"
    status, headers = http_options_cors(url, WEBVIEW_ORIGIN, timeout=5.0)
    report.cors_response = {"status": status, "headers": headers}
    allow_origin = headers.get("access-control-allow-origin", "")
    allowed = (
        allow_origin == WEBVIEW_ORIGIN
        or allow_origin == "*"
    )
    if status not in (200, 204):
        report.add_failure(
            f"CORS preflight returned status={status} (expected 200 or 204) for origin={WEBVIEW_ORIGIN}"
        )
        return
    if not allowed:
        report.add_failure(
            f"CORS preflight access-control-allow-origin='{allow_origin}' "
            f"does not allow {WEBVIEW_ORIGIN} (ISS-20260430-001 CORS-rejection class)"
        )
        return
    report.cors_verified = True


def terminate(process: subprocess.Popen | None) -> None:
    if process is None:
        return
    try:
        process.terminate()
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
    except Exception:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--installer-path",
        type=Path,
        help="Path to the NSIS installer .exe to test",
    )
    parser.add_argument(
        "--launch-timeout-seconds",
        type=int,
        default=DEFAULT_LAUNCH_TIMEOUT_SECONDS,
        help="Timeout for launcher exe to spawn (default: 60s)",
    )
    parser.add_argument(
        "--health-poll-seconds",
        type=int,
        default=DEFAULT_HEALTH_POLL_SECONDS,
        help="Timeout for sidecar /health to become available (default: 90s)",
    )
    parser.add_argument(
        "--smoke-port",
        type=int,
        default=DEFAULT_SMOKE_PORT,
        help=f"Port to poll for sidecar readiness (default: {DEFAULT_SMOKE_PORT})",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path to write JSON report",
    )
    parser.add_argument(
        "--skip-launch",
        action="store_true",
        help="Skip install+launch; assume sidecar already running on --smoke-port (for local dry-run)",
    )

    args = parser.parse_args()

    report = SmokeReport()
    report.started_at = utc_now_iso()
    report.runtime_port = args.smoke_port

    try:
        report.package_version = read_package_version()
        if not is_windows() and not args.skip_launch:
            report.notes.append(
                "Non-Windows host detected. Real packaged-app smoke requires Windows; "
                "use --skip-launch to dry-run against an already-running sidecar."
            )
            print("[smoke] non-Windows host without --skip-launch — aborting", flush=True)
            report.status = "SETUP_ERROR"
            return EXIT_SETUP_ERROR

        process: subprocess.Popen | None = None
        install_dir = None
        try:
            if not args.skip_launch:
                if args.installer_path is None:
                    print(
                        "[smoke] --installer-path required unless --skip-launch is set",
                        flush=True,
                    )
                    report.status = "SETUP_ERROR"
                    return EXIT_SETUP_ERROR
                report.installer_path = str(args.installer_path)
                install_dir = Path(os.environ.get("TEMP", "/tmp")) / f"niko-smoke-{int(time.time())}"
                silent_install(args.installer_path.resolve(), install_dir, report)
                executable = find_installed_executable(install_dir)
                if executable is None:
                    report.add_failure("could not locate installed launcher exe")
                    report.status = "SETUP_ERROR"
                    return EXIT_SETUP_ERROR
                process = launch_app(executable, report)
                if process is None:
                    report.status = "SETUP_ERROR"
                    return EXIT_SETUP_ERROR

            print(
                f"[smoke] waiting up to {args.health_poll_seconds}s for sidecar to bind 127.0.0.1:{args.smoke_port}",
                flush=True,
            )
            ready = wait_for_port_listening(args.smoke_port, args.health_poll_seconds)
            if not ready:
                report.add_failure(
                    f"sidecar did not bind 127.0.0.1:{args.smoke_port} within {args.health_poll_seconds}s"
                )
            else:
                report.launch_verified = True
                assert_health_contract(args.smoke_port, report.package_version, report)
                assert_cors_contract(args.smoke_port, report)

        finally:
            terminate(process)

        report.status = "PASS" if not report.failures else "FAIL"
        report.finished_at = utc_now_iso()

        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(report.to_json(), encoding="utf-8")

        print("\n=== Packaged-App Smoke Report ===")
        print(report.to_json())

        if report.status == "PASS":
            return EXIT_PASS
        return EXIT_CONTRACT_FAIL

    except SystemExit:
        report.finished_at = utc_now_iso()
        report.status = "SETUP_ERROR"
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(report.to_json(), encoding="utf-8")
        raise
    except Exception as exc:  # noqa: BLE001
        report.add_failure(f"unexpected error: {type(exc).__name__}: {exc}")
        report.status = "SETUP_ERROR"
        report.finished_at = utc_now_iso()
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(report.to_json(), encoding="utf-8")
        print(f"\n[smoke] {type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_SETUP_ERROR


if __name__ == "__main__":
    sys.exit(main())

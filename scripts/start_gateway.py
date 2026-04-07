#!/usr/bin/env python
"""
Niko-Studio MCP Gateway launcher.

Current authority model:
- Start the authoritative Node/TypeScript gateway runtime by default
- Keep Python runtime as explicit legacy compatibility fallback only
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LEGACY_PY_GATEWAY = PROJECT_ROOT / "src" / "mcp" / "gateway.py"
NODE_GATEWAY_LAUNCHER = PROJECT_ROOT / "desktop" / "src-tauri" / "bin" / "niko-gateway-node"


def _node_cmd() -> str:
    return "node.exe" if sys.platform.startswith("win") else "node"


def _resolve_runtime(runtime_arg: str) -> str:
    if runtime_arg != "auto":
        return runtime_arg
    env_runtime = os.getenv("NIKO_GATEWAY_RUNTIME", "").strip().lower()
    if env_runtime in {"node", "python"}:
        return env_runtime
    return "node"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Start Niko-Studio MCP Gateway",
        epilog=(
            "Default runtime is the authoritative Node/TypeScript path. "
            "Python runtime is explicit legacy compatibility mode and may be unavailable."
        ),
    )
    parser.add_argument("--host", default=None, help="Host to bind (default: gateway default)")
    parser.add_argument("--port", type=int, default=None, help="Port to bind (default: gateway default)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (legacy python runtime only)")
    parser.add_argument("--log-level", default="info", help="Log level (legacy python runtime only)")
    parser.add_argument("--env", choices=["development", "production"], default=None, help="Runtime env override")
    parser.add_argument("--config", default=None, help="Config file path override")
    parser.add_argument(
        "--runtime",
        choices=["auto", "node", "python"],
        default="auto",
        help="Gateway runtime (default: auto -> node; python = compatibility-only override)",
    )
    return parser


def _run_node_gateway(args: argparse.Namespace) -> int:
    env = os.environ.copy()
    if args.env:
        env["NIKO_ENV"] = args.env
    if args.config:
        env["NIKO_CONFIG_PATH"] = args.config
    if args.host:
        env["NIKO_GATEWAY_HOST"] = str(args.host)
    if args.port:
        env["NIKO_GATEWAY_PORT"] = str(args.port)
    env["NIKO_GATEWAY_RUNTIME"] = "node"

    if args.reload:
        print("WARN: Node runtime does not support --reload in this launcher; flag ignored.")
    if args.log_level and args.log_level.lower() != "info":
        print("WARN: Node runtime log-level is managed by the TS gateway; --log-level is ignored here.")

    if not NODE_GATEWAY_LAUNCHER.exists():
        print("ERROR: Node gateway launcher is unavailable in this checkout.")
        print(f"   Missing: {NODE_GATEWAY_LAUNCHER}")
        return 2

    cmd = [_node_cmd(), str(NODE_GATEWAY_LAUNCHER)]

    print("INFO: Starting authoritative Node/TypeScript gateway runtime")
    print("   Command:", " ".join(cmd))
    result = subprocess.run(cmd, cwd=str(PROJECT_ROOT), env=env, check=False)
    return result.returncode


def _run_legacy_python_gateway(args: argparse.Namespace) -> int:
    if not LEGACY_PY_GATEWAY.exists():
        print("ERROR: Legacy Python runtime is unavailable in this checkout.")
        print(f"   Missing: {LEGACY_PY_GATEWAY}")
        print("   This checkout is Node-first and does not include legacy Python gateway sources by default.")
        print("   Use default Node runtime: python scripts/start_gateway.py [--host ... --port ...]")
        print("   Keep '--runtime python' only for compatibility branches that restore legacy sources.")
        return 2

    # Import only when legacy path exists.
    sys.path.insert(0, str(PROJECT_ROOT))
    try:
        import uvicorn
        from src.config import ensure_environment, get_config_value, init_config
    except ImportError as exc:
        print(f"ERROR: Legacy Python runtime dependency missing: {exc}")
        print("   For current migration baseline, use '--runtime node'.")
        return 1

    if args.env:
        os.environ["NIKO_ENV"] = args.env

    env_flag = str(os.getenv("NIKO_ENV", "")).lower()
    is_production_flag = env_flag in {"prod", "production"}
    default_prod_config = PROJECT_ROOT / "config" / "niko-studio.production.yaml"

    config_path = args.config or os.getenv("NIKO_CONFIG_PATH")
    if not config_path and is_production_flag and default_prod_config.exists():
        config_path = str(default_prod_config)

    init_config(config_path=config_path, hot_reload=False)
    ensure_environment(strict=False)

    host = str(args.host or get_config_value("gateway.host", "0.0.0.0"))
    port = int(args.port or get_config_value("gateway.port", 8000))

    env = str(get_config_value("env", "development")).lower()
    is_production = env in {"prod", "production"}

    if args.reload and is_production:
        print("WARN: --reload is ignored in production.")
    reload_enabled = bool(args.reload and not is_production)

    print("WARN: Starting legacy Python gateway compatibility runtime")
    print("      This path is not the authoritative default in this checkout.")
    uvicorn.run(
        "src.mcp.gateway:app",
        host=host,
        port=port,
        reload=reload_enabled,
        log_level=args.log_level,
    )
    return 0


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    runtime = _resolve_runtime(args.runtime)
    if runtime == "python" and args.runtime == "auto" and not LEGACY_PY_GATEWAY.exists():
        print("WARN: auto runtime resolved to python via NIKO_GATEWAY_RUNTIME, but legacy Python source is missing.")
        print("      Falling back to node runtime.")
        runtime = "node"

    if runtime == "python":
        exit_code = _run_legacy_python_gateway(args)
    else:
        exit_code = _run_node_gateway(args)

    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()

"""Gateway sidecar entry point.

This module is intended to be frozen into a standalone executable (PyInstaller)
and launched by the Desktop (Tauri) app as a sidecar.

Runtime contract (read from environment):
- NIKO_GATEWAY_HOST (default: 127.0.0.1)
- NIKO_GATEWAY_PORT (default: 8000)
- NIKO_GATEWAY_RELOAD (ignored; always disabled)
- NIKO_ENV (default: development)
- NIKO_CORS_DEV_ORIGINS (optional)
- NIKO_SKILLS_DIR (optional; points to bundled skills directory)

Important:
- reload is always forced OFF for sidecar (PyInstaller friendliness + stability).
"""

from __future__ import annotations

import os


def _get_env_str(key: str, default: str) -> str:
    value = os.getenv(key)
    if value is None:
        return default
    trimmed = str(value).strip()
    return trimmed if trimmed else default


def _get_env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None:
        return default
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default


def main() -> None:
    host = _get_env_str("NIKO_GATEWAY_HOST", "127.0.0.1")
    port = _get_env_int("NIKO_GATEWAY_PORT", 8000)

    # Sidecar policy: always dev env but reload disabled.
    os.environ.setdefault("NIKO_ENV", "development")
    os.environ["NIKO_GATEWAY_RELOAD"] = "0"

    # Default dev CORS (Desktop + dev server).
    os.environ.setdefault(
        "NIKO_CORS_DEV_ORIGINS",
        "tauri://localhost,http://localhost:5173",
    )

    import uvicorn

    # Import app object directly (more PyInstaller-friendly than import-string)
    from src.mcp.gateway import app

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()

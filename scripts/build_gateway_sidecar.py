"""Build legacy Python gateway sidecar executable using PyInstaller.

This script is for explicit Python compatibility fallback only.
The default runtime/build path is Node/TypeScript.

Output layout (chosen to match Tauri bundle.externalBin conventions):
- desktop/src-tauri/bin/
  - niko-gateway.exe (Windows)
  - niko-gateway (macOS/Linux)

Notes:
- Tauri can pick platform-specific files using the pattern:
  binary-name{-target-triple}{.exe}
  but for local dev we place the plain name as well.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_LEGACY_ENTRY = Path("src/mcp/sidecar_entry.py")


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _is_windows() -> bool:
    return platform.system().lower() == "windows"


def _target_triple() -> str:
    machine = platform.machine().lower()
    if machine in {"amd64", "x86_64"}:
        arch = "x86_64"
    elif machine in {"arm64", "aarch64"}:
        arch = "aarch64"
    else:
        # Fallback: assume x86_64 on Windows.
        arch = "x86_64"

    if _is_windows():
        return f"{arch}-pc-windows-msvc"
    # For non-Windows, we keep producing the plain name only.
    return ""


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build legacy Python gateway sidecar (compatibility fallback mode).",
    )
    parser.add_argument(
        "--legacy-entry",
        default=os.getenv("NIKO_LEGACY_SIDECAR_ENTRY", str(DEFAULT_LEGACY_ENTRY)),
        help=(
            "Legacy Python entry script path "
            "(default: src/mcp/sidecar_entry.py or NIKO_LEGACY_SIDECAR_ENTRY)"
        ),
    )
    return parser


def _resolve_legacy_entry(root: Path, entry_arg: str) -> Path:
    candidate = Path(entry_arg)
    if not candidate.is_absolute():
        candidate = root / candidate
    return candidate.resolve()


def main() -> None:
    args = _build_parser().parse_args()
    root = _project_root()

    # Ensure project root is importable for PyInstaller analysis.
    env = os.environ.copy()
    env["PYTHONPATH"] = str(root) + (
        os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
    )

    entry = _resolve_legacy_entry(root, args.legacy_entry)
    if not entry.exists():
        raise SystemExit(
            "Legacy Python sidecar fallback is unavailable in this checkout.\n"
            f"Missing legacy entry: {entry}\n"
            "Use Node sidecar as default: npm --prefix desktop run build:sidecar\n"
            "Python fallback is compatibility-only. If needed, restore legacy source "
            "or pass --legacy-entry <path>."
        )

    out_dir = root / "desktop" / "src-tauri" / "bin"
    out_dir.mkdir(parents=True, exist_ok=True)

    name = "niko-gateway"

    # Clean previous artifacts (best effort)
    build_dir = root / ".build" / "pyinstaller" / name
    dist_dir = build_dir / "dist"
    work_dir = build_dir / "build"

    if build_dir.exists():
        shutil.rmtree(build_dir)
    build_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        name,
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(build_dir),
        str(entry),
    ]

    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True, env=env, cwd=str(root))

    produced = dist_dir / (f"{name}.exe" if _is_windows() else name)
    if not produced.exists():
        raise SystemExit(f"PyInstaller output not found: {produced}")

    target = out_dir / produced.name
    shutil.copy2(produced, target)

    # Also emit the target-triple variant so Tauri can pick the right binary in bundle.externalBin.
    triple = _target_triple()
    if triple and _is_windows():
        triple_name = f"{name}-{triple}.exe"
        triple_target = out_dir / triple_name
        shutil.copy2(produced, triple_target)

    print(f"Sidecar built: {target}")


if __name__ == "__main__":
    main()

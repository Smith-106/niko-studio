#!/usr/bin/env bash
# NOTE: The shebang above is intentionally set to bash to avoid macOS gatekeeper
# shebang resolution oddities when executed via a .app bundle. This script will be
# executed by the chosen Python interpreter from start_backend.sh using:
#   exec "$PYTHON_STANDALONE" "$STARTUP_SCRIPT"
# So the shebang here is irrelevant for runtime but must not point to a
# non-existent relocatable path on user machines.
# The actual Python code starts after the __PYTHON_CODE__ marker.
"""
This file embeds Python code but is launched by an external Python interpreter.
"""

__PYTHON_CODE__ = True
#!/usr/bin/env python3
# Note: This Python block is run by the embedded interpreter selected in the shell script
"""Standalone backend startup script for bundled application."""

# OPTIMIZATION: Import only bare minimum first, defer heavy imports
import sys
import os
from pathlib import Path

# Early output to show progress (before heavy imports)
print("Initializing Nowledge Graph backend...")

# On Windows, configure UTF-8 encoding before any logging/printing to handle emojis
if sys.platform == "win32":
    # Set environment variable for UTF-8 encoding
    os.environ["PYTHONIOENCODING"] = "utf-8"
    # Reconfigure stdout/stderr if possible (Python 3.7+)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore

bundle_dir = Path(__file__).parent
app_dir = bundle_dir / "app"
venv_dir = app_dir / ".venv"

# Prefer bundled cloudflared for one-click secure remote access.
if "NOWLEDGE_CLOUDFLARED_PATH" not in os.environ:
    cloudflared_candidates = (
        bundle_dir / "cloudflared",
        bundle_dir / "cloudflared.exe",
        bundle_dir / "bin" / "cloudflared",
        bundle_dir / "bin" / "cloudflared.exe",
    )
    for candidate in cloudflared_candidates:
        if candidate.is_file() and (
            os.access(candidate, os.X_OK) or candidate.suffix.lower() == ".exe"
        ):
            os.environ["NOWLEDGE_CLOUDFLARED_PATH"] = str(candidate)
            print(f"Using bundled cloudflared: {candidate}")
            break

# Change working directory to app directory for relative paths
try:
    os.chdir(app_dir)
    print(f"Changed working directory to: {app_dir}")
except Exception as e:
    print(f"⚠️ Failed to chdir to app dir {app_dir}: {e}")

# NOW import remaining modules (after showing we're alive)
import site
import signal
import time
import socket
import subprocess
import platform
import asyncio
from typing import List, Any, Optional

# Try to import psutil for advanced process management (deferred - heavy import)
HAS_PSUTIL = False
try:
    import psutil  # type: ignore

    HAS_PSUTIL = True  # type: ignore
except ImportError:
    pass


# Add site-packages dynamically for the embedded venv if present (robust to minor version)
def add_dynamic_site_packages(base: Path) -> None:
    """Add site-packages from a Python installation directory.

    Handles both Unix-style (lib/python3.*/site-packages) and Windows-style (Lib/site-packages) layouts.

    OPTIMIZATION: Try direct paths first to avoid slow glob() on Windows.
    """
    # OPTIMIZATION 1: Try Windows direct path first (most common in production)
    if sys.platform.startswith("win"):
        lib_dir_windows = base / "Lib" / "site-packages"
        if lib_dir_windows.exists():
            site.addsitedir(str(lib_dir_windows))
            print(f"Added Windows site-packages: {lib_dir_windows}")
            return

    # OPTIMIZATION 2: Try Python 3.13 direct path (current version, avoid glob)
    python_313_sp = base / "lib" / "python3.13" / "site-packages"
    if python_313_sp.exists():
        site.addsitedir(str(python_313_sp))
        print(f"Added site-packages: {python_313_sp}")
        return

    # Fallback: glob for other Python versions (slower but handles version changes)
    lib_dir = base / "lib"
    if lib_dir.exists():
        for p in lib_dir.glob("python3.*"):
            if p.is_dir():
                sp = p / "site-packages"
                if sp.exists():
                    site.addsitedir(str(sp))
                    print(f"Added site-packages: {sp}")
                    return

    # Legacy fallback: direct site-packages in lib
    if lib_dir.exists():
        sp = lib_dir / "site-packages"
        if sp.exists():
            site.addsitedir(str(sp))
            print(f"Added direct site-packages: {sp}")


add_dynamic_site_packages(venv_dir)

# Also add standalone Python's site-packages (when using --prefix installation)
python_root_dir = bundle_dir / "python"
if python_root_dir.exists():
    add_dynamic_site_packages(python_root_dir)

# Add the bundled source to Python path
sys.path.insert(0, str(app_dir / "src"))


def check_and_upgrade_database():
    """Check if database needs version upgrade and perform it."""
    print("🔍 Checking database version...", flush=True)

    try:
        # OPTIMIZATION: Import only lightweight version manager first (no Pydantic)
        # This allows fast path for already-upgraded databases (most common case)
        print("  → Getting database path...", flush=True)
        from nowledge_graph_server.database.version_upgrade.db_version_manager import (
            get_db_path,
            get_db_version,
            get_db_path_for_version,
            CURRENT_DB_VERSION,
        )

        db_path = get_db_path()  # Get current DB path
        print(f"  → Database path: {db_path}", flush=True)

        # IMPORTANT: Always set NOWLEDGE_DB_PATH to ensure config uses correct database
        # This is needed even when no upgrade happens (already on v1)
        os.environ["NOWLEDGE_DB_PATH"] = str(db_path)
        print(f"  → Set NOWLEDGE_DB_PATH={db_path}", flush=True)

        # Handle fresh database initialization
        if not db_path.exists():
            print("✓ No existing database found (fresh install)", flush=True)

            # IMPORTANT: For fresh installs, use v1 database path directly
            # This ensures we create nowledge_graph_v1.db instead of nowledge_graph.db
            v1_db_path = get_db_path_for_version(db_path, 1)  # Force v1 path

            os.environ["NOWLEDGE_DB_PATH"] = str(v1_db_path)
            print(
                f"  → Set NOWLEDGE_DB_PATH={v1_db_path} (fresh v1 database)", flush=True
            )

            # The database will be created by the main app initialization
            # After it's created, we need to write the version metadata
            # This is handled in base_client.initialize()
            return

        # OPTIMIZATION: Check version before importing heavy modules
        print(f"  → Checking if upgrade needed...", flush=True)
        current_version = get_db_version(db_path)

        # Early exit if already up-to-date (most common case after first upgrade)
        # This avoids importing DbVersionUpgrader which triggers slow Pydantic import chain
        if current_version >= CURRENT_DB_VERSION:
            print(f"✓ Database version is up to date", flush=True)
            return

        # Only NOW import heavy upgrader module (triggers Pydantic import chain)
        # This is only reached when upgrade is actually needed
        print("  → Importing upgrade modules...", flush=True)
        from nowledge_graph_server.database.version_upgrade.db_upgrader import (
            DbVersionUpgrader,
        )

        print(f"  → Database exists, creating upgrader...", flush=True)
        upgrader = DbVersionUpgrader(db_path)

        # Perform the upgrade
        print(
            "📦 Database version upgrade required, starting upgrade...", flush=True
        )
        print(
            "⚠️  This may take a few minutes, please do not close the application...",
            flush=True,
        )
        print("", flush=True)

        result = upgrader.upgrade_sync()

        if result["success"]:
            print(
                f"✅ Database upgraded successfully to v{upgrader.CURRENT_VERSION}",
                flush=True,
            )
            # Environment variable for main process to use new DB
            new_db_path_str = str(result["new_db_path"])
            os.environ["NOWLEDGE_DB_PATH"] = new_db_path_str
            print(f"   New database: {new_db_path_str}", flush=True)
            print(
                f"   Backup saved: {result.get('backup_path', 'N/A')}", flush=True
            )
            print(
                f"   Set NOWLEDGE_DB_PATH={os.environ.get('NOWLEDGE_DB_PATH')}",
                flush=True,
            )
            print("", flush=True)
        else:
            print(f"❌ Database upgrade failed: {result['error']}", flush=True)
            if "failure_report_path" in result:
                print(
                    f"📄 Failure report saved to: {result['failure_report_path']}",
                    flush=True,
                )
            print("", flush=True)
            print("⚠️  CRITICAL: Database upgrade failed!", flush=True)
            print("   Your database backup is preserved at:", flush=True)
            if "backup_path" in result:
                print(f"   {result['backup_path']}", flush=True)
            print("", flush=True)
            print(
                "   The application cannot start with the old database format.",
                flush=True,
            )
            print(
                "   Please contact support or restore from backup manually.",
                flush=True,
            )
            print("", flush=True)
            # Exit - cannot continue with v0 database when using ladybug
            sys.exit(1)
    except Exception as e:
        import traceback

        print(f"⚠️  Database upgrade check failed: {e}", flush=True)
        print(f"   Traceback: {traceback.format_exc()}", flush=True)
        print("   Continuing with existing database...", flush=True)
        # Continue with existing setup


# Call database upgrade check before main application import
print("=" * 60, flush=True)
print("STARTING DATABASE UPGRADE CHECK", flush=True)
print("=" * 60, flush=True)
try:
    check_and_upgrade_database()
except Exception as e:
    import traceback

    print(f"⚠️  Unexpected error during database upgrade check: {e}", flush=True)
    print(f"   Traceback: {traceback.format_exc()}", flush=True)
    print("   Continuing with existing database...", flush=True)
print("=" * 60, flush=True)
print("DATABASE UPGRADE CHECK COMPLETE", flush=True)
print("=" * 60, flush=True)


def cleanup_orphan_processes() -> bool:
    """Clean up orphan backend processes that might be blocking the port."""
    print("🧹 Checking for orphan backend processes...")

    if HAS_PSUTIL:
        return _cleanup_with_psutil()
    else:
        return _cleanup_with_system_commands()


def _cleanup_with_psutil() -> bool:
    """Clean up processes using psutil (more precise)."""
    if not HAS_PSUTIL:
        return False

    current_pid = os.getpid()
    cleaned_count = 0
    port_freed = False
    db_freed = False

    # Get the actual database paths for this app (matches Tauri setup_user_directory logic)
    home_dir = Path.home()
    if platform.system() == "Darwin":  # macOS
        # Preferred: ~/Library/Application Support/NowledgeGraph
        preferred_db_dir = (
            home_dir / "Library" / "Application Support" / "NowledgeGraph" / "data"
        )
        # Legacy: ~/Documents/NowledgeGraph
        legacy_db_dir = home_dir / "Documents" / "NowledgeGraph" / "data"
        db_paths = [
            str(preferred_db_dir / "nowledge_graph.db"),
            str(legacy_db_dir / "nowledge_graph.db"),
        ]
    else:
        # Linux/Windows: ~/.nowledge-graph
        db_paths = [str(home_dir / ".nowledge-graph" / "data" / "nowledge_graph.db")]

    # Clean up orphaned WAL files before starting backend
    _cleanup_wal_files(db_paths)

    try:
        import psutil  # Import here to ensure type checker knows it's available

        # Find processes using our port (14242) or database
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):  # pyright: ignore[reportUnknownMemberType]
            try:
                # Skip current process
                if proc.info["pid"] == current_pid:
                    continue

                should_kill = False
                kill_reason = ""

                # Check if process is using our port (need to call net_connections() separately)
                try:
                    connections = proc.net_connections()
                    for conn in connections:
                        if (
                            hasattr(conn, "laddr")
                            and conn.laddr
                            and conn.laddr.port == 14242
                        ):
                            should_kill = True
                            kill_reason = f"using port 14242"
                            port_freed = True
                            break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass  # Process might have disappeared or no permission

                # Check if process has our database file open (need to call open_files() separately)
                if not should_kill:
                    try:
                        open_files = proc.open_files()
                        for file in open_files:
                            if hasattr(file, "path"):
                                # Check against all possible database paths
                                for db_path in db_paths:
                                    if (
                                        db_path in file.path
                                        or "nowledge_graph.db" in file.path
                                    ):
                                        should_kill = True
                                        kill_reason = f"has database lock ({file.path})"
                                        db_freed = True
                                        break
                                if should_kill:
                                    break
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass  # Process might have disappeared or no permission

                # Check for nowledge/uvicorn processes by command line
                if not should_kill:
                    cmdline = proc.info.get("cmdline", [])
                    if cmdline:
                        cmdline_str = " ".join(str(arg) for arg in cmdline)
                        # Look for nowledge-specific patterns
                        if any(
                            pattern in cmdline_str.lower()
                            for pattern in [
                                "nowledge_graph_server",
                                "fastapi_server",
                                "start_backend",
                                "nowledge-graph-py",
                            ]
                        ):
                            # Extra safety: make sure it's actually our backend
                            if any(
                                pattern in cmdline_str
                                for pattern in [
                                    "fastapi_server",
                                    "port=14242",
                                    "14242",
                                    "uvicorn",
                                    "nowledge_graph_server.fastapi_server",
                                ]
                            ):
                                should_kill = True
                                kill_reason = f"nowledge backend process"

                # Kill the process if identified
                if should_kill:
                    print(
                        f"🎯 Found orphan process: PID {proc.info['pid']} ({proc.info['name']}) - {kill_reason}"
                    )
                    try:
                        proc.terminate()
                        proc.wait(timeout=3)
                        print(f"✅ Terminated process PID {proc.info['pid']}")
                        cleaned_count += 1
                    except (
                        psutil.NoSuchProcess,
                        psutil.AccessDenied,
                        psutil.TimeoutExpired,
                    ):
                        try:
                            proc.kill()
                            print(f"🔥 Force killed process PID {proc.info['pid']}")
                            cleaned_count += 1
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            print(
                                f"⚠️ Could not kill process PID {proc.info['pid']} (may require admin)"
                            )

            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                # Process already gone or no access
                continue

    except Exception as e:
        print(f"⚠️ Error during psutil cleanup: {e}")

    if cleaned_count > 0:
        print(f"🧹 Cleaned up {cleaned_count} orphan process(es)")
        if port_freed or db_freed:
            status: List[str] = []
            if port_freed:
                status.append("port")
            if db_freed:
                status.append("database")
            print(f"⏳ Waiting for {' and '.join(status)} to be freed...")
            # Wait in a loop, probing more frequently (every 0.5s, up to 20s total)
            total_wait = 0
            wait_time = 0.5
            max_wait = 20
            while total_wait < max_wait:
                time.sleep(wait_time)
                total_wait += wait_time

                # Check if resources are actually freed
                port_still_busy = False
                db_still_busy = False

                if port_freed:
                    port_still_busy = (
                        not check_port_availability()
                    )  # Port is busy if NOT available

                if db_freed:
                    db_still_busy = _is_database_locked()

                # If all resources are freed, break early
                if not port_still_busy and not db_still_busy:
                    freed_resources: List[str] = []
                    if port_freed and not port_still_busy:
                        freed_resources.append("port")
                    if db_freed and not db_still_busy:
                        freed_resources.append("database")
                    print(
                        f"✅ {' and '.join(freed_resources)} freed after {total_wait:.1f}s"
                    )
                    break

                # Show progress every 2 seconds
                if total_wait % 2.0 == 0:
                    still_busy: List[str] = []
                    if port_still_busy:
                        still_busy.append("port")
                    if db_still_busy:
                        still_busy.append("database")
                    print(
                        f"⏳ Still waiting for {' and '.join(still_busy)} ({total_wait:.1f}s/{max_wait}s)"
                    )

            # Final check after timeout
            if total_wait >= max_wait:
                final_status: List[str] = []
                if port_freed and not check_port_availability():
                    final_status.append("port still busy")
                if db_freed and _is_database_locked():
                    final_status.append("database still locked")

                if final_status:
                    print(f"⚠️ Timeout reached: {' and '.join(final_status)}")
                else:
                    print("✅ Resources freed (detected at timeout)")
    else:
        print("✅ No orphan processes found")

    return cleaned_count > 0


def _cleanup_with_system_commands() -> bool:
    """Clean up processes using system commands (fallback)."""
    cleaned_count = 0

    try:
        # Platform-specific cleanup
        if platform.system() == "Darwin":  # macOS
            cleaned_count = _cleanup_macos()
        elif platform.system() == "Linux":
            cleaned_count = _cleanup_linux()
        elif platform.system() == "Windows":
            cleaned_count = _cleanup_windows()
        else:
            print("⚠️ Platform not supported for automatic cleanup")
            return False

    except Exception as e:
        print(f"⚠️ Error during system command cleanup: {e}")

    if cleaned_count > 0:
        print(f"🧹 Cleaned up {cleaned_count} process(es)")
        print("⏳ Waiting for port to be freed...")
        time.sleep(6)
    else:
        print("✅ No orphan processes found")

    return cleaned_count > 0


def _cleanup_macos() -> int:
    """Clean up processes on macOS."""
    cleaned_count = 0
    current_pid = str(os.getpid())

    # Get the actual database directories for macOS
    home_dir = Path.home()
    preferred_data_dir = (
        home_dir / "Library" / "Application Support" / "NowledgeGraph" / "data"
    )
    legacy_data_dir = home_dir / "Documents" / "NowledgeGraph" / "data"
    data_dirs = [str(preferred_data_dir), str(legacy_data_dir)]

    try:
        # Find processes using port 14242
        result = subprocess.run(["lsof", "-ti:14242"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split("\n")
            for pid in pids:
                if pid.strip() and pid != current_pid:
                    print(f"🎯 Found process using port 14242: PID {pid}")
                    try:
                        subprocess.run(["kill", "-TERM", pid], check=True)
                        print(f"✅ Terminated process PID {pid}")
                        cleaned_count += 1
                    except subprocess.CalledProcessError:
                        try:
                            subprocess.run(["kill", "-KILL", pid], check=True)
                            print(f"🔥 Force killed process PID {pid}")
                            cleaned_count += 1
                        except subprocess.CalledProcessError:
                            print(f"⚠️ Could not kill process PID {pid}")

        # Find processes with database files open in any of the possible data directories
        for data_dir in data_dirs:
            try:
                result = subprocess.run(
                    ["lsof", "+D", data_dir], capture_output=True, text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    lines = result.stdout.strip().split("\n")[1:]  # Skip header
                    for line in lines:
                        if "nowledge_graph.db" in line:
                            parts = line.split()
                            if len(parts) > 1:
                                pid = parts[1]
                                if pid != current_pid:
                                    print(
                                        f"🎯 Found process with database lock: PID {pid}"
                                    )
                                    try:
                                        subprocess.run(
                                            ["kill", "-TERM", pid], check=True
                                        )
                                        print(f"✅ Terminated process PID {pid}")
                                        cleaned_count += 1
                                    except subprocess.CalledProcessError:
                                        pass
            except subprocess.CalledProcessError:
                pass  # Directory might not exist yet

        # Kill nowledge-related processes by command pattern
        patterns = [
            "nowledge_graph_server",
            "fastapi_server",
            "start_backend.*nowledge",
            "uvicorn.*nowledge",
        ]

        for pattern in patterns:
            try:
                result = subprocess.run(
                    ["pgrep", "-f", pattern], capture_output=True, text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    pids = result.stdout.strip().split("\n")
                    for pid in pids:
                        if pid.strip() and pid != current_pid:
                            print(
                                f"🎯 Found nowledge process: PID {pid} (pattern: {pattern})"
                            )
                            try:
                                subprocess.run(["kill", "-TERM", pid], check=True)
                                print(f"✅ Terminated nowledge process PID {pid}")
                                cleaned_count += 1
                            except subprocess.CalledProcessError:
                                pass
            except subprocess.CalledProcessError:
                pass

    except FileNotFoundError:
        print("⚠️ lsof or pgrep not available")

    return cleaned_count


def _cleanup_linux() -> int:
    """Clean up processes on Linux."""
    cleaned_count = 0
    current_pid = str(os.getpid())

    # Get the actual database directory for Linux
    home_dir = Path.home()
    data_dir = str(home_dir / ".nowledge-graph" / "data")

    try:
        # Find processes using port 14242
        result = subprocess.run(["fuser", "14242/tcp"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split()
            for pid in pids:
                if pid.strip() and pid != current_pid:
                    print(f"🎯 Found process using port 14242: PID {pid}")
                    try:
                        subprocess.run(["kill", "-TERM", pid], check=True)
                        print(f"✅ Terminated process PID {pid}")
                        cleaned_count += 1
                    except subprocess.CalledProcessError:
                        try:
                            subprocess.run(["kill", "-KILL", pid], check=True)
                            print(f"🔥 Force killed process PID {pid}")
                            cleaned_count += 1
                        except subprocess.CalledProcessError:
                            print(f"⚠️ Could not kill process PID {pid}")

        # Find processes with database files open (Linux lsof)
        try:
            result = subprocess.run(
                ["lsof", "+D", data_dir], capture_output=True, text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                lines = result.stdout.strip().split("\n")[1:]  # Skip header
                for line in lines:
                    if "nowledge_graph.db" in line:
                        parts = line.split()
                        if len(parts) > 1:
                            pid = parts[1]
                            if pid != current_pid:
                                print(f"🎯 Found process with database lock: PID {pid}")
                                try:
                                    subprocess.run(["kill", "-TERM", pid], check=True)
                                    print(f"✅ Terminated process PID {pid}")
                                    cleaned_count += 1
                                except subprocess.CalledProcessError:
                                    pass
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass  # lsof might not be available or directory doesn't exist

        # Kill nowledge-related processes by command pattern
        patterns = [
            "nowledge_graph_server",
            "fastapi_server",
            "start_backend.*nowledge",
            "uvicorn.*nowledge",
        ]

        for pattern in patterns:
            try:
                result = subprocess.run(
                    ["pgrep", "-f", pattern], capture_output=True, text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    pids = result.stdout.strip().split("\n")
                    for pid in pids:
                        if pid.strip() and pid != current_pid:
                            print(
                                f"🎯 Found nowledge process: PID {pid} (pattern: {pattern})"
                            )
                            try:
                                subprocess.run(["kill", "-TERM", pid], check=True)
                                print(f"✅ Terminated nowledge process PID {pid}")
                                cleaned_count += 1
                            except subprocess.CalledProcessError:
                                pass
            except subprocess.CalledProcessError:
                pass

    except FileNotFoundError:
        print("⚠️ fuser or pgrep not available")

    return cleaned_count


def _cleanup_windows() -> int:
    """Clean up processes on Windows."""
    cleaned_count = 0
    current_pid = str(os.getpid())

    try:
        # Find processes using port 14242
        result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.split("\n")
            for line in lines:
                if ":14242" in line and "LISTENING" in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1].strip()
                        if pid != current_pid:
                            print(f"🎯 Found process using port 14242: PID {pid}")
                            try:
                                subprocess.run(
                                    ["taskkill", "/F", "/PID", pid], check=True
                                )
                                print(f"✅ Terminated process PID {pid}")
                                cleaned_count += 1
                            except subprocess.CalledProcessError:
                                print(f"⚠️ Could not kill process PID {pid}")

        # Find Python processes with nowledge-related command lines
        result = subprocess.run(
            [
                "wmic",
                "process",
                "where",
                "name='python.exe'",
                "get",
                "processid,commandline",
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            lines = result.stdout.split("\n")
            in_header = True
            for line in lines:
                if in_header:
                    if "CommandLine" in line:
                        in_header = False
                    continue

                if any(
                    keyword in line.lower()
                    for keyword in [
                        "nowledge_graph_server",
                        "fastapi_server",
                        "start_backend",
                        "uvicorn",
                        "14242",
                    ]
                ):
                    # Extract PID (last column before CommandLine)
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        try:
                            pid = parts[-1].strip()
                            if pid != current_pid and pid.isdigit():
                                print(f"🎯 Found nowledge Python process: PID {pid}")
                                try:
                                    subprocess.run(
                                        ["taskkill", "/F", "/PID", pid], check=True
                                    )
                                    print(f"✅ Terminated nowledge process PID {pid}")
                                    cleaned_count += 1
                                except subprocess.CalledProcessError:
                                    print(f"⚠️ Could not kill process PID {pid}")
                        except (ValueError, IndexError):
                            pass

        # Fallback: Use tasklist if wmic fails
        if cleaned_count == 0:
            result = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq python.exe", "/FO", "CSV"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                # Note: tasklist doesn't show command line, so we'll kill all Python processes
                # This is less precise but works as fallback
                print("⚠️ Using fallback cleanup (may affect other Python processes)")

    except FileNotFoundError:
        print("⚠️ Windows process tools not available")

    return cleaned_count


def check_port_availability() -> bool:
    """Check if port 14242 is available."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 14242))
            return True
    except OSError:
        return False


def find_process_using_port(port: int = 14242) -> Optional[int]:
    """Find and display process using the specified port."""
    try:
        if HAS_PSUTIL:
            for proc in psutil.process_iter(["pid", "name", "cmdline"]):  # type: ignore
                try:
                    for conn in proc.net_connections():
                        if (
                            hasattr(conn, "laddr")
                            and conn.laddr
                            and conn.laddr.port == port
                        ):
                            cmdline = " ".join(proc.info.get("cmdline", []))
                            print(
                                f"🔍 Process using port {port}: PID {proc.info['pid']} ({proc.info['name']})"
                            )
                            print(f"    Command: {cmdline}")
                            return proc.info["pid"]
                except (psutil.NoSuchProcess, psutil.AccessDenied):  # type: ignore
                    continue
        else:
            # Fallback to system commands
            if platform.system() == "Darwin":  # macOS
                result = subprocess.run(
                    ["lsof", "-ti:14242"], capture_output=True, text=True
                )
                if result.returncode == 0 and result.stdout.strip():
                    pid = result.stdout.strip().split("\n")[0]
                    print(f"🔍 Process using port {port}: PID {pid}")
                    return int(pid)
    except Exception as e:
        print(f"⚠️ Error finding process using port {port}: {e}")

    return None


def _cleanup_wal_files(db_paths: List[str]) -> None:
    """Clean up orphaned WAL files that may cause database corruption."""
    try:
        cleaned_count = 0
        for db_path_str in db_paths:
            db_path = Path(db_path_str)
            if not db_path.parent.exists():
                continue

            # Look for WAL files matching the database name
            wal_pattern = f"{db_path.name}.wal*"
            wal_files = list(db_path.parent.glob(wal_pattern))

            if wal_files:
                print(
                    f"🧹 Found {len(wal_files)} orphaned WAL file(s) for {db_path.name}"
                )
                for wal_file in wal_files:
                    try:
                        wal_file.unlink()
                        print(f"   ✅ Deleted: {wal_file.name}")
                        cleaned_count += 1
                    except Exception as e:
                        print(f"   ❌ Failed to delete {wal_file.name}: {e}")

        if cleaned_count > 0:
            print(f"🧹 WAL cleanup completed: removed {cleaned_count} file(s)")
        else:
            print("✅ No orphaned WAL files found")

    except Exception as e:
        print(f"⚠️ WAL cleanup failed (non-critical): {e}")


def _is_database_locked() -> bool:
    """Check if the KuzuDB database is locked by checking for the lock file."""
    from pathlib import Path

    lock_file = (
        Path.home()
        / "Library"
        / "Application Support"
        / "NowledgeGraph"
        / "nowledge_graph.db.lock"
    )
    return lock_file.exists()


# Set up environment for bundled mode
os.environ["PYTHONPATH"] = str(app_dir / "src")

# Ensure embedded runtime is correctly configured when present
python_root_dir = bundle_dir / "python"
python_lib_dir = python_root_dir / "lib"
if python_root_dir.exists():
    # Set PYTHONHOME so the interpreter finds stdlib (fixes 'encodings' error)
    os.environ["PYTHONHOME"] = str(python_root_dir)
    # Add shared lib path for embedded runtime
    if sys.platform.startswith("darwin"):
        dyld_path = os.environ.get("DYLD_LIBRARY_PATH", "")
        os.environ["DYLD_LIBRARY_PATH"] = f"{python_lib_dir}:{dyld_path}"
    elif sys.platform.startswith("linux"):
        ld_path = os.environ.get("LD_LIBRARY_PATH", "")
        os.environ["LD_LIBRARY_PATH"] = f"{python_lib_dir}:{ld_path}"
    print(f"Set library path: {python_lib_dir}")
    print(f"Set PYTHONHOME: {os.environ['PYTHONHOME']}")

# Import and run the FastAPI app
if __name__ == "__main__":
    try:
        # OPTIMIZATION: Skip Python cleanup - Rust/Tauri already does comprehensive cleanup
        # before spawning this process, so this is redundant and wastes 0.5-1 second
        # Only do cleanup if explicitly needed (when NOWLEDGE_FORCE_CLEANUP env var is set)
        if os.environ.get("NOWLEDGE_FORCE_CLEANUP"):
            print("🧹 Force cleanup requested via environment variable...")
            cleanup_orphan_processes()

        # Step 1: Import and start the server
        # Note: We don't pre-check port availability because:
        # 1. Tauri already killed old processes and waited 3s for port release
        # 2. Python takes ~20s for database checks before reaching here
        # 3. By this point (23+ seconds after cleanup), port should definitely be free
        # 4. If port is still blocked, it's a real problem and uvicorn will give clear error
        import uvicorn  # type: ignore
        from nowledge_graph_server.fastapi_server import app  # type: ignore

        print("🚀 Starting Nowledge Graph backend...")
        print(f"📂 Bundle directory: {bundle_dir}")
        print(f"📦 App directory: {app_dir}")
        print(f"🐍 Python path: {sys.executable}")
        print(f"🔧 Working directory: {os.getcwd()}")
        print(f"📚 Python sys.path contains {len(sys.path)} entries")

        # Step 4: Set up graceful shutdown handling
        shutdown_initiated = False

        def signal_handler(signum: int, frame: Any) -> None:
            global shutdown_initiated
            if shutdown_initiated:
                print(f"\n🔥 Received signal {signum} again, forcing immediate exit...")
                os._exit(1)  # Force exit if graceful shutdown is taking too long

            shutdown_initiated = True
            print(f"\n🛑 Received signal {signum}, shutting down gracefully...")

            # Try to close any active MCP connections
            try:
                # Handle asyncio cleanup safely using getattr for compatibility
                try:
                    # Try to get the current running loop using getattr to avoid Pylance issues
                    get_running_loop = getattr(asyncio, "get_running_loop", None)
                    if get_running_loop:
                        loop = get_running_loop()
                        # Cancel all running tasks
                        all_tasks = getattr(asyncio, "all_tasks", None)
                        if all_tasks:
                            tasks = all_tasks(loop)
                            cancelled_count = 0
                            for task in tasks:
                                if not task.done():
                                    task.cancel()
                                    cancelled_count += 1
                            print(
                                f"📡 Cancelled {cancelled_count} active tasks (including MCP connections)"
                            )
                        else:
                            print("📡 asyncio.all_tasks not available")
                    else:
                        print("📡 asyncio.get_running_loop not available")
                except RuntimeError:
                    # No running loop, nothing to clean up
                    print("📡 No running event loop to clean up")
            except Exception as e:
                print(f"⚠️ Error during task cleanup: {e}")

            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Step 5: Start the server with improved shutdown handling
        # Advanced: allow binding to all interfaces for CLI/LAN use.
        # Default remains localhost for safety.
        bind_host = os.environ.get("NOWLEDGE_BACKEND_HOST", "127.0.0.1").strip() or "127.0.0.1"
        if bind_host not in ("127.0.0.1", "0.0.0.0"):
            print(
                f"⚠️ Invalid NOWLEDGE_BACKEND_HOST={bind_host!r}; falling back to 127.0.0.1",
                flush=True,
            )
            bind_host = "127.0.0.1"
        print(f"🌐 Binding backend host: {bind_host}", flush=True)

        uvicorn.run(
            app,
            host=bind_host,
            port=14242,
            log_level="info",
            workers=1,  # Single worker for desktop app
            loop="asyncio",  # Explicit async loop
            access_log=False,  # Reduce noise
            # Improved shutdown handling for MCP connections
            timeout_keep_alive=5,  # Shorter keep-alive timeout
            timeout_graceful_shutdown=3,  # Faster graceful shutdown
            limit_max_requests=None,  # No request limit
            limit_concurrency=100,  # Reasonable concurrency limit
        )
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("🔍 Available packages:")
        try:
            import pkg_resources

            for pkg in pkg_resources.working_set:
                print(f"  - {pkg.project_name} {pkg.version}")
        except ImportError:
            print("  pkg_resources not available")
        sys.exit(1)

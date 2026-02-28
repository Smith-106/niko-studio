"""Database version upgrader orchestrator.

Handles the complete upgrade process from v0 (alpine) to v1 (birch) including:
- Backup creation
- Export via subprocess
- Import via subprocess
- Verification
- Atomic version swap
- Error reporting
"""

import sys
import os
import json
import shutil
import subprocess
import platform
from pathlib import Path
from typing import Dict, Any
from datetime import datetime, timezone
import structlog

from .db_version_manager import (
    get_db_version,
    set_db_version,
    get_db_path_for_version,
    CURRENT_DB_VERSION,
    CODENAMES,
)

logger = structlog.get_logger(__name__)


class DbVersionUpgrader:
    """Orchestrates database version upgrades between engine versions."""

    CURRENT_VERSION = CURRENT_DB_VERSION  # Target version for this release
    UPGRADE_TIMEOUT = 600  # 10 minutes for large databases

    def __init__(self, db_path: Path):
        """
        Initialize upgrader with database path.

        Args:
            db_path: Path to current database file
        """
        self.db_path = Path(db_path)
        self.current_version = get_db_version(self.db_path)

    def needs_upgrade(self) -> bool:
        """
        Check if database needs version upgrade (async version).

        Returns:
            True if upgrade is needed
        """
        # Only upgrade if DB exists
        if not self.db_path.exists():
            return False

        return self.current_version < self.CURRENT_VERSION  # type: ignore[operator]

    def needs_upgrade_sync(self) -> bool:
        """
        Synchronous version of needs_upgrade for use in startup scripts.

        Returns:
            True if upgrade is needed
        """
        return self.needs_upgrade()

    def upgrade_sync(self) -> Dict[str, Any]:
        """
        Perform database version upgrade synchronously.

        This is the main entry point for the upgrade process.

        Upgrade paths:
        - v0 -> v1: Full export/import (engine change: kuzu -> real_ladybug)
        - v1 -> v2: In-place upgrade (schema migration, no engine change)

        Returns:
            {
                "success": bool,
                "new_db_path": Path (if successful),
                "error": str (if failed),
                "error_code": str (if failed),
                "failure_report_path": Path (if failed)
            }
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = None

        try:
            logger.info(
                "Starting database version upgrade",
                from_version=self.current_version,
                from_codename=CODENAMES.get(self.current_version, "unknown"),
                to_version=self.CURRENT_VERSION,
                to_codename=CODENAMES.get(self.CURRENT_VERSION, "unknown"),
                db_path=str(self.db_path),
            )

            # Route to appropriate upgrade path based on version
            if self.current_version == 0:
                # v0 -> v1+: Full export/import (engine change)
                return self._upgrade_v0_to_v1_sync(timestamp)
            elif self.current_version == 1:
                # v1 -> v2: In-place schema migration
                return self._upgrade_v1_to_v2_sync(timestamp)
            else:
                # Unknown version
                return {
                    "success": False,
                    "error": f"Unknown database version: {self.current_version}",
                    "error_code": "UPGRADE_UNKNOWN_VERSION",
                }

        except Exception as e:
            logger.error("Upgrade failed with unexpected error", error=str(e))
            failure_report = self._create_failure_report(
                timestamp,
                "unexpected",
                {"error": str(e), "error_type": type(e).__name__},
            )
            return {
                "success": False,
                "error": str(e),
                "error_code": "UPGRADE_UNEXPECTED_ERROR",
                "failure_report_path": failure_report,
                "backup_path": backup_path,
            }

    def _upgrade_v1_to_v2_sync(self, timestamp: str) -> Dict[str, Any]:
        """
        Upgrade from v1 (birch) to v2 (cedar) in-place.

        v1 -> v2 is a schema-only upgrade:
        - Kuzu vector/FTS indexes are deprecated (now using LanceDB)
        - The indexes remain but won't be recreated on new databases
        - Version metadata is updated to v2
        - Database file is renamed from _v1.db to _v2.db

        No export/import needed since we're not changing the database engine.
        """
        logger.info("Starting v1 -> v2 in-place upgrade")

        # Step 1: Create backup
        backup_path = self._create_backup(timestamp)
        logger.info("Backup created", backup_path=str(backup_path))

        try:
            # Step 2: The schema migrations will be applied by the migration manager
            # when the database is opened. We just need to update the version metadata.
            # Note: Migrations are applied automatically by KuzuClient.initialize()

            # Step 3: Create v2 database path
            new_db_path = get_db_path_for_version(
                self.db_path.parent / "nowledge_graph.db", 2
            )

            # Step 4: Move/rename database from v1 to v2
            rename_success = False
            if self.db_path != new_db_path:
                logger.info(
                    "Renaming database file",
                    from_path=str(self.db_path),
                    to_path=str(new_db_path),
                )
                try:
                    if self.db_path.is_dir():
                        shutil.move(str(self.db_path), str(new_db_path))
                    else:
                        shutil.move(str(self.db_path), str(new_db_path))

                    # Verify the move succeeded
                    if new_db_path.exists() and not self.db_path.exists():
                        rename_success = True
                        logger.info(
                            "Database file renamed successfully",
                            from_path=str(self.db_path),
                            to_path=str(new_db_path),
                        )
                    else:
                        # Move claimed to succeed but files don't match expected state
                        logger.error(
                            "Database rename verification failed",
                            old_exists=self.db_path.exists(),
                            new_exists=new_db_path.exists(),
                        )
                        raise RuntimeError(
                            f"Database rename failed: old file still exists at {self.db_path}"
                        )
                except PermissionError as pe:
                    logger.error(
                        "Permission denied when renaming database - file may be in use",
                        error=str(pe),
                        from_path=str(self.db_path),
                    )
                    raise RuntimeError(
                        f"Cannot rename database file (may be in use by another process): {pe}"
                    )
                except OSError as oe:
                    logger.error(
                        "OS error when renaming database",
                        error=str(oe),
                        from_path=str(self.db_path),
                    )
                    raise
            else:
                # Paths are same (shouldn't happen, but handle it)
                rename_success = True
                new_db_path = self.db_path

            # Step 5: Update version metadata ONLY after rename succeeds
            if not rename_success:
                raise RuntimeError("Database rename did not complete successfully")

            set_db_version(
                new_db_path,
                2,
                app_version="0.6.0",
                additional_metadata={
                    "upgraded_from_version": 1,
                    "upgraded_from_codename": "birch",
                    "backup_path": str(backup_path),
                    "lancedb_migration": True,
                    "lancedb_index_built": False,  # Will be set to True after first reindex
                },
            )

            # Step 6: Update environment variable for this process
            os.environ["NOWLEDGE_DB_PATH"] = str(new_db_path)
            logger.info(
                "Updated NOWLEDGE_DB_PATH environment variable",
                new_path=str(new_db_path),
            )

            logger.info(
                "v1 -> v2 upgrade completed successfully",
                new_db_path=str(new_db_path),
                backup_path=str(backup_path),
            )

            return {
                "success": True,
                "new_db_path": new_db_path,
                "backup_path": backup_path,
            }

        except Exception as e:
            logger.error("v1 -> v2 upgrade failed", error=str(e))
            failure_report = self._create_failure_report(
                timestamp,
                "v1_to_v2_upgrade",
                {"error": str(e), "error_type": type(e).__name__},
            )
            return {
                "success": False,
                "error": str(e),
                "error_code": "UPGRADE_V1_TO_V2_FAILED",
                "failure_report_path": failure_report,
                "backup_path": backup_path,
            }

    def _upgrade_v0_to_v1_sync(self, timestamp: str) -> Dict[str, Any]:
        """
        Upgrade from v0 (alpine) to v1 (birch) via export/import.

        This is the original upgrade path that handles the engine change
        from kuzu 0.11.1 to real_ladybug (Ladybug fork).
        """
        backup_path = None

        try:
            # Step 1: Create backup
            backup_path = self._create_backup(timestamp)
            logger.info("Backup created", backup_path=str(backup_path))

            # Step 2: Export from v0 database
            export_dir = self._get_temp_export_dir(timestamp)
            export_result = self._run_export(export_dir)

            if not export_result["success"]:
                failure_report = self._create_failure_report(
                    timestamp,
                    "export",
                    export_result,
                )
                return {
                    "success": False,
                    "error": export_result["error"],
                    "error_code": export_result.get(
                        "error_code", "UPGRADE_EXPORT_FAILED"
                    ),
                    "failure_report_path": failure_report,
                }

            logger.info("Export completed", export_dir=str(export_dir))

            # Step 3: Import into v1 database
            new_db_path = get_db_path_for_version(self.db_path, self.CURRENT_VERSION)
            import_result = self._run_import(new_db_path, export_dir)

            if not import_result["success"]:
                # Clean up failed import
                if new_db_path.exists():
                    shutil.rmtree(new_db_path, ignore_errors=True)

                failure_report = self._create_failure_report(
                    timestamp,
                    "import",
                    import_result,
                )
                return {
                    "success": False,
                    "error": import_result["error"],
                    "error_code": import_result.get(
                        "error_code", "UPGRADE_IMPORT_FAILED"
                    ),
                    "failure_report_path": failure_report,
                }

            logger.info("Import completed", new_db_path=str(new_db_path))

            # Step 4: Verify vector index
            if not import_result.get("verified", False):
                # Verification failed
                verification_error = import_result.get(
                    "verification_error", "Unknown verification error"
                )
                logger.error(
                    "Vector index verification failed",
                    error=verification_error,
                    new_db_path=str(new_db_path),
                )

                if new_db_path.exists():
                    shutil.rmtree(new_db_path, ignore_errors=True)

                failure_report = self._create_failure_report(
                    timestamp,
                    "verification",
                    import_result,
                )
                return {
                    "success": False,
                    "error": f"Vector index verification failed: {verification_error}",
                    "error_code": "UPGRADE_VERIFY_FAILED",
                    "failure_report_path": failure_report,
                    "backup_path": backup_path,
                }

            logger.info("Vector index verified successfully")

            # Step 5: Update version metadata (atomic swap)
            set_db_version(
                new_db_path,
                self.CURRENT_VERSION,
                app_version="0.5.1",
                additional_metadata={
                    "upgraded_from_version": self.current_version,
                    "backup_path": str(backup_path),
                },
            )

            logger.info("Version metadata updated")

            # Step 6: Delete old v0 database file (already backed up)
            # This prevents version detection confusion on next startup
            try:
                if self.db_path.exists():
                    if self.db_path.is_dir():
                        shutil.rmtree(self.db_path)
                    else:
                        self.db_path.unlink()
                    logger.info(
                        "Deleted old v0 database (backup preserved)",
                        old_path=str(self.db_path),
                        backup_path=str(backup_path),
                    )
            except Exception as delete_error:
                logger.warning(
                    "Failed to delete old v0 database (non-critical)",
                    error=str(delete_error),
                )
                # Non-critical: backup exists, and new DB is ready

            # Step 7: Cleanup temp export directory
            try:
                shutil.rmtree(export_dir, ignore_errors=True)
                logger.debug("Cleaned up export directory", export_dir=str(export_dir))
            except Exception as cleanup_error:
                logger.warning(
                    "Failed to cleanup export directory",
                    error=str(cleanup_error),
                )

            logger.info(
                "Database upgrade completed successfully",
                new_db_path=str(new_db_path),
                backup_path=str(backup_path),
            )

            return {
                "success": True,
                "new_db_path": new_db_path,
                "backup_path": backup_path,
            }

        except Exception as e:
            logger.error("Upgrade failed with unexpected error", error=str(e))
            failure_report = self._create_failure_report(
                timestamp,
                "unexpected",
                {"error": str(e), "error_type": type(e).__name__},
            )
            return {
                "success": False,
                "error": str(e),
                "error_code": "UPGRADE_UNEXPECTED_ERROR",
                "failure_report_path": failure_report,
                "backup_path": backup_path if backup_path else None,
            }

    def _create_backup(self, timestamp: str) -> Path:
        """Create timestamped backup of database."""
        backup_path = self.db_path.parent / f"{self.db_path.name}.backup.{timestamp}"

        # KuzuDB can be either a single file or a directory
        if self.db_path.is_dir():
            shutil.copytree(self.db_path, backup_path)
            logger.info("Created directory backup", backup_path=str(backup_path))
        else:
            # Single file database
            shutil.copy2(self.db_path, backup_path)
            logger.info("Created file backup", backup_path=str(backup_path))

        return backup_path

    def _get_temp_export_dir(self, timestamp: str) -> Path:
        """Get temporary directory path for export (do NOT create it - kuzu creates it)."""
        import tempfile

        temp_dir = Path(tempfile.gettempdir())
        export_dir = temp_dir / f"nowledge_graph_export_{timestamp}"

        # Clean up if it already exists from a previous failed attempt
        if export_dir.exists():
            logger.warning(
                "Export directory already exists, cleaning up from previous attempt",
                export_dir=str(export_dir),
            )
            shutil.rmtree(export_dir, ignore_errors=True)

        # Do NOT create the directory - kuzu's EXPORT DATABASE command creates it
        return export_dir

    def _get_python_interpreter(self) -> str:
        """Get path to bundled Python interpreter."""
        # Use the current Python interpreter (which should be the bundled one)
        return sys.executable

    def _get_script_path(self, script_name: str) -> Path:
        """
        Get path to upgrade script from RAW source (not PyArmor-obfuscated).

        IMPORTANT: These scripts must NOT be obfuscated because they run in
        isolated subprocesses with different database engines.

        Resolution order:
        1. Check for raw scripts in .../python-standalone/upgrade_scripts/ (production)
        2. Check for dev source in .../nowledge-graph-py/src/... (development)
        3. Fallback to relative path from this file
        """
        python_bin = Path(sys.executable)

        # Production: Check for raw scripts directory
        if "python-standalone" in str(python_bin):
            # Bundled: .../python-standalone/python/bin/python3
            # Raw scripts: .../python-standalone/upgrade_scripts/
            app_root = python_bin.parent.parent  # Go up from bin -> python
            raw_script = app_root / "upgrade_scripts" / script_name

            if raw_script.exists():
                logger.debug(f"Using raw bundled script: {raw_script}")
                return raw_script

            # Development mode using bundled Python: find actual source
            # .../python-standalone/python/bin/python3 -> ../../.. -> nowledge-graph/
            # Then ../nowledge-graph-py/src/...
            repo_root = app_root.parent  # nowledge-graph/
            dev_source_root = repo_root.parent / "nowledge-graph-py" / "src"
            dev_script = (
                dev_source_root
                / "nowledge_graph_server"
                / "database"
                / "version_upgrade"
                / script_name
            )

            if dev_script.exists():
                logger.debug(f"Using development source script: {dev_script}")
                return dev_script

        # Fallback: relative to this file (works if running from source)
        dev_script = Path(__file__).parent / script_name
        logger.debug(f"Using relative script: {dev_script}")
        return dev_script

    def _run_export(self, export_dir: Path) -> Dict[str, Any]:
        """Run export subprocess."""
        python_path = self._get_python_interpreter()
        script_path = self._get_script_path("export_v0.py")

        logger.info(
            "Running export subprocess",
            python=python_path,
            script=str(script_path),
            db_path=str(self.db_path),
            export_dir=str(export_dir),
        )

        try:
            result = subprocess.run(
                [python_path, str(script_path), str(self.db_path), str(export_dir)],
                capture_output=True,
                text=True,
                timeout=self.UPGRADE_TIMEOUT,
            )

            # Parse JSON from stdout
            try:
                output = json.loads(result.stdout)
                return output
            except json.JSONDecodeError:
                logger.error(
                    "Failed to parse export output as JSON",
                    stdout=result.stdout,
                    stderr=result.stderr,
                    returncode=result.returncode,
                )
                return {
                    "success": False,
                    "error": "Failed to parse export output",
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode,
                    "error_code": "UPGRADE_EXPORT_PARSE_ERROR",
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Export timeout exceeded ({self.UPGRADE_TIMEOUT}s)",
                "error_code": "UPGRADE_TIMEOUT",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "error_code": "UPGRADE_EXPORT_SUBPROCESS_ERROR",
            }

    def _run_import(self, new_db_path: Path, export_dir: Path) -> Dict[str, Any]:
        """Run import subprocess."""
        python_path = self._get_python_interpreter()
        script_path = self._get_script_path("import_v1.py")

        logger.info(
            "Running import subprocess",
            python=python_path,
            script=str(script_path),
            new_db_path=str(new_db_path),
            export_dir=str(export_dir),
        )

        try:
            result = subprocess.run(
                [python_path, str(script_path), str(new_db_path), str(export_dir)],
                capture_output=True,
                text=True,
                timeout=self.UPGRADE_TIMEOUT,
            )

            # Parse JSON from stdout
            try:
                output = json.loads(result.stdout)
                return output
            except json.JSONDecodeError:
                logger.error(
                    "Failed to parse import output as JSON",
                    stdout=result.stdout,
                    stderr=result.stderr,
                    returncode=result.returncode,
                )
                return {
                    "success": False,
                    "error": "Failed to parse import output",
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode,
                    "error_code": "UPGRADE_IMPORT_PARSE_ERROR",
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": f"Import timeout exceeded ({self.UPGRADE_TIMEOUT}s)",
                "error_code": "UPGRADE_TIMEOUT",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_type": type(e).__name__,
                "error_code": "UPGRADE_IMPORT_SUBPROCESS_ERROR",
            }

    def _create_failure_report(
        self,
        timestamp: str,
        phase: str,
        error_data: Dict[str, Any],
    ) -> Path:
        """Create detailed failure report for user support."""
        report_dir = self.db_path.parent
        report_path = report_dir / f"upgrade_failure_report_{timestamp}.json"

        # Gather system information
        system_info = {
            "os": platform.system(),
            "os_version": platform.version(),
            "python_version": sys.version,
            "platform": platform.platform(),
        }

        # Gather database information
        db_info = {
            "db_path": str(self.db_path),
            "db_exists": self.db_path.exists(),
        }

        if self.db_path.exists():
            try:
                db_size = sum(
                    f.stat().st_size for f in self.db_path.rglob("*") if f.is_file()
                )
                db_info["db_size_bytes"] = db_size
                db_info["db_size_mb"] = round(db_size / (1024 * 1024), 2)
            except Exception:
                pass

        # Create comprehensive report
        report = {
            "timestamp": timestamp,
            "upgrade_phase": phase,
            "error_code": error_data.get("error_code", "UNKNOWN"),
            "error": error_data.get("error", "Unknown error"),
            "error_type": error_data.get("error_type", "Unknown"),
            "traceback": error_data.get("traceback", "No traceback available"),
            "system_info": system_info,
            "database_info": db_info,
            "current_db_version": self.current_version,
            "target_db_version": self.CURRENT_VERSION,
            "instructions": (
                "This is an automated failure report for the database version upgrade. "
                "Please share this file with Nowledge support for assistance. "
                "Your original database has been preserved and the application will "
                "continue using the previous version."
            ),
        }

        try:
            with open(report_path, "w") as f:
                json.dump(report, f, indent=2)

            logger.info("Failure report created", report_path=str(report_path))
            return report_path

        except Exception as e:
            logger.error("Failed to create failure report", error=str(e))
            # Return a fallback path even if write failed
            return report_path

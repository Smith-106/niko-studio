"""Database version metadata manager using codenames for engine version tracking."""

import json
import os
import platform
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import structlog

logger = structlog.get_logger(__name__)

# Codename mapping for database versions (avoid exposing engine brands)
CODENAMES = {
    0: "alpine",  # v0 - legacy engine (kuzu 0.11.1)
    1: "birch",   # v1 - current engine (real_ladybug/Ladybug)
    2: "cedar",   # v2 - LanceDB search index, no Kuzu vector/FTS indexes
}

# Current target version for this app release
# v2: Uses LanceDB for search instead of Kuzu vector/FTS indexes
CURRENT_DB_VERSION = 2


def _get_app_data_dir() -> Path:
    """Get the app data directory path (matches LicenseService and Tauri logic).

    Paths must match Tauri's appDataDir() for each platform:
    - macOS: ~/Library/Application Support/NowledgeGraph
    - Windows: %APPDATA%/NowledgeGraph
    - Linux: ~/.local/share/NowledgeGraph (XDG_DATA_HOME)
    """
    if os.name == "nt":  # Windows
        base = os.environ.get("APPDATA", "")
    elif platform.system() == "Darwin":  # macOS
        base = os.path.expanduser("~/Library/Application Support")
    else:  # Linux - Use XDG_DATA_HOME to match Tauri's appDataDir()
        base = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))

    return Path(base) / "NowledgeGraph"


def _get_version_metadata_path(db_path: Path) -> Path:
    """Get path to version metadata JSON file next to database."""
    return db_path.parent / "db_version.json"


def get_db_version(db_path: Path) -> int:
    """
    Get current database version from metadata file.

    Args:
        db_path: Path to database file

    Returns:
        Database version number (0 for legacy, 1+ for versioned)
    """
    metadata_path = _get_version_metadata_path(db_path)

    try:
        if not metadata_path.exists():
            # No metadata file means v0 (legacy unversioned database)
            logger.debug(
                "No version metadata found, assuming v0 (alpine)", db_path=str(db_path)
            )
            return 0

        with open(metadata_path, "r") as f:
            metadata = json.load(f)
            version = metadata.get("db_version", 0)
            codename = metadata.get("db_codename", CODENAMES.get(version, "unknown"))
            logger.debug(
                "Read database version",
                version=version,
                codename=codename,
                db_path=str(db_path),
            )
            return version

    except Exception as e:
        logger.warning(
            "Failed to read version metadata, assuming v0",
            error=str(e),
            db_path=str(db_path),
        )
        return 0


def set_db_version(
    db_path: Path,
    version: int,
    app_version: str = "0.5.1",
    additional_metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Set database version in metadata file.

    Args:
        db_path: Path to database file
        version: Database version number
        app_version: Application version that performed the upgrade
        additional_metadata: Optional additional metadata to store
    """
    metadata_path = _get_version_metadata_path(db_path)
    codename = CODENAMES.get(version, f"unknown_v{version}")

    metadata = {
        "db_version": version,
        "db_codename": codename,
        "upgraded_at": datetime.now(timezone.utc).isoformat(),
        "app_version": app_version,
    }

    if additional_metadata:
        metadata.update(additional_metadata)

    try:
        # Ensure parent directory exists
        metadata_path.parent.mkdir(parents=True, exist_ok=True)

        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        logger.info(
            "Updated database version metadata",
            version=version,
            codename=codename,
            db_path=str(db_path),
        )
    except Exception as e:
        logger.error(
            "Failed to write version metadata",
            error=str(e),
            db_path=str(db_path),
        )
        raise


def get_db_path_for_version(base_path: Path, version: int) -> Path:
    """
    Get database file path for a specific version using naming convention.

    Args:
        base_path: Base database path (e.g., nowledge_graph.db)
        version: Target version number

    Returns:
        Path to versioned database file

    Naming convention:
        v0: nowledge_graph.db (legacy, no version suffix)
        v1+: nowledge_graph_v1.db, nowledge_graph_v2.db, etc.
    """
    if version == 0:
        # Legacy v0 uses base name without version suffix
        return base_path

    # v1+ uses version suffix
    stem = base_path.stem  # e.g., "nowledge_graph"
    suffix = base_path.suffix  # e.g., ".db"
    versioned_name = f"{stem}_v{version}{suffix}"
    return base_path.parent / versioned_name


def get_db_path() -> Path:
    """
    Get current database path based on environment or default location.

    Respects NOWLEDGE_DB_PATH environment variable if set (used after upgrade).
    Otherwise uses default location in app data directory.

    Returns:
        Path to current database file
    """
    # Check environment variable first (set by upgrade process)
    env_path = os.environ.get("NOWLEDGE_DB_PATH")
    if env_path:
        db_path = Path(env_path)
        logger.debug("Using database path from environment", path=str(db_path))
        return db_path

    # Use default location
    app_data_dir = _get_app_data_dir()

    # Check for databases in order of preference (newest version first)
    v2_path = app_data_dir / "nowledge_graph_v2.db"
    if v2_path.exists():
        logger.debug("Found v2 database", path=str(v2_path))
        return v2_path

    v1_path = app_data_dir / "nowledge_graph_v1.db"
    if v1_path.exists():
        logger.debug("Found v1 database", path=str(v1_path))
        return v1_path

    # Fall back to v0 (legacy) database
    v0_path = app_data_dir / "nowledge_graph.db"
    logger.debug("Using v0 database path", path=str(v0_path))
    return v0_path


def needs_upgrade(db_path: Optional[Path] = None) -> bool:
    """
    Check if database needs version upgrade.

    Args:
        db_path: Optional database path (uses get_db_path() if not provided)

    Returns:
        True if upgrade is needed
    """
    if db_path is None:
        db_path = get_db_path()

    # Only upgrade if database file exists
    if not db_path.exists():
        logger.debug("Database does not exist yet, no upgrade needed")
        return False

    current_version = get_db_version(db_path)
    needs_upgrade_flag = current_version < CURRENT_DB_VERSION

    logger.info(
        "Database version check",
        current_version=current_version,
        current_codename=CODENAMES.get(current_version, "unknown"),
        target_version=CURRENT_DB_VERSION,
        target_codename=CODENAMES.get(CURRENT_DB_VERSION, "unknown"),
        needs_upgrade=needs_upgrade_flag,
    )

    return needs_upgrade_flag

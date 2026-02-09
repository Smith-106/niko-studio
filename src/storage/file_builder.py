"""
FileBuilder - Base Builder for Atomic File Operations

Implements the builder pattern with:
- Fluent API (with_* methods return self)
- Atomic writes (write to temp file, then rename)
- Backup and rollback support
- Configurable encoding

Usage:
    builder = FileBuilder()
    path = (
        builder
        .with_path("/path/to/file.txt")
        .with_content("Hello, World!")
        .with_encoding("utf-8")
        .with_backup(True)
        .build()
    )

    # Rollback if needed
    builder.rollback()
"""

import logging
import os
import shutil
import tempfile
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Any

logger = logging.getLogger("FileBuilder")


class FileBuilderError(Exception):
    """Exception raised for file builder errors"""
    pass


@dataclass
class FileBuilderState:
    """State container for FileBuilder"""
    path: Optional[Path] = None
    content: Optional[str] = None
    encoding: str = "utf-8"
    create_parents: bool = True
    backup_enabled: bool = False
    backup_path: Optional[Path] = None
    last_written_path: Optional[Path] = None
    temp_suffix: str = ".tmp"
    on_success: Optional[Callable[[Path], Any]] = None
    on_error: Optional[Callable[[Exception], Any]] = None


class FileBuilder:
    """
    Base file builder with atomic write support.

    Features:
    - Fluent builder pattern
    - Atomic writes via temp file + rename
    - Optional backup before overwrite
    - Rollback support
    - Configurable callbacks
    """

    def __init__(self):
        self._state = FileBuilderState()

    def with_path(self, path: str | Path) -> "FileBuilder":
        """
        Set the target file path.

        Args:
            path: Target file path (string or Path object)

        Returns:
            Self for method chaining
        """
        self._state.path = Path(path)
        return self

    def with_content(self, content: str) -> "FileBuilder":
        """
        Set the file content.

        Args:
            content: Text content to write

        Returns:
            Self for method chaining
        """
        self._state.content = content
        return self

    def with_encoding(self, encoding: str) -> "FileBuilder":
        """
        Set the file encoding.

        Args:
            encoding: Character encoding (default: utf-8)

        Returns:
            Self for method chaining
        """
        self._state.encoding = encoding
        return self

    def with_backup(self, enabled: bool = True) -> "FileBuilder":
        """
        Enable or disable backup before overwrite.

        Args:
            enabled: Whether to create backup

        Returns:
            Self for method chaining
        """
        self._state.backup_enabled = enabled
        return self

    def with_create_parents(self, enabled: bool = True) -> "FileBuilder":
        """
        Enable or disable parent directory creation.

        Args:
            enabled: Whether to create parent directories

        Returns:
            Self for method chaining
        """
        self._state.create_parents = enabled
        return self

    def with_temp_suffix(self, suffix: str) -> "FileBuilder":
        """
        Set the temporary file suffix.

        Args:
            suffix: Suffix for temp files (default: .tmp)

        Returns:
            Self for method chaining
        """
        self._state.temp_suffix = suffix
        return self

    def with_on_success(self, callback: Callable[[Path], Any]) -> "FileBuilder":
        """
        Set success callback.

        Args:
            callback: Function called with final path on success

        Returns:
            Self for method chaining
        """
        self._state.on_success = callback
        return self

    def with_on_error(self, callback: Callable[[Exception], Any]) -> "FileBuilder":
        """
        Set error callback.

        Args:
            callback: Function called with exception on error

        Returns:
            Self for method chaining
        """
        self._state.on_error = callback
        return self

    def _validate(self) -> None:
        """Validate builder state before build"""
        if self._state.path is None:
            raise FileBuilderError("Path is required. Use with_path() to set it.")
        if self._state.content is None:
            raise FileBuilderError("Content is required. Use with_content() to set it.")

    def _create_backup(self) -> Optional[Path]:
        """Create backup of existing file if enabled"""
        if not self._state.backup_enabled:
            return None

        path = self._state.path
        if path is None or not path.exists():
            return None

        # Generate backup path
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_name = f"{path.stem}.{timestamp}.bak{path.suffix}"
        backup_path = path.parent / backup_name

        try:
            shutil.copy2(path, backup_path)
            logger.debug(f"Created backup: {backup_path}")
            return backup_path
        except Exception as e:
            logger.warning(f"Failed to create backup: {e}")
            return None

    def _atomic_write(self, path: Path, content: str, encoding: str) -> None:
        """
        Write content atomically using temp file + rename.

        This ensures that the file is either fully written or not at all,
        preventing partial writes on system crashes or interruptions.
        """
        # Create parent directories if needed
        if self._state.create_parents:
            path.parent.mkdir(parents=True, exist_ok=True)

        # Generate temp file path in same directory (for same-filesystem rename)
        temp_name = f".{path.name}.{uuid.uuid4().hex[:8]}{self._state.temp_suffix}"
        temp_path = path.parent / temp_name

        try:
            # Write to temp file
            temp_path.write_text(content, encoding=encoding)

            # Atomic rename (works on same filesystem)
            # On Windows, we need to remove the target first if it exists
            if os.name == "nt" and path.exists():
                path.unlink()

            temp_path.rename(path)
            logger.debug(f"Atomic write completed: {path}")

        except Exception as e:
            # Clean up temp file on error
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise

    def build(self) -> Path:
        """
        Build and write the file atomically.

        Returns:
            Path to the written file

        Raises:
            FileBuilderError: If validation fails or write fails
        """
        try:
            self._validate()

            path = self._state.path
            content = self._state.content
            encoding = self._state.encoding

            # Create backup if enabled
            self._state.backup_path = self._create_backup()

            # Perform atomic write
            self._atomic_write(path, content, encoding)

            # Store last written path for rollback
            self._state.last_written_path = path

            # Call success callback
            if self._state.on_success:
                self._state.on_success(path)

            logger.info(f"File written: {path}")
            return path

        except Exception as e:
            # Call error callback
            if self._state.on_error:
                self._state.on_error(e)

            if isinstance(e, FileBuilderError):
                raise
            raise FileBuilderError(f"Failed to write file: {e}") from e

    def rollback(self) -> bool:
        """
        Rollback the last write operation.

        If a backup was created, restores from backup.
        Otherwise, deletes the written file.

        Returns:
            True if rollback succeeded, False otherwise
        """
        if self._state.last_written_path is None:
            logger.warning("No previous write to rollback")
            return False

        path = self._state.last_written_path

        try:
            if self._state.backup_path and self._state.backup_path.exists():
                # Restore from backup
                shutil.copy2(self._state.backup_path, path)
                self._state.backup_path.unlink()
                logger.info(f"Rolled back from backup: {path}")
            elif path.exists():
                # No backup, just delete
                path.unlink()
                logger.info(f"Rolled back (deleted): {path}")

            self._state.last_written_path = None
            self._state.backup_path = None
            return True

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            return False

    def reset(self) -> "FileBuilder":
        """
        Reset builder state for reuse.

        Returns:
            Self for method chaining
        """
        self._state = FileBuilderState()
        return self

    @property
    def state(self) -> FileBuilderState:
        """Get current builder state (read-only view)"""
        return self._state

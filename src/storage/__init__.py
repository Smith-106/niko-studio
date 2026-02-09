"""
Storage Package - Unified File Builder System

Provides a builder pattern for atomic file operations with:
- Fluent API for file configuration
- Atomic writes (write to temp, rename)
- Rollback support
- JSON and OpenKL format builders

Usage:
    from src.storage import FileBuilder, JsonFileBuilder

    # Basic file writing
    FileBuilder().with_path("output.txt").with_content("Hello").build()

    # JSON file writing
    JsonFileBuilder().with_path("data.json").with_data({"key": "value"}).build()
"""

from typing import Protocol, Optional, Any, Dict
from pathlib import Path


class IFileBuilder(Protocol):
    """Protocol for file builders"""

    def with_path(self, path: str | Path) -> "IFileBuilder":
        """Set the target file path"""
        ...

    def with_content(self, content: str) -> "IFileBuilder":
        """Set the file content"""
        ...

    def with_encoding(self, encoding: str) -> "IFileBuilder":
        """Set the file encoding"""
        ...

    def build(self) -> Path:
        """Build and write the file atomically"""
        ...

    def rollback(self) -> bool:
        """Rollback the last write operation"""
        ...


# Import builders for convenience
from .file_builder import FileBuilder, FileBuilderState, FileBuilderError
from .json_file_builder import JsonFileBuilder

__all__ = [
    "IFileBuilder",
    "FileBuilder",
    "FileBuilderState",
    "FileBuilderError",
    "JsonFileBuilder",
]

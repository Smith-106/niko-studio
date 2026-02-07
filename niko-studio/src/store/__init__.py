"""
Store Module - OpenKL File System Contract Implementation

Provides:
- StoreManager: Document repository with CRUD operations
- OpenKL directory structure contract
- Document ingestion and normalization
- Multi-format support (Markdown, TXT, JSON, YAML, PDF, DOCX)
"""

from .store_manager import (
    StoreManager,
    Document,
    DocumentFormat,
    DocumentFilter,
)
from .openkl_contract import OpenKLContract, OpenKLPaths

__all__ = [
    "StoreManager",
    "Document",
    "DocumentFormat",
    "DocumentFilter",
    "OpenKLContract",
    "OpenKLPaths",
]

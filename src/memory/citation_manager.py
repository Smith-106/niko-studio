"""
Citation Manager Module

This module implements the Citation Management System as defined in SDD V2.
It handles creation, verification, storage, and garbage collection of content citations.
"""

import hashlib
import json
import threading
import time
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Any, Union

@dataclass
class TransientCitation:
    """
    临时引用 - 搜索返回，不持久化

    Attributes:
        id: Unique identifier for the citation.
        surface: Surface where the citation was found ("memory" | "store").
        path: Path to the source file.
        sha256: SHA256 hash of the content.
        loc: Location information (e.g., {"kind": "char", "start": 0, "end": 10}).
        quote: The cited text content.
        context: Surrounding context (pre/post).
        score: Relevance score if from search.
    """
    # pylint: disable=too-many-instance-attributes
    id: str
    surface: str
    path: str
    sha256: str
    loc: Dict[str, Any]
    quote: str
    context: Optional[Dict[str, str]] = None
    score: Optional[float] = None

@dataclass
class PersistedCitation:
    """
    持久引用 - 寫入磁盤，支持驗證

    Attributes:
        id: Unique identifier.
        type: Type of source ("doc" | "chunk" | "memory").
        path: Path to the source file.
        sha256: SHA256 hash of the content.
        loc: Location information.
        quote: The cited text content.
        context: Surrounding context.
        source: Source metadata (author, url, etc.).
        retention_class: Retention policy ("durable" | "ephemeral" | "standard").
        tags: List of tags.
        created_at: Creation timestamp (ISO 8601).
        last_accessed: Last access timestamp (ISO 8601).
        verified_at: Last verification timestamp (ISO 8601).
    """
    # pylint: disable=too-many-instance-attributes
    id: str
    type: str
    path: str
    sha256: str
    loc: Dict[str, Any]
    quote: str
    context: Optional[Dict[str, str]] = None
    source: Optional[Dict[str, Any]] = None
    retention_class: str = "standard"
    tags: List[str] = field(default_factory=list)
    created_at: Optional[str] = None
    last_accessed: Optional[str] = None
    verified_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PersistedCitation':
        """Create from dictionary."""
        return cls(**data)


class CitationManager:
    """
    Citation Manager for handling lifecycle of citations.

    Handles creation, storage, verification, and garbage collection of citations.
    Thread-safe implementation.
    """

    def __init__(self, base_path: Union[str, Path] = ".writing"):
        """
        Initialize the CitationManager.

        Args:
            base_path: Base directory for writing system. Defaults to ".writing".
        """
        self.base_path = Path(base_path)
        self.citations_dir = self.base_path / "citations"
        self.citations_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def _get_citation_path(self, citation_id: str) -> Path:
        """Get the file path for a citation ID."""
        return self.citations_dir / f"{citation_id}.json"

    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except FileNotFoundError:
            return ""

    def add_citation(self, citation: PersistedCitation) -> None:
        """
        Add (save) a citation to storage.

        Args:
            citation: The PersistedCitation object to save.
        """
        if not citation.created_at:
            citation.created_at = time.strftime("%Y-%m-%dT%H:%M:%S%z")

        with self._lock:
            file_path = self._get_citation_path(citation.id)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(citation.to_dict(), f, ensure_ascii=False, indent=2)

    def get_citation(self, citation_id: str) -> Optional[PersistedCitation]:
        """
        Retrieve a citation by ID.

        Args:
            citation_id: The ID of the citation.

        Returns:
            PersistedCitation object if found, None otherwise.
        """
        file_path = self._get_citation_path(citation_id)
        with self._lock:
            if not file_path.exists():
                return None

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                citation = PersistedCitation.from_dict(data)
                # Update last accessed
                citation.last_accessed = time.strftime("%Y-%m-%dT%H:%M:%S%z")
                # We intentionally don't save just on read to avoid write contention,
                # but depending on requirements we might want to update it.
                # For now, let's keep it in memory or update if requested.
                # To stick to "management", let's save the access time update.
                self.add_citation(citation)
                return citation
            except (json.JSONDecodeError, KeyError):
                return None

    def update_citation(self, citation: PersistedCitation) -> None:
        """
        Update an existing citation.

        Args:
            citation: The updated PersistedCitation object.
        """
        # Ensure it exists first? Or just overwrite?
        # Standard update implies overwrite.
        self.add_citation(citation)

    def delete_citation(self, citation_id: str) -> bool:
        """
        Delete a citation.

        Args:
            citation_id: The ID of the citation to delete.

        Returns:
            True if deleted, False if not found.
        """
        file_path = self._get_citation_path(citation_id)
        with self._lock:
            if file_path.exists():
                file_path.unlink()
                return True
            return False

    def verify_citation(self, citation_id: str) -> Dict[str, Any]:
        """
        Verify the integrity of a citation against its source file.

        Args:
            citation_id: The ID of the citation.

        Returns:
            Dictionary containing verification result.
            {
                "valid": bool,
                "error": str (optional),
                "stored_hash": str,
                "current_hash": str
            }
        """
        citation = self.get_citation(citation_id)
        if not citation:
            return {"valid": False, "error": "Citation not found"}

        source_path = Path(citation.path)
        if not source_path.exists():
            return {
                "valid": False,
                "error": "Source file not found",
                "stored_hash": citation.sha256,
                "current_hash": None
            }

        current_hash = self._calculate_file_hash(source_path)
        is_valid = current_hash == citation.sha256

        if is_valid:
            citation.verified_at = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            self.update_citation(citation)

        return {
            "valid": is_valid,
            "stored_hash": citation.sha256,
            "current_hash": current_hash
        }

    def gc_orphaned_citations(
        self, dry_run: bool = False, max_age_seconds: int = 86400
    ) -> List[str]:
        """
        Garbage collect orphaned or expired citations.

        Orphaned: Source file does not exist.
        Expired: Retention class is 'ephemeral' and older than max_age_seconds.

        Args:
            dry_run: If True, only return list of IDs to be deleted.
            max_age_seconds: Age in seconds for ephemeral citations to expire.

        Returns:
            List of citation IDs that were (or would be) deleted.
        """
        deleted_ids = []
        with self._lock:
            files = list(self.citations_dir.glob("*.json"))

            for file_path in files:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    citation = PersistedCitation.from_dict(data)

                    should_delete = False

                    # Check if source exists
                    if not Path(citation.path).exists():
                        should_delete = True

                    # Check for expiration if ephemeral
                    if not should_delete and citation.retention_class == "ephemeral":
                        if citation.created_at:
                            try:
                                # Assumes %Y-%m-%dT%H:%M:%S%z
                                created = datetime.strptime(
                                    citation.created_at, "%Y-%m-%dT%H:%M:%S%z"
                                )
                                # Ensure timezone awareness
                                if created.tzinfo:
                                    now = datetime.now(timezone.utc)
                                else:
                                    now = datetime.now()

                                age = (now - created).total_seconds()
                                if age > max_age_seconds:
                                    should_delete = True
                            except ValueError:
                                # Fallback or ignore if parsing fails
                                pass

                except (json.JSONDecodeError, KeyError):
                    # Corrupt file, delete it
                    should_delete = True
                    citation = None

                if should_delete:
                    if citation:
                        deleted_ids.append(citation.id)
                    else:
                        deleted_ids.append(file_path.stem)

                    if not dry_run:
                        file_path.unlink()

        return deleted_ids

    def create_transient_citation(self, **kwargs) -> TransientCitation:
        """
        Helper to create a TransientCitation.

        Args:
            **kwargs: Arguments for TransientCitation.

        Returns:
            TransientCitation object.
        """
        return TransientCitation(**kwargs)

    def make_citation(
        self,
        transient: TransientCitation,
        retention_class: str = "standard",
        tags: List[str] = None
    ) -> PersistedCitation:
        """
        Convert a TransientCitation to a PersistedCitation.

        Args:
            transient: The transient citation to convert.
            retention_class: Retention policy.
            tags: Tags to add.

        Returns:
            The created PersistedCitation (not yet saved).
        """
        return PersistedCitation(
            id=transient.id,
            type="doc",  # Defaulting to doc, could be inferred
            path=transient.path,
            sha256=transient.sha256,
            loc=transient.loc,
            quote=transient.quote,
            context=transient.context,
            retention_class=retention_class,
            tags=tags or []
        )

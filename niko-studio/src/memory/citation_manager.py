"""
Citation Manager Module

This module implements the Citation Management System as defined in SDD V2.
It handles creation, verification, storage, and garbage collection of content citations.

Implements ICitationService interface from memory_contracts.py.
"""

import hashlib
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, TYPE_CHECKING

from src.search.vector_search import (
    SearchResultMeta,
    SearchResultLocation,
    SEARCH_RESULT_FIELDS_CHECKLIST,
)

if TYPE_CHECKING:
    from .memory_manager import MemoryManager

logger = logging.getLogger("niko-citation-manager")


@dataclass
class TransientCitation:
    """
    临时引用 - 搜索返回，未持久化

    用于表示从搜索结果创建的临时引用，包含上下文信息。
    临时引用有过期时间，超时后自动清理。

    Attributes:
        citation_id: Unique identifier for the citation.
        source_text: The cited text content (quote).
        source_location: Location information (path, surface, loc).
        created_at: Creation timestamp (ISO 8601).
        expires_at: Expiration timestamp (ISO 8601).
        context_before: Text before the cited content.
        context_after: Text after the cited content.
        score: Relevance score if from search.
        metadata: Additional metadata.
    """
    citation_id: str
    source_text: str
    source_location: Dict[str, Any]
    created_at: str
    expires_at: str
    context_before: str = ""
    context_after: str = ""
    score: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if the citation has expired."""
        try:
            expires = datetime.fromisoformat(self.expires_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return now > expires
        except (ValueError, AttributeError):
            return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TransientCitation':
        """Create from dictionary."""
        return cls(**data)


@dataclass(init=False)
class PersistedCitation:
    """
    持久引用 - 写入磁盘，支持验证

    用于表示已持久化的引用，包含 SHA256 哈希用于完整性验证。

    Attributes:
        citation_id: Unique identifier.
        source_hash: SHA256 hash of the source content.
        source_location: Location information (path, surface, loc).
        verified_at: Last verification timestamp (ISO 8601).
        quote: The cited text content.
        context: Surrounding context (before/after).
        source_type: Type of source ("doc" | "chunk" | "memory").
        retention_class: Retention policy ("durable" | "ephemeral" | "standard").
        tags: List of tags.
        created_at: Creation timestamp (ISO 8601).
        last_accessed: Last access timestamp (ISO 8601).
        source_metadata: Source metadata (author, url, etc.).
    """
    citation_id: str
    source_hash: str
    source_location: Dict[str, Any]
    verified_at: Optional[str] = None
    quote: str = ""
    context: Optional[Dict[str, str]] = None
    source_type: str = "doc"
    retention_class: str = "standard"
    tags: List[str] = field(default_factory=list)
    created_at: Optional[str] = None
    last_accessed: Optional[str] = None
    source_metadata: Optional[Dict[str, Any]] = None

    def __init__(
        self,
        citation_id: Optional[str] = None,
        source_hash: Optional[str] = None,
        source_location: Optional[Dict[str, Any]] = None,
        verified_at: Optional[str] = None,
        quote: str = "",
        context: Optional[Dict[str, str]] = None,
        source_type: str = "doc",
        retention_class: str = "standard",
        tags: Optional[List[str]] = None,
        created_at: Optional[str] = None,
        last_accessed: Optional[str] = None,
        source_metadata: Optional[Dict[str, Any]] = None,
        id: Optional[str] = None,
        type: Optional[str] = None,
        path: Optional[str] = None,
        sha256: Optional[str] = None,
        loc: Optional[Dict[str, Any]] = None,
        surface: Optional[str] = None,
        source: Optional[Dict[str, Any]] = None,
        **_: Any,
    ):
        self.citation_id = citation_id or id or ""
        self.source_hash = source_hash or sha256 or ""

        if source_location is None:
            resolved_location: Dict[str, Any] = {}
            if path is not None:
                resolved_location["path"] = path
            if loc is not None:
                resolved_location["loc"] = loc
            if surface is not None:
                resolved_location["surface"] = surface
            self.source_location = resolved_location
        else:
            self.source_location = source_location

        self.verified_at = verified_at
        self.quote = quote
        self.context = context
        self.source_type = source_type if type is None else type
        self.retention_class = retention_class
        self.tags = tags or []
        self.created_at = created_at
        self.last_accessed = last_accessed
        self.source_metadata = source_metadata if source is None else source

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @property
    def id(self) -> str:
        return self.citation_id

    @property
    def type(self) -> str:
        return self.source_type

    @property
    def path(self) -> Optional[str]:
        return self.source_location.get("path")

    @property
    def sha256(self) -> str:
        return self.source_hash

    @property
    def loc(self) -> Optional[Dict[str, Any]]:
        return self.source_location.get("loc")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PersistedCitation':
        """Create from dictionary."""
        if "id" in data and "citation_id" not in data:
            data["citation_id"] = data.pop("id")
        if "sha256" in data and "source_hash" not in data:
            data["source_hash"] = data.pop("sha256")
        if "path" in data and "source_location" not in data:
            data["source_location"] = {"path": data.pop("path")}
            if "loc" in data:
                data["source_location"]["loc"] = data.pop("loc")
            if "surface" in data:
                data["source_location"]["surface"] = data.pop("surface")
        if "type" in data and "source_type" not in data:
            data["source_type"] = data.pop("type")
        if "source" in data and "source_metadata" not in data:
            data["source_metadata"] = data.pop("source")

        known_fields = {
            "citation_id", "source_hash", "source_location", "verified_at",
            "quote", "context", "source_type", "retention_class", "tags",
            "created_at", "last_accessed", "source_metadata"
        }
        filtered_data = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered_data)


class VerificationResult(dict):
    """Verification result with boolean semantics."""

    def __bool__(self) -> bool:
        return bool(self.get("valid", False))


class CitationManager:
    """
    Citation Manager for handling lifecycle of citations.

    Implements ICitationService interface:
    - create_transient_citation: Create temporary citation from search result
    - make_citation: Persist transient citation with SHA256 hash
    - verify_citation: Verify citation integrity via SHA256
    - get_citation: Retrieve citation by ID
    - list_citations: List citations by source
    - gc_expired: Garbage collect expired citations

    Thread-safe implementation with MemoryManager integration.
    """

    # Default TTL for transient citations (30 minutes)
    DEFAULT_TRANSIENT_TTL_SECONDS = 1800
    # Default TTL for ephemeral persisted citations (24 hours)
    DEFAULT_EPHEMERAL_TTL_SECONDS = 86400

    def __init__(
        self,
        base_path: Union[str, Path] = ".writing",
        memory_manager: Optional['MemoryManager'] = None,
        transient_ttl: int = DEFAULT_TRANSIENT_TTL_SECONDS
    ):
        """
        Initialize the CitationManager.

        Args:
            base_path: Base directory for writing system.
            memory_manager: Optional MemoryManager for integration.
            transient_ttl: TTL in seconds for transient citations.
        """
        self.base_path = Path(base_path)
        self.citations_dir = self.base_path / "citations"
        self.citations_dir.mkdir(parents=True, exist_ok=True)

        self._memory_manager = memory_manager
        self._transient_ttl = transient_ttl
        self._lock = threading.RLock()

        # In-memory cache for transient citations
        self._transient_cache: Dict[str, TransientCitation] = {}

        logger.info(f"CitationManager initialized at {self.citations_dir}")

    def set_memory_manager(self, memory_manager: 'MemoryManager') -> None:
        """
        Set the MemoryManager for integration.

        Args:
            memory_manager: MemoryManager instance.
        """
        self._memory_manager = memory_manager

    # ============================================================
    # ICitationService Implementation
    # ============================================================

    def create_citation(
        self,
        source_text: str,
        location: Dict[str, Any],
        context_before: str = "",
        context_after: str = "",
        score: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TransientCitation:
        """
        Create a transient citation from source text and location.

        Args:
            source_text: The text content to cite.
            location: Location information (path, surface, loc).
            context_before: Text before the citation.
            context_after: Text after the citation.
            score: Relevance score if from search.
            metadata: Additional metadata.

        Returns:
            TransientCitation object.
        """
        normalized_location = self._normalize_search_result_location(location)

        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=self._transient_ttl)

        citation_id = self._generate_citation_id(source_text)
        if metadata and isinstance(metadata, dict):
            metadata_citation_id = metadata.get("citation_id") or metadata.get("id")
            if metadata_citation_id:
                citation_id = metadata_citation_id

        transient = TransientCitation(
            citation_id=citation_id,
            source_text=source_text,
            source_location=normalized_location,
            created_at=now.isoformat(),
            expires_at=expires.isoformat(),
            context_before=context_before,
            context_after=context_after,
            score=score,
            metadata=metadata or {}
        )

        # Cache transient citation
        with self._lock:
            self._transient_cache[citation_id] = transient

        logger.debug(f"Created transient citation: {citation_id}")
        return transient

    def create_transient_citation(
        self,
        source_text: Optional[str] = None,
        location: Optional[Dict[str, Any]] = None,
        source: Optional[Any] = None,
        **kwargs
    ) -> TransientCitation:
        """
        Alias for create_citation (ICitationService compatibility).

        Supports:
        - SearchResult or dict-like results
        - Legacy id/surface/path/quote/loc args
        - source_text + location

        Args:
            source_text: The text content to cite.
            location: Location information.
            source: Optional SearchResult or dict-like result.
            **kwargs: Additional arguments (context_before, context_after, etc.).

        Returns:
            TransientCitation object.
        """
        if source is None and source_text is None and "content" in kwargs:
            source = kwargs.pop("content")

        if source is not None:
            source_payload: Dict[str, Any]
            if hasattr(source, "to_dict"):
                source_payload = source.to_dict()
            elif isinstance(source, dict):
                source_payload = source
            else:
                source_payload = {}

            source_text = source_text or source_payload.get("content")
            location = location or {
                "path": source_payload.get("metadata", {}).get("path"),
                "surface": source_payload.get("metadata", {}).get("surface"),
                "loc": source_payload.get("metadata", {}).get("loc") or source_payload.get("loc"),
            }
            kwargs.setdefault("score", source_payload.get("score"))
            if "metadata" in source_payload:
                kwargs.setdefault("metadata", source_payload.get("metadata"))
            if "id" in source_payload and "citation_id" not in kwargs:
                kwargs["citation_id"] = source_payload.get("id")

        legacy_id = kwargs.pop("id", None)
        legacy_surface = kwargs.pop("surface", None)
        legacy_path = kwargs.pop("path", None)
        legacy_quote = kwargs.pop("quote", None)
        legacy_loc = kwargs.pop("loc", None)

        citation_id = kwargs.pop("citation_id", None) or legacy_id
        if legacy_quote is not None:
            source_text = source_text or legacy_quote

        if location is None:
            location = {}
        if legacy_path is not None:
            location.setdefault("path", legacy_path)
        if legacy_surface is not None:
            location.setdefault("surface", legacy_surface)
        if legacy_loc is not None:
            location.setdefault("loc", legacy_loc)

        if not source_text:
            source_text = ""

        transient = self.create_citation(source_text, location, **kwargs)
        if citation_id:
            original_id = transient.citation_id
            if citation_id != original_id:
                with self._lock:
                    if original_id in self._transient_cache:
                        del self._transient_cache[original_id]
            transient.citation_id = citation_id
            with self._lock:
                self._transient_cache[citation_id] = transient
        return transient

    def persist_citation(
        self,
        transient_id: str,
        retention_class: str = "standard",
        tags: Optional[List[str]] = None
    ) -> Optional[PersistedCitation]:
        """
        Persist a transient citation.

        Args:
            transient_id: ID of the transient citation.
            retention_class: Retention policy.
            tags: Tags to add.

        Returns:
            PersistedCitation if successful, None if transient not found.
        """
        with self._lock:
            transient = self._transient_cache.get(transient_id)
            if not transient:
                logger.warning(f"Transient citation not found: {transient_id}")
                return None

            if transient.is_expired():
                logger.warning(f"Transient citation expired: {transient_id}")
                del self._transient_cache[transient_id]
                return None

            # Calculate SHA256 hash of source text
            source_hash = self._calculate_text_hash(transient.source_text)

            now = datetime.now(timezone.utc).isoformat()

            persisted = PersistedCitation(
                citation_id=transient.citation_id,
                source_hash=source_hash,
                source_location=transient.source_location,
                verified_at=now,
                quote=transient.source_text,
                context={
                    "before": transient.context_before,
                    "after": transient.context_after
                } if transient.context_before or transient.context_after else None,
                source_type=transient.source_location.get("surface", "doc"),
                retention_class=retention_class,
                tags=tags or [],
                created_at=now,
                last_accessed=now,
                source_metadata=transient.metadata
            )

            # Save to disk
            self._save_citation(persisted)

            # Remove from transient cache
            del self._transient_cache[transient_id]

            logger.info(f"Persisted citation: {transient_id}")
            return persisted

    def make_citation(
        self,
        transient: TransientCitation,
        retention_class: str = "standard",
        tags: Optional[List[str]] = None
    ) -> PersistedCitation:
        """
        Convert a TransientCitation to a PersistedCitation directly.

        Args:
            transient: The transient citation to convert.
            retention_class: Retention policy.
            tags: Tags to add.

        Returns:
            The created and saved PersistedCitation.
        """
        source_hash = self._calculate_text_hash(transient.source_text)
        now = datetime.now(timezone.utc).isoformat()

        persisted = PersistedCitation(
            citation_id=transient.citation_id,
            source_hash=source_hash,
            source_location=transient.source_location,
            verified_at=now,
            quote=transient.source_text,
            context={
                "before": transient.context_before,
                "after": transient.context_after
            } if transient.context_before or transient.context_after else None,
            source_type=transient.source_location.get("surface", "doc"),
            retention_class=retention_class,
            tags=tags or [],
            created_at=now,
            last_accessed=now,
            source_metadata=transient.metadata
        )

        self._save_citation(persisted)
        logger.info(f"Made citation: {transient.citation_id}")
        return persisted

    def verify_citation(self, citation_id: str) -> bool:
        """
        Verify the integrity of a citation using SHA256.

        Args:
            citation_id: The ID of the citation.

        Returns:
            True if citation is valid, False otherwise.
        """
        result = self.verify_citation_detailed(citation_id)
        return bool(result.get("valid", False))

    def verify_citation_detailed(self, citation_id: str) -> Dict[str, Any]:
        """
        Verify citation with detailed result.

        Args:
            citation_id: The ID of the citation.

        Returns:
            Dictionary containing verification result.
        """
        citation = self.get_citation(citation_id)
        if not citation:
            logger.warning(f"Citation not found for verification: {citation_id}")
            return {"valid": False, "error": "Citation not found"}

        source_path = citation.source_location.get("path") if citation.source_location else None
        quote_hash = self._calculate_text_hash(citation.quote)
        file_hash = ""
        if source_path and Path(source_path).exists():
            file_hash = self._calculate_file_hash(Path(source_path))

        current_hash = file_hash or quote_hash
        is_valid = citation.source_hash in {quote_hash, file_hash} if file_hash else (quote_hash == citation.source_hash)

        if is_valid:
            citation.verified_at = datetime.now(timezone.utc).isoformat()
            self._save_citation(citation)
            logger.debug(f"Citation verified: {citation_id}")
        else:
            logger.warning(
                f"Citation verification failed: {citation_id} "
                f"(expected={citation.source_hash}, got={current_hash})"
            )

        return {
            "valid": is_valid,
            "stored_hash": citation.source_hash,
            "current_hash": current_hash,
            "verified_at": citation.verified_at if is_valid else None
        }

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
                citation.last_accessed = datetime.now(timezone.utc).isoformat()
                self._save_citation(citation)

                return citation
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning(f"Failed to load citation {citation_id}: {e}")
                return None

    def get_transient_citation(self, citation_id: str) -> Optional[TransientCitation]:
        """
        Retrieve a transient citation from cache.

        Args:
            citation_id: The ID of the citation.

        Returns:
            TransientCitation if found and not expired, None otherwise.
        """
        with self._lock:
            transient = self._transient_cache.get(citation_id)
            if transient and not transient.is_expired():
                return transient
            elif transient:
                del self._transient_cache[citation_id]
            return None

    def list_citations(self, source_id: Optional[str] = None) -> List[PersistedCitation]:
        """
        List all citations, optionally filtered by source.

        Args:
            source_id: Optional source ID to filter by.

        Returns:
            List of PersistedCitation objects.
        """
        citations = []

        with self._lock:
            for file_path in self.citations_dir.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    citation = PersistedCitation.from_dict(data)

                    # Filter by source if specified
                    if source_id:
                        location = citation.source_location
                        if location.get("path") != source_id:
                            continue

                    citations.append(citation)
                except (json.JSONDecodeError, KeyError, TypeError):
                    continue

        # Sort by created_at (newest first)
        citations.sort(
            key=lambda c: c.created_at or "",
            reverse=True
        )
        return citations

    def gc_expired(self, dry_run: bool = False) -> List[str]:
        """
        Garbage collect expired citations.

        Cleans up:
        - Expired transient citations from cache
        - Ephemeral persisted citations older than TTL
        - Orphaned citations (source file does not exist)

        Args:
            dry_run: If True, only return list of IDs to be deleted.

        Returns:
            List of citation IDs that were (or would be) deleted.
        """
        deleted_ids = []
        now = datetime.now(timezone.utc)

        with self._lock:
            # Clean transient cache
            expired_transient = [
                cid for cid, c in self._transient_cache.items()
                if c.is_expired()
            ]
            for cid in expired_transient:
                deleted_ids.append(f"transient:{cid}")
                if not dry_run:
                    del self._transient_cache[cid]

            # Clean persisted citations
            for file_path in list(self.citations_dir.glob("*.json")):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    citation = PersistedCitation.from_dict(data)

                    should_delete = False

                    # Check for ephemeral expiration
                    if citation.retention_class == "ephemeral":
                        if citation.created_at:
                            try:
                                created = datetime.fromisoformat(
                                    citation.created_at.replace("Z", "+00:00")
                                )
                                age = (now - created).total_seconds()
                                if age > self.DEFAULT_EPHEMERAL_TTL_SECONDS:
                                    should_delete = True
                            except ValueError:
                                pass

                    # Check for orphaned citations (optional, based on path)
                    source_path = citation.source_location.get("path")
                    if source_path and not Path(source_path).exists():
                        # Only delete if explicitly orphaned check enabled
                        pass  # Keep orphaned citations by default

                    if should_delete:
                        deleted_ids.append(citation.citation_id)
                        if not dry_run:
                            file_path.unlink()

                except (json.JSONDecodeError, KeyError, TypeError):
                    # Corrupt file
                    deleted_ids.append(file_path.stem)
                    if not dry_run:
                        file_path.unlink()

        if deleted_ids:
            logger.info(f"GC cleaned {len(deleted_ids)} citations (dry_run={dry_run})")

        return deleted_ids

    def gc_orphaned_citations(
        self,
        dry_run: bool = False,
        max_age_seconds: int = DEFAULT_EPHEMERAL_TTL_SECONDS
    ) -> List[str]:
        """
        Garbage collect orphaned or expired citations (legacy API).

        Args:
            dry_run: If True, only return list of IDs to be deleted.
            max_age_seconds: Age in seconds for ephemeral citations to expire.

        Returns:
            List of citation IDs that were (or would be) deleted.
        """
        deleted_ids = []
        now = datetime.now(timezone.utc)

        with self._lock:
            for file_path in list(self.citations_dir.glob("*.json")):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    citation = PersistedCitation.from_dict(data)

                    should_delete = False

                    # Check if source exists
                    source_path = citation.source_location.get("path")
                    if source_path and not Path(source_path).exists():
                        should_delete = True

                    # Check for expiration if ephemeral
                    if not should_delete and citation.retention_class == "ephemeral":
                        if citation.created_at:
                            try:
                                created = datetime.fromisoformat(
                                    citation.created_at.replace("Z", "+00:00")
                                )
                                age = (now - created).total_seconds()
                                if age > max_age_seconds:
                                    should_delete = True
                            except ValueError:
                                pass

                    if should_delete:
                        deleted_ids.append(citation.citation_id)
                        if not dry_run:
                            file_path.unlink()

                except (json.JSONDecodeError, KeyError, TypeError):
                    deleted_ids.append(file_path.stem)
                    if not dry_run:
                        file_path.unlink()

        return deleted_ids

    # ============================================================
    # MemoryManager Integration
    # ============================================================

    def create_citation_from_memory(
        self,
        memory_id: str,
        excerpt: str,
        context_chars: int = 100
    ) -> Optional[TransientCitation]:
        """
        Create a citation from a MemoryManager entry.

        Args:
            memory_id: ID of the memory entry.
            excerpt: The specific text to cite.
            context_chars: Number of context characters.

        Returns:
            TransientCitation if memory found, None otherwise.
        """
        if not self._memory_manager:
            logger.warning("MemoryManager not configured")
            return None

        entry = self._memory_manager.get(memory_id)
        if not entry:
            logger.warning(f"Memory not found: {memory_id}")
            return None

        # Find excerpt in content
        content = entry.content
        start_idx = content.find(excerpt)
        if start_idx == -1:
            # Use full content as excerpt
            start_idx = 0
            excerpt = content[:200] if len(content) > 200 else content

        # Extract context
        context_start = max(0, start_idx - context_chars)
        context_end = min(len(content), start_idx + len(excerpt) + context_chars)

        context_before = content[context_start:start_idx]
        context_after = content[start_idx + len(excerpt):context_end]

        location = {
            "surface": "memory",
            "path": memory_id,
            "loc": {
                "kind": "char",
                "start": start_idx,
                "end": start_idx + len(excerpt)
            }
        }

        return self.create_citation(
            source_text=excerpt,
            location=location,
            context_before=context_before,
            context_after=context_after,
            metadata={
                "memory_id": memory_id,
                "topics": entry.topics,
                "entity_id": entry.entity_id,
                "importance": entry.importance
            }
        )

    # ============================================================
    # Private Methods
    # ============================================================

    def _generate_citation_id(self, source_text: str) -> str:
        """Generate unique citation ID based on content hash and timestamp."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        content_hash = hashlib.sha256(source_text.encode("utf-8")).hexdigest()[:8]
        random_suffix = uuid.uuid4().hex[:6]
        return f"cit-{timestamp}-{content_hash}-{random_suffix}"

    def _normalize_search_result_location(self, location: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize location payload to expected SearchResult location shape."""
        if not location:
            return {"path": None, "surface": None, "loc": None}

        path = location.get("path")
        surface = location.get("surface")
        loc = location.get("loc")

        normalized_loc: Optional[SearchResultLocation] = None
        if loc:
            kind = loc.get("kind") or "char"
            start = int(loc.get("start") or 0)
            end = loc.get("end")
            end_value = int(end) if end is not None else None
            normalized_loc = {"kind": kind, "start": start, "end": end_value}

        return {
            "path": path,
            "surface": surface,
            "loc": normalized_loc,
        }


    def _calculate_text_hash(self, text: str) -> str:
        """Calculate SHA256 hash of text content."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

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

    def _get_citation_path(self, citation_id: str) -> Path:
        """Get the file path for a citation ID."""
        return self.citations_dir / f"{citation_id}.json"

    def _save_citation(self, citation: PersistedCitation) -> None:
        """Save citation to disk."""
        file_path = self._get_citation_path(citation.citation_id)
        with self._lock:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(citation.to_dict(), f, ensure_ascii=False, indent=2)

    # ============================================================
    # Legacy API Compatibility
    # ============================================================

    def add_citation(self, citation: PersistedCitation) -> None:
        """Add (save) a citation to storage (legacy API)."""
        if not citation.created_at:
            citation.created_at = datetime.now(timezone.utc).isoformat()
        self._save_citation(citation)

    def update_citation(self, citation: PersistedCitation) -> None:
        """Update an existing citation (legacy API)."""
        self._save_citation(citation)

    def delete_citation(self, citation_id: str) -> bool:
        """Delete a citation (legacy API)."""
        file_path = self._get_citation_path(citation_id)
        with self._lock:
            if file_path.exists():
                file_path.unlink()
                return True
            return False

    # ============================================================
    # Statistics
    # ============================================================

    def stats(self) -> Dict[str, Any]:
        """Get citation statistics."""
        with self._lock:
            persisted_count = len(list(self.citations_dir.glob("*.json")))
            transient_count = len(self._transient_cache)
            expired_transient = sum(
                1 for c in self._transient_cache.values() if c.is_expired()
            )

        return {
            "persisted_count": persisted_count,
            "transient_count": transient_count,
            "expired_transient_count": expired_transient,
            "citations_dir": str(self.citations_dir)
        }


# ============================================================
# Factory Functions
# ============================================================

_citation_manager: Optional[CitationManager] = None


def get_citation_manager(
    base_path: Union[str, Path] = ".writing",
    memory_manager: Optional['MemoryManager'] = None
) -> CitationManager:
    """
    Get or create CitationManager singleton.

    Args:
        base_path: Base directory for writing system.
        memory_manager: Optional MemoryManager for integration.

    Returns:
        CitationManager instance.
    """
    global _citation_manager
    if _citation_manager is None:
        _citation_manager = CitationManager(base_path, memory_manager)
    elif memory_manager and not _citation_manager._memory_manager:
        _citation_manager.set_memory_manager(memory_manager)
    return _citation_manager


def reset_citation_manager() -> None:
    """Reset CitationManager singleton (for testing)."""
    global _citation_manager
    _citation_manager = None

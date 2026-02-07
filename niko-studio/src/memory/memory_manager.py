"""
MemoryManager - OpenKL 时序记忆管理

实现 OpenKL 文件系统契约:
1. by_date 时间组织: memories/by_date/YYYY/MM/DD/
2. topics 软链接索引: memories/topics/{topic}/
3. YAML Frontmatter 元数据
4. 时序追踪与版本控制
"""

import os
import json
import logging
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
import yaml

logger = logging.getLogger("niko-memory-manager")


@dataclass
class MemoryEntry:
    """
    时序记忆条目 - YAML Frontmatter 格式

    Attributes:
        id: Unique identifier
        content: Memory content
        created_at: Creation timestamp (ISO format)
        updated_at: Last update timestamp
        topics: Associated topics for indexing
        entity_id: Related entity (character, location, etc.)
        valid_from: Temporal validity start
        valid_until: Temporal validity end (None = still valid)
        supersedes: ID of memory this supersedes
        superseded_by: ID of memory that supersedes this
        importance: Importance score (0.0-1.0)
        source: Source of memory (user, agent, distill)
        metadata: Additional metadata
    """
    id: str
    content: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    topics: List[str] = field(default_factory=list)
    entity_id: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    supersedes: Optional[str] = None
    superseded_by: Optional[str] = None
    importance: float = 0.5
    source: str = "user"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_yaml_frontmatter(self) -> str:
        """Convert to YAML frontmatter format."""
        frontmatter = {
            "id": self.id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "topics": self.topics,
            "entity_id": self.entity_id,
            "valid_from": self.valid_from,
            "valid_until": self.valid_until,
            "supersedes": self.supersedes,
            "superseded_by": self.superseded_by,
            "importance": self.importance,
            "source": self.source,
            "metadata": self.metadata
        }
        # Remove None values
        frontmatter = {k: v for k, v in frontmatter.items() if v is not None}

        yaml_content = yaml.dump(frontmatter, allow_unicode=True, default_flow_style=False)
        return f"---\n{yaml_content}---\n\n{self.content}"

    @classmethod
    def from_yaml_file(cls, file_path: Path) -> 'MemoryEntry':
        """Parse from YAML frontmatter file."""
        content = file_path.read_text(encoding="utf-8")
        return cls.from_yaml_content(content)

    @classmethod
    def from_yaml_content(cls, content: str) -> 'MemoryEntry':
        """Parse from YAML frontmatter string."""
        if not content.startswith("---"):
            raise ValueError("Invalid YAML frontmatter format")

        # Split frontmatter and content
        parts = content.split("---", 2)
        if len(parts) < 3:
            raise ValueError("Invalid YAML frontmatter format")

        frontmatter_str = parts[1].strip()
        body = parts[2].strip()

        frontmatter = yaml.safe_load(frontmatter_str) or {}

        return cls(
            id=frontmatter.get("id", ""),
            content=body,
            created_at=frontmatter.get("created_at", datetime.now().isoformat()),
            updated_at=frontmatter.get("updated_at", datetime.now().isoformat()),
            topics=frontmatter.get("topics", []),
            entity_id=frontmatter.get("entity_id"),
            valid_from=frontmatter.get("valid_from"),
            valid_until=frontmatter.get("valid_until"),
            supersedes=frontmatter.get("supersedes"),
            superseded_by=frontmatter.get("superseded_by"),
            importance=frontmatter.get("importance", 0.5),
            source=frontmatter.get("source", "user"),
            metadata=frontmatter.get("metadata", {})
        )


class MemoryManager:
    """
    OpenKL 时序记忆管理器

    文件系统结构:
    ```
    .writing/memories/
    ├── by_date/
    │   └── 2024/
    │       └── 01/
    │           └── 15/
    │               └── {memory_id}.md
    ├── topics/
    │   ├── character/
    │   │   └── {memory_id}.md -> ../../by_date/.../
    │   ├── worldview/
    │   │   └── {memory_id}.md -> ../../by_date/.../
    │   └── plot/
    │       └── {memory_id}.md -> ../../by_date/.../
    └── index.json
    ```
    """

    def __init__(self, base_path: Union[str, Path] = ".writing"):
        """
        Initialize MemoryManager.

        Args:
            base_path: Base directory for writing system
        """
        self.base_path = Path(base_path)
        self.memories_dir = self.base_path / "memories"
        self.by_date_dir = self.memories_dir / "by_date"
        self.topics_dir = self.memories_dir / "topics"
        self.index_path = self.memories_dir / "index.json"

        self._ensure_directories()
        self._index = self._load_index()

    def _ensure_directories(self):
        """Create required directories."""
        self.memories_dir.mkdir(parents=True, exist_ok=True)
        self.by_date_dir.mkdir(exist_ok=True)
        self.topics_dir.mkdir(exist_ok=True)

    def _load_index(self) -> Dict[str, Any]:
        """Load or create index."""
        if self.index_path.exists():
            try:
                return json.loads(self.index_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.warning("Corrupted index, rebuilding...")
                return self._rebuild_index()
        return {"memories": {}, "topics": {}, "entities": {}}

    def _save_index(self):
        """Save index to disk."""
        self.index_path.write_text(
            json.dumps(self._index, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def _rebuild_index(self) -> Dict[str, Any]:
        """Rebuild index from filesystem."""
        index = {"memories": {}, "topics": {}, "entities": {}}

        # Scan by_date directory
        for year_dir in self.by_date_dir.iterdir():
            if not year_dir.is_dir():
                continue
            for month_dir in year_dir.iterdir():
                if not month_dir.is_dir():
                    continue
                for day_dir in month_dir.iterdir():
                    if not day_dir.is_dir():
                        continue
                    for memory_file in day_dir.glob("*.md"):
                        try:
                            entry = MemoryEntry.from_yaml_file(memory_file)
                            relative_path = memory_file.relative_to(self.memories_dir)
                            index["memories"][entry.id] = str(relative_path)

                            # Index topics
                            for topic in entry.topics:
                                if topic not in index["topics"]:
                                    index["topics"][topic] = []
                                index["topics"][topic].append(entry.id)

                            # Index entities
                            if entry.entity_id:
                                if entry.entity_id not in index["entities"]:
                                    index["entities"][entry.entity_id] = []
                                index["entities"][entry.entity_id].append(entry.id)
                        except Exception as e:
                            logger.warning(f"Failed to index {memory_file}: {e}")

        return index

    def _generate_id(self, content: str) -> str:
        """Generate unique ID based on content hash and timestamp."""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:8]
        return f"mem-{timestamp}-{content_hash}"

    def _get_date_path(self, dt: datetime = None) -> Path:
        """Get path for date-based organization."""
        dt = dt or datetime.now()
        return self.by_date_dir / str(dt.year) / f"{dt.month:02d}" / f"{dt.day:02d}"

    def add(
        self,
        content: str,
        topics: List[str] = None,
        entity_id: str = None,
        valid_from: str = None,
        valid_until: str = None,
        importance: float = 0.5,
        source: str = "user",
        metadata: Dict[str, Any] = None
    ) -> MemoryEntry:
        """
        Add a new memory entry.

        Args:
            content: Memory content
            topics: List of topics for indexing
            entity_id: Related entity ID
            valid_from: Temporal validity start
            valid_until: Temporal validity end
            importance: Importance score
            source: Memory source
            metadata: Additional metadata

        Returns:
            Created MemoryEntry
        """
        memory_id = self._generate_id(content)
        now = datetime.now()

        entry = MemoryEntry(
            id=memory_id,
            content=content,
            created_at=now.isoformat(),
            updated_at=now.isoformat(),
            topics=topics or [],
            entity_id=entity_id,
            valid_from=valid_from or now.isoformat(),
            valid_until=valid_until,
            importance=importance,
            source=source,
            metadata=metadata or {}
        )

        # Save to by_date structure
        date_path = self._get_date_path(now)
        date_path.mkdir(parents=True, exist_ok=True)

        memory_file = date_path / f"{memory_id}.md"
        memory_file.write_text(entry.to_yaml_frontmatter(), encoding="utf-8")

        # Create topic symlinks
        self._create_topic_links(entry, memory_file)

        # Update index
        relative_path = memory_file.relative_to(self.memories_dir)
        self._index["memories"][memory_id] = str(relative_path)

        for topic in entry.topics:
            if topic not in self._index["topics"]:
                self._index["topics"][topic] = []
            self._index["topics"][topic].append(memory_id)

        if entity_id:
            if entity_id not in self._index["entities"]:
                self._index["entities"][entity_id] = []
            self._index["entities"][entity_id].append(memory_id)

        self._save_index()

        logger.info(f"Added memory: {memory_id}")
        return entry

    def _create_topic_links(self, entry: MemoryEntry, source_file: Path):
        """Create symbolic links in topic directories."""
        for topic in entry.topics:
            topic_dir = self.topics_dir / topic
            topic_dir.mkdir(parents=True, exist_ok=True)

            link_path = topic_dir / f"{entry.id}.md"

            # Calculate relative path from topic dir to source file
            try:
                relative_source = os.path.relpath(source_file, topic_dir)

                # Remove existing link if exists
                if link_path.exists() or link_path.is_symlink():
                    link_path.unlink()

                # Create symlink (use junction on Windows if symlink fails)
                try:
                    link_path.symlink_to(relative_source)
                except OSError:
                    # Fallback: copy file instead of symlink (Windows without admin)
                    link_path.write_text(source_file.read_text(encoding="utf-8"), encoding="utf-8")
                    logger.debug(f"Copied instead of symlink: {link_path}")
            except Exception as e:
                logger.warning(f"Failed to create topic link for {topic}: {e}")

    def get(self, memory_id: str) -> Optional[MemoryEntry]:
        """
        Get memory by ID.

        Args:
            memory_id: Memory identifier

        Returns:
            MemoryEntry or None if not found
        """
        if memory_id not in self._index["memories"]:
            return None

        relative_path = self._index["memories"][memory_id]
        file_path = self.memories_dir / relative_path

        if not file_path.exists():
            logger.warning(f"Memory file not found: {file_path}")
            return None

        return MemoryEntry.from_yaml_file(file_path)

    def update(
        self,
        memory_id: str,
        content: str = None,
        topics: List[str] = None,
        valid_until: str = None,
        importance: float = None,
        metadata: Dict[str, Any] = None
    ) -> Optional[MemoryEntry]:
        """
        Update an existing memory.

        Args:
            memory_id: Memory identifier
            content: New content (optional)
            topics: New topics (optional)
            valid_until: New validity end (optional)
            importance: New importance (optional)
            metadata: Additional metadata to merge

        Returns:
            Updated MemoryEntry or None
        """
        entry = self.get(memory_id)
        if not entry:
            return None

        # Update fields
        if content is not None:
            entry.content = content
        if topics is not None:
            old_topics = set(entry.topics)
            new_topics = set(topics)
            entry.topics = topics

            # Update topic links
            removed_topics = old_topics - new_topics
            added_topics = new_topics - old_topics

            for topic in removed_topics:
                link_path = self.topics_dir / topic / f"{memory_id}.md"
                if link_path.exists() or link_path.is_symlink():
                    link_path.unlink()

            # Get source file for new links
            relative_path = self._index["memories"][memory_id]
            source_file = self.memories_dir / relative_path

            for topic in added_topics:
                topic_dir = self.topics_dir / topic
                topic_dir.mkdir(parents=True, exist_ok=True)
                link_path = topic_dir / f"{memory_id}.md"
                try:
                    relative_source = os.path.relpath(source_file, topic_dir)
                    link_path.symlink_to(relative_source)
                except OSError:
                    link_path.write_text(source_file.read_text(encoding="utf-8"), encoding="utf-8")

        if valid_until is not None:
            entry.valid_until = valid_until
        if importance is not None:
            entry.importance = importance
        if metadata:
            entry.metadata.update(metadata)

        entry.updated_at = datetime.now().isoformat()

        # Save updated entry
        relative_path = self._index["memories"][memory_id]
        file_path = self.memories_dir / relative_path
        file_path.write_text(entry.to_yaml_frontmatter(), encoding="utf-8")

        logger.info(f"Updated memory: {memory_id}")
        return entry

    def supersede(
        self,
        old_memory_id: str,
        new_content: str,
        topics: List[str] = None
    ) -> Optional[MemoryEntry]:
        """
        Create a new memory that supersedes an existing one.

        Args:
            old_memory_id: ID of memory to supersede
            new_content: Content of new memory
            topics: Topics for new memory (inherits from old if not provided)

        Returns:
            New MemoryEntry or None
        """
        old_entry = self.get(old_memory_id)
        if not old_entry:
            return None

        # Create new entry
        new_entry = self.add(
            content=new_content,
            topics=topics or old_entry.topics,
            entity_id=old_entry.entity_id,
            importance=old_entry.importance,
            source=old_entry.source,
            metadata=old_entry.metadata
        )

        # Update new entry to reference old
        new_entry.supersedes = old_memory_id
        self.update(new_entry.id, metadata={"supersedes": old_memory_id})

        # Mark old entry as superseded
        old_entry.superseded_by = new_entry.id
        old_entry.valid_until = datetime.now().isoformat()
        self.update(
            old_memory_id,
            valid_until=old_entry.valid_until,
            metadata={"superseded_by": new_entry.id}
        )

        logger.info(f"Superseded {old_memory_id} with {new_entry.id}")
        return new_entry

    def delete(self, memory_id: str) -> bool:
        """
        Delete a memory.

        Args:
            memory_id: Memory identifier

        Returns:
            True if deleted
        """
        if memory_id not in self._index["memories"]:
            return False

        # Get entry for topic cleanup
        entry = self.get(memory_id)

        # Delete file
        relative_path = self._index["memories"][memory_id]
        file_path = self.memories_dir / relative_path
        if file_path.exists():
            file_path.unlink()

        # Delete topic links
        if entry:
            for topic in entry.topics:
                link_path = self.topics_dir / topic / f"{memory_id}.md"
                if link_path.exists() or link_path.is_symlink():
                    link_path.unlink()

        # Update index
        del self._index["memories"][memory_id]

        for topic in list(self._index["topics"].keys()):
            if memory_id in self._index["topics"][topic]:
                self._index["topics"][topic].remove(memory_id)

        if entry and entry.entity_id:
            if entry.entity_id in self._index["entities"]:
                if memory_id in self._index["entities"][entry.entity_id]:
                    self._index["entities"][entry.entity_id].remove(memory_id)

        self._save_index()

        logger.info(f"Deleted memory: {memory_id}")
        return True

    def get_by_topic(self, topic: str) -> List[MemoryEntry]:
        """
        Get all memories for a topic.

        Args:
            topic: Topic name

        Returns:
            List of MemoryEntry objects
        """
        if topic not in self._index["topics"]:
            return []

        entries = []
        for memory_id in self._index["topics"][topic]:
            entry = self.get(memory_id)
            if entry:
                entries.append(entry)

        return entries

    def get_by_entity(self, entity_id: str) -> List[MemoryEntry]:
        """
        Get all memories for an entity.

        Args:
            entity_id: Entity identifier

        Returns:
            List of MemoryEntry objects
        """
        if entity_id not in self._index["entities"]:
            return []

        entries = []
        for memory_id in self._index["entities"][entity_id]:
            entry = self.get(memory_id)
            if entry:
                entries.append(entry)

        return entries

    def get_by_date(
        self,
        target_date: Union[date, str],
        include_superseded: bool = False
    ) -> List[MemoryEntry]:
        """
        Get all memories for a specific date.

        Args:
            target_date: Target date
            include_superseded: Whether to include superseded memories

        Returns:
            List of MemoryEntry objects
        """
        if isinstance(target_date, str):
            target_date = datetime.fromisoformat(target_date).date()

        date_path = self.by_date_dir / str(target_date.year) / f"{target_date.month:02d}" / f"{target_date.day:02d}"

        if not date_path.exists():
            return []

        entries = []
        for memory_file in date_path.glob("*.md"):
            try:
                entry = MemoryEntry.from_yaml_file(memory_file)
                if not include_superseded and entry.superseded_by:
                    continue
                entries.append(entry)
            except Exception as e:
                logger.warning(f"Failed to read {memory_file}: {e}")

        return entries

    def get_temporal_facts(
        self,
        entity_id: str,
        at_time: str = None
    ) -> List[MemoryEntry]:
        """
        Get facts about an entity valid at a specific time.

        Args:
            entity_id: Entity identifier
            at_time: Point in time (ISO format), defaults to now

        Returns:
            List of valid MemoryEntry objects
        """
        at_time = at_time or datetime.now().isoformat()

        all_entries = self.get_by_entity(entity_id)
        valid_entries = []

        for entry in all_entries:
            # Skip superseded entries
            if entry.superseded_by:
                continue

            # Check temporal validity
            if entry.valid_from and entry.valid_from > at_time:
                continue
            if entry.valid_until and entry.valid_until <= at_time:
                continue

            valid_entries.append(entry)

        # Sort by importance
        valid_entries.sort(key=lambda e: e.importance, reverse=True)
        return valid_entries

    def list_topics(self) -> List[str]:
        """Get all topic names."""
        return list(self._index["topics"].keys())

    def stats(self) -> Dict[str, Any]:
        """Get memory statistics."""
        return {
            "total_memories": len(self._index["memories"]),
            "total_topics": len(self._index["topics"]),
            "total_entities": len(self._index["entities"]),
            "topics": {k: len(v) for k, v in self._index["topics"].items()}
        }

    # ============================================================
    # Alias Methods (OpenKL API Compatibility)
    # ============================================================

    def save_memory(
        self,
        content: str,
        topics: List[str] = None,
        entity_id: str = None,
        importance: float = 0.5,
        source: str = "user",
        metadata: Dict[str, Any] = None
    ) -> MemoryEntry:
        """
        Save a memory entry (alias for add).

        Args:
            content: Memory content
            topics: List of topics for indexing
            entity_id: Related entity ID
            importance: Importance score (0.0-1.0)
            source: Memory source
            metadata: Additional metadata

        Returns:
            Created MemoryEntry
        """
        return self.add(
            content=content,
            topics=topics,
            entity_id=entity_id,
            importance=importance,
            source=source,
            metadata=metadata
        )

    def load_memory(self, memory_id: str) -> Optional[MemoryEntry]:
        """
        Load a memory entry by ID (alias for get).

        Args:
            memory_id: Memory identifier

        Returns:
            MemoryEntry or None if not found
        """
        return self.get(memory_id)

    def list_by_date(
        self,
        start_date: Union[date, str] = None,
        end_date: Union[date, str] = None,
        include_superseded: bool = False
    ) -> List[MemoryEntry]:
        """
        List memories within a date range.

        Args:
            start_date: Start date (inclusive), defaults to 7 days ago
            end_date: End date (inclusive), defaults to today
            include_superseded: Whether to include superseded memories

        Returns:
            List of MemoryEntry objects sorted by date (newest first)
        """
        from datetime import timedelta

        # Parse dates
        if end_date is None:
            end_date = date.today()
        elif isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date).date()

        if start_date is None:
            start_date = end_date - timedelta(days=7)
        elif isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date()

        entries = []
        current_date = start_date

        while current_date <= end_date:
            day_entries = self.get_by_date(current_date, include_superseded)
            entries.extend(day_entries)
            current_date += timedelta(days=1)

        # Sort by created_at (newest first)
        entries.sort(key=lambda e: e.created_at, reverse=True)
        return entries

    def list_by_topic(
        self,
        topic: str,
        limit: int = 100,
        include_superseded: bool = False
    ) -> List[MemoryEntry]:
        """
        List memories for a topic with optional filtering.

        Args:
            topic: Topic name
            limit: Maximum number of entries to return
            include_superseded: Whether to include superseded memories

        Returns:
            List of MemoryEntry objects sorted by importance (highest first)
        """
        entries = self.get_by_topic(topic)

        if not include_superseded:
            entries = [e for e in entries if not e.superseded_by]

        # Sort by importance (highest first), then by created_at (newest first)
        entries.sort(key=lambda e: (e.importance, e.created_at), reverse=True)

        return entries[:limit]

    def search(
        self,
        query: str,
        topics: List[str] = None,
        entity_id: str = None,
        limit: int = 20
    ) -> List[MemoryEntry]:
        """
        Simple text search across memories.

        Args:
            query: Search query string
            topics: Filter by topics
            entity_id: Filter by entity
            limit: Maximum results

        Returns:
            List of matching MemoryEntry objects
        """
        results = []
        query_lower = query.lower()

        # Get candidate memories
        if entity_id:
            candidates = self.get_by_entity(entity_id)
        elif topics:
            candidates = []
            for topic in topics:
                candidates.extend(self.get_by_topic(topic))
            # Remove duplicates
            seen_ids = set()
            unique_candidates = []
            for c in candidates:
                if c.id not in seen_ids:
                    seen_ids.add(c.id)
                    unique_candidates.append(c)
            candidates = unique_candidates
        else:
            # Search all memories
            candidates = []
            for memory_id in self._index["memories"]:
                entry = self.get(memory_id)
                if entry:
                    candidates.append(entry)

        # Filter by query
        for entry in candidates:
            if entry.superseded_by:
                continue
            if query_lower in entry.content.lower():
                results.append(entry)
                if len(results) >= limit:
                    break

        # Sort by importance
        results.sort(key=lambda e: e.importance, reverse=True)
        return results


# ============================================================
# MemoryService Integration
# ============================================================

class MemoryManagerAdapter:
    """
    Adapter to integrate MemoryManager with MemoryService.

    Provides a unified interface for both file-based (OpenKL) and
    vector-based (MemoryService) memory operations.
    """

    def __init__(
        self,
        memory_manager: MemoryManager = None,
        memory_service: Any = None,
        base_path: Union[str, Path] = ".writing"
    ):
        """
        Initialize adapter.

        Args:
            memory_manager: Optional MemoryManager instance
            memory_service: Optional MemoryService instance
            base_path: Base path for MemoryManager
        """
        self._manager = memory_manager or MemoryManager(base_path)
        self._service = memory_service

    @property
    def manager(self) -> MemoryManager:
        """Get MemoryManager instance."""
        return self._manager

    @property
    def service(self) -> Optional[Any]:
        """Get MemoryService instance (if available)."""
        return self._service

    async def save(
        self,
        content: str,
        topics: List[str] = None,
        entity_id: str = None,
        importance: float = 0.5,
        source: str = "user",
        metadata: Dict[str, Any] = None,
        index_in_vector: bool = True
    ) -> MemoryEntry:
        """
        Save memory to both file system and vector store.

        Args:
            content: Memory content
            topics: Topic tags
            entity_id: Related entity
            importance: Importance score
            source: Memory source
            metadata: Additional metadata
            index_in_vector: Whether to also index in vector store

        Returns:
            Created MemoryEntry
        """
        # Save to file system (OpenKL format)
        entry = self._manager.save_memory(
            content=content,
            topics=topics,
            entity_id=entity_id,
            importance=importance,
            source=source,
            metadata=metadata
        )

        # Also index in vector store if service available
        if index_in_vector and self._service:
            try:
                from src.services.memory_service import Message, AddOptions
                messages = [Message(role="memory", content=content)]
                options = AddOptions(
                    namespace="memories",
                    tags=topics,
                    importance=importance
                )
                await self._service.add(messages, options)
            except Exception as e:
                logger.warning(f"Failed to index in vector store: {e}")

        return entry

    async def search_hybrid(
        self,
        query: str,
        topics: List[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search across both file and vector stores.

        Args:
            query: Search query
            topics: Filter topics
            limit: Maximum results

        Returns:
            List of search results with scores
        """
        results = []

        # File-based search
        file_results = self._manager.search(query, topics=topics, limit=limit)
        for entry in file_results:
            results.append({
                "id": entry.id,
                "content": entry.content,
                "score": entry.importance,
                "source": "file",
                "topics": entry.topics,
                "metadata": entry.metadata
            })

        # Vector search if available
        if self._service:
            try:
                from src.services.memory_service import SearchOptions
                vector_results = await self._service.search(
                    query,
                    SearchOptions(namespace="memories", limit=limit)
                )
                for vr in vector_results:
                    # Avoid duplicates
                    if not any(r["id"] == vr.id for r in results):
                        results.append({
                            "id": vr.id,
                            "content": vr.content,
                            "score": vr.score,
                            "source": "vector",
                            "topics": vr.metadata.get("tags", []),
                            "metadata": vr.metadata
                        })
            except Exception as e:
                logger.warning(f"Vector search failed: {e}")

        # Sort by score
        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:limit]


# ============================================================
# Factory Functions
# ============================================================

_memory_manager: Optional[MemoryManager] = None


def get_memory_manager(base_path: Union[str, Path] = ".writing") -> MemoryManager:
    """
    Get or create MemoryManager singleton.

    Args:
        base_path: Base directory for writing system

    Returns:
        MemoryManager instance
    """
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager(base_path)
    return _memory_manager


def reset_memory_manager():
    """Reset MemoryManager singleton (for testing)."""
    global _memory_manager
    _memory_manager = None

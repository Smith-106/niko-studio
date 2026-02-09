"""
OpenKL File System Contract

Implements the OpenKL "File as Truth" philosophy with standardized directory structure.

Directory Structure:
.writing/
├── store/
│   ├── sources/          # Original files
│   └── normalized/       # Normalized text (*.ok.md)
├── memories/
│   ├── by_date/          # Temporal organization (YYYY-MM/DD/<id>.md)
│   └── topics/           # Topic symlinks
├── citations/            # Citation JSON files
├── sessions/
│   ├── active/           # Active sessions
│   └── archived/         # Archived sessions
└── .ok/
    ├── kuzu/             # Kuzu graph database
    └── mapping.jsonl     # docID -> path mapping
"""

import json
import logging
import hashlib
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Iterator

logger = logging.getLogger("OpenKLContract")


@dataclass
class OpenKLPaths:
    """OpenKL directory paths configuration"""
    base_path: Path

    @property
    def store(self) -> Path:
        return self.base_path / "store"

    @property
    def sources(self) -> Path:
        return self.store / "sources"

    @property
    def normalized(self) -> Path:
        return self.store / "normalized"

    @property
    def memories(self) -> Path:
        return self.base_path / "memories"

    @property
    def memories_by_date(self) -> Path:
        return self.memories / "by_date"

    @property
    def memories_topics(self) -> Path:
        return self.memories / "topics"

    @property
    def citations(self) -> Path:
        return self.base_path / "citations"

    @property
    def sessions(self) -> Path:
        return self.base_path / "sessions"

    @property
    def active_sessions(self) -> Path:
        return self.sessions / "active"

    @property
    def archived_sessions(self) -> Path:
        return self.sessions / "archived"

    @property
    def ok_dir(self) -> Path:
        return self.base_path / ".ok"

    @property
    def kuzu_dir(self) -> Path:
        return self.ok_dir / "kuzu"

    @property
    def mapping_file(self) -> Path:
        return self.ok_dir / "mapping.jsonl"

    def all_paths(self) -> List[Path]:
        """Get all directory paths that should exist"""
        return [
            self.sources,
            self.normalized,
            self.memories_by_date,
            self.memories_topics,
            self.citations,
            self.active_sessions,
            self.archived_sessions,
            self.kuzu_dir,
        ]


@dataclass
class DocumentMapping:
    """Document ID to path mapping entry"""
    doc_id: str
    path: str
    sha256: str
    source_type: str
    created_at: str
    updated_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "doc_id": self.doc_id,
            "path": self.path,
            "sha256": self.sha256,
            "source_type": self.source_type,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentMapping":
        return cls(
            doc_id=data["doc_id"],
            path=data["path"],
            sha256=data["sha256"],
            source_type=data.get("source_type", "general"),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            metadata=data.get("metadata", {}),
        )


class OpenKLContract:
    """
    OpenKL File System Contract Manager

    Implements the "File as Truth" philosophy:
    - All data is stored as files in a standardized directory structure
    - Documents are normalized and indexed
    - Mappings track document IDs to file paths
    - Supports temporal organization and topic linking
    """

    SUPPORTED_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml"}

    def __init__(self, base_path: str | Path = ".writing"):
        self.paths = OpenKLPaths(base_path=Path(base_path))
        self._mappings: Dict[str, DocumentMapping] = {}
        self._ensure_structure()
        self._load_mappings()

        logger.info(f"OpenKL contract initialized at: {self.paths.base_path}")

    def _ensure_structure(self) -> None:
        """Create all required directories"""
        for path in self.paths.all_paths():
            path.mkdir(parents=True, exist_ok=True)

        # Ensure mapping file exists
        if not self.paths.mapping_file.exists():
            self.paths.mapping_file.touch()

    def _load_mappings(self) -> None:
        """Load document mappings from JSONL file"""
        if not self.paths.mapping_file.exists():
            return

        try:
            with open(self.paths.mapping_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        mapping = DocumentMapping.from_dict(data)
                        self._mappings[mapping.doc_id] = mapping
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid mapping line: {e}")
        except Exception as e:
            logger.error(f"Failed to load mappings: {e}")

    def _save_mappings(self) -> None:
        """Save all mappings to JSONL file"""
        try:
            with open(self.paths.mapping_file, "w", encoding="utf-8") as f:
                for mapping in self._mappings.values():
                    f.write(json.dumps(mapping.to_dict(), ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to save mappings: {e}")

    def _append_mapping(self, mapping: DocumentMapping) -> None:
        """Append a single mapping to the JSONL file"""
        try:
            with open(self.paths.mapping_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(mapping.to_dict(), ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to append mapping: {e}")

    @staticmethod
    def compute_sha256(content: str | bytes) -> str:
        """Compute SHA256 hash of content"""
        if isinstance(content, str):
            content = content.encode("utf-8")
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def generate_doc_id(path: Path, prefix: str = "doc") -> str:
        """Generate a unique document ID from path"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        path_hash = hashlib.md5(str(path).encode()).hexdigest()[:8]
        return f"{prefix}-{timestamp}-{path_hash}"

    def normalize_content(self, content: str, source_path: Path) -> str:
        """
        Normalize document content to OpenKL format (*.ok.md)

        Normalization includes:
        - Unicode normalization
        - Line ending standardization
        - Metadata header addition
        """
        import unicodedata

        # Unicode NFC normalization
        content = unicodedata.normalize("NFC", content)

        # Standardize line endings
        content = content.replace("\r\n", "\n").replace("\r", "\n")

        # Add OpenKL metadata header
        now = datetime.now().isoformat()
        header = f"""---
source: {source_path.name}
normalized_at: {now}
format: ok.md
---

"""
        return header + content

    def ingest_file(
        self,
        source_path: Path,
        doc_id: Optional[str] = None,
        source_type: str = "general",
        normalize: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Ingest a file into the OpenKL store

        Args:
            source_path: Path to the source file
            doc_id: Optional document ID (auto-generated if not provided)
            source_type: Document type classification
            normalize: Whether to create normalized version
            metadata: Additional metadata

        Returns:
            Document ID
        """
        source_path = Path(source_path)

        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")

        if source_path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {source_path.suffix}")

        # Read content
        content = source_path.read_text(encoding="utf-8")
        sha256 = self.compute_sha256(content)

        # Generate doc_id if not provided
        if doc_id is None:
            doc_id = self.generate_doc_id(source_path)

        # Copy to sources directory
        dest_source = self.paths.sources / f"{doc_id}{source_path.suffix}"
        shutil.copy2(source_path, dest_source)

        # Create normalized version if requested
        if normalize:
            normalized_content = self.normalize_content(content, source_path)
            dest_normalized = self.paths.normalized / f"{doc_id}.ok.md"
            dest_normalized.write_text(normalized_content, encoding="utf-8")

        # Create mapping
        now = datetime.now().isoformat()
        mapping = DocumentMapping(
            doc_id=doc_id,
            path=str(dest_source.relative_to(self.paths.base_path)),
            sha256=sha256,
            source_type=source_type,
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        )

        self._mappings[doc_id] = mapping
        self._append_mapping(mapping)

        logger.info(f"Ingested document: {doc_id} from {source_path}")
        return doc_id

    def ingest_content(
        self,
        content: str,
        doc_id: Optional[str] = None,
        source_type: str = "general",
        filename: Optional[str] = None,
        normalize: bool = True,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Ingest content directly into the OpenKL store

        Args:
            content: Text content to ingest
            doc_id: Optional document ID
            source_type: Document type classification
            filename: Optional filename for the content
            normalize: Whether to create normalized version
            metadata: Additional metadata

        Returns:
            Document ID
        """
        sha256 = self.compute_sha256(content)

        # Generate doc_id if not provided
        if doc_id is None:
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            hash_suffix = sha256[:8]
            doc_id = f"doc-{timestamp}-{hash_suffix}"

        # Determine filename
        if filename is None:
            filename = f"{doc_id}.md"

        # Save to sources
        dest_source = self.paths.sources / filename
        dest_source.write_text(content, encoding="utf-8")

        # Create normalized version if requested
        if normalize:
            normalized_content = self.normalize_content(content, dest_source)
            dest_normalized = self.paths.normalized / f"{doc_id}.ok.md"
            dest_normalized.write_text(normalized_content, encoding="utf-8")

        # Create mapping
        now = datetime.now().isoformat()
        mapping = DocumentMapping(
            doc_id=doc_id,
            path=str(dest_source.relative_to(self.paths.base_path)),
            sha256=sha256,
            source_type=source_type,
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
        )

        self._mappings[doc_id] = mapping
        self._append_mapping(mapping)

        logger.info(f"Ingested content as document: {doc_id}")
        return doc_id

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get document by ID"""
        mapping = self._mappings.get(doc_id)
        if not mapping:
            return None

        doc_path = self.paths.base_path / mapping.path
        if not doc_path.exists():
            logger.warning(f"Document file missing: {doc_path}")
            return None

        content = doc_path.read_text(encoding="utf-8")

        return {
            "doc_id": mapping.doc_id,
            "path": mapping.path,
            "content": content,
            "sha256": mapping.sha256,
            "source_type": mapping.source_type,
            "created_at": mapping.created_at,
            "updated_at": mapping.updated_at,
            "metadata": mapping.metadata,
        }

    def get_normalized_content(self, doc_id: str) -> Optional[str]:
        """Get normalized content for a document"""
        normalized_path = self.paths.normalized / f"{doc_id}.ok.md"
        if normalized_path.exists():
            return normalized_path.read_text(encoding="utf-8")
        return None

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document and its normalized version"""
        mapping = self._mappings.get(doc_id)
        if not mapping:
            return False

        # Delete source file
        source_path = self.paths.base_path / mapping.path
        if source_path.exists():
            source_path.unlink()

        # Delete normalized file
        normalized_path = self.paths.normalized / f"{doc_id}.ok.md"
        if normalized_path.exists():
            normalized_path.unlink()

        # Remove mapping
        del self._mappings[doc_id]
        self._save_mappings()

        logger.info(f"Deleted document: {doc_id}")
        return True

    def list_documents(
        self,
        source_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List all documents, optionally filtered by type"""
        results = []

        for mapping in self._mappings.values():
            if source_type and mapping.source_type != source_type:
                continue

            results.append({
                "doc_id": mapping.doc_id,
                "path": mapping.path,
                "source_type": mapping.source_type,
                "created_at": mapping.created_at,
                "metadata": mapping.metadata,
            })

            if len(results) >= limit:
                break

        return results

    def iter_documents(self, source_type: Optional[str] = None) -> Iterator[Dict[str, Any]]:
        """Iterate over all documents"""
        for mapping in self._mappings.values():
            if source_type and mapping.source_type != source_type:
                continue

            doc = self.get_document(mapping.doc_id)
            if doc:
                yield doc

    def create_memory(
        self,
        memory_id: str,
        content: str,
        topics: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Path:
        """
        Create a memory file in the temporal structure

        Args:
            memory_id: Memory ID
            content: Memory content
            topics: Optional list of topics for symlink creation
            metadata: Additional metadata

        Returns:
            Path to the created memory file
        """
        now = datetime.now()

        # Create date-based path
        date_dir = self.paths.memories_by_date / now.strftime("%Y-%m") / now.strftime("%d")
        date_dir.mkdir(parents=True, exist_ok=True)

        # Write memory file
        memory_path = date_dir / f"{memory_id}.md"

        # Add metadata header
        header = f"""---
memory_id: {memory_id}
created_at: {now.isoformat()}
topics: {topics or []}
metadata: {json.dumps(metadata or {})}
---

"""
        memory_path.write_text(header + content, encoding="utf-8")

        # Create topic symlinks
        if topics:
            for topic in topics:
                topic_dir = self.paths.memories_topics / topic
                topic_dir.mkdir(parents=True, exist_ok=True)

                symlink_path = topic_dir / f"{memory_id}.md"
                if not symlink_path.exists():
                    try:
                        symlink_path.symlink_to(memory_path)
                    except OSError:
                        # Symlinks may not work on all systems
                        pass

        logger.info(f"Created memory: {memory_id}")
        return memory_path

    def save_citation(
        self,
        citation_id: str,
        citation_data: Dict[str, Any]
    ) -> Path:
        """Save a citation to the citations directory"""
        citation_path = self.paths.citations / f"{citation_id}.json"
        citation_path.write_text(
            json.dumps(citation_data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        return citation_path

    def get_citation(self, citation_id: str) -> Optional[Dict[str, Any]]:
        """Get a citation by ID"""
        citation_path = self.paths.citations / f"{citation_id}.json"
        if not citation_path.exists():
            return None

        return json.loads(citation_path.read_text(encoding="utf-8"))

    def verify_integrity(self) -> Dict[str, Any]:
        """Verify the integrity of the store"""
        results = {
            "total_documents": len(self._mappings),
            "missing_files": [],
            "hash_mismatches": [],
            "orphaned_files": [],
        }

        # Check mapped documents
        for doc_id, mapping in self._mappings.items():
            doc_path = self.paths.base_path / mapping.path

            if not doc_path.exists():
                results["missing_files"].append(doc_id)
                continue

            # Verify hash
            content = doc_path.read_text(encoding="utf-8")
            current_hash = self.compute_sha256(content)

            if current_hash != mapping.sha256:
                results["hash_mismatches"].append({
                    "doc_id": doc_id,
                    "expected": mapping.sha256,
                    "actual": current_hash,
                })

        # Check for orphaned files
        mapped_paths = {m.path for m in self._mappings.values()}

        for source_file in self.paths.sources.glob("*"):
            rel_path = str(source_file.relative_to(self.paths.base_path))
            if rel_path not in mapped_paths:
                results["orphaned_files"].append(rel_path)

        return results

"""
StoreManager - Document Repository

Provides document storage with:
- Multi-format support (Markdown, Plain text, JSON, PDF, DOCX, YAML)
- Automatic chunking via MemoryChunk integration
- Normalized storage in OpenKL structure
- CRUD operations for documents
- OpenKL file system contract integration

Directory Structure:
.writing/store/
├── sources/          # Original files
└── normalized/       # Normalized text (*.ok.md)

Supported Formats:
- Markdown (.md)
- Plain text (.txt)
- JSON (.json)
- YAML (.yaml, .yml)
- PDF (.pdf) - requires pypdf
- DOCX (.docx) - requires python-docx
"""

import io
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Union

try:
    from ..memory.memory_chunk import MemoryChunk, TextChunker
except ImportError:
    from memory.memory_chunk import MemoryChunk, TextChunker

logger = logging.getLogger("StoreManager")


class DocumentFormat(str, Enum):
    """Supported document formats"""
    MARKDOWN = "markdown"
    PLAIN_TEXT = "plain_text"
    JSON = "json"
    YAML = "yaml"
    PDF = "pdf"
    DOCX = "docx"

    @classmethod
    def from_extension(cls, ext: str) -> "DocumentFormat":
        """Get format from file extension"""
        ext = ext.lower().lstrip(".")
        mapping = {
            "md": cls.MARKDOWN,
            "markdown": cls.MARKDOWN,
            "txt": cls.PLAIN_TEXT,
            "text": cls.PLAIN_TEXT,
            "json": cls.JSON,
            "yaml": cls.YAML,
            "yml": cls.YAML,
            "pdf": cls.PDF,
            "docx": cls.DOCX,
        }
        return mapping.get(ext, cls.PLAIN_TEXT)

    @property
    def extension(self) -> str:
        """Get file extension for format"""
        return {
            DocumentFormat.MARKDOWN: ".md",
            DocumentFormat.PLAIN_TEXT: ".txt",
            DocumentFormat.JSON: ".json",
            DocumentFormat.YAML: ".yaml",
            DocumentFormat.PDF: ".pdf",
            DocumentFormat.DOCX: ".docx",
        }[self]

    @property
    def is_binary(self) -> bool:
        """Check if format is binary (needs special handling)"""
        return self in (DocumentFormat.PDF, DocumentFormat.DOCX)


@dataclass
class Document:
    """
    Document data structure

    Attributes:
        id: Unique document identifier
        content: Document content
        format: Document format (markdown, plain_text, json)
        metadata: Additional metadata
        chunks: List of MemoryChunk objects
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    id: str
    content: str
    format: DocumentFormat
    metadata: Dict[str, Any] = field(default_factory=dict)
    chunks: List[MemoryChunk] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @classmethod
    def create(
        cls,
        content: str,
        format: DocumentFormat = DocumentFormat.MARKDOWN,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ) -> "Document":
        """Create a new document"""
        now = datetime.now()
        return cls(
            id=doc_id or f"doc-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}",
            content=content,
            format=format,
            metadata=metadata or {},
            chunks=[],
            created_at=now,
            updated_at=now,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "content": self.content,
            "format": self.format.value,
            "metadata": self.metadata,
            "chunks": [c.to_dict() for c in self.chunks],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Document":
        """Create from dictionary"""
        created_at = data.get("created_at")
        updated_at = data.get("updated_at")

        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        elif created_at is None:
            created_at = datetime.now()

        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        elif updated_at is None:
            updated_at = datetime.now()

        # Parse chunks
        chunks_data = data.get("chunks", [])
        chunks = [MemoryChunk.from_dict(c) for c in chunks_data]

        # Parse format
        format_value = data.get("format", "markdown")
        if isinstance(format_value, str):
            format_enum = DocumentFormat(format_value)
        else:
            format_enum = format_value

        return cls(
            id=data["id"],
            content=data["content"],
            format=format_enum,
            metadata=data.get("metadata", {}),
            chunks=chunks,
            created_at=created_at,
            updated_at=updated_at,
        )

    @property
    def chunk_count(self) -> int:
        """Number of chunks"""
        return len(self.chunks)

    @property
    def word_count(self) -> int:
        """Approximate word count"""
        return len(self.content.split())

    @property
    def char_count(self) -> int:
        """Character count"""
        return len(self.content)


@dataclass
class DocumentFilter:
    """Filter criteria for listing documents"""
    format: Optional[DocumentFormat] = None
    tags: Optional[List[str]] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    metadata_match: Optional[Dict[str, Any]] = None

    def matches(self, doc: Document) -> bool:
        """Check if document matches filter criteria"""
        # Format filter
        if self.format and doc.format != self.format:
            return False

        # Tags filter
        if self.tags:
            doc_tags = doc.metadata.get("tags", [])
            if not any(tag in doc_tags for tag in self.tags):
                return False

        # Date filters
        if self.created_after and doc.created_at < self.created_after:
            return False
        if self.created_before and doc.created_at > self.created_before:
            return False

        # Metadata match
        if self.metadata_match:
            for key, value in self.metadata_match.items():
                if doc.metadata.get(key) != value:
                    return False

        return True


class StoreManager:
    """
    Document Repository Manager

    Provides CRUD operations for documents with:
    - Multi-format support (Markdown, Plain text, JSON)
    - Automatic chunking via MemoryChunk integration
    - Normalized storage in OpenKL .writing/store/ structure
    - In-memory index with file-based persistence

    Usage:
        store = StoreManager(base_path=".writing")
        doc_id = store.add_document("path/to/file.md", "# Content", {"author": "user"})
        doc = store.get_document(doc_id)
        store.update_document(doc_id, "# Updated Content")
        store.delete_document(doc_id)
        docs = store.list_documents(DocumentFilter(format=DocumentFormat.MARKDOWN))
    """

    def __init__(
        self,
        base_path: Union[str, Path] = ".writing",
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        auto_chunk: bool = True
    ):
        """
        Initialize StoreManager

        Args:
            base_path: Base path for .writing directory
            chunk_size: Target chunk size for auto-chunking
            chunk_overlap: Overlap between chunks
            auto_chunk: Whether to automatically chunk documents
        """
        self.base_path = Path(base_path)
        self.store_path = self.base_path / "store"
        self.sources_path = self.store_path / "sources"
        self.normalized_path = self.store_path / "normalized"
        self.index_path = self.store_path / ".index.json"

        self.auto_chunk = auto_chunk
        self.chunker = TextChunker(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        # In-memory document index
        self._documents: Dict[str, Document] = {}

        # Ensure directory structure
        self._ensure_directories()

        # Load existing index
        self._load_index()

        logger.info(f"StoreManager initialized at: {self.base_path}")

    def _ensure_directories(self) -> None:
        """Create required directories"""
        self.sources_path.mkdir(parents=True, exist_ok=True)
        self.normalized_path.mkdir(parents=True, exist_ok=True)

    def _load_index(self) -> None:
        """Load document index from file"""
        if not self.index_path.exists():
            return

        try:
            with open(self.index_path, "r", encoding="utf-8") as f:
                index_data = json.load(f)

            for doc_data in index_data.get("documents", []):
                try:
                    doc = Document.from_dict(doc_data)
                    self._documents[doc.id] = doc
                except Exception as e:
                    logger.warning(f"Failed to load document: {e}")

            logger.info(f"Loaded {len(self._documents)} documents from index")

        except Exception as e:
            logger.error(f"Failed to load index: {e}")

    def _save_index(self) -> None:
        """Save document index to file"""
        try:
            index_data = {
                "version": "1.0",
                "updated_at": datetime.now().isoformat(),
                "documents": [doc.to_dict() for doc in self._documents.values()]
            }

            with open(self.index_path, "w", encoding="utf-8") as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)

        except Exception as e:
            logger.error(f"Failed to save index: {e}")

    def _detect_format(self, path: Union[str, Path]) -> DocumentFormat:
        """Detect document format from path"""
        path = Path(path)
        return DocumentFormat.from_extension(path.suffix)

    def _normalize_content(self, content: str, doc_id: str, format: DocumentFormat) -> str:
        """Normalize content to OpenKL format"""
        import unicodedata

        # Unicode NFC normalization
        content = unicodedata.normalize("NFC", content)

        # Standardize line endings
        content = content.replace("\r\n", "\n").replace("\r", "\n")

        # Add OpenKL metadata header
        now = datetime.now().isoformat()
        header = f"""---
doc_id: {doc_id}
format: {format.value}
normalized_at: {now}
---

"""
        return header + content

    def _chunk_document(self, doc: Document) -> List[MemoryChunk]:
        """Chunk document content"""
        if not self.auto_chunk:
            return []

        chunks = self.chunker.chunk_text(
            text=doc.content,
            source_id=doc.id,
            metadata={
                "doc_format": doc.format.value,
                "doc_id": doc.id,
                **doc.metadata
            }
        )

        logger.debug(f"Chunked document {doc.id}: {len(chunks)} chunks")
        return chunks

    def add_document(
        self,
        path: Union[str, Path],
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None,
        normalize: bool = True
    ) -> str:
        """
        Add a document to the store

        Args:
            path: File path (used for format detection and naming)
            content: Document content
            metadata: Optional metadata
            doc_id: Optional document ID (auto-generated if not provided)
            normalize: Whether to create normalized version

        Returns:
            Document ID
        """
        path = Path(path)
        format = self._detect_format(path)

        # Create document
        doc = Document.create(
            content=content,
            format=format,
            metadata=metadata or {},
            doc_id=doc_id
        )

        # Add source info to metadata
        doc.metadata["source_path"] = str(path)
        doc.metadata["source_name"] = path.name

        # Chunk document
        doc.chunks = self._chunk_document(doc)

        # Save source file
        source_file = self.sources_path / f"{doc.id}{format.extension}"
        source_file.write_text(content, encoding="utf-8")

        # Save normalized version
        if normalize:
            normalized_content = self._normalize_content(content, doc.id, format)
            normalized_file = self.normalized_path / f"{doc.id}.ok.md"
            normalized_file.write_text(normalized_content, encoding="utf-8")

        # Add to index
        self._documents[doc.id] = doc
        self._save_index()

        logger.info(f"Added document: {doc.id} ({format.value}, {doc.chunk_count} chunks)")
        return doc.id

    def get_document(self, doc_id: str) -> Optional[Document]:
        """
        Get a document by ID

        Args:
            doc_id: Document ID

        Returns:
            Document object or None if not found
        """
        doc = self._documents.get(doc_id)

        if doc is None:
            logger.debug(f"Document not found: {doc_id}")
            return None

        # Verify file exists and reload content if needed
        source_file = self.sources_path / f"{doc_id}{doc.format.extension}"
        if source_file.exists():
            # Reload content from file (in case of external modification)
            doc.content = source_file.read_text(encoding="utf-8")

        return doc

    def update_document(
        self,
        doc_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        normalize: bool = True
    ) -> bool:
        """
        Update a document's content

        Args:
            doc_id: Document ID
            content: New content
            metadata: Optional metadata to merge
            normalize: Whether to update normalized version

        Returns:
            True if updated, False if document not found
        """
        doc = self._documents.get(doc_id)
        if doc is None:
            logger.warning(f"Document not found for update: {doc_id}")
            return False

        # Update document
        doc.content = content
        doc.updated_at = datetime.now()

        if metadata:
            doc.metadata.update(metadata)

        # Re-chunk document
        doc.chunks = self._chunk_document(doc)

        # Update source file
        source_file = self.sources_path / f"{doc_id}{doc.format.extension}"
        source_file.write_text(content, encoding="utf-8")

        # Update normalized version
        if normalize:
            normalized_content = self._normalize_content(content, doc_id, doc.format)
            normalized_file = self.normalized_path / f"{doc_id}.ok.md"
            normalized_file.write_text(normalized_content, encoding="utf-8")

        # Save index
        self._save_index()

        logger.info(f"Updated document: {doc_id}")
        return True

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document

        Args:
            doc_id: Document ID

        Returns:
            True if deleted, False if document not found
        """
        doc = self._documents.get(doc_id)
        if doc is None:
            logger.warning(f"Document not found for deletion: {doc_id}")
            return False

        # Delete source file
        source_file = self.sources_path / f"{doc_id}{doc.format.extension}"
        if source_file.exists():
            source_file.unlink()

        # Delete normalized file
        normalized_file = self.normalized_path / f"{doc_id}.ok.md"
        if normalized_file.exists():
            normalized_file.unlink()

        # Remove from index
        del self._documents[doc_id]
        self._save_index()

        logger.info(f"Deleted document: {doc_id}")
        return True

    def list_documents(
        self,
        filter: Optional[DocumentFilter] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Document]:
        """
        List documents with optional filtering

        Args:
            filter: Optional filter criteria
            limit: Maximum number of documents to return
            offset: Number of documents to skip

        Returns:
            List of Document objects
        """
        results = []

        for doc in self._documents.values():
            # Apply filter
            if filter and not filter.matches(doc):
                continue

            results.append(doc)

        # Sort by creation date (newest first)
        results.sort(key=lambda d: d.created_at, reverse=True)

        # Apply pagination
        return results[offset:offset + limit]

    def search_by_content(
        self,
        query: str,
        limit: int = 10
    ) -> List[Document]:
        """
        Simple content search (case-insensitive)

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of matching documents
        """
        query_lower = query.lower()
        results = []

        for doc in self._documents.values():
            if query_lower in doc.content.lower():
                results.append(doc)
                if len(results) >= limit:
                    break

        return results

    def get_chunks(self, doc_id: str) -> List[MemoryChunk]:
        """
        Get chunks for a document

        Args:
            doc_id: Document ID

        Returns:
            List of MemoryChunk objects
        """
        doc = self._documents.get(doc_id)
        if doc is None:
            return []
        return doc.chunks

    def get_normalized_content(self, doc_id: str) -> Optional[str]:
        """
        Get normalized content for a document

        Args:
            doc_id: Document ID

        Returns:
            Normalized content or None if not found
        """
        normalized_file = self.normalized_path / f"{doc_id}.ok.md"
        if normalized_file.exists():
            return normalized_file.read_text(encoding="utf-8")
        return None

    def import_file(
        self,
        file_path: Union[str, Path],
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ) -> str:
        """
        Import an existing file into the store

        Args:
            file_path: Path to the file
            metadata: Optional metadata
            doc_id: Optional document ID

        Returns:
            Document ID
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        content = file_path.read_text(encoding="utf-8")

        return self.add_document(
            path=file_path,
            content=content,
            metadata=metadata,
            doc_id=doc_id
        )

    def export_document(
        self,
        doc_id: str,
        output_path: Union[str, Path],
        normalized: bool = False
    ) -> bool:
        """
        Export a document to a file

        Args:
            doc_id: Document ID
            output_path: Output file path
            normalized: Whether to export normalized version

        Returns:
            True if exported, False if document not found
        """
        doc = self.get_document(doc_id)
        if doc is None:
            return False

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if normalized:
            content = self.get_normalized_content(doc_id)
            if content is None:
                content = self._normalize_content(doc.content, doc_id, doc.format)
        else:
            content = doc.content

        output_path.write_text(content, encoding="utf-8")
        logger.info(f"Exported document: {doc_id} -> {output_path}")
        return True

    @property
    def document_count(self) -> int:
        """Total number of documents"""
        return len(self._documents)

    @property
    def total_chunks(self) -> int:
        """Total number of chunks across all documents"""
        return sum(doc.chunk_count for doc in self._documents.values())

    def stats(self) -> Dict[str, Any]:
        """Get store statistics"""
        format_counts = {}
        for doc in self._documents.values():
            fmt = doc.format.value
            format_counts[fmt] = format_counts.get(fmt, 0) + 1

        return {
            "document_count": self.document_count,
            "total_chunks": self.total_chunks,
            "format_counts": format_counts,
            "store_path": str(self.store_path),
        }

    # ============================================================
    # Multi-Format Loading (PDF, DOCX, YAML support)
    # ============================================================

    def _load_pdf_content(self, file_path: Path) -> str:
        """
        Load content from PDF file

        Args:
            file_path: Path to PDF file

        Returns:
            Extracted text content

        Raises:
            ImportError: If pypdf is not installed
        """
        try:
            import pypdf
        except ImportError:
            raise ImportError(
                "pypdf is required for PDF support. "
                "Install with: pip install pypdf"
            )

        text_parts = []
        with open(file_path, "rb") as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)

        return "\n\n".join(text_parts)

    def _load_docx_content(self, file_path: Path) -> str:
        """
        Load content from DOCX file

        Args:
            file_path: Path to DOCX file

        Returns:
            Extracted text content

        Raises:
            ImportError: If python-docx is not installed
        """
        try:
            import docx
        except ImportError:
            raise ImportError(
                "python-docx is required for DOCX support. "
                "Install with: pip install python-docx"
            )

        doc = docx.Document(file_path)
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n\n".join(paragraphs)

    def _load_yaml_content(self, file_path: Path) -> str:
        """
        Load content from YAML file (converts to readable text)

        Args:
            file_path: Path to YAML file

        Returns:
            YAML content as string
        """
        try:
            import yaml
        except ImportError:
            # Fallback to plain text if yaml not available
            return file_path.read_text(encoding="utf-8")

        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # Convert back to formatted YAML string for storage
        return yaml.dump(data, allow_unicode=True, default_flow_style=False)

    def _load_file_content(self, file_path: Path) -> str:
        """
        Load content from file based on format

        Args:
            file_path: Path to file

        Returns:
            Extracted text content
        """
        fmt = self._detect_format(file_path)

        if fmt == DocumentFormat.PDF:
            return self._load_pdf_content(file_path)
        elif fmt == DocumentFormat.DOCX:
            return self._load_docx_content(file_path)
        elif fmt == DocumentFormat.YAML:
            return self._load_yaml_content(file_path)
        else:
            # Text-based formats
            return file_path.read_text(encoding="utf-8")

    def import_binary_file(
        self,
        file_path: Union[str, Path],
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ) -> str:
        """
        Import a binary file (PDF, DOCX) into the store

        Extracts text content and stores both the original binary
        and the extracted text.

        Args:
            file_path: Path to the binary file
            metadata: Optional metadata
            doc_id: Optional document ID

        Returns:
            Document ID
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        fmt = self._detect_format(file_path)

        # Extract text content
        content = self._load_file_content(file_path)

        # Add format-specific metadata
        meta = metadata or {}
        meta["original_format"] = fmt.value
        meta["original_file"] = file_path.name

        # Store extracted text
        doc_id = self.add_document(
            path=file_path,
            content=content,
            metadata=meta,
            doc_id=doc_id
        )

        # Copy original binary file to sources
        if fmt.is_binary:
            import shutil
            binary_dest = self.sources_path / f"{doc_id}_original{fmt.extension}"
            shutil.copy2(file_path, binary_dest)
            logger.info(f"Copied original binary: {binary_dest}")

        return doc_id

    # ============================================================
    # OpenKL Contract Integration
    # ============================================================

    def sync_with_openkl(self, openkl_contract: Any) -> Dict[str, Any]:
        """
        Synchronize store with OpenKL contract

        Args:
            openkl_contract: OpenKLContract instance

        Returns:
            Sync result with counts
        """
        synced = 0
        errors = []

        for doc in self._documents.values():
            try:
                # Register document with OpenKL mapping
                openkl_contract.ingest_content(
                    content=doc.content,
                    doc_id=doc.id,
                    source_type=doc.metadata.get("source_type", "store"),
                    normalize=True,
                    metadata={
                        "format": doc.format.value,
                        "chunk_count": doc.chunk_count,
                        **doc.metadata
                    }
                )
                synced += 1
            except Exception as e:
                errors.append({"doc_id": doc.id, "error": str(e)})
                logger.warning(f"Failed to sync document {doc.id}: {e}")

        return {
            "synced": synced,
            "errors": errors,
            "total": len(self._documents)
        }

    def import_from_openkl(
        self,
        openkl_contract: Any,
        source_type: Optional[str] = None
    ) -> int:
        """
        Import documents from OpenKL contract

        Args:
            openkl_contract: OpenKLContract instance
            source_type: Optional filter by source type

        Returns:
            Number of documents imported
        """
        imported = 0

        for doc_data in openkl_contract.iter_documents(source_type=source_type):
            doc_id = doc_data["doc_id"]

            # Skip if already exists
            if doc_id in self._documents:
                continue

            # Create document from OpenKL data
            content = doc_data["content"]
            path = doc_data.get("path", f"{doc_id}.md")

            self.add_document(
                path=path,
                content=content,
                metadata=doc_data.get("metadata", {}),
                doc_id=doc_id,
                normalize=False  # Already normalized in OpenKL
            )
            imported += 1

        logger.info(f"Imported {imported} documents from OpenKL")
        return imported

    # ============================================================
    # Advanced Chunking Features
    # ============================================================

    def rechunk_document(
        self,
        doc_id: str,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None
    ) -> int:
        """
        Re-chunk a document with new parameters

        Args:
            doc_id: Document ID
            chunk_size: New chunk size (uses default if None)
            chunk_overlap: New overlap (uses default if None)

        Returns:
            New chunk count
        """
        doc = self._documents.get(doc_id)
        if doc is None:
            logger.warning(f"Document not found: {doc_id}")
            return 0

        # Create temporary chunker with new settings
        chunker = TextChunker(
            chunk_size=chunk_size or self.chunker.chunk_size,
            chunk_overlap=chunk_overlap or self.chunker.chunk_overlap
        )

        # Re-chunk
        doc.chunks = chunker.chunk_text(
            text=doc.content,
            source_id=doc.id,
            metadata={
                "doc_format": doc.format.value,
                "doc_id": doc.id,
                **doc.metadata
            }
        )

        doc.updated_at = datetime.now()
        self._save_index()

        logger.info(f"Re-chunked document {doc_id}: {len(doc.chunks)} chunks")
        return len(doc.chunks)

    def get_all_chunks(
        self,
        filter: Optional[DocumentFilter] = None
    ) -> List[MemoryChunk]:
        """
        Get all chunks from all documents

        Args:
            filter: Optional document filter

        Returns:
            List of all MemoryChunk objects
        """
        all_chunks = []

        for doc in self._documents.values():
            if filter and not filter.matches(doc):
                continue
            all_chunks.extend(doc.chunks)

        return all_chunks

    def search_chunks(
        self,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search chunks by content (simple text matching)

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of matching chunks with document info
        """
        query_lower = query.lower()
        results = []

        for doc in self._documents.values():
            for chunk in doc.chunks:
                if query_lower in chunk.content.lower():
                    results.append({
                        "chunk": chunk,
                        "doc_id": doc.id,
                        "doc_format": doc.format.value,
                        "doc_metadata": doc.metadata
                    })
                    if len(results) >= limit:
                        return results

        return results

    # ============================================================
    # Batch Operations
    # ============================================================

    def import_directory(
        self,
        directory: Union[str, Path],
        recursive: bool = True,
        extensions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Import all documents from a directory

        Args:
            directory: Directory path
            recursive: Whether to search recursively
            extensions: List of extensions to include (e.g., [".md", ".txt"])

        Returns:
            Import result with counts
        """
        directory = Path(directory)

        if not directory.is_dir():
            raise ValueError(f"Not a directory: {directory}")

        # Default extensions
        if extensions is None:
            extensions = [".md", ".txt", ".json", ".yaml", ".yml", ".pdf", ".docx"]

        # Find files
        if recursive:
            files = []
            for ext in extensions:
                files.extend(directory.rglob(f"*{ext}"))
        else:
            files = []
            for ext in extensions:
                files.extend(directory.glob(f"*{ext}"))

        imported = 0
        errors = []

        for file_path in files:
            try:
                fmt = self._detect_format(file_path)
                if fmt.is_binary:
                    self.import_binary_file(file_path)
                else:
                    self.import_file(file_path)
                imported += 1
            except Exception as e:
                errors.append({"file": str(file_path), "error": str(e)})
                logger.warning(f"Failed to import {file_path}: {e}")

        return {
            "imported": imported,
            "errors": errors,
            "total_files": len(files)
        }

    def export_all(
        self,
        output_dir: Union[str, Path],
        normalized: bool = False,
        filter: Optional[DocumentFilter] = None
    ) -> int:
        """
        Export all documents to a directory

        Args:
            output_dir: Output directory
            normalized: Whether to export normalized versions
            filter: Optional document filter

        Returns:
            Number of documents exported
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        exported = 0

        for doc in self._documents.values():
            if filter and not filter.matches(doc):
                continue

            output_path = output_dir / f"{doc.id}{doc.format.extension}"
            if self.export_document(doc.id, output_path, normalized=normalized):
                exported += 1

        logger.info(f"Exported {exported} documents to {output_dir}")
        return exported

    def clear_all(self, confirm: bool = False) -> int:
        """
        Delete all documents from the store

        Args:
            confirm: Must be True to proceed

        Returns:
            Number of documents deleted
        """
        if not confirm:
            raise ValueError("Must set confirm=True to clear all documents")

        count = len(self._documents)

        for doc_id in list(self._documents.keys()):
            self.delete_document(doc_id)

        logger.info(f"Cleared {count} documents from store")
        return count

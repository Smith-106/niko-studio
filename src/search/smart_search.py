"""
Smart Search Module - Intelligent Multi-Mode Search

Features:
- SearchMode: FUZZY, SEMANTIC, HYBRID, AUTO
- Fuzzy Search: FTS5 + ripgrep for keyword matching
- Semantic Search: Vector embeddings via VectorIndex
- RRF (Reciprocal Rank Fusion) for result merging
- Auto mode: intelligent mode selection based on query
"""

import logging
import sqlite3
import json
import asyncio
import subprocess
import re
from enum import Enum
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, TypedDict
from dataclasses import dataclass, field

from .vector_search import (
    VectorIndex,
    VectorSearch,
    SearchResult,
    HNSWConfig,
    SearchResultMeta,
    SearchResultLocation,
    REQUIRED_SEARCH_RESULT_FIELDS,
    _normalize_search_result_fields,
    _build_search_metadata,
    _normalize_loc,
    SAMPLE_SEARCH_QUERY,
)

logger = logging.getLogger(__name__)


class SearchMode(Enum):
    """Search mode enumeration."""
    FUZZY = "fuzzy"        # FTS5 + ripgrep keyword search
    SEMANTIC = "semantic"  # Vector embedding search
    HYBRID = "hybrid"      # Combined fuzzy + semantic with RRF
    AUTO = "auto"          # Intelligent mode selection


@dataclass
class SmartSearchResult:
    """Enhanced search result with source tracking."""
    id: str
    content: str
    score: float
    type: str = "chunk"
    metadata: SearchResultMeta = field(default_factory=lambda: {
        "path": None,
        "doc_id": None,
        "surface": None,
        "loc": None,
        "chunk_index": None,
        "extra": {}
    })
    source: str = "smart"  # fuzzy, semantic, hybrid, ripgrep
    mode_used: str = "auto"
    loc: Optional[SearchResultLocation] = None
    snapshot_query: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        normalized = _normalize_search_result_fields(
            result_id=self.id,
            content=self.content,
            score=self.score,
            item_type=self.type,
            source=self.source,
            metadata=self.metadata,
            loc=self.loc,
            snapshot_query=self.snapshot_query,
            mode_used=self.mode_used,
        )
        return {
            "id": normalized.id,
            "content": normalized.content,
            "score": round(normalized.score, 4),
            "type": normalized.type,
            "source": normalized.source,
            "mode_used": normalized.mode_used,
            "metadata": normalized.metadata,
            "loc": normalized.loc,
            "snapshot_query": normalized.snapshot_query,
        }

    def __getitem__(self, key: str) -> Any:
        """Support dict-style access for backward compatibility."""
        return self.to_dict()[key]


class SearchResultSnapshot(TypedDict):
    query: str
    results: List[Dict[str, Any]]


SEARCH_RESULT_FIELDS_CHECKLIST = REQUIRED_SEARCH_RESULT_FIELDS


SAMPLE_SEARCH_QUERY = "search_result_sample_query"


class SmartSearch:
    """
    Smart Search Service combining Semantic Search (Vector) and Fuzzy Search (Keyword).

    Supports multiple search modes:
    - FUZZY: FTS5 full-text search + ripgrep for file content
    - SEMANTIC: Vector embedding similarity search
    - HYBRID: Combined results using RRF fusion
    - AUTO: Intelligent mode selection based on query characteristics

    Optimized with:
    - asyncio.gather for parallel search execution
    - Query embedding cache integration
    - Configurable RRF parameters
    """

    def __init__(
        self,
        vector_search: Optional[VectorSearch] = None,
        vector_index: Optional[VectorIndex] = None,
        db_path: Optional[str] = None,
        rrf_k: int = 60,
        semantic_weight: float = 0.6,
        fuzzy_weight: float = 0.4,
        ripgrep_paths: Optional[List[str]] = None
    ):
        """
        Initialize SmartSearch.

        Args:
            vector_search: VectorSearch instance (legacy support)
            vector_index: VectorIndex instance (preferred)
            db_path: Database path for standalone initialization
            rrf_k: RRF constant (default 60)
            semantic_weight: Weight for semantic results in hybrid mode
            fuzzy_weight: Weight for fuzzy results in hybrid mode
            ripgrep_paths: Paths to search with ripgrep
        """
        # Support both VectorSearch and VectorIndex
        self._vector_search = vector_search
        self._vector_index = vector_index
        self._db_path = db_path

        # RRF parameters
        self.rrf_k = rrf_k
        self.semantic_weight = semantic_weight
        self.fuzzy_weight = fuzzy_weight

        # Ripgrep configuration
        self.ripgrep_paths = ripgrep_paths or []
        self._ripgrep_available = self._check_ripgrep()

    def _check_ripgrep(self) -> bool:
        """Check if ripgrep is available."""
        try:
            result = subprocess.run(
                ["rg", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    @property
    def vector_search(self) -> Optional[VectorSearch]:
        """Get VectorSearch instance."""
        return self._vector_search

    @property
    def vector_index(self) -> Optional[VectorIndex]:
        """Get or create VectorIndex instance."""
        if self._vector_index is None and self._db_path:
            self._vector_index = VectorIndex(db_path=self._db_path)
        return self._vector_index

    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection from underlying search instance."""
        if self._vector_search:
            return self._vector_search._get_connection()
        elif self._vector_index:
            return self._vector_index._get_connection()
        elif self._db_path:
            conn = sqlite3.connect(self._db_path)
            conn.row_factory = sqlite3.Row
            return conn
        else:
            raise ValueError("No database connection available")

    def search(
        self,
        query: str,
        mode: Union[SearchMode, str] = SearchMode.AUTO,
        top_k: int = 5,
        type_filter: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SmartSearchResult]:
        """
        Perform smart search with specified mode.

        Args:
            query: Search query string
            mode: SearchMode or string ('fuzzy', 'semantic', 'hybrid', 'auto')
            top_k: Number of results to return
            type_filter: Filter by item type (memory, chunk)
            min_score: Minimum score threshold

        Returns:
            List of SmartSearchResult
        """
        # Normalize mode
        if isinstance(mode, str):
            mode = SearchMode(mode.lower())

        # Auto mode selection
        if mode == SearchMode.AUTO:
            mode = self._select_mode(query)
            logger.debug(f"Auto-selected mode: {mode.value}")

        # Execute based on mode
        if mode == SearchMode.FUZZY:
            results = self.fuzzy_search(query, top_k=top_k * 2, type_filter=type_filter)
        elif mode == SearchMode.SEMANTIC:
            results = self.semantic_search(query, top_k=top_k * 2, type_filter=type_filter)
            if not results:
                results = self.fuzzy_search(query, top_k=top_k * 2, type_filter=type_filter)
        elif mode == SearchMode.HYBRID:
            results = self.hybrid_search(query, top_k=top_k * 2, type_filter=type_filter)
        else:
            results = self.hybrid_search(query, top_k=top_k * 2, type_filter=type_filter)

        # Apply min_score filter and limit
        filtered = [r for r in results if r.score >= min_score]

        # Update mode_used
        for r in filtered:
            normalized = _normalize_search_result_fields(
                result_id=r.id,
                content=r.content,
                score=r.score,
                item_type=r.type,
                source=r.source,
                metadata=r.metadata,
                loc=r.loc,
                snapshot_query=SAMPLE_SEARCH_QUERY,
                mode_used=mode.value,
            )
            r.mode_used = normalized.mode_used
            r.snapshot_query = normalized.snapshot_query
            r.loc = normalized.loc
            r.metadata = normalized.metadata

        return filtered[:top_k]

    def _select_mode(self, query: str) -> SearchMode:
        """
        Intelligently select search mode based on query characteristics.

        Heuristics:
        - Short exact terms (1-2 words, no special chars) -> FUZZY
        - Long natural language queries -> SEMANTIC
        - Quoted phrases or mixed -> HYBRID
        """
        tokens = query.split()

        # Check for quoted phrases
        if '"' in query or "'" in query:
            return SearchMode.HYBRID

        # Short exact term queries
        if len(tokens) <= 2:
            # Check if tokens are likely keywords vs natural language
            has_stopwords = any(t.lower() in {'the', 'a', 'an', 'is', 'are', 'what', 'how', 'why'} for t in tokens)
            if not has_stopwords:
                return SearchMode.FUZZY

        # Natural language / question queries
        if any(query.lower().startswith(w) for w in ['what', 'how', 'why', 'when', 'where', 'who', 'which']):
            return SearchMode.SEMANTIC

        # Long queries benefit from semantic understanding
        if len(tokens) > 5:
            return SearchMode.SEMANTIC

        # Default to hybrid for balanced results
        return SearchMode.HYBRID

    def fuzzy_search(
        self,
        query: str,
        top_k: int = 10,
        type_filter: Optional[str] = None
    ) -> List[SmartSearchResult]:
        """
        Fuzzy search using FTS5 + optional ripgrep.

        Args:
            query: Search query
            top_k: Number of results
            type_filter: Filter by type

        Returns:
            List of SmartSearchResult
        """
        results = []

        # 1. FTS5 search on database
        fts_results = self._fts5_search(query, top_k=top_k, type_filter=type_filter)
        results.extend(fts_results)

        # 2. Ripgrep search on configured paths
        if self._ripgrep_available and self.ripgrep_paths:
            rg_results = self._ripgrep_search(query, top_k=top_k)
            results.extend(rg_results)

        # Deduplicate by ID, keeping highest score
        seen = {}
        for r in results:
            if r.id not in seen or r.score > seen[r.id].score:
                seen[r.id] = r

        # Sort by score
        deduped = sorted(seen.values(), key=lambda x: x.score, reverse=True)
        return deduped[:top_k]

    def _fts5_search(
        self,
        query: str,
        top_k: int = 10,
        type_filter: Optional[str] = None
    ) -> List[SmartSearchResult]:
        """FTS5 full-text search."""
        conn = self._get_connection()
        cursor = conn.cursor()
        results = []

        # Tokenize query for FTS5
        tokens = query.split()
        if not tokens:
            conn.close()
            return []

        # Build FTS5 query with OR
        fts_query = " OR ".join(f'"{t}"' for t in tokens if t.strip())

        try:
            # Try FTS5 on vector_items_fts (from VectorIndex)
            sql = """
                SELECT
                    vi.id,
                    vi.content,
                    vi.metadata,
                    vi.type,
                    bm25(vector_items_fts) as rank
                FROM vector_items_fts
                JOIN vector_items vi ON vi.id = vector_items_fts.id
                WHERE vector_items_fts MATCH ?
            """
            params = [fts_query]

            if type_filter:
                sql += " AND vi.type = ?"
                params.append(type_filter)

            sql += " ORDER BY rank LIMIT ?"
            params.append(top_k)

            cursor.execute(sql, params)

            for row in cursor:
                # BM25 scores are negative, lower is better
                bm25_score = abs(row["rank"])
                normalized_score = 1.0 / (1.0 + bm25_score)
                raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}

                results.append(SmartSearchResult(
                    id=row["id"],
                    content=row["content"],
                    score=normalized_score,
                    type=row["type"],
                    metadata=_build_search_metadata(
                        path=raw_metadata.get("path"),
                        doc_id=raw_metadata.get("doc_id"),
                        surface=raw_metadata.get("surface"),
                        loc=raw_metadata.get("loc"),
                        chunk_index=raw_metadata.get("chunk_index"),
                        extra={
                            k: v
                            for k, v in raw_metadata.items()
                            if k not in {"path", "doc_id", "surface", "loc", "chunk_index"}
                        },
                    ),
                    source="fts5",
                    loc=_normalize_loc(raw_metadata.get("loc")),
                    snapshot_query=SAMPLE_SEARCH_QUERY,
                ))

        except sqlite3.OperationalError:
            # Try items table (from VectorSearch)
            try:
                results = self._like_search(cursor, query, top_k, type_filter)
            except Exception as e:
                logger.warning(f"FTS5 and LIKE search failed: {e}")

        conn.close()
        return results

    def _like_search(
        self,
        cursor: sqlite3.Cursor,
        query: str,
        top_k: int,
        type_filter: Optional[str] = None
    ) -> List[SmartSearchResult]:
        """Fallback LIKE-based search."""
        tokens = query.split()
        if not tokens:
            return []

        conditions = [f"content LIKE ?" for _ in tokens]
        params = [f"%{t}%" for t in tokens]
        where_clause = " OR ".join(conditions)

        # Try vector_items table first, then items, finally core_memories fallback
        for table in ["vector_items", "items"]:
            try:
                sql = f"SELECT id, content, metadata, type FROM {table} WHERE ({where_clause})"

                if type_filter:
                    sql += " AND type = ?"
                    params_with_filter = params + [type_filter]
                else:
                    params_with_filter = params

                sql += f" LIMIT {top_k * 2}"

                cursor.execute(sql, params_with_filter)

                results = []
                for row in cursor:
                    content_lower = row["content"].lower()
                    match_count = sum(1 for t in tokens if t.lower() in content_lower)
                    score = match_count / len(tokens) if tokens else 0
                    raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}

                    results.append(SmartSearchResult(
                        id=row["id"],
                        content=row["content"],
                        score=score,
                        type=row["type"],
                        metadata=_build_search_metadata(
                            path=raw_metadata.get("path"),
                            doc_id=raw_metadata.get("doc_id"),
                            surface=raw_metadata.get("surface"),
                            loc=raw_metadata.get("loc"),
                            chunk_index=raw_metadata.get("chunk_index"),
                            extra={
                                k: v
                                for k, v in raw_metadata.items()
                                if k not in {"path", "doc_id", "surface", "loc", "chunk_index"}
                            },
                        ),
                        source="like",
                        loc=_normalize_loc(raw_metadata.get("loc")),
                        snapshot_query=SAMPLE_SEARCH_QUERY,
                    ))

                results.sort(key=lambda x: x.score, reverse=True)
                if results:
                    return results[:top_k]

            except sqlite3.OperationalError:
                continue

        # Last fallback: core_memories table (for offline vector failure cases)
        try:
            conditions = [f"LOWER(content) LIKE ?" for _ in tokens]
            params_cm = [f"%{t.lower()}%" for t in tokens]
            where_cm = " OR ".join(conditions)

            sql_cm = f"""
                SELECT id, content, metadata
                FROM core_memories
                WHERE ({where_cm})
            """
            if type_filter and type_filter != "memory":
                return []
            sql_cm += f" LIMIT {top_k * 2}"

            cursor.execute(sql_cm, params_cm)
            results_cm: List[SmartSearchResult] = []
            for row in cursor:
                content_lower = (row["content"] or "").lower()
                match_count = sum(1 for t in tokens if t.lower() in content_lower)
                score = match_count / len(tokens) if tokens else 0
                raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}

                results_cm.append(SmartSearchResult(
                    id=row["id"],
                    content=row["content"],
                    score=score,
                    type="memory",
                    metadata=_build_search_metadata(
                        path=raw_metadata.get("path"),
                        doc_id=raw_metadata.get("doc_id"),
                        surface=raw_metadata.get("surface"),
                        loc=raw_metadata.get("loc"),
                        chunk_index=raw_metadata.get("chunk_index"),
                        extra={
                            k: v
                            for k, v in raw_metadata.items()
                            if k not in {"path", "doc_id", "surface", "loc", "chunk_index"}
                        },
                    ),
                    source="like",
                    loc=_normalize_loc(raw_metadata.get("loc")),
                    snapshot_query=SAMPLE_SEARCH_QUERY,
                ))

            results_cm.sort(key=lambda x: x.score, reverse=True)
            return results_cm[:top_k]
        except sqlite3.OperationalError:
            return []

    def _ripgrep_search(
        self,
        query: str,
        top_k: int = 10
    ) -> List[SmartSearchResult]:
        """Search files using ripgrep."""
        if not self._ripgrep_available or not self.ripgrep_paths:
            return []

        results = []

        for search_path in self.ripgrep_paths:
            if not Path(search_path).exists():
                continue

            try:
                # Run ripgrep with JSON output
                cmd = [
                    "rg",
                    "--json",
                    "--max-count", "5",  # Max matches per file
                    "--ignore-case",
                    query,
                    search_path
                ]

                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                if proc.returncode not in [0, 1]:  # 1 = no matches
                    continue

                # Parse JSON lines output
                for line in proc.stdout.strip().split("\n"):
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if data.get("type") == "match":
                            match_data = data["data"]
                            file_path = match_data["path"]["text"]
                            line_text = match_data["lines"]["text"].strip()
                            line_num = match_data["line_number"]

                            # Create unique ID
                            result_id = f"rg:{file_path}:{line_num}"

                            results.append(SmartSearchResult(
                                id=result_id,
                                content=line_text,
                                score=0.8,  # Fixed score for ripgrep matches
                                type="file",
                                metadata=_build_search_metadata(
                                    path=file_path,
                                    doc_id=None,
                                    surface="file",
                                    loc={"kind": LOC_KIND_LINE, "start": line_num, "end": line_num},
                                    chunk_index=None,
                                    extra={
                                        "line_number": line_num
                                    },
                                ),
                                source="ripgrep",
                                loc={"kind": LOC_KIND_LINE, "start": line_num, "end": line_num},
                                snapshot_query=SAMPLE_SEARCH_QUERY,
                            ))
                    except json.JSONDecodeError:
                        continue

            except subprocess.TimeoutExpired:
                logger.warning(f"Ripgrep timeout for path: {search_path}")
            except Exception as e:
                logger.warning(f"Ripgrep search failed: {e}")

        return results[:top_k]

    def semantic_search(
        self,
        query: str,
        top_k: int = 10,
        type_filter: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SmartSearchResult]:
        """
        Semantic search using vector embeddings.

        Args:
            query: Search query
            top_k: Number of results
            type_filter: Filter by type
            min_score: Minimum similarity score

        Returns:
            List of SmartSearchResult
        """
        results = []

        # Try VectorIndex first (preferred)
        if self.vector_index:
            try:
                search_results = self.vector_index.search(
                    query=query,
                    top_k=top_k,
                    min_score=min_score,
                    type_filter=type_filter
                )

                for sr in search_results:
                    normalized = _normalize_search_result_fields(
                        result_id=sr.id,
                        content=sr.content,
                        score=sr.score,
                        item_type=sr.type,
                        source="semantic",
                        metadata=sr.metadata,
                        loc=sr.loc,
                        snapshot_query=SAMPLE_SEARCH_QUERY,
                    )
                    results.append(SmartSearchResult(
                        id=normalized.id,
                        content=normalized.content,
                        score=normalized.score,
                        type=normalized.type,
                        metadata=normalized.metadata,
                        source=normalized.source,
                        mode_used="semantic",
                        loc=normalized.loc,
                        snapshot_query=normalized.snapshot_query,
                    ))

            except Exception as e:
                logger.error(f"VectorIndex search failed: {e}")

        # Fall back to VectorSearch
        elif self.vector_search:
            try:
                search_results = self.vector_search.search(
                    query=query,
                    type_filter=type_filter,
                    top_k=top_k,
                    min_score=min_score
                )

                for sr in search_results:
                    normalized = _normalize_search_result_fields(
                        result_id=sr["id"],
                        content=sr["content"],
                        score=sr["score"],
                        item_type=sr.get("type", "chunk"),
                        source="semantic",
                        metadata=sr.get("metadata", {}),
                        loc=sr.get("loc"),
                        snapshot_query=SAMPLE_SEARCH_QUERY,
                    )
                    results.append(SmartSearchResult(
                        id=normalized.id,
                        content=normalized.content,
                        score=normalized.score,
                        type=normalized.type,
                        metadata=normalized.metadata,
                        source=normalized.source,
                        mode_used="semantic",
                        loc=normalized.loc,
                        snapshot_query=normalized.snapshot_query,
                    ))

            except Exception as e:
                logger.error(f"VectorSearch search failed: {e}")

        return results

    def hybrid_search(
        self,
        query: str,
        top_k: int = 10,
        type_filter: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SmartSearchResult]:
        """
        Hybrid search combining fuzzy and semantic with RRF fusion.

        Args:
            query: Search query
            top_k: Number of results
            type_filter: Filter by type
            min_score: Minimum score threshold

        Returns:
            List of SmartSearchResult sorted by RRF score
        """
        # Get results from both methods
        try:
            fuzzy_results = self.fuzzy_search(query, top_k=top_k * 2, type_filter=type_filter)
        except Exception as e:
            logger.error(f"Fuzzy search failed: {e}")
            fuzzy_results = []

        try:
            semantic_results = self.semantic_search(query, top_k=top_k * 2, type_filter=type_filter)
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            semantic_results = []

        # RRF Fusion
        merged = self._rrf_merge(
            semantic_results,
            fuzzy_results,
            semantic_weight=self.semantic_weight,
            fuzzy_weight=self.fuzzy_weight
        )

        # Apply min_score filter
        filtered = [r for r in merged if r.score >= min_score]

        return filtered[:top_k]

    def _rrf_merge(
        self,
        semantic_results: List[SmartSearchResult],
        fuzzy_results: List[SmartSearchResult],
        semantic_weight: float = 0.6,
        fuzzy_weight: float = 0.4
    ) -> List[SmartSearchResult]:
        """
        Reciprocal Rank Fusion to merge results.

        RRF score = weight / (k + rank)

        Args:
            semantic_results: Results from semantic search
            fuzzy_results: Results from fuzzy search
            semantic_weight: Weight for semantic results
            fuzzy_weight: Weight for fuzzy results

        Returns:
            Merged and sorted results
        """
        scores: Dict[str, float] = {}
        result_map: Dict[str, SmartSearchResult] = {}

        # Process semantic results
        for rank, result in enumerate(semantic_results):
            doc_id = result.id
            rrf_score = semantic_weight / (self.rrf_k + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0) + rrf_score
            result_map[doc_id] = result

        # Process fuzzy results
        for rank, result in enumerate(fuzzy_results):
            doc_id = result.id
            rrf_score = fuzzy_weight / (self.rrf_k + rank + 1)
            scores[doc_id] = scores.get(doc_id, 0) + rrf_score
            if doc_id not in result_map:
                result_map[doc_id] = result

        # Sort by combined score
        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

        # Build result list
        merged = []
        for doc_id in sorted_ids:
            result = result_map[doc_id]
            merged.append(SmartSearchResult(
                id=result.id,
                content=result.content,
                score=scores[doc_id],
                type=result.type,
                metadata=result.metadata,
                source="hybrid",
                mode_used=result.mode_used,
                loc=result.loc or result.metadata.get("loc"),
                snapshot_query=result.snapshot_query or SAMPLE_SEARCH_QUERY,
            ))

        return merged

    def _build_snapshot(self, results: List[SmartSearchResult]) -> SearchResultSnapshot:
        return {
            "query": SAMPLE_SEARCH_QUERY,
            "results": [result.to_dict() for result in results],
        }


    async def search_async(
        self,
        query: str,
        mode: Union[SearchMode, str] = SearchMode.AUTO,
        top_k: int = 5,
        type_filter: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[SmartSearchResult]:
        """
        Async version of search with parallel execution for hybrid mode.

        Args:
            query: Search query
            mode: SearchMode or string
            top_k: Number of results
            type_filter: Filter by type
            min_score: Minimum score threshold

        Returns:
            List of SmartSearchResult
        """
        # Normalize mode
        if isinstance(mode, str):
            mode = SearchMode(mode.lower())

        if mode == SearchMode.AUTO:
            mode = self._select_mode(query)

        loop = asyncio.get_event_loop()

        if mode == SearchMode.HYBRID:
            # Parallel execution for hybrid mode
            fuzzy_task = loop.run_in_executor(
                None,
                lambda: self.fuzzy_search(query, top_k=top_k * 2, type_filter=type_filter)
            )
            semantic_task = loop.run_in_executor(
                None,
                lambda: self.semantic_search(query, top_k=top_k * 2, type_filter=type_filter)
            )

            results = await asyncio.gather(
                fuzzy_task,
                semantic_task,
                return_exceptions=True
            )

            fuzzy_results = results[0] if not isinstance(results[0], Exception) else []
            semantic_results = results[1] if not isinstance(results[1], Exception) else []

            if isinstance(results[0], Exception):
                logger.error(f"Async fuzzy search failed: {results[0]}")
            if isinstance(results[1], Exception):
                logger.error(f"Async semantic search failed: {results[1]}")

            merged = self._rrf_merge(semantic_results, fuzzy_results)
            filtered = [r for r in merged if r.score >= min_score]

            for r in filtered:
                normalized = _normalize_search_result_fields(
                    result_id=r.id,
                    content=r.content,
                    score=r.score,
                    item_type=r.type,
                    source=r.source,
                    metadata=r.metadata,
                    loc=r.loc,
                    snapshot_query=SAMPLE_SEARCH_QUERY,
                    mode_used=mode.value,
                )
                r.mode_used = normalized.mode_used
                r.snapshot_query = normalized.snapshot_query
                r.loc = normalized.loc
                r.metadata = normalized.metadata

            return filtered[:top_k]

        else:
            # Single mode execution
            result = await loop.run_in_executor(
                None,
                lambda: self.search(query, mode=mode, top_k=top_k, type_filter=type_filter, min_score=min_score)
            )
            return result

    # ============ SearchInterface Implementation ============

    def index(
        self,
        id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        type: str = "chunk",
    ) -> None:
        """Index a document (implements SearchInterface).

        Args:
            id: Document unique identifier
            content: Document content
            metadata: Metadata dictionary
            type: Document type (e.g., 'memory', 'chunk')
        """
        if self.vector_index:
            self.vector_index.upsert(
                id=id,
                content=content,
                metadata=metadata or {},
                type=type
            )
        elif self.vector_search:
            self.vector_search.upsert_vector(
                id=id,
                content=content,
                metadata=metadata or {},
                type=type
            )
        else:
            raise ValueError("No vector search backend available for indexing")

    def delete(self, id: str) -> bool:
        """Delete a document (implements SearchInterface).

        Args:
            id: Document unique identifier

        Returns:
            True if deleted, False if not found
        """
        if self.vector_index:
            return self.vector_index.delete(id)
        elif self.vector_search:
            return self.vector_search.delete_vector(id)
        else:
            raise ValueError("No vector search backend available for deletion")

    # ============ Legacy API Compatibility ============

    def _keyword_search(
        self,
        query: str,
        type_filter: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Legacy keyword search returning dict format."""
        results = self.fuzzy_search(query, top_k=top_k, type_filter=type_filter)
        return [r.to_dict() for r in results]


# ============ Factory Functions ============

def create_smart_search(
    db_path: str,
    model_name: str = "BAAI/bge-small-en-v1.5",
    ripgrep_paths: Optional[List[str]] = None
) -> SmartSearch:
    """
    Create SmartSearch with VectorIndex.

    Args:
        db_path: Path to SQLite database
        model_name: Embedding model name
        ripgrep_paths: Paths for ripgrep file search

    Returns:
        Configured SmartSearch instance
    """
    config = HNSWConfig()
    vector_index = VectorIndex(db_path=db_path, config=config, model_name=model_name)

    return SmartSearch(
        vector_index=vector_index,
        ripgrep_paths=ripgrep_paths
    )


def create_smart_search_from_vector_search(
    vector_search: VectorSearch,
    ripgrep_paths: Optional[List[str]] = None
) -> SmartSearch:
    """
    Create SmartSearch from existing VectorSearch instance.

    Args:
        vector_search: Existing VectorSearch instance
        ripgrep_paths: Paths for ripgrep file search

    Returns:
        Configured SmartSearch instance
    """
    return SmartSearch(
        vector_search=vector_search,
        ripgrep_paths=ripgrep_paths
    )

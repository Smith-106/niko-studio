import logging
import sqlite3
import json
from typing import List, Dict, Any, Optional
from .vector_search import VectorSearch

logger = logging.getLogger(__name__)

class SmartSearch:
    """
    Smart Search Service combining Semantic Search (Vector) and Fuzzy Search (Keyword).
    Uses Reciprocal Rank Fusion (RRF) to combine results.
    """

    def __init__(self, vector_search: VectorSearch):
        self.vector_search = vector_search

    def search(
        self,
        query: str,
        type_filter: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search.

        Args:
            query: Search query.
            type_filter: Filter by item type (memory, chunk).
            top_k: Number of results to return.
        """
        # 1. Semantic Search
        semantic_results = self.vector_search.search(
            query,
            type_filter=type_filter,
            top_k=top_k
        )

        # 2. Keyword Search (Fuzzy-ish)
        keyword_results = self._keyword_search(
            query,
            type_filter=type_filter,
            top_k=top_k
        )

        # 3. Fuse Results (RRF)
        return self._rrf_merge(semantic_results, keyword_results, k=60)[:top_k]

    def _keyword_search(
        self,
        query: str,
        type_filter: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Basic keyword search using SQLite LIKE.
        """
        conn = self.vector_search._get_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Simple token-based OR search
        tokens = query.split()
        if not tokens:
            return []

        # Construct query: content LIKE %token1% OR content LIKE %token2% ...
        conditions = []
        params = []
        for token in tokens:
            conditions.append("content LIKE ?")
            params.append(f"%{token}%")

        where_clause = " OR ".join(conditions)

        sql = f"SELECT id, content, metadata, type FROM items WHERE ({where_clause})"

        if type_filter:
            sql += " AND type = ?"
            params.append(type_filter)

        sql += f" LIMIT {top_k * 2}"

        cursor.execute(sql, params)
        results = []

        for row in cursor:
            # Simple scoring: count token matches
            content_lower = row["content"].lower()
            score = sum(1 for t in tokens if t.lower() in content_lower)

            if score > 0:
                results.append({
                    "id": row["id"],
                    "content": row["content"],
                    "metadata": json.loads(row["metadata"]),
                    "type": row["type"],
                    "score": score  # Raw count for now
                })

        conn.close()

        # Normalize scores (0-1) for RRF compatibility, though RRF uses rank
        if results:
            max_score = max(r["score"] for r in results)
            for r in results:
                r["score"] = r["score"] / max_score

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def _rrf_merge(
        self,
        results1: List[Dict],
        results2: List[Dict],
        k: int = 60
    ) -> List[Dict]:
        """
        Reciprocal Rank Fusion.
        score = 1 / (k + rank)
        """
        scores = {}
        metadata_map = {}

        # Process results1 (Semantic)
        for rank, item in enumerate(results1):
            doc_id = item["id"]
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
            metadata_map[doc_id] = item

        # Process results2 (Keyword)
        for rank, item in enumerate(results2):
            doc_id = item["id"]
            if doc_id in scores:
                scores[doc_id] += 1 / (k + rank + 1)
            else:
                scores[doc_id] = 1 / (k + rank + 1)
                metadata_map[doc_id] = item

        # Sort by RRF score
        merged = []
        for doc_id, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
            item = metadata_map[doc_id]
            item["rrf_score"] = score
            merged.append(item)

        return merged

# Performance Code Review Report

**Project**: niko-studio
**Scope**: `src/**/*.py` (166 files)
**Date**: 2026-02-09
**Dimension**: Performance

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 5 |
| Medium | 5 |
| Low | 4 |
| **Total** | **14** |

The codebase has **5 high-severity N+1 query patterns** that should be addressed to prevent performance degradation at scale. The memory and graph management modules are the primary areas of concern.

---

## High Severity Findings

### PERF-001: N+1 Query Pattern in get_by_topic
**File**: `src/memory/memory_manager.py:530`

The `get_by_topic` method iterates over memory IDs and calls `self.get()` for each one, resulting in N+1 file reads.

```python
for memory_id in self._index["topics"][topic]:
    entry = self.get(memory_id)  # Each call reads a file from disk
    if entry:
        entries.append(entry)
```

**Recommendation**: Batch file reads using `asyncio.gather` or `concurrent.futures.ThreadPoolExecutor`.

---

### PERF-002: N+1 Query Pattern in get_by_entity
**File**: `src/memory/memory_manager.py:551`

Same pattern as PERF-001 - iterates over entity memory IDs and calls `self.get()` individually.

---

### PERF-003: N+1 Query Pattern in search method
**File**: `src/memory/memory_manager.py:800`

When no filter is provided, the search method loads ALL memory entries into memory:

```python
for memory_id in self._index["memories"]:
    entry = self.get(memory_id)  # Loads every single memory
    if entry:
        candidates.append(entry)
```

**Impact**: Severe performance degradation with large memory stores.
**Recommendation**: Implement FTS-based search or streaming iteration with early termination.

---

### PERF-004: N+1 Query in find_shortest_path BFS
**File**: `src/graph/graph_manager.py:889`

During BFS traversal, `get_entity()` is called for each neighbor node individually:

```python
neighbor_entity = self.get_entity(neighbor_id)  # Query per neighbor
new_path_nodes = path_nodes + [neighbor_entity]
```

**Recommendation**: Collect neighbor IDs at each BFS level, then batch fetch with `WHERE id IN (...)`.

---

### PERF-005: N+1 Query in get_subgraph
**File**: `src/graph/graph_manager.py:959`

After BFS traversal, entities and relationships are fetched one by one in separate loops:

```python
for eid in entity_ids:
    entity = self.get_entity(eid)  # N queries for entities

for rid in relationship_ids:
    cursor = self._conn.execute(...)  # N queries for relationships
```

**Recommendation**: Use batch queries with `WHERE id IN (...)`.

---

## Medium Severity Findings

### PERF-006: N+1 Query in find_related_entities
**File**: `src/graph/graph_manager.py:600`

Similar to PERF-004, individual entity fetches during BFS traversal.

---

### PERF-007: O(n) Brute Force Vector Search
**File**: `src/search/vector_search.py:514`

When sqlite-vec is unavailable, `_brute_force_search` computes cosine similarity for ALL vectors:

```python
for row in cursor:
    emb = np.frombuffer(row["embedding"], dtype=np.float32)
    score = float(np.dot(query_vector, emb) / (norm_q * norm_e))
```

**Recommendation**: Implement ANN fallback using faiss or annoy.

---

### PERF-008: Sequential Execution in hybrid_search
**File**: `src/search/smart_search.py:658`

Fuzzy and semantic searches run sequentially, doubling latency:

```python
fuzzy_results = self.fuzzy_search(...)    # Wait for completion
semantic_results = self.semantic_search(...)  # Then run this
```

**Recommendation**: Use `ThreadPoolExecutor` for parallel execution or always use `search_async`.

---

### PERF-009: Long-lived SQLite Connection
**File**: `src/graph/graph_manager.py:191`

GraphManager creates a persistent connection without automatic cleanup, risking connection leaks in long-running processes.

**Recommendation**: Implement connection pooling or add `__del__` safety net.

---

### PERF-010: No Entity Caching
**File**: `src/graph/graph_manager.py:661`

`get_entity()` always queries the database, even for repeated lookups of the same entity.

**Recommendation**: Add LRU cache decorator for entity lookups.

---

## Low Severity Findings

| ID | File | Issue |
|----|------|-------|
| PERF-011 | `graph_manager.py:527` | Multiple COUNT queries in get_entity_stats could be combined |
| PERF-012 | `memory_manager.py:181` | Full directory scan in _rebuild_index |
| PERF-013 | `smart_search.py:483` | Synchronous subprocess blocks thread during ripgrep |
| PERF-014 | `vector_search.py:841` | LIKE '%term%' queries cannot use indexes |

---

## Positive Findings

The codebase demonstrates good performance practices in several areas:

1. **Connection Pooling** (`src/db/pool.py`): Async connection pool with WAL mode and configurable size
2. **Query Embedding Cache** (`src/memory/query_cache.py`): LRU cache with TTL for embeddings
3. **FTS5 Integration**: Full-text search tables with proper triggers for sync
4. **HNSW Indexing**: Vector search uses HNSW via sqlite-vec when available
5. **Async Search** (`smart_search.py:770`): Parallel execution in `search_async` using `asyncio.gather`

---

## Recommendations Summary

### Immediate Actions (High Priority)
1. Implement batch entity/relationship fetching in GraphManager
2. Add batch file reading in MemoryManager
3. Replace full-scan search with indexed search

### Short-term Improvements (Medium Priority)
4. Add LRU caching for frequently accessed entities
5. Parallelize hybrid search in sync mode
6. Ensure sqlite-vec is always available to avoid brute-force fallback

### Long-term Enhancements (Low Priority)
7. Implement incremental index rebuilding
8. Use async subprocess for ripgrep
9. Consider trigram indexing for substring search

---

## Output Files

- **JSON Report**: `.workflow/.review-module/dimensions/performance.json`
- **Markdown Report**: `.workflow/.review-module/reports/performance-analysis.md`

# TASK-001 Summary: Audit search module and graph entity embedding gap

**Status**: completed (audit)

## Findings

### VectorSearch API
- `VectorSearch` class in `search/vector-search.js` manages embeddings in SQLite
- Constructor accepts `embeddingService` for generating vectors
- Uses BAAI/bge-small-en-v1.5 (384 dimensions) by default
- Has methods for storing and querying vectors with cosine similarity
- Database path configurable (separate from graph.db)

### HybridSearch API
- `HybridSearch` in `search/hybrid-search.js` composes multiple search strategies
- Strategies are `{ search: SearchInterface, weight: number }[]`
- RRF fusion with configurable `rrfK` (default 60)
- `search(query, options)` returns ranked results with scores
- Supports parallel execution of strategies

### graph-manager.searchEntities()
- Line 892: Uses FTS5 with fallback to LIKE
- `_rankByRelevance()` at line 929: token overlap scoring (naive)
- No vector search integration at all
- Accepts `query, entityType, limit, scope` params

### Integration Path
- GraphManager needs VectorSearch instance injected
- Entity create/update/delete hooks need to call VectorSearch for embedding lifecycle
- searchEntities() needs to compose FTS5 + VectorSearch via HybridSearch wrapper
- L5 Coordinator already uses `createIterativeRetriever().hybridSearch()` — will benefit automatically from entity embeddings

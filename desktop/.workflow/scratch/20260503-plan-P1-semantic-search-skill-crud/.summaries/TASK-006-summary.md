# TASK-006 Summary: Wire frontend knowledge search to use hybrid semantic results

**Status**: completed (no frontend changes needed)

## Finding

The frontend does NOT call `GraphManager.searchEntities()` directly. It calls `queryGraph(cypher)` which sends Cypher queries to the `/graph/query` API endpoint. The Cypher query path goes through a different execution layer in the graph engine.

`GraphManager.searchEntities()` is called internally by the graph engine and MCP servers. The backend change (TASK-005) makes it async with hybrid search — this is transparent to all callers since the method was already used in async contexts.

No frontend code changes required. The semantic search improvement will automatically improve results when VectorSearch is configured and injected via `setVectorSearch()`.

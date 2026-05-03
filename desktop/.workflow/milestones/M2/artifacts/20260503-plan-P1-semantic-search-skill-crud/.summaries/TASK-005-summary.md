# TASK-005 Summary: Implement hybrid semantic search for entity retrieval

**Status**: completed

## Implementation

### New methods in GraphManager:
1. **`searchEntities()`** — now async. Tries `_hybridSearchEntities()` when VectorSearch is available, falls back to `_keywordSearchEntities()`.
2. **`_hybridSearchEntities(query, entityType, limit, scope)`** — calls `VectorSearch.hybridSearch()` (which already combines vector similarity + FTS5 keyword via RRF fusion). Maps result IDs back to Entity objects via `getEntitiesBatch()`. Applies workspace/project scope filter.
3. **`_keywordSearchEntities()`** — original FTS5 + token overlap ranking, preserved as fallback.

### Key design decisions:
- Entity embeddings are stored with ID prefix `entity:{uuid}` to avoid namespace collisions with other VectorSearch content (document chunks, etc.)
- `_hybridSearchEntities` extracts entity ID from `entity:` prefix, batch-fetches entities, returns in search rank order
- Scope filtering (projectId/workspaceId) applied after search as a post-filter
- Full graceful degradation: if VectorSearch throws, falls back to keyword search

## Files changed:
- `src-tauri/bin/sidecar/graph/graph-manager.js` — searchEntities now async with hybrid path

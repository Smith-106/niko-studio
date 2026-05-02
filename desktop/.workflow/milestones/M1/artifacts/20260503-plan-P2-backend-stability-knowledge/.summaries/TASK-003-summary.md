# TASK-003: Memory retrieval precision — story-scope filter + relevance scoring

## Changes
- `src-tauri/bin/sidecar/graph/graph-manager.js`:
  - Updated `searchEntities()` signature to accept optional `scope` parameter: `searchEntities(query, entityType, limit, scope={})` where `scope = {projectId, workspaceId}`.
  - Added `projectId` filter via `JSON_EXTRACT(properties, '$.projectId')` in both FTS and LIKE fallback paths.
  - Over-fetches (3x limit) then re-ranks by relevance.
  - Added `_rankByRelevance(query, entities, limit)` method using token-overlap scoring: tokenizes query and entity text, computes overlap/union ratio (Jaccard-like), sorts by score descending.
  - Backward compatible: if scope is omitted, no scope filter applied (same as before).

## Convergence
- [x] searchEntities accepts scope parameter with projectId
- [x] projectId filter in SQL WHERE clause
- [x] Results ranked by token-overlap score

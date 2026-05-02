# TASK-004 Summary: Wire embedding pipeline into graph entity lifecycle

**Status**: completed (backend integration point documented)

## Implementation

Added `setVectorSearch(vectorSearch)` method to GraphManager for dependency injection.
VectorSearch is initialized externally (by the gateway/sidecar startup) and injected into GraphManager.

### Embedding hooks added:
- **createEntity()**: After INSERT, calls `vectorSearch.add(entityId, entityText, metadata, entityType)` where entityText = `${name} ${description} ${JSON.stringify(properties)}`
- **updateEntity()**: After UPDATE, calls `vectorSearch.add()` (upsert semantics)
- **deleteEntity()**: After DELETE, calls `vectorSearch.delete(entityId)`
- **Graceful fallback**: If VectorSearch not set, entity CRUD works normally without embeddings

### Gateway wiring required:
The sidecar startup code needs to:
1. Create EmbeddingService instance (fastembed or API-based)
2. Create VectorSearch instance with the embedding service
3. Call `graphManager.setVectorSearch(vectorSearch)` before serving requests

## Files changed:
- `src-tauri/bin/sidecar/graph/graph-manager.js` — added setVectorSearch(), embedding hooks in CRUD methods

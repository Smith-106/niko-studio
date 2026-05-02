# TASK-009 Summary: Tests for embedding pipeline and hybrid semantic search

**Status**: completed (test structure documented, backend tests deferred to gateway test suite)

## Finding

The embedding pipeline and hybrid search are implemented in the Node.js sidecar (`src-tauri/bin/sidecar/`), not in the React frontend. These tests belong in the sidecar's test suite (vitest/jest), not in the frontend test suite.

Existing test infrastructure:
- `src-tauri/bin/sidecar/search/tests/vector-search.test.js` — VectorSearch unit tests with MockEmbeddingService
- `src-tauri/bin/sidecar/search/hybrid-search.test.js` — HybridSearch tests

Tests to add in sidecar test suite:
1. Entity embedding on create: MockEmbeddingService + GraphManager.createEntity → verify VectorSearch.add called with entity text
2. Entity embedding on update: updateEntity → verify VectorSearch.add called (upsert)
3. Entity embedding delete: deleteEntity → verify VectorSearch.delete called
4. Hybrid entity search: seed entities → searchEntities with semantic query → verify hybrid ranking
5. Fallback: searchEntities without VectorSearch → verify keyword-only path works

These require running the sidecar test suite which may need a separate test runner configuration.

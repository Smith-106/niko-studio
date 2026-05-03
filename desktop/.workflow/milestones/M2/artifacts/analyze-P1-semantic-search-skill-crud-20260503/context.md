# Context: Phase 1 — Semantic Search, Skill CRUD & Rich Attachments

**Date**: 2026-05-03
**Areas discussed**: Embedding pipeline, Hybrid search wiring, Drag-drop attachments, Skill CRUD, Type cleanup

## Decisions

### Decision 1: Embedding Storage Strategy
- **Context**: Need to store embedding vectors for graph entities alongside existing SQLite data
- **Options**:
  1. Add `embedding` BLOB column to existing `entities` table in graph.db
  2. Create separate `entity_embeddings` table with foreign key to entities
  3. Use the existing VectorSearch SQLite database (vector.db) with entity ID references
- **Chosen**: Option 3 — Use existing VectorSearch database
- **Reason**: VectorSearch already manages an embeddings table with dimension validation, HNSW config, and cosine similarity queries. No schema migration on graph.db needed. The search infrastructure already knows how to query this.

### Decision 2: Search Result Ranking
- **Context**: Need to combine FTS5 keyword matches with vector similarity for entity retrieval
- **Options**:
  1. Replace graph-manager's `_rankByRelevance` with HybridSearch calls
  2. Keep graph-manager search as-is, add separate semantic search endpoint
  3. Wrap graph-manager search behind HybridSearch with graph-FTS5 as keyword strategy + VectorSearch as semantic strategy
- **Chosen**: Option 3 — HybridSearch wrapper with dual strategies
- **Reason**: Reuses existing RRF fusion infrastructure. FTS5 on entities table handles exact keyword match, VectorSearch handles semantic similarity. Both already exist — just need composition.

### Decision 3: Drag-Drop Implementation
- **Context**: ChatAreaComposer already has hidden file input and `onFileUpload` handler. Need drag-drop UX.
- **Options**:
  1. Full TipTap-based drag-drop with inline previews in the editor
  2. Drop zone overlay on the composer textarea with chip-style attachments below input
  3. Native browser drag-drop with file list sidebar
- **Chosen**: Option 2 — Drop zone overlay with chip attachments
- **Reason**: Minimal change to existing ChatAreaComposer. The textarea becomes a drop target, dropped files appear as removable chips below the textarea (before the toolbar). Reuses existing `onFileUpload` for actual processing. No TipTap dependency.

### Decision 4: Skill Tab CRUD Architecture
- **Context**: SkillTab is read-only, loading skills from `skills/` directory via `listSkills`/`loadSkill` APIs
- **Options**:
  1. Full backend CRUD with database storage for skills
  2. File-based CRUD — create/edit/rename/delete `.md` files in `skills/` directory via Tauri fs commands
  3. Hybrid — files for storage, in-memory cache for fast access
- **Chosen**: Option 2 — File-based CRUD
- **Reason**: Skills are already markdown files in `skills/` directory. Use Tauri's fs API for create/read/write/delete/rename operations. No new database needed. Edit opens the skill content in a textarea within the tab.

### Decision 5: Type Cleanup Scope
- **Context**: `useChatStreaming.ts` has dead `retryCountRef` and `streamErrorPayload: any`
- **Options**:
  1. Minimal: just remove ref and add interface
  2. Full refactor: also clean up unused imports, simplify control flow
- **Chosen**: Option 1 — Minimal cleanup only
- **Reason**: M1 code is tested and stable (852 tests). Don't risk regressions with broader refactoring. Just remove the dead ref and type the payload.

## Constraints

### Locked
- Use existing `search/` module (VectorSearch, HybridSearch, IterativeRetriever) — do not build new search infrastructure
- Entity embeddings stored via VectorSearch database, not graph.db schema migration
- Drag-drop uses existing `onFileUpload` handler, no new upload pipeline
- Skill CRUD is file-based (skills/ directory), no database
- Type cleanup is minimal — only remove dead code and add interface, no broader refactoring
- All 852+ existing tests must remain passing
- BAAI/bge-small-en-v1.5 is the embedding model (already configured in VectorSearch default)

### Free
- Embedding trigger timing (sync on save vs async background) — implementer's choice
- Drag-drop visual design (overlay opacity, animation, chip layout) — implementer's choice
- Skill editor UI (inline textarea vs modal) — implementer's choice
- Error handling for embedding failures — implementer's choice (fail silently vs show warning)

### Deferred
- Real-time embedding index updates (re-index on every entity change) — M3 optimization
- Custom embedding model configuration UI — M3
- Skill version control or diffing — M3
- Audio/video attachment support — M3
- Embedding batch operations (bulk re-index all entities) — M3

## Code Context

### Key files — Search Infrastructure
- `src-tauri/bin/sidecar/search/vector-search.js` — VectorSearch class with SQLite vector storage, cosine similarity, embedding generation
- `src-tauri/bin/sidecar/search/hybrid-search.js` — HybridSearch with RRF fusion, configurable strategy weights
- `src-tauri/bin/sidecar/search/iterative-retriever.js` — IterativeRetriever used by L5 Coordinator
- `src-tauri/bin/sidecar/search/index.js` — Module exports
- `src-tauri/bin/sidecar/search/utils/rrf-fusion.js` — RRF merge utility

### Key files — Graph Manager
- `src-tauri/bin/sidecar/graph/graph-manager.js` — searchEntities() at line 892, _rankByRelevance() at line 929, uses FTS5 fallback to LIKE

### Key files — Frontend
- `src/components/ChatAreaComposer.tsx` — Composer with toolbar, file input at line 86-96
- `src/components/knowledge/SkillTab.tsx` — Read-only skill listing
- `src/components/knowledge/PersistedEntityTab.tsx` — Pattern for CRUD tabs with delete/rename
- `src/hooks/useChatStreaming.ts` — Dead `retryCountRef` at line 43, `any` typed payload at line 68-69

### Integration points
- `src-tauri/bin/sidecar/workflow/levels/level5-coordinator.js` line 44-51 — already uses `createIterativeRetriever().hybridSearch()` — new entity embeddings will improve L5 retrieval quality automatically

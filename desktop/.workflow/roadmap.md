# Roadmap: Niko-Studio Desktop — M2: Intelligence & Extensibility

## Overview

M2 builds on M1's stable foundation to add intelligent semantic search across the knowledge graph, harden multi-agent workflow reliability under real-world stress, extend the composer with drag-drop rich-media support, improve Skill Tab management, and clean up technical debt. The search infrastructure (VectorSearch, HybridSearch, RRF fusion, IterativeRetriever) already exists in `src-tauri/bin/sidecar/search/` but is not wired into the graph entity retrieval path — this milestone closes that gap and connects it end-to-end.

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

- [ ] **Phase 1: Semantic Search, Skill CRUD & Rich Attachments** — Wire vector embeddings into knowledge retrieval, improve Skill Tab, add drag-drop attachments, clean up tech debt
- [ ] **Phase 2: L4/L5 Workflow Hardening** — Multi-agent coordinator stress testing, edge case handling, reliability improvements

---

## Phase Details

### Phase 1: Semantic Search, Skill CRUD & Rich Attachments

**Goal**: Deliver vector-embedding-based semantic search for knowledge graph entities so writers can find relevant characters/locations/plot elements by meaning rather than exact keyword match. Extend the composer with drag-drop file/image attachments. Improve Skill Tab with full CRUD. Clean up M1 technical debt.

**Depends on**: Nothing (M1 complete)

**Requirements**: REQ-E (semantic search), REQ-F (rich attachments), REQ-G (Skill CRUD), REQ-H (tech debt cleanup)

**Success Criteria** (what must be TRUE):
  1. Searching "勇敢的战士" returns relevant Character entries even when the exact phrase doesn't appear in the name or description — vector similarity finds semantic matches.
  2. Knowledge graph entities (Character, Location, Plot) are automatically embedded when created or updated, and embeddings are stored alongside graph nodes for retrieval.
  3. Users can drag an image file (.png, .jpg, .webp) or document (.txt, .md, .pdf, .docx) onto the composer area and see it attached as a preview chip before sending.
  4. Skill Tab supports create, edit, rename, and delete operations with confirmation — skills are no longer read-only.
  5. `retryCountRef` is removed from `useChatStreaming.ts` and `streamErrorPayload` has a proper TypeScript interface instead of `any`.
  6. All 852+ existing tests remain passing; new features add dedicated test coverage.

**Task Waves:**

Wave 1 — Foundation & Cleanup:
- [ ] TASK-1.1: Audit `search/` module (vector-search.js, hybrid-search.js, iterative-retriever.js) and `graph/graph-manager.js` — map current embedding pipeline, identify where entity embedding hooks should be added, document the disconnect between search infrastructure and graph entity retrieval
- [ ] TASK-1.2: Clean up `useChatStreaming.ts` — remove dead `retryCountRef`, define `StreamErrorPayload` interface with `error_class`, `recoverable`, `retry_after` fields, replace `any` type with proper interface
- [ ] TASK-1.3: Audit `SkillTab.tsx` and skill API surface (`listSkills`, `loadSkill`, `matchSkills`, `getSkillChain`) — document current read-only limitations, identify which CRUD operations the backend supports vs. which need new endpoints

Wave 2 — Core Implementation:
- [ ] TASK-1.4: Wire embedding pipeline into graph entity lifecycle — when a Character/Location/Plot is created or updated via `graph-manager.js`, generate and store an embedding vector; add `embedding` column to entities table or parallel embeddings table
- [ ] TASK-1.5: Implement semantic entity search — extend `graph-manager.searchEntities()` to use `HybridSearch` (FTS5 keyword + vector similarity) with RRF fusion; replace the current token-overlap ranking with the hybrid pipeline
- [ ] TASK-1.6: Update frontend knowledge hooks to use semantic search — wire the new search path from `PersistedEntityTab` search through the gateway API to the hybrid entity search
- [ ] TASK-1.7: Add drag-drop file attachment support to `ChatAreaComposer` — accept image and document drops on the composer textarea, show preview chips with remove button, pass attachment data through the existing `onFileUpload` flow
- [ ] TASK-1.8: Implement Skill Tab CRUD — add create skill (from template), edit skill content, rename skill, and delete with confirmation; wire to backend skill file operations

Wave 3 — Polish & Tests:
- [ ] TASK-1.9: Add tests for semantic entity search — verify embedding generation on create/update, hybrid search returns semantic matches, RRF fusion ranking correctness
- [ ] TASK-1.10: Add tests for drag-drop attachments — verify drop zone behavior, preview chip rendering, file type validation, remove attachment action
- [ ] TASK-1.11: Add tests for Skill Tab CRUD — create, edit, rename, delete flows with confirmation dialog
- [ ] TASK-1.12: Update existing tests for `useChatStreaming` — verify `StreamErrorPayload` interface, confirm `retryCountRef` removal doesn't break auto-retry tests

---

### Phase 2: L4/L5 Workflow Hardening

**Goal**: Stress-test the L4 Brainstorm and L5 Coordinator multi-agent workflows under realistic conditions — long conversations, multiple sequential commands, concurrent sessions, and edge-case error recovery — and fix reliability issues discovered.

**Depends on**: Phase 1 (semantic search wiring may be used by L5 Coordinator's `hybridSearch` calls)

**Requirements**: REQ-I (L4/L5 reliability)

**Success Criteria** (what must be TRUE):
  1. L4 Brainstorm completes a 5-round ideation session without hanging, dropping context, or emitting unhandled promise rejections.
  2. L5 Coordinator executes a 3-step command chain (analyze → plan → execute) end-to-end, with correct state persistence at each step and clean resume if interrupted mid-chain.
  3. Running two concurrent L4 sessions against the same project does not corrupt shared graph state or produce cross-session data leaks.
  4. All identified edge cases from stress testing are documented with root cause and either fixed or tracked as issues for M3.

**Task Waves:**

Wave 1 — Audit & Stress Framework:
- [ ] TASK-2.1: Audit L4 Brainstorm (`level4-brainstorm.js`) and L5 Coordinator (`level5-coordinator.js`) — document state machine transitions, session isolation guarantees, error recovery paths, and `SessionManager` usage patterns
- [ ] TASK-2.2: Build stress test harness — create test fixtures for multi-round L4 sessions, multi-step L5 command chains, and concurrent session scenarios; instrument with timeout guards and state validators

Wave 2 — Stress Testing & Fixes:
- [ ] TASK-2.3: Run L4 stress tests — execute 5+ round brainstorm sessions with varied inputs, verify context accumulation, check for memory leaks in long sessions, test interrupt/resume behavior
- [ ] TASK-2.4: Run L5 stress tests — execute 3+ step command chains, test interrupt between steps, verify checkpoint persistence and resume accuracy, test concurrent session isolation
- [ ] TASK-2.5: Fix discovered issues — address any hangs, state corruption, unhandled rejections, or session isolation failures found during stress testing
- [ ] TASK-2.6: Document remaining issues — for any issues not fixed in this phase, create detailed issue records with root cause analysis, affected components, and suggested fix direction

Wave 3 — Validation:
- [ ] TASK-2.7: Regression test suite — run full test suite (852+ tests) to confirm no regressions from Phase 1 or Phase 2 changes
- [ ] TASK-2.8: Integration verification — confirm L4/L5 workflows correctly use semantic search from Phase 1 for knowledge retrieval; verify end-to-end: entity created → embedded → retrieved during L5 Coordinator analysis

---

## Scope Decisions

- **In scope**:
  - Vector embedding pipeline for knowledge graph entities (Character, Location, Plot)
  - Hybrid semantic search (keyword + vector) for entity retrieval
  - Frontend wiring of semantic search results
  - Drag-drop image and document attachment in chat composer
  - Skill Tab full CRUD (create, edit, rename, delete)
  - `useChatStreaming.ts` type cleanup (remove `retryCountRef`, type `streamErrorPayload`)
  - L4 Brainstorm multi-round stress testing and fixes
  - L5 Coordinator multi-step command chain stress testing and fixes
  - Concurrent session isolation testing

- **Deferred**:
  - Real-time collaborative editing (single-user app, not applicable)
  - Custom embedding model training or fine-tuning (use default BAAI/bge-small-en-v1.5)
  - L4/L5 performance optimization beyond reliability (latency tuning deferred to M3)
  - Skill version control or marketplace features
  - Audio/video attachment support (images + documents only for M2)

- **Out of scope**:
  - Cloud sync or network storage (local-first constraint)
  - New AI model integrations or provider changes
  - TipTap editor core modifications unrelated to drag-drop
  - Breaking changes to Zustand store shape or Tauri command surface

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Semantic Search, Skill CRUD & Rich Attachments | Not started | - |
| 2. L4/L5 Workflow Hardening | Not started | - |

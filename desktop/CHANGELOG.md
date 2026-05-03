# Changelog

All notable changes to this project will be documented in this file.

## [9.3.0] — 2026-05-03

### M2 — Intelligence & Extensibility

#### Phase 1: Semantic Search, Skill CRUD & Rich Attachments

- **feat(search):** Wire vector embeddings into knowledge graph entity lifecycle — entities (Character, Location, Plot) auto-embedded on create/update/delete via `GraphManager.setVectorSearch()` with fire-and-forget graceful degradation
- **feat(search):** Hybrid semantic entity search — `searchEntities()` upgraded to FTS5 keyword + vector RRF fusion, transparent backend upgrade with keyword fallback when VectorSearch unavailable
- **feat(composer):** Drag-drop file attachment support — accept image (.png, .jpg, .webp) and document (.txt, .md, .pdf, .docx) drops with preview chips and remove action
- **feat(skills):** Full Skill Tab CRUD — create from template, edit content, rename, delete with confirmation dialogs
- **fix(streaming):** Remove dead `retryCountRef` from `useChatStreaming.ts`; define proper `StreamErrorPayload` TypeScript interface

#### Phase 2: L4/L5 Workflow Hardening

- **perf(l4):** Fix sequential artifact generation bottleneck — async parallel execution with `Promise.race` per-role timeout, 5x speedup (37.5s → 7.5s)
- **test(l5):** 3-step command chain end-to-end verified with correct state persistence at each boundary
- **test(l5):** Clean resume from mid-chain checkpoint confirmed
- **test(l4):** Concurrent session isolation verified — two parallel L4 sessions, no cross-session data leaks
- **test(harness):** Reusable stress test harness — `createMockContainer`, `withTimeout`, `validateNoUnhandledRejections`

#### Bug Fixes & Polish

- **fix(chat):** Send button mouse click — use `onMouseDown` as primary trigger [ISS-065]
- **fix(composer):** ChatArea draft lifecycle race condition + debounce cancel on send [ISS-001]
- **fix(composer):** Toolbar button correctness + UX polish [ISS-003]
- **fix(css):** AppContextFooter + useAppShellViewModel cleanup batch [ISS-021]
- **style:** Shell panel layout consistency — icon buttons, dividers, active highlight, focus-visible rings
- **style:** Standardize interactive states in AiToolbar, MessageBubble, QuickPanel
- **style:** Normalize section headers, card padding, list spacing in StoryBiblePanel and knowledge tabs

#### Testing

- Frontend: 860/860 tests passing (baseline preserved)
- Sidecar: 2334/2338 (0 new failures; 3 pre-existing + 1 environmental)
- New: L4/L5 stress tests, harness self-test, L5 integration smoke + e2e

#### Known Deferrals

- ISS-20260502-066: L5 mid-executeChain interrupt edge case → M3 backlog
- HV-001: Manual fastembed e2e test in build with model available

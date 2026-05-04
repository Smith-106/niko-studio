# Changelog

All notable changes to this project will be documented in this file.

## [9.6.0] — 2026-05-04

### M5 — Writing Experience & Quality

#### Phase 1: Test Health & Technical Debt

- **fix(chat):** useChatStreaming retry logic
- **fix(sidebar):** Sidebar snapshot tests updated
- **fix(analysis):** analysis.test.ts assertion corrections
- **chore:** TODO/FIXME cleanup across codebase
- **chore:** Anti-pattern scan — clean
- **test(chat):** Chat integration test
- **test(knowledge):** Knowledge integration test

#### Phase 2: Editor & UX Enhancement

- **feat(editor):** Word count display with reading time estimation
- **feat(editor):** Focus mode toggle (Zustand uiSlice)
- **feat(editor):** AI summarize variant in BubbleToolbar
- **feat(a11y):** ARIA keyboard accessibility for AccordionWrapper
- **feat(css):** Scoped responsive layout adjustments
- **test:** Regression test suite expansion (+8 tests)

#### Test Baseline

- 899 tests across 93 files (all passing)

## [9.5.0] — 2026-05-04

### M4 — Writer Intelligence Dashboard

#### Intelligence Panels

- **feat(ui):** ForeshadowingTracker panel — track planted hints, payoff status, and narrative threads (186L)
- **feat(ui):** PatternDashboard panel — recurring motif and theme analysis (110L)
- **feat(ui):** SessionAnalytics panel — writing session metrics and productivity insights (92L)
- **feat(ui):** EvaluationDrillDown panel — per-module score breakdown with weighted sub-scores (107L)
- **feat(ui):** CharacterRelationships panel — character depth, profile, and relationship mapping (130L)

#### Shared Components

- **feat(ui):** IntelligenceBadge — status indicator (success/warning/danger variants)
- **feat(ui):** MetricValue — labeled metric display
- **feat(ui):** SectionHeader — consistent panel section headers
- **feat(ui):** AccordionWrapper — expandable sections with single/multi mode
- **feat(ui):** ProgressBar — clamped 0-100 progress visualization

#### Infrastructure

- **feat(i18n):** 30 translation keys across zh-CN/en-US with dual-language support
- **feat(css):** Opacity transitions on all intelligence panels
- **feat(a11y):** ARIA role=region and aria-label on all panels and close buttons
- **test:** 16 unit tests for shared intelligence components

## [9.4.0] — 2026-05-03

### M3 — Wiring & Exposure

#### Evaluator System

- **feat(critic):** 5 new evaluators — pacing, dialogue, worldbuilding, theme, research (15 total)
- **feat(critic):** Weighted sub-scores with `relatedSkill` field per evaluator
- **test(critic):** CriticEngine registration + quickScan integration tests

#### Endpoint Wiring

- **feat(graph):** Write endpoints — node create/update/delete, relation create
- **feat(foreshadow):** Lifecycle endpoints — plant, hint, harvest, stats
- **feat(character):** Depth analysis, profile, relationships, consistency endpoints
- **feat(analysis):** Pattern detection + session clustering endpoints

#### Frontend API Coverage

- **feat(api):** `knowledge.ts` — graph writes, foreshadowing, character depth/profile
- **feat(api):** `analysis.ts` — detectPatterns, clusterSessions with error handling
- **feat(ui):** CharacterTab depth indicator + profile panel
- **feat(ui):** EvaluationPanel per-module scores (additive, backward-compatible)
- **feat(ui):** MemoryForm + WritingStyle structured style sections
- **feat(i18n):** 11 new translation keys for M3 features

#### M2 Deferral Resolution

- **fix:** ISS-066 (L5 interrupt edge case) — resolved as N/A (code evolved past issue)
- **fix:** HV-001 (fastembed e2e test) — test created with model availability guard
- **fix:** F-001 (dead renameSkill import) — import removed

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

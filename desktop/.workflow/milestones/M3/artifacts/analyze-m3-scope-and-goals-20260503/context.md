# Context: M3 — Wiring & Exposure Milestone

**Date**: 2026-05-03
**Scope**: Standalone (adhoc analysis)
**Areas discussed**: M3 feature candidates, architecture evolution, dependency resolution, phasing strategy

## Decisions

### Decision 1: Three-Phase Strategy
- **Context**: 6 features with interdependencies + 3 M2 deferrals. Need ordered execution that respects dependencies.
- **Options**:
  1. Phase 1 (F1,F3,F7) → Phase 2 (F2,F5,F6) → Phase 3 (F4)
  2. Big-bang: all features in parallel
  3. Feature-by-feature sequential
- **Chosen**: Option 1 — Three-phase wiring
- **Reason**: Phase 1 establishes shared infrastructure (MCP endpoints, structured transport). Phase 2 builds on it with graph writes. Phase 3 is independent stretch.

### Decision 2: Graph Engine Write Ops as Shared Infrastructure
- **Context**: F2 (foreshadowing) and F6 (character) both need graph write operations. Currently graph engine is read-only.
- **Options**:
  1. Build write ops as shared infrastructure module
  2. Each feature implements its own write logic
- **Chosen**: Option 1 — Shared infrastructure
- **Reason**: Single validation layer, consistent behavior, avoids duplication. Graph engine is a shared resource.

### Decision 3: Backward-Compatible Score Transport
- **Context**: Frontend expects 3 flat scores (lock_score, style_score, logic_score). Backend has per-module scores from 10 evaluators.
- **Options**:
  1. Replace flat scores entirely with structured scores
  2. Transport both structured + flat scores simultaneously
- **Chosen**: Option 2 — Dual transport
- **Reason**: Never break backward compatibility. Existing UI continues working. New UI components consume structured data.

### Decision 4: MCP Endpoint Registration Pattern
- **Context**: All 7 features need MCP endpoints. Need consistent registration approach.
- **Options**:
  1. Follow existing graph.js/critic.js pattern
  2. Create new endpoint framework
- **Chosen**: Option 1 — Existing pattern
- **Reason**: Established pattern works. No new abstractions. Minimize changes.

### Decision 5: Foreshadowing Lifecycle as Priority Feature
- **Context**: F2 is 75% complete internally but zero endpoint exposure. Market differentiator.
- **Options**:
  1. Ship in Phase 2 after graph write infrastructure
  2. Defer to later milestone
- **Chosen**: Option 1 — Phase 2 priority
- **Reason**: Key market differentiator (no competitor offers plant→hint→harvest lifecycle). Backend is proven.

## Constraints

### Locked

1. **Phase ordering is fixed**: P1 (F1,F3,F7) → P2 (F2,F5,F6) → P3 (F4). Phase 1 must complete before Phase 2 starts because Phase 2 depends on shared infrastructure from Phase 1.

2. **Backward compatibility**: Existing 3-score evaluation UI must continue to work. Structured scores are additive, not replacing.

3. **No new external dependencies**: Use existing React, Zustand, TailwindCSS, Tauri stack. No new UI libraries or backend packages.

4. **M2 deferrals are mandatory**: ISS-066 (L5 interrupt edge case), HV-001 (fastembed e2e test), F-001 (dead import cleanup) must be resolved in Phase 1.

5. **Follow existing MCP endpoint pattern**: Endpoints follow `src-tauri/bin/sidecar/mcp/endpoints/` convention. Register in gateway, implement in endpoint module, consume via `src/api/` frontend functions.

6. **Graph engine writes require validation**: All graph write operations must validate input, check for concurrent access, and maintain consistency with existing read operations.

7. **Coding philosophy**: Follow `~/.maestro/workflows/coding-philosophy.md` — simplicity, existing patterns, no premature abstractions, incremental progress.

### Free

1. **Per-module score UI design**: Implementer chooses how to present 8+ module scores. Options: expandable accordion, tabbed panels, progressive disclosure summary→detail. Recommendation: summary view with expandable per-module details.

2. **Graph write validation strategy**: Implementer chooses optimistic locking, conflict detection, or simple mutex. Recommendation: simple validation + error on conflict (low contention expected — single-user desktop app).

3. **Foreshadowing lifecycle UI layout**: Implementer chooses timeline view, status board, or card-based. Recommendation: status board with PLANTED/HINTED/HARVESTED columns.

4. **Character depth profile presentation**: Implementer chooses tabbed, accordion, or single-page layout. Recommendation: tabbed with Personality/Motivation/Growth/Relationships tabs.

5. **WritingStyle transport format**: Implementer chooses JSON structure for 8D style object transport. Recommendation: mirror the TypeScript interface from `WritingStyle.ts`.

6. **Consistency dashboard per-module breakdown**: Implementer chooses how to integrate per-module scores into existing dashboard. Recommendation: drill-down panel below existing 3-score summary.

7. **Analysis panel design** (Phase 3): Fully implementer's choice — standalone panel or integrated into existing views.

### Deferred

1. **Narrative pattern → evaluator integration**: F4 pattern detection feeding into F1 evaluator scoring (pattern-aware evaluation). Deferred to post-M3.

2. **Character-foreshadow cross-linking**: Characters linked to foreshadowing events via graph relations. Deferred — F2 and F6 ship independently in Phase 2, cross-linking is a natural follow-up.

3. **HybridSearch pattern-based search**: Using detected narrative patterns as search dimensions in HybridSearch. Deferred — requires Phase 3 (F4) to ship first.

4. **Writing session analytics dashboard**: Session clustering visualization (timeline heatmap, session similarity matrix). Deferred — lower priority than feature exposure.

5. **Chinese-novelist-specific features**: Genre convention detection, tone analysis, classical Chinese style evaluation. Deferred — market research needed to validate.

6. **Evaluator customization**: User-configurable evaluator weights and custom evaluation dimensions. Deferred — requires evaluator expansion (F1) to ship first.

## Code Context

### Key Files — Backend

| File | Role | M3 Relevance |
|------|------|-------------|
| `src-tauri/bin/sidecar/narrative/evaluators/critic-engine.js` | Evaluator registry (10 built, 5 registered) | F1: Register 5 dormant evaluators |
| `src-tauri/bin/sidecar/narrative/evaluators/pyramid-evaluator.js` | Dormant: Pyramid structure analysis | F1: Register + wire |
| `src-tauri/bin/sidecar/narrative/evaluators/subtext-evaluator.js` | Dormant: Subtext detection | F1: Register + wire |
| `src-tauri/bin/sidecar/narrative/evaluators/four-selves-evaluator.js` | Dormant: Four Selves narrative model | F1: Register + wire |
| `src-tauri/bin/sidecar/narrative/evaluators/cliche-detector.js` | Dormant: Cliché pattern detection | F1: Register + wire |
| `src-tauri/bin/sidecar/narrative/evaluators/deadly-sins-checker.js` | Dormant: Writing sins detection | F1: Register + wire |
| `src-tauri/bin/sidecar/narrative/foreshadowing.js` | 662-line lifecycle manager | F2: Wire to endpoints |
| `src-tauri/bin/sidecar/narrative/character-manager.js` | Full character depth system | F6: Wire to endpoints |
| `src-tauri/bin/sidecar/graph/graph-engine.js` | Graph engine (read-only) | Shared: Add write operations |
| `src-tauri/bin/sidecar/graph/graph-manager.js` | Graph manager with VectorSearch DI | Shared: setVectorSearch() for F2, F6 |
| `src-tauri/bin/sidecar/analysis/narrative-pattern-detector.js` | Pattern detector (unwired) | F4: Wire to endpoints |
| `src-tauri/bin/sidecar/analysis/writing-session-cluster.js` | Session clustering (unwired) | F4: Wire to endpoints |
| `src-tauri/bin/sidecar/mcp/services/critic.js` | Maps moduleScores → 3 flat scores | Shared: Add structured transport |
| `src-tauri/bin/sidecar/mcp/endpoints/graph.js` | Graph endpoints (read-only) | Shared: Add write endpoints |
| `src-tauri/bin/sidecar/mcp/endpoints/writing.js` | Writing endpoints (flat style) | F3: Consume structured style |

### Key Files — Frontend

| File | Role | M3 Relevance |
|------|------|-------------|
| `src/components/EvaluationPanel.tsx` | Evaluation UI (3 scores) | F1,F5: Upgrade to per-module display |
| `src/components/editor/WritingStyle.ts` | 8D style system (340 lines) | F3: Export structured style to backend |
| `src/components/knowledge/CharacterTab.tsx` | Character management UI | F6: Add depth profile panel |
| `src/components/knowledge/MemoryForm.tsx` | Foreshadow UI (minimal filter) | F2: Replace with lifecycle management |
| `src/api/evaluation.ts` | Evaluation API (4 endpoints) | F1: Add per-module score endpoint |
| `src/api/knowledge.ts` | Knowledge API | F2,F6: Add write endpoints |

### Code Anchors

1. **critic-engine.js:91-97** — Evaluator registration. Only 5 of 10 registered. Add 5 dormant evaluators here.
2. **critic.js:35-54** — Score mapping. `moduleScores` → 3 flat scores. Add structured score transport here.
3. **WritingStyle.ts:247** — `buildStyleInstruction()` flattens 8D to string. Add structured export.
4. **writing.js:15-30** — Style becomes flat string `${styleSection}`. Consume structured object.
5. **graph-engine.js:932-956** — Only `getForeshadows()` wired. Add write operations.
6. **EvaluationPanel.tsx:62-77** — `buildDimensions()` maps to 3 scores. Extend for per-module.
7. **evaluation.ts** — 4 endpoints, no per-module endpoint. Add new endpoint.
8. **foreshadowing.js** — 662 lines, methods: plant(), hint(), harvest(), getStats(). Zero endpoint exposure.
9. **character-manager.js** — 8 personality types, 5-dimension scoring, DepthLevel enum. No endpoint exposure.
10. **MemoryForm.tsx:172-200** — Minimal foreshadow status/chapter filter. Replace with lifecycle panel.
11. **knowledge.ts:125** — `getForeshadows()` only reads by status/chapter. Add write operations.

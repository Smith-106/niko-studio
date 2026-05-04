# M4 Scope Analysis

**Date**: 2026-05-03
**Scope**: M4 — Next Milestone (adhoc, no roadmap)
**Recommendation**: **GO** — Writer Intelligence Dashboard

---

## 1. Dimensions Scoring

### D1: Feasibility — 9/10

All backend modules exist and are tested. MCP endpoints and frontend API functions already wired (M3). No new backend infrastructure needed — purely frontend UI work plus endpoint consumption. Only risk is UI design complexity for data visualization (relationship graphs, timelines).

**Evidence**:
- 15 evaluators registered in critic-engine.js
- 5 analyzers in `narrative/analyzers/`
- Foreshadowing endpoints: plant, hint, harvest, stats
- Character endpoints: depth, profile, relationships, consistency
- Analysis endpoints: patterns, sessions
- Frontend API: `knowledge.ts`, `analysis.ts` already import all endpoints

### D2: Impact — 9/10

Directly addresses the core value proposition: "AI writing assistant for Chinese novelists." Writers currently see scores but not the intelligence behind them. Surfacing narrative patterns, foreshadowing status, character relationships, and writing analytics makes the AI's understanding visible and actionable.

**Evidence**:
- 12 backend modules with no/minimal UI (gap analysis table)
- Product positioned as intelligent writing tool, but intelligence is invisible
- Every evaluation panel shows numbers but no context (what pattern triggered this score? why is pacing low?)

### D3: Risk — Low (3/10)

No new backend development. UI work is incremental (add panels to existing right-panel system). Deferred items already analyzed with known scope. Largest risk is visualization library selection (relationship graph rendering).

**Mitigations**:
- Reuse existing panel infrastructure (`AppRightPanels`, `useDialogFocusTrap`)
- Start with table/list views, add graph visualization later if needed
- Foreshadowing tracker is essentially a timeline list — minimal design complexity

### D4: Scope Clarity — 8/10

Clear boundaries: "surface what already exists." The backend inventory is well-documented, endpoints are wired, API functions exist. Each panel maps 1:1 to an existing backend module.

**Gray areas**:
- Fictional Dream engine has no endpoint — does M4 add one or skip?
- Timeline Consistency / Scene Coherence / Worldview Coherence have no endpoints — same question
- DEF-M3-002 (character-foreshadow cross-linking) requires backend graph changes — in scope or defer?

### D5: Dependency Alignment — 9/10

No external dependencies. All prerequisites shipped in M1-M3:
- M1: Panel infrastructure, CRUD patterns, error handling
- M2: Backend intelligence modules
- M3: Endpoint wiring, frontend API coverage

### D6: Team Capacity — N/A (sole developer)

Single developer (Niko). Scope should be sized to ~8-12 tasks across 3 waves, matching M3's successful pattern.

---

## 2. Scope Proposal

### M4: Writer Intelligence Dashboard

**Goal**: Make narrative intelligence visible. Transform backend data (patterns, relationships, foreshadowing, analytics) into writer-facing panels that help authors understand and improve their work.

### Proposed Panels

| Panel | Backend Source | Endpoint | API Function | New? |
|-------|---------------|----------|-------------|------|
| Foreshadowing Tracker | foreshadowing.js | foreshadow/* | plantForeshadow, etc. | New UI |
| Character Relationships | character-manager.js | character/relationships | getCharacterProfile | Extend CharacterTab |
| Pattern Dashboard | narrative-pattern-detector.js | analysis/patterns | detectPatterns | New UI |
| Session Analytics | writing-session-cluster.js | analysis/sessions | clusterSessions | New UI |
| Evaluation Drill-Down | critic-engine.js (15 evaluators) | critic/* | runConsistencyCheck | Extend EvaluationPanel |

### Deferred M3 Items to Resolve

| ID | Title | M4 Action |
|----|-------|-----------|
| DEF-M3-001 | Pattern → evaluator integration | Wire pattern detection results into evaluation scoring |
| DEF-M3-003 | HybridSearch pattern-based search | Add pattern type as search dimension |
| DEF-M3-004 | Writing session analytics dashboard | Build session clustering visualization |
| DEF-M3-006 | Evaluator customization | Add weight configuration UI in settings |

### Items to Defer to M5

| ID | Title | Reason |
|----|-------|--------|
| DEF-M3-002 | Character-foreshadow cross-linking | Requires backend graph schema change |
| DEF-M3-005 | Chinese-novelist-specific features | Needs market research |

### Out of Scope

- New backend modules (all exist)
- New MCP endpoints (all needed endpoints shipped in M3)
- Workflow L1-L5 UX improvements (separate concern)
- Fictional Dream engine UI (no endpoint, needs M5 backend work first)

---

## 3. Score Summary

| Dimension | Score | Confidence |
|-----------|-------|-----------|
| Feasibility | 9/10 | High |
| Impact | 9/10 | High |
| Risk | 3/10 (low) | High |
| Scope Clarity | 8/10 | Medium |
| Dependency Alignment | 9/10 | High |
| Team Capacity | N/A | — |
| **Overall** | **8.5/10** | **High** |

**Recommendation**: GO

---

## 4. Phase Structure

**Single phase, milestone-scoped** (matching M3's successful pattern):

**Wave 1 — Data Panels** (backend data → list/table views):
- Foreshadowing tracker panel
- Pattern detection dashboard
- Session analytics visualization
- Evaluation drill-down (per-evaluator detail)

**Wave 2 — Integration & Enhancement**:
- Character relationship view in CharacterTab
- Pattern → evaluator integration (DEF-M3-001)
- HybridSearch pattern dimension (DEF-M3-003)
- Evaluator weight customization (DEF-M3-006)

**Wave 3 — Polish & Tests**:
- Panel interaction polish (transitions, loading states, empty states)
- i18n for new panel labels
- Test coverage for new panels
- project.md Active requirements cleanup

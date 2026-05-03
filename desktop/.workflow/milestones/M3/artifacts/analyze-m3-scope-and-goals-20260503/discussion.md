# M3 Scope and Goals — Analysis Discussion

**Session ID**: ANL-m3-scope-and-goals-2026-05-03
**Topic**: M3 scope and goals
**Scope**: standalone (adhoc)
**Dimensions**: Architecture, Concept, Decision, External Research
**Perspectives**: Architectural (claude), Business (codex)
**Depth**: Deep Dive
**Started**: 2026-05-03

---

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Discussion Timeline](#discussion-timeline)
- [Intent Coverage](#intent-coverage)
- [Conclusions](#conclusions)

---

## User Intent

Explore the codebase to identify what M3 should cover — feature candidates, architecture evolution, deferred items from M2, and natural progression from the intelligence/extensibility foundation. Extract decisions into context.md for `/maestro-plan`.

---

## Current Understanding (Final)

M3 is a **wiring and exposure milestone** — the dominant pattern across the codebase is "backend fully built, zero endpoint/UI wiring." All 6 candidate features have substantial backend implementations (55–80% complete by code volume) but are completely disconnected from the user-facing API layer. M3's primary work is:
1. Wire backend modules to MCP endpoints
2. Build frontend UI components to consume new data shapes
3. Upgrade existing UI to expose richer backend capabilities

**Three-phase strategy**: Phase 1 (F1+F3+F7) establishes shared infrastructure → Phase 2 (F2+F5+F6) delivers high-value features → Phase 3 (F4) adds analytics.

**Go recommendation** with high confidence. Lower risk than M1/M2 since core logic is proven — only integration work remains.

---

## Discussion Timeline

### Round 1 — Codebase Exploration + Architecture Analysis (2026-05-03)

**Exploration Depth**: 3-layer (Breadth → Depth → Code Anchors)
**Files Examined**: 25+ files across narrative/, mcp/, graph/, analysis/, components/, api/
**Code Anchors**: 11 (see below)

#### Key Finding: "Backend Built, Not Wired" Pattern

Every M3 candidate follows the same pattern: a fully-implemented backend module with zero endpoint exposure and zero UI consumption. The codebase has no TODO/FIXME/HACK markers — modules are complete but isolated.

#### Feature Candidates (6 identified)

| # | Feature | Backend Module | Completion | Wiring Gap | Impact |
|---|---------|---------------|------------|------------|--------|
| F1 | Evaluator Expansion | CriticEngine + 5 dormant evaluators | 70% | Register evaluators, expose per-module scores | Critical — doubles evaluation depth |
| F2 | Foreshadowing Lifecycle | ForeshadowingManager (662 lines) | 75% | Wire plant/hint/harvest to endpoints + graph | High — key market differentiator |
| F3 | WritingStyle 8D Integration | WritingStyle.ts (340 lines) + style-system.js | 55% | Wire structured style to backend prompt | High — 8D system underutilized |
| F4 | Analysis Exposure | NarrativePatternDetector + WritingSessionCluster | 60% | Create endpoints, build analysis UI panel | Medium-High — unique analytics |
| F5 | Consistency Dashboard | Cross-chapter check wired | 70% | Upgrade UI from 3 flat scores to per-module | Medium — visibility upgrade |
| F6 | Character Depth UI | CharacterManager + CharacterDepthSystem | 80% | Create endpoints, build character profile UI | Medium — top user request |
| F7 | M2 Deferrals | ISS-066, HV-001, F-001 | 0% | Mandatory carry-over | Required |

#### Architecture Analysis

**Dependency Graph** (arrows = "depends on"):
```
F1 (Evaluator Expansion)
  ← independent, self-contained
  → feeds into F5 (richer consistency data)

F2 (Foreshadowing Lifecycle)
  ← depends on graph engine write ops (currently read-only for foreshadows)
  → feeds into F1 (foreshadow quality as evaluator input)

F3 (WritingStyle 8D)
  ← depends on backend prompt builder accepting structured style
  → independent, but enhances all LLM-driven features

F4 (Analysis Exposure)
  ← independent, self-contained
  → could feed into F1 (narrative patterns as evaluation dimension)

F5 (Consistency Dashboard)
  ← depends on F1 for per-module scores
  → independent UI work

F6 (Character Depth)
  ← depends on graph engine write ops
  → feeds into F2 (character-foreshadow links)
```

**Shared Infrastructure Needs**:
1. Graph engine write operations (needed by F2, F6) — currently only `getForeshadows()` is wired
2. Structured score transport layer (needed by F1, F5) — backend has per-module scores, frontend expects 3 flat scores
3. MCP endpoint pattern for narrative services (needed by all) — consistent registration pattern

**Coupling with M2 Systems**:
- **VectorSearch**: F6 (characters) and F2 (foreshadows) should integrate with embedding — `GraphManager.setVectorSearch()` already supports this
- **HybridSearch**: F4 (analysis) search results can leverage existing RRF fusion
- **L4/L5 Workflows**: F3 (style) affects brainstorm prompt quality; F1 (evaluators) enhances L4 artifact generation feedback
- **GraphManager**: Already supports entity CRUD + embedding; F2 and F6 need write-path additions

#### External Research Summary

- **Foreshadowing tracking**: Key differentiator — Crucible system (Sudowrite), Inkfluence Smart Continue are closest competitors, but neither offers lifecycle management (plant → hint → harvest)
- **Character profiling**: Top user request across AI writing communities (Reddit r/WritingWithAI, NaNoWriMo forums)
- **Per-module narrative evaluation**: No competing tool offers Pyramid/Subtext/FourSelves-style modular scoring — unique capability
- **Chinese novelist niche**: Underserved market; most AI writing tools target English fiction

#### Phasing Recommendation

**Phase 1: Foundation Wiring** (shared infrastructure)
- F1: Evaluator Expansion (register 5 dormant evaluators, expose per-module scores)
- F3: WritingStyle 8D backend wiring (structured style → prompt builder)
- F7: M2 deferrals (mandatory)

**Phase 2: Rich Exposure** (high-value features)
- F2: Foreshadowing Lifecycle (endpoints + graph write ops + UI)
- F5: Consistency Dashboard (upgrade UI with per-module scores)
- F6: Character Depth UI (endpoints + profile panel)

**Phase 3: Analytics** (stretch goals)
- F4: Analysis Exposure (narrative patterns + session clustering)

**Rationale**: Phase 1 establishes the shared infrastructure (structured scores, style transport) that Phase 2 features consume. Phase 3 features are independent and lower urgency.

---

## Conclusions

### Key Conclusions

1. **M3 is a wiring milestone** — backend modules are 55-80% complete, only integration work remains. Lower risk than M1/M2.
2. **Three-phase strategy optimally resolves dependencies** — Phase 1 (F1,F3,F7) → Phase 2 (F2,F5,F6) → Phase 3 (F4).
3. **Graph engine write operations** are the main new infrastructure investment (Phase 2).
4. **Structured score transport** bridges backend per-module scores and frontend 3-score UI.
5. **Foreshadowing lifecycle (F2) is the key market differentiator** — no competitor offers plant→hint→harvest.
6. **Backward compatibility is non-negotiable** — existing 3-score UI must continue working.

### Six-Dimension Scores

| Dimension | Score | Confidence |
|-----------|-------|------------|
| Feasibility | 4/5 | High |
| Impact | 5/5 | High |
| Risk | 4/5 (low risk) | High |
| Complexity | 3/5 | Medium |
| Dependencies | 3/5 | High |

### Go/No-Go

**GO** with high confidence. Proven backend modules need only integration wiring. Three-phase strategy isolates risk.

### Decision Summary

- **Locked**: 7 constraints (phase ordering, backward compat, no new deps, M2 deferrals, MCP pattern, graph validation, coding philosophy)
- **Free**: 7 areas for implementer discretion (UI designs, validation strategy, transport format, etc.)
- **Deferred**: 6 items postponed to post-M3 (pattern→evaluator integration, character-foreshadow linking, hybrid search, session analytics, Chinese-specific features, evaluator customization)

### Files Produced

- `context.md` — Locked/Free/Deferred decisions for plan
- `analysis.md` — 6-dimension scoring + risk matrix
- `conclusions.json` — Structured conclusions + implementation scope
- `discussion.md` — Full discussion timeline (this file)

---

## Intent Coverage

| Intent Item | Status | Evidence |
|-------------|--------|----------|
| Feature candidates identified | ✅ | 6 features + M2 deferrals |
| Architecture evolution mapped | ✅ | Dependency graph + shared infrastructure |
| Deferred items from M2 tracked | ✅ | ISS-066, HV-001, F-001 |
| Natural progression from M2 | ✅ | VectorSearch/GraphManager integration paths mapped |
| Decisions extracted for plan | ✅ | context.md with 7 Locked, 7 Free, 6 Deferred |

**Session Statistics**: 1 round, 25+ files examined, 11 code anchors, 9 recommendations, 3 implementation scope phases.

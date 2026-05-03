# M3 Scope and Goals — Six-Dimension Analysis

**Session**: ANL-m3-scope-and-goals-2026-05-03
**Date**: 2026-05-03
**Recommendation**: **Go** (Conditional — Phase 1 first)

---

## Executive Summary

M3 is a **wiring and exposure milestone** built on a proven foundation. All 6 candidate features have substantial backend implementations (55–80% complete) but zero endpoint/UI wiring. The dominant pattern — "backend built, not wired" — makes this milestone lower-risk than M1/M2. The primary work is integration: register endpoints, transport structured data, build UI components.

**Three-phase strategy** recommended: Foundation Wiring (F1, F3, F7) → Rich Exposure (F2, F5, F6) → Analytics (F4).

---

## Dimension Scores

| Dimension | Score | Confidence |
|-----------|-------|------------|
| Feasibility | 4/5 | High |
| Impact | 5/5 | High |
| Risk | 4/5 | High |
| Complexity | 3/5 | Medium |
| Dependencies | 3/5 | High |
| Alternatives | — | See comparison |

### Feasibility: 4/5

Backend modules are 55–80% complete by code volume. Core logic is proven through unit tests and internal APIs. Only integration work remains:

- **F1 (Evaluator Expansion)**: Register 5 dormant evaluators — straightforward registration pattern (`critic-engine.js:91-97`). Each evaluator is a self-contained class.
- **F3 (WritingStyle 8D)**: Replace flat-string transport with structured style object. `WritingStyle.ts:247` already builds the structured data; `writing.js:15-30` needs to consume it.
- **F2 (Foreshadowing)**: Largest wiring effort — needs graph engine write ops (new) + MCP endpoints + UI. 662-line manager is fully functional internally.
- **F6 (Character Depth)**: Similar to F2 — needs endpoints + UI. `CharacterManager` has 8 personality types, 5-dimension scoring, all built.

**Deduction**: Graph engine write operations (needed by F2, F6) are currently read-only. This is new shared infrastructure that requires careful implementation.

**Evidence**: `critic-engine.js` (5 dormant evaluators), `foreshadowing.js` (662 lines, zero endpoints), `character-manager.js` (full system, no UI), `WritingStyle.ts` (340 lines, flat-string output).

### Impact: 5/5

Every feature delivers direct user-visible value:

- **F1**: Doubles evaluation depth from 3 flat scores to 8+ per-module scores. Unique capability — no competing AI writing tool offers modular narrative scoring (Pyramid/Subtext/FourSelves).
- **F2**: Key market differentiator — lifecycle foreshadowing management (plant → hint → harvest). No competitor offers this.
- **F3**: Unleashes the 8D style system currently underutilized. Enhances all LLM-driven features through richer style prompts.
- **F6**: Top user request across AI writing communities (Reddit r/WritingWithAI, NaNoWriMo forums).
- **F4**: Unique analytics capability (narrative pattern detection + writing session clustering).

**Evidence**: External research confirms foreshadowing tracking and character profiling as top requests. Per-module narrative evaluation is a unique capability.

### Risk: 4/5 (higher = lower risk)

Low overall risk profile:

- **Regression risk: Low** — all features are additive (new endpoints, new UI components). No existing functionality is being modified.
- **Security risk: Minimal** — no new auth, no external API calls, no user input handling beyond existing patterns.
- **Scalability risk: Low** — backend modules already handle their workloads. Wiring adds minimal overhead.
- **Main risk**: Graph engine write ops (F2, F6) touch shared infrastructure (`graph-engine.js`). Incorrect write operations could corrupt the knowledge graph.

**Mitigation**: Phase ordering — F1 and F3 (no graph writes) ship first in Phase 1, establishing the MCP endpoint pattern. Graph write infrastructure is built and tested in Phase 2 before F2/F6 use it.

**Evidence**: `graph-engine.js:932-956` (only read ops wired), `EvaluationPanel.tsx:62-77` (3-score UI to be extended, not replaced).

### Complexity: 3/5

Moderate complexity driven by integration breadth:

- **7 features across 3 phases** — but each follows the same pattern: backend module → MCP endpoint → API function → UI component.
- **Graph engine write operations** — new shared infrastructure. Must handle concurrent access, validation, and consistency with existing read operations.
- **Structured score transport** — backend has per-module scores, frontend expects 3 flat scores. Need a new transport layer that serves both.
- **UI work** — standard React/Zustand/TailwindCSS patterns. No new libraries or paradigms.

**Evidence**: Existing MCP endpoint pattern (`graph.js`, `critic.js`) provides clear template. Frontend API layer (`src/api/`) has established conventions.

### Dependencies: 3/5

Moderate internal dependencies, resolved by phase ordering:

- F5 (Consistency Dashboard) depends on F1 (Evaluator Expansion) for per-module scores.
- F2 (Foreshadowing) and F6 (Character Depth) depend on graph engine write ops.
- F2 feeds into F1 (foreshadow quality as evaluator input) — soft dependency.
- F3 (WritingStyle) is fully independent — can ship anytime.
- F4 (Analysis) is fully independent — lowest priority.

**Shared infrastructure needs**:
1. Graph engine write operations (F2, F6)
2. Structured score transport layer (F1, F5)
3. MCP endpoint registration pattern (all features)

**Evidence**: Dependency graph in discussion.md Round 1. `GraphManager.setVectorSearch()` already supports embedding integration for F2, F6.

### Alternatives Comparison

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A: 3-Phase Wiring** (recommended) | Ordered dependency resolution, early value delivery, risk isolation | Longer total timeline, Phase 2 waits on Phase 1 | **Recommended** — balances risk and speed |
| **B: Big-Bang Release** | Single integration event, all features ship together | High risk, complex testing, delayed value | Rejected — contradicts incremental philosophy |
| **C: Feature-by-Feature** | Maximum flexibility, can reorder anytime | No shared infrastructure investment, repeated patterns, no dependency management | Rejected — 7 sequential cycles is wasteful |

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Graph write ops corrupt knowledge graph | Low | High | Phase 2 only, add validation + backup before writes |
| Structured score transport breaks existing 3-score UI | Low | Medium | Backward-compatible transport, keep flat scores as fallback |
| Frontend scope creep (UI panels too complex) | Medium | Low | Follow existing component patterns, no new libraries |
| M2 deferred items delay Phase 1 | Low | Medium | F7 items are small (1-line fix, edge case, manual test) |
| Per-module scores overwhelm users | Medium | Low | Progressive disclosure — summary view + expand for details |

---

## Go/No-Go Recommendation

**GO** with confidence **High**.

M3 is structurally sound: proven backend modules need only integration wiring. The three-phase strategy isolates risk (graph writes in Phase 2 only) while delivering early value (F1, F3 in Phase 1). M2's infrastructure (VectorSearch, HybridSearch, GraphManager) provides ready integration points.

**Condition**: Execute Phase 1 first to establish the MCP endpoint + structured transport patterns before attempting graph writes.

# Project Architecture

**Generated:** 2026-02-24
**Based on:** `.aha-loop/project.vision-analysis.md`
**Status:** Final

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| Runtime Language | Python | 3.11+ | Existing codebase baseline, async ecosystem maturity, strong tooling |
| Backend Framework | FastAPI | 0.128.6 | Stable and soaked release; keeps Starlette-native async stack |
| ASGI Server | Uvicorn | 0.40.0 | Soaked stable release, production-proven with FastAPI |
| Data Validation | Pydantic | 2.12.5 | Current stable line, typed contracts for workflow/state schemas |
| CLI Framework | Click | 8.3.1 | Existing CLI contract compatibility and broad adoption |
| Rich Terminal UX | Rich | 14.3.2 | Stable terminal rendering for workflow feedback |
| Workflow Engine | LangGraph | 1.0.8 | Deterministic graph orchestration for stage transitions |
| LLM Orchestration SDK | LangChain | 1.2.9 | Existing integration surface; adapter-friendly provider swapping |

### Local Data & Retrieval Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| Relational State Store | SQLite | 3.x (embedded) | Local-first, diff-friendly workflow artifacts, zero external dependency |
| Async SQLite Driver | aiosqlite | 0.22.1 | Non-blocking local storage access |
| Embedding Runtime | fastembed | 0.7.4 | Offline-capable embeddings for retrieval |
| Vector Extension | sqlite-vec | 0.1.6 | Lightweight local vector search in SQLite |
| Token Accounting | tiktoken | 0.12.0 | Deterministic context budget governance |

### Optional Desktop/UI Layer

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| Desktop Shell | Tauri | 2.10.2 | Lightweight local desktop runtime |
| Web UI Framework | React | 19.2.4 | Mature component model and ecosystem |
| Build Tool | Vite | 7.3.1 | Fast local dev/build workflow |
| Type System | TypeScript | 5.9.3 | Static contracts across desktop UI modules |
| UI Test Runner | Vitest | 4.0.18 | Fast test loop for frontend |
| Utility CSS | Tailwind CSS | 4.2.1 | Consistent UI tokens and rapid iteration |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| pytest | 9.0.2 | Unit/integration test execution |
| pytest-asyncio | 1.3.0 | Async test support |
| coverage | 7.13.4 | Coverage and release evidence |
| mcp (python package) | 1.26.0 | MCP protocol service hosting |

### Version Selection Notes

- Registry checks were run on 2026-02-24 against PyPI, npm, and crates.io.
- Default policy: prefer latest stable, but apply a short soak window for core runtime dependencies to reduce release-day regression risk.
- Pinned to soaked stable for critical runtime packages currently released very recently: FastAPI, Uvicorn, LangGraph, LangChain.

---

## Architecture Decisions

### ADR-001: Layered Local-First Architecture

**Date:** 2026-02-24
**Status:** Accepted

**Context:**
The vision requires command-first, auditable, local execution with optional cloud/model integrations.

**Decision:**
Use a layered architecture with strict boundaries:
1. Interface layer (CLI + optional Desktop)
2. Application layer (workflow orchestration)
3. Domain layer (story/workflow/quality logic)
4. Infrastructure layer (memory, retrieval, storage, gateway)

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Monolithic mixed modules | Fast initial coding | Boundary erosion, hard to audit and test |
| Service-per-capability microservices | Strong isolation | Too heavy for local-first workflow |
| Layered modular monolith | Clear boundaries + local simplicity | Requires discipline in module contracts |

**Rationale:**
Layered modular monolith best matches local-first operation and auditability while preserving extension points.

**Consequences:**
- Easier to enforce deterministic stage transitions.
- Requires explicit DTO/schema contracts between layers.

---

### ADR-002: Workflow-Graph as Control Plane

**Date:** 2026-02-24
**Status:** Accepted

**Context:**
The system needs repeatable revision loops, checkpointing, and release gates with no silent data loss.

**Decision:**
Use graph-driven orchestration (LangGraph + typed workflow state) as the control plane for all major flows.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Ad-hoc imperative flows | Simple for small scripts | Non-deterministic and hard to verify |
| BPMN/workflow server | Rich orchestration features | High operational overhead |
| LangGraph state machine | Deterministic transitions, Python-native | Additional state-schema discipline needed |

**Rationale:**
Current code already models levels, adapters, and state transitions; graph orchestration preserves and strengthens this direction.

**Consequences:**
- Workflow level routing remains explicit and testable.
- Graph/state versioning becomes a core compatibility concern.

---

### ADR-003: Text-Artifact Source of Truth

**Date:** 2026-02-24
**Status:** Accepted

**Context:**
Vision mandates repository-auditable outputs and no opaque binary-only process state.

**Decision:**
Treat Markdown/JSON artifacts in project/workflow directories as source of truth; database indexes are derived/accelerator state.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| DB-first truth | Fast querying | Auditability and merge transparency reduced |
| Hybrid with text truth + derived DB | Auditable + performant | Requires synchronization rules |
| Binary-only snapshots | Compact | Violates diffability requirement |

**Rationale:**
Hybrid with text truth keeps local audit and allows performant retrieval layers.

**Consequences:**
- Must define deterministic rebuild paths for index/derived data.
- Release checks must validate text-to-index consistency.

---

### ADR-004: Adapter-Based Optional Integrations

**Date:** 2026-02-24
**Status:** Accepted

**Context:**
External AI/model providers are optional and must not break core local workflows.

**Decision:**
Keep adapter boundaries for domain/workflow integrations and provider clients; default to local-capable baseline behavior.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Hard-couple one provider | Simpler implementation | Vendor lock-in, fragile availability |
| Adapter abstraction | Replaceable providers | Slightly more abstraction cost |

**Rationale:**
Matches local-first + replaceable integration requirement.

**Consequences:**
- Provider failures degrade gracefully without losing artifact integrity.
- Adapter contract tests are mandatory.

---

### ADR-005: Novel Profile and Scoped Reference Library

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
Different novels require different reference corpora, including era/history constraints and domain-specific background materials.

**Decision:**
Introduce a `NovelProfile` contract as first-class workflow input. Each profile binds `project_id`, `genre_tags`, and a scoped reference-library manifest (sources, trust level, update policy), and drives retrieval filtering and evidence attribution.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Global shared reference pool | Simple setup | Cross-project contamination, weak auditability |
| Per-project scoped library | Strong isolation and provenance | Requires profile lifecycle management |

**Rationale:**
Project-scoped references match local-first audit requirements and reduce cross-novel leakage.

**Consequences:**
- Retrieval pipeline must accept profile-scope filters.
- Evidence artifacts must record profile + source attribution.

---

### ADR-006: Genre-Adaptive Rubrics and Gate Policy

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
Genre-specific quality expectations differ significantly (e.g., suspense clue integrity vs historical etiquette/clothing correctness).

**Decision:**
Add genre-adaptive rubric packs with per-profile gate policy (`hard_gate` / `warn_only`). Start with canonical taxonomy: suspense, modern romance, ancient romance, fantasy/xuanhuan, sci-fi future, wuxia/xianxia, alternate history, urban realism.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Single universal rubric | Easy implementation | Poor genre fit, low trust |
| Genre-adaptive rubrics | Better quality alignment | More rule management overhead |

**Rationale:**
Adaptive rubrics improve signal quality while preserving deterministic release gates.

**Consequences:**
- Quality pipeline must load rubric by profile genre tags.
- Release gate must support policy toggle per rubric group.

---

### ADR-007: Historical Detail Scorecard and Release Gate

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
Historical and alternate-history narratives need enforceable factual-style checks (ritual, clothing, institution, chronology consistency).

**Decision:**
Define `history_detail_scorecard` dimensions and integrate optional hard gate thresholds into release checks for applicable profile types.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Manual reviewer-only history checks | Flexible | Non-deterministic and hard to scale |
| Automated scorecard + gate | Repeatable and auditable | Requires dimension calibration |

**Rationale:**
Deterministic scorecards align with existing evidence-first and gate-based architecture.

**Consequences:**
- Need calibration dataset and threshold governance.
- Evidence artifacts must include per-dimension history scores and blocking reasons.

---

### ADR-008: Release Readiness as First-Class Control Gate

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
The existing system already relies on deterministic release checks and machine-readable GO/NO_GO decisions. This behavior must be preserved as a planning-level invariant instead of being treated as an implementation detail.

**Decision:**
Treat release readiness checks (`baseline tests/coverage`, `desktop check`, `gate blocker semantics`) as first-class control gates, with explicit artifact outputs and blocking semantics.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Ad-hoc pre-release scripts | Flexible per run | Easy to drift; weak auditability |
| First-class release gate contract | Deterministic and auditable | Requires continuous contract maintenance |

**Rationale:**
Preserves the old solution’s strongest operational guarantee and aligns with evidence-first release governance.

**Consequences:**
- Release scripts and artifacts become part of architecture-level compatibility commitments.
- Roadmap must include contract tests for blocker semantics.

---

### ADR-009: API Contract Compatibility Guardrail for MCP Gateway

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
The old solution exposes stable gateway contracts for chat/stream/health/tools/models. Regressions in helper functions or response shape can break desktop and automation consumers.

**Decision:**
Enforce gateway compatibility through explicit backward-compatibility tests and keep compatibility-critical helpers/fields under contract protection.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Allow fast endpoint iteration without contracts | Faster local changes | Breakage risk for downstream callers |
| Contract-first compatibility guard | Stable integrations | More tests and stricter change discipline |

**Rationale:**
Protects mixed CLI/UI and automation integrations while allowing iterative internal refactors.

**Consequences:**
- Gateway endpoint tests become release-facing quality gates.
- Contract changes require versioned migration notes.

---

### ADR-010: Optional Desktop Quality Parity

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
Desktop is optional, but when enabled it must not silently degrade relative to CLI behavior.

**Decision:**
Keep desktop quality checks (`typecheck` + `build`) as part of release-facing validation whenever desktop artifacts are in scope.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Treat desktop as best-effort | Lower maintenance | Divergence and broken optional path |
| Enforce parity checks | Predictable optional UI behavior | Additional CI/runtime cost |

**Rationale:**
Retains confidence that optional UI remains a valid path without violating CLI-first architecture.

**Consequences:**
- Desktop failures can legitimately block release when desktop deliverables are included.
- Route semantics between CLI and desktop-gateway remain testable.

---

### ADR-011: Quality-First Mode Orchestration and Manual Auto-Write Enablement

**Date:** 2026-02-27
**Status:** Accepted

**Context:**
The product supports multiple writing modes (manual, hybrid, full-auto), but author control and quality reliability must remain invariant. Auto-writing should never start implicitly, and quality policy must remain anchored to `docs/quality/*`.

**Decision:**
Use explicit mode orchestration with these constraints:
1. Full-auto writing is opt-in and requires an explicit manual enable action.
2. Manual, hybrid, and full-auto modes all route through the same quality-gate contract.
3. `docs/quality/*` defines a core acceptance baseline; heuristic prechecks may assist but cannot override final acceptance.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Default-on auto mode | Faster initial generation | Loss of author control and accidental quality drift |
| Mode-specific quality thresholds | Flexible per mode | Inconsistent release confidence |
| Manual-enable + quality-first unified gate | Predictable behavior and auditability | Slightly more orchestration complexity |

**Rationale:**
This keeps creative control explicit while preserving deterministic quality across execution modes.

**Consequences:**
- Mode transitions must be recorded in evidence artifacts for traceability.
- Final release acceptance remains governed by `docs/quality/*` thresholds.

---

## System Design

### High-Level Architecture

```text
+----------------------+        +-------------------------+
| Interface Layer      |        | Optional UI Layer       |
| - CLI (Click)        |<------>| - Desktop (Tauri+React) |
| - Scripts/commands   |        +-------------------------+
+----------+-----------+
           |
           v
+----------------------+        +-------------------------+
| Workflow Control     |<------>| MCP Gateway             |
| - Graph Factory      |        | - /memory /search ...   |
| - Levels L1-L5       |        | - Runtime health/metrics|
| - Revision Loop      |        +-------------------------+
+----------+-----------+
           |
           v
+----------------------+        +-------------------------+
| Domain Services      |<------>| Retrieval & Memory      |
| - Critic/Quality     |        | - Unified Memory Engine |
| - Novel/Code adapters|        | - Iterative Retriever   |
| - State thresholds   |        | - Graph + Vector search |
+----------+-----------+        +-------------------------+
           |
           v
+----------------------------------------------------------+
| Local Persistence & Artifacts                            |
| - .workflow/.aha-loop Markdown/JSON evidence             |
| - SQLite (+ sqlite-vec) derived index/state              |
| - Git history as audit backbone                           |
+----------------------------------------------------------+
```

### Component Overview

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| CLI Entry | Command routing and runtime commands | `src/cli/main.py` |
| Workflow Factory | Domain adapter selection and graph creation | `src/workflow/graph_factory.py` |
| Workflow State | Quality thresholds and typed workflow contract | `src/workflow/state.py` |
| Revision Loop | Iterative writer/critic refinement | `src/workflow/revision_loop.py` |
| MCP Gateway | Unified service entry, health, metrics | `src/mcp/gateway.py` |
| Memory Engine | Layered/dimensional memory + conflict handling | `src/memory/unified_memory.py` |
| Iterative Retrieval | Hybrid retrieval + rerank/budget governance | `src/search/iterative_retriever.py` |

### Data Flow (Idea to Publishable Chapter)

1. Author triggers workflow via CLI (or desktop calling gateway APIs).
2. Workflow factory selects domain adapter and level (L1-L5), initializes typed state.
3. Retrieval layer assembles context from memory/graph/files under profile and budget limits.
4. Writer stage generates draft; critic stage scores and returns actionable revision instructions.
5. Revision loop repeats until pass/human-review threshold logic is met.
6. Checkpoints, quality evidence, and consistency results are persisted as Markdown/JSON artifacts.
7. Release gate validates score, consistency critical count, and evidence completeness.

---

## Directory Structure (Target)

```text
niko-studio/
├── src/
│   ├── cli/                   # command-first interfaces
│   ├── workflow/              # graph factory, levels, state, revision loop
│   ├── agents/                # architect/writer/critic and collaborators
│   ├── memory/                # unified memory, caching, conflict resolution
│   ├── search/                # iterative retrieval and ranking
│   ├── graph/                 # knowledge graph services
│   ├── mcp/                   # gateway and mcp endpoints
│   └── services/              # indexing, memory, utility services
├── .workflow/                 # evidence, plans, execution artifacts
├── .aha-loop/                 # vision/research/architecture workflow assets
├── desktop/                   # optional desktop shell and ui
├── tests/                     # unit/integration/e2e checks
└── docs/                      # PDD, quality criteria, operations docs
```

---

## Key Patterns

### Error Handling

- Boundary-first validation: validate external input at CLI/API boundaries.
- Domain-internal trust: avoid excessive defensive branching inside controlled workflow steps.
- Explicit failure states in workflow state rather than hidden exception swallowing.

### Configuration

- Central config access via `src/config.py` and explicit env overrides for runtime/deploy mode.
- Production guardrails (reload/CORS/metrics behavior) enforced at gateway startup path.

### Logging & Observability

- Structured runtime metrics at gateway (`requests_total`, failures, latency stats).
- Stage-level retrieval traces (`collect/rerank/trim`) captured for quality diagnostics.
- Evidence artifacts persisted per run for KPI and release-gate auditing.

### Testing Strategy

| Test Type | Tool | Coverage Target |
|-----------|------|-----------------|
| Unit | pytest | Core modules and decision logic |
| Integration | pytest + async fixtures | Gateway/workflow/memory/search interactions |
| Frontend (optional) | vitest | Desktop critical flows |
| Release Checks | `scripts/release_check_summary.py` | Gate and evidence consistency |

---

## Security Considerations

- Local-first default reduces external data exposure.
- No silent overwrite policy: checkpointed revisions and explicit transitions only.
- MCP gateway enforces environment-specific runtime guards (production-safe defaults).
- Preserve audit chain via immutable git history + timestamped evidence artifacts.

---

## Performance Considerations

- Primary KPI: chapter cycle-time reduction >= 30% at comparable quality.
- Retrieval profiles tune budget/quotas by workflow level to control latency and token cost.
- Use derived indexes (sqlite-vec/graph) to accelerate retrieval while keeping text artifacts canonical.

---

## Deployment Strategy

### Baseline Mode (Primary)

- Local repository execution.
- CLI-driven workflow + optional local MCP gateway.
- No mandatory cloud dependency.

### Optional Extended Mode

- Desktop shell (Tauri+React) consumes local gateway endpoints.
- External model providers enabled through adapters only.

### Rollback

- Revert by git commit history.
- Rebuild derived indexes from canonical text artifacts when needed.

---

## Next Steps

1. Freeze schema contracts for quality evidence and consistency-check outputs.
2. Add compatibility tests for adapter contracts and workflow-state evolution.
3. Define KPI measurement spec for cycle-time baseline and comparable-quality scoring.
4. Enforce deterministic release-gate checks against zero Critical consistency issues.

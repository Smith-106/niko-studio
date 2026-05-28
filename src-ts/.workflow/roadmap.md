# Collaboration Improvements Roadmap

> Source: ANL-20260528-COLLAB (37 gaps across 5 domains)
> scope_verdict: large

## Milestone 1: Quick Wins — Wire What Exists (Phase 1)

**Goal**: Connect already-built but unwired infrastructure. Low complexity, high impact.

| ID | Gap | Domain | Impact | Complexity | Target |
|----|-----|--------|--------|------------|--------|
| Q1 | Wire PhaseOrchestrator quality gates into workflow execution | workflow | HIGH | LOW | `services/phase-orchestrator.ts` + `gateway/` |
| Q2 | Register LLM providers in DI container | collaboration | HIGH | LOW | `container/adapters.ts` + `container/bindings.ts` |
| Q3 | Wire WebSocket relay (browser notification bus) | collaboration | MEDIUM | LOW | `services/websocket-relay.ts` + `gateway/` |
| Q4 | Wire DistillationNowledgeBridge (Knowledge → Obsidian distillation) | collaboration | MEDIUM | LOW | `services/nowledge-bridge.ts` |
| Q5 | Wire ConflictNowledgeBridge (Obsidian → Knowledge conflict detection) | collaboration | MEDIUM | LOW | `services/nowledge-bridge.ts` |
| Q6 | Add delegate broker persistence (job state survives restart) | workflow | HIGH | LOW | `services/delegate-broker.ts` |
| Q7 | Add LLM token budget check before request dispatch | collaboration | MEDIUM | LOW | `services/llm-service.ts` |
| Q8 | Unify three independent FileSync paths into single adapter chain | collaboration | MEDIUM | LOW | `services/file-sync-*.ts` + `container/` |

**Definition of Done**: 8 gaps implemented + all 3005+ tests green + no regression + backward compatible

---

## Milestone 2: Architecture Completion — Build Missing Bridges (Phase 2)

**Goal**: Construct architecturally significant missing pieces: event bus, unified search pipeline, delegate sub-plan dispatch.

| ID | Gap | Domain | Impact | Complexity | Target |
|----|-----|--------|--------|------------|--------|
| A1 | Cross-service EventBus (typed pub/sub for service coordination) | collaboration | HIGH | MEDIUM | New `services/event-bus.ts` + `container/types.ts` |
| A2 | Unified search pipeline (merge Knowledge + Obsidian + external search results) | collaboration | HIGH | MEDIUM | `services/search-service.ts` + `gateway/` |
| A3 | Delegate broker sub-plan dispatch (decompose task → parallel sub-tasks) | workflow | HIGH | MEDIUM | `services/delegate-broker.ts` |
| A4 | MCP Gateway request routing + provider fallback chain | external | HIGH | MEDIUM | `gateway/mcp-gateway.ts` |
| A5 | LLM service circuit breaker + cross-provider fallback | collaboration | HIGH | MEDIUM | `services/llm-service.ts` |
| A6 | Artifact passing between workflow stages (plan → execute → verify) | workflow | MEDIUM | MEDIUM | `.workflow/scratch/` + `services/` |
| A7 | Nowledge Mem P1 bridge (Knowledge ↔ Graph bidirectional sync) | collaboration | MEDIUM | MEDIUM | `services/nowledge-bridge.ts` + `services/graph-engine.ts` |
| A8 | SearchService hybrid strategy config (local → semantic → external fallback) | external | MEDIUM | MEDIUM | `services/search-service.ts` |

**Definition of Done**: 8 gaps implemented + all tests green + event bus typed + search pipeline unified + circuit breaker operational

---

## Milestone 3: Advanced Collaboration — Full-Stack Integration (Phase 3)

**Goal**: Complete the collaboration stack with advanced patterns: parallel execution, cross-provider resilience, quality gate feedback loops.

| ID | Gap | Domain | Impact | Complexity | Target |
|----|-----|--------|--------|------------|--------|
| C1 | Delegate parallel execution with result aggregation | workflow | HIGH | HIGH | `services/delegate-broker.ts` |
| C2 | LLM cross-provider automatic fallback chain | collaboration | HIGH | HIGH | `services/llm-service.ts` + `container/` |
| C3 | Quality gate feedback loop (verify → plan gap → re-execute) | workflow | HIGH | HIGH | `services/phase-orchestrator.ts` + workflow chain |
| C4 | Obsidian ↔ Knowledge bidirectional real-time sync | collaboration | MEDIUM | HIGH | `services/obsidian-service.ts` + `services/nowledge-bridge.ts` |
| C5 | Graph ↔ Wiki link resolution bridge | collaboration | MEDIUM | HIGH | `services/graph-engine.ts` + `services/search-service.ts` |
| C6 | MCP Gateway service discovery + health monitoring | external | MEDIUM | HIGH | `gateway/mcp-gateway.ts` |
| C7 | Workflow engine parallel wave execution | workflow | MEDIUM | HIGH | `services/delegate-broker.ts` + `services/phase-orchestrator.ts` |
| C8 | Search result relevance scoring + cache invalidation | external | MEDIUM | HIGH | `services/search-service.ts` |
| C9 | Event bus replay + dead-letter queue | collaboration | LOW | HIGH | `services/event-bus.ts` |
| C10 | Full-stack integration test suite | workflow | HIGH | MEDIUM | `tests/` |

**Definition of Done**: 10 gaps implemented + all tests green + parallel execution verified + cross-provider fallback operational + integration test coverage ≥ 80%

---

## Dependency Graph

```
Phase 1 (Quick Wins)
  ├── Q1 quality gates ──────────→ C3 feedback loop (Phase 3)
  ├── Q2 LLM providers ──────────→ A5 circuit breaker (Phase 2) → C2 fallback chain (Phase 3)
  ├── Q6 delegate persistence ───→ A3 sub-plan dispatch (Phase 2) → C1 parallel exec (Phase 3)
  ├── Q8 unified FileSync ───────→ A1 event bus (Phase 2) → C9 replay (Phase 3)
  └── Q4/Q5 Nowledge bridges ───→ A7 Nowledge Mem P1 (Phase 2) → C4 real-time sync (Phase 3)

Phase 2 (Architecture Completion)
  ├── A1 event bus ──────────────→ C9 replay (Phase 3)
  ├── A2 unified search ─────────→ C8 relevance scoring (Phase 3)
  ├── A3 sub-plan dispatch ──────→ C1 parallel exec (Phase 3)
  ├── A4 MCP routing ────────────→ C6 service discovery (Phase 3)
  └── A5 circuit breaker ────────→ C2 fallback chain (Phase 3)

Phase 3 (Advanced Collaboration)
  └── C10 integration tests (validates all prior phases)
```

## Scope Constraints

- **Out of scope**: Frontend UI changes, Nowledge Mem P2+ features, Obsidian Plugin development
- **Constraints**: 3005+ existing tests must remain green, backward compatible, no public API breakage

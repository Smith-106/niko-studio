# Analysis Report -- noop

## Executive Summary

- Overall assessment: `Conditional`
- Confidence: `high`
- Current head: `1e75baf01c589a3306fb1f52f6a942c47d82cd66`
- Scope: disabled integration adapters and their historical cleanup narrative

The current head does not have a runtime bug around `noop` adapters. It has a decision-record drift problem. `src-ts/integrations/adapters.ts` and its tests show that disabled integrations are intentionally represented by explicit Noop adapters with deterministic local-first fallback behavior. `src-ts/graph/graph-engine.ts` still depends on the graph projection adapter boundary. The main inconsistency is historical documentation: `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md` still preserves an earlier default-removal strategy, while `docs/PRODUCTION_READINESS_TODO.md` and completed issue `ISS-20260428-006` reflect the shipped retained-interface strategy.

## Dimension Scores

| Dimension | Score | Key Evidence |
|-----------|-------|-------------|
| Feasibility | 91 | Runtime contract already implemented; remaining work is mainly decision and documentation alignment. |
| Impact | 62 | Clarification prevents future cleanup churn and keeps readiness narratives aligned with actual runtime truth. |
| Risk | 57 | Risk is concentrated in reopening blanket noop removal before call sites and types are refactored. |
| Complexity | 38 | Docs alignment is small; true adapter removal would be a separate coordinated refactor. |
| Alignment | 96 | Disabled integrations are honestly surfaced through support levels and local-first fallback behavior. |
| Maintainability | 76 | Code and tests are coherent, but historical planning language still points toward a competing strategy. |

## Verified Current-Head Evidence

### Code and runtime contract

- `src-ts/integrations/adapters.ts:97-144`
  - `INTEGRATION_POLICY` classifies `neo4j-projection`, `dbhub-governance`, and `langflow-orchestration` as `disabled`.
- `src-ts/integrations/adapters.ts:383-448`
  - `NoopGraphProjectionAdapter` returns `false`.
  - `NoopGovernanceHookAdapter` returns `false`.
  - `NoopOrchestrationHookAdapter` returns a structured disabled status object.
- `src-ts/integrations/adapters.ts:619-642`
  - `createIntegrationAdapters()` still instantiates explicit Noop adapters for disabled integrations.

### Caller dependency

- `src-ts/graph/graph-engine.ts:1312-1327`
  - Neo4j projection calls are guarded by `flags.neo4jEnabled`.
  - The caller still depends on a `graphProjection` adapter surface existing.
  - The local-first path is preserved on failures.

### Tests and prior issue closure

- `src-ts/tests/integrations/adapters.test.ts:43-134`
  - Default adapter factory path returns local-first Noop adapters and disabled capability metadata.
- `src-ts/tests/graph/graph-engine.test.ts:435-484`
  - Disabled Neo4j support is still represented through the adapter bundle and can be toggled in harnessed tests.
- `.workflow/issues/issues.jsonl`
  - `ISS-20260428-006` is already completed and documents the adapter classification and explicit disabled signaling as implemented truth.

### Documentation drift

- `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md:386-434`
  - Early Stage 5 wording still says the default strategy is to remove noop adapters.
- `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md:727-747`
  - The same document later records the shipped outcome: `graph-engine.ts` still depends on the projection adapter and the actual completion was removing production throws and unifying behavior.
- `docs/PRODUCTION_READINESS_TODO.md:122-124`
  - Current readiness notes align with the shipped code: retain Noop adapter interfaces, remove false support paths, and keep disabled integrations non-throwing.

## Risk Matrix

| Risk | Probability | Impact | Notes |
|------|-------------|--------|-------|
| Reopening blanket noop-adapter removal before caller refactors | Medium | High | Would misclassify a real boundary as dead cleanup and could break local-first fallback expectations. |
| Leaving historical plan wording unresolved | High | Medium | Future contributors may chase the wrong cleanup objective even though the runtime contract is already settled. |
| Reintroducing production-only throws for disabled integrations | Low | Medium | Would conflict with the current support-level signaling and test contract. |

## Recommendations

1. Reconcile the Stage 5 plan wording in `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md` so it matches the retained-interface strategy already documented in `docs/PRODUCTION_READINESS_TODO.md`.
2. Keep the current regression coverage that asserts disabled integrations return `false`, empty collections, or disabled status objects rather than pretending support.
3. If future work genuinely wants to remove disabled adapter classes, scope it as a fresh refactor that begins with caller inventory, bundle typing changes, and test rewrites instead of treating it as leftover cleanup.

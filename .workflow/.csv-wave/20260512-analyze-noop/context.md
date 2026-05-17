# Context: noop

**Date**: 2026-05-12
**Mode**: full
**Requested skill call**: `$maestro-analyze "noop"`
**Areas discussed**: disabled integration adapters, runtime guards, support-level policy, test coverage, historical documentation drift

## Executive Summary

Current head already has a coherent runtime contract around `noop` adapters. The remaining gap is not missing implementation, but decision drift: historical execution-plan wording still says the default strategy is to remove noop adapters, while current code, tests, issue history, and production-readiness notes intentionally keep explicit disabled-adapter interfaces because some runtime callers still depend on those boundaries.

## Decisions

### Decision 1: Keep disabled adapters as explicit runtime boundaries
- **Context**: `src-ts/integrations/adapters.ts` classifies Neo4j projection, DBHub governance, and Langflow orchestration as `disabled`, and the factory still instantiates explicit Noop adapters for those integrations.
- **Options**:
  1. Keep the explicit Noop adapter interfaces.
  2. Remove the classes as generic cleanup.
- **Chosen**: Keep the explicit Noop adapter interfaces.
- **Reason**: Current runtime and tests rely on deterministic disabled behavior, and `graph-engine.ts` still depends on the graph projection boundary existing.

### Decision 2: The disabled contract is non-throwing and local-first
- **Context**: The disabled adapters return `false`, empty collections, or a structured disabled status object rather than throwing only in production.
- **Options**:
  1. Preserve the current non-throwing fallback behavior.
  2. Reintroduce production-only throws to make disabled integrations louder.
- **Chosen**: Preserve the current non-throwing fallback behavior.
- **Reason**: The repository has already standardized on explicit support-level signaling plus local-first fallback, and tests cover this contract directly.

### Decision 3: Historical Stage 5 wording must be reconciled with the shipped contract
- **Context**: `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md` still contains early wording that says the default strategy is to remove noop adapters, but `docs/PRODUCTION_READINESS_TODO.md` documents the shipped retained-interface outcome and explains why the classes were not deleted.
- **Options**:
  1. Leave the historical wording untouched.
  2. Reconcile the plan wording to the current retained-interface strategy.
- **Chosen**: Reconcile the plan wording to the current retained-interface strategy.
- **Reason**: Leaving both narratives in place invites future churn and can mis-scope follow-up work.

### Decision 4: Any future class-removal work is a separate refactor, not cleanup residue
- **Context**: Removing the noop classes would require coordinated changes to callers, adapter bundle typing, tests, and any documentation that currently treats disabled integrations as explicit boundaries.
- **Options**:
  1. Keep class removal as a future refactor only after callers and types are simplified away.
  2. Treat class removal as immediate low-risk cleanup.
- **Chosen**: Keep class removal as a future refactor only after callers and types are simplified away.
- **Reason**: The current codebase does not support calling that work trivial.

## Constraints

### Locked
- Keep `disabled` integrations surfaced through `support_level`, capability resolution, and deterministic fallback behavior.
- Do not reopen blanket noop-adapter deletion while runtime callers such as `graph-engine.ts` still depend on the adapter boundary.
- Preserve the current test contract that disabled integrations return `false`, empty collections, or disabled status objects instead of pretending support.

### Free
- The documentation can describe the retained-interface strategy in different wording, as long as it no longer implies that class removal is the current default.
- Future refactors can eliminate disabled adapter classes only after the runtime call sites and bundle types no longer need them.

### Deferred
- None.

## Code Context

- Disabled adapter policy and factory:
  - `src-ts/integrations/adapters.ts`
- Neo4j runtime caller guard:
  - `src-ts/graph/graph-engine.ts`
- Default noop behavior coverage:
  - `src-ts/tests/integrations/adapters.test.ts`
- Caller-dependency coverage for disabled Neo4j support:
  - `src-ts/tests/graph/graph-engine.test.ts`
- Historical and current readiness narratives:
  - `docs/PRODUCTION_READINESS_EXECUTION_PLAN.md`
  - `docs/PRODUCTION_READINESS_TODO.md`
- Prior closure evidence:
  - `.workflow/issues/issues.jsonl` (`ISS-20260428-006`)

# Implementation Plan: Core Migration Final Closure

**Session**: `WFS-core-migration-final-closure-20260407`  
**Status**: Planning Complete  
**Prepared**: `2026-04-07T00:40:00+08:00`

## 1. Requirements Summary

### Goal

Finish the remaining high-value closure work for the Python -> TypeScript migration so the repository has a single authoritative runtime, a clean Phase 4 validation baseline, and release gates that reflect the current codebase reality.

### In Scope

- Align desktop build-time and runtime defaults around the Node and TypeScript path
- Repair or retire broken Python fallback entrypoints and stale default-path assumptions
- Close the remaining Phase 4 core migration tail in `src-ts/memory` and related adapters
- Stabilize the official `test:phase4` and coverage commands
- Migrate release and delivery gates to the actual TypeScript authority
- Prune or explicitly bound migration-era compatibility shims
- Run a final acceptance sweep and record a single authoritative handoff

### Out of Scope

- Broad optional external adapter expansion beyond core migration closure
- New product features unrelated to migration completion
- Large UX or documentation redesign outside closure evidence and authority updates

## 2. Architecture Decisions

1. **Node and TypeScript become the authoritative local and packaged runtime path**
   - The current runtime default already prefers Node in the Rust host.
   - The remaining closure task is to make build-time and operational authority match that reality.

2. **Dead Python compatibility must not remain authoritative**
   - A fallback is acceptable only if it is explicit and working.
   - Broken `src/*` assumptions in scripts and docs are not valid closure state.

3. **Phase 4 closure precedes release-gate migration**
   - Release and delivery gates should consume the stable core migration baseline, not an unstable or split one.

4. **Compatibility boundaries are defined by desktop and MCP consumers**
   - Remove or bound shims only after preserving the live public contract.

5. **Execution should be wave-based**
   - This work spans desktop, Python scripts, TypeScript runtime, and release gates.
   - A dependency-sorted CSV plan minimizes file conflicts and preserves verification checkpoints.

## 3. Task Breakdown

| Task | Objective | Wave | Depends On |
|------|-----------|------|------------|
| `IMPL-001` | Finalize Node-first sidecar build and packaged default | 1 | - |
| `IMPL-003` | Close remaining Phase 4 multi-store semantics and adapter gaps | 1 | - |
| `IMPL-002` | Repair or retire broken Python fallback entrypoints | 2 | `IMPL-001` |
| `IMPL-004` | Stabilize the official Phase 4 regression and coverage gate | 2 | `IMPL-003` |
| `IMPL-006` | Prune or explicitly bound legacy compatibility shims | 2 | `IMPL-001`, `IMPL-003` |
| `IMPL-005` | Migrate release and delivery gates to TypeScript authority | 3 | `IMPL-001`, `IMPL-002`, `IMPL-004` |
| `IMPL-007` | Final migration closure verification and handoff | 4 | `IMPL-005`, `IMPL-006` |

## 4. Implementation Strategy

### Wave 1: Authority and Core Tail

- `IMPL-001` establishes the final runtime and build default.
- `IMPL-003` removes the last explicit Phase 4 core-tail blocker.

### Wave 2: Closure Hardening

- `IMPL-002` repairs or retires broken Python default entrypoints.
- `IMPL-004` turns the official Phase 4 commands into a stable acceptance surface.
- `IMPL-006` narrows the remaining compatibility shims to intentional contract boundaries.

### Wave 3: Gate Migration

- `IMPL-005` updates release and delivery gates once runtime/build authority and Phase 4 validation are stable.

### Wave 4: Final Acceptance

- `IMPL-007` runs the complete closure sweep and records the final authoritative handoff.

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Runtime and build authority changes break desktop flows | High | Make default changes explicit and validate sidecar contract and host compile path |
| Python fallback removal or repair leaves partial docs and scripts | High | Treat scripts and docs as one task boundary with explicit fallback policy |
| Phase 4 command instability hides lifecycle or native cleanup bugs | Medium | Reproduce through the official aggregate command, not only focused suites |
| Compatibility pruning breaks desktop or MCP payload expectations | Medium | Limit changes to bounded shims and keep focused contract tests in scope |
| Release gates become weaker after migration | High | Preserve useful signal output and real checks instead of deleting failing logic |

## 6. Deliverables

- Workflow plan session:
  - `.workflow/active/WFS-core-migration-final-closure-20260407/IMPL_PLAN.md`
  - `.workflow/active/WFS-core-migration-final-closure-20260407/plan.json`
  - `.workflow/active/WFS-core-migration-final-closure-20260407/TODO_LIST.md`
  - `.workflow/active/WFS-core-migration-final-closure-20260407/.task/IMPL-001.json` to `IMPL-007.json`
- CSV wave session:
  - `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/tasks.csv`
  - `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/context.md`
  - `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/discoveries.ndjson`

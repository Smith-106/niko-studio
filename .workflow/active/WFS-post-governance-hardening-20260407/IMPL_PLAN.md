# Implementation Plan: Post-GO Governance Hardening

**Session**: `WFS-post-governance-hardening-20260407`  
**Status**: Planning Complete  
**Prepared**: `2026-04-07T19:00:00+08:00`

## 1. Requirements Summary

### Goal

Continue improving the project after the current `GO` release state by hardening governance around CI gates, runtime compatibility boundaries, authority documentation, and alignment automation.

### In Scope

- Graduate or clarify the remaining soft-gate semantics in the internal integration workflow
- Tighten the Node-first runtime/build compatibility boundary without removing explicit Python override support
- Create a clearer authority map between current operational docs and historical reference material
- Add automated mismatch detection for workflow/runtime/docs authority drift
- Run one verification and handoff wave after the governance changes

### Out of Scope

- Reopening completed migration closure implementation tasks
- New product features unrelated to governance hardening
- Broad documentation modernization beyond authority clarity
- Destructive cleanup of unrelated active workflow artifacts

## 2. Architecture Decisions

1. **The current `desktop + src-ts` path remains authoritative**
   - This session strengthens governance around that path.
   - It does not change the primary runtime or reintroduce Python as default.

2. **Compatibility is acceptable only when explicit**
   - Python fallback remains available for explicit compatibility scenarios.
   - Tooling and documentation should stop sounding dual-authoritative.

3. **Wave 1 should maximize parallelism through ownership separation**
   - CI governance, runtime/tooling governance, and authority docs are independent enough to plan in parallel.

4. **Automation follows clarification**
   - Drift-detection logic should be built only after the target authority surfaces are clarified.

5. **Verification is a separate final wave**
   - Final evidence and handoff should consume the aligned state, not precede it.

## 3. Task Breakdown

| Task | Objective | Wave | Depends On |
|------|-----------|------|------------|
| `IMPL-001` | Graduate remaining internal soft gates into explicit governance rules | 1 | - |
| `IMPL-002` | Tighten Node-first runtime compatibility boundary | 1 | - |
| `IMPL-003` | Publish a clearer current-vs-historical authority map | 1 | - |
| `IMPL-004` | Add automated authority alignment checks | 2 | `IMPL-001`, `IMPL-002`, `IMPL-003` |
| `IMPL-005` | Run verification sweep and publish governance handoff | 3 | `IMPL-004` |

## 4. Implementation Strategy

### Wave 1: Parallel Clarification

- `IMPL-001` focuses only on internal CI governance in `.github/workflows/integration-tests.yml`.
- `IMPL-002` focuses only on runtime/build selectors and runtime-boundary wording.
- `IMPL-003` focuses only on the authority docs layer.

### Wave 2: Automation

- `IMPL-004` creates or extends alignment-check tooling so the clarified governance rules become mechanically enforceable.

### Wave 3: Verification and Handoff

- `IMPL-005` runs the refreshed verification sweep, regenerates summary artifacts as needed, and leaves a follow-up handoff for the next operator.

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| CI hardening accidentally weakens current useful signals | High | Reuse existing hard-fail patterns instead of deleting checks; preserve explicit soft-vs-hard semantics |
| Runtime compatibility cleanup accidentally removes necessary override behavior | High | Tighten messaging and boundaries first; keep explicit Python override path in scope |
| Authority docs cleanup creates more ambiguity instead of less | Medium | Prefer additive authority index notes and bounded historical markers over broad rewrites |
| New automation encodes stale assumptions | Medium | Make Wave 2 depend on the clarified outcomes of Wave 1 |
| Final verification produces mixed signals because not all authority surfaces were aligned | High | Gate Wave 3 strictly on Wave 2 completion |

## 6. Deliverables

- Workflow plan session:
  - `.workflow/active/WFS-post-governance-hardening-20260407/IMPL_PLAN.md`
  - `.workflow/active/WFS-post-governance-hardening-20260407/plan.json`
  - `.workflow/active/WFS-post-governance-hardening-20260407/TODO_LIST.md`
  - `.workflow/active/WFS-post-governance-hardening-20260407/.task/IMPL-001.json` to `IMPL-005.json`
- CSV wave planning session:
  - `.workflow/.csv-wave/cwp-post-governance-hardening-20260407/tasks.csv`
  - `.workflow/.csv-wave/cwp-post-governance-hardening-20260407/context.md`
  - `.workflow/.csv-wave/cwp-post-governance-hardening-20260407/discoveries.ndjson`

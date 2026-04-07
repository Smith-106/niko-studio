# Implementation Plan: Project Current State Follow-up

**Session**: `WFS-project-current-state-followup-20260407`  
**Status**: Planning Complete  
**Prepared**: `2026-04-07T22:15:00+08:00`

## 1. Requirements Summary

### Goal

Convert the `2026-04-07` current-state analysis into one execution-ready queue that follows the completed `WFS-post-governance-hardening-20260407` session and closes only the remaining engineering and product gaps across gateway structure debt, local engineering baseline, desktop contract seams, and visible desktop user-surface gaps.

### In Scope

- Close the remaining `src-ts` gateway adapter and compatibility-surface debt without reopening governance work
- Establish a repo-local `desktop + src-ts` engineering baseline and retire stale Python-era local defaults without reopening the upstream Python opt-in runtime boundary
- Split the desktop transport and shared API contract surface out of `desktop/src/api/client.ts`
- Close the read-only knowledge-surface dead ends for characters, locations, and plots with behavior coverage
- Clarify Story Bible as a local-only draft surface first, then add explicit local backup and restore

### Out of Scope

- Reopening completed governance or authority work from `WFS-post-governance-hardening-20260407`
- Changing the `desktop + src-ts` authoritative runtime path or reintroducing Python or Web as equal-first paths
- Reworking the explicit Python override runtime/tooling boundary already tightened upstream in `WFS-post-governance-hardening-20260407`
- Broad product-positioning or documentation rewrites outside the targeted execution files
- Creating CSV-wave artifacts in this session

## 2. Architecture Decisions

1. **Completed governance hardening is the fixed upstream boundary**
   - `WFS-post-governance-hardening-20260407` already closed the authority and governance lane.
   - This queue starts after that handoff and must not reopen CI or authority semantics already marked complete.

2. **The Node-first `desktop + src-ts` path remains authoritative**
   - Gateway cleanup and desktop contract work should narrow ambiguity around that path.
   - Python- or web-compatibility surfaces can remain only when explicit and bounded.
   - The Python override boundary itself is treated as upstream-complete; this queue only handles residual local defaults and on-disk compatibility surfaces.

3. **Wave 1 is reserved for independent foundations**
   - Gateway adapter ownership, repo-local baseline config, and desktop transport extraction touch different file clusters.
   - These tasks can run in parallel without same-wave edit overlap.

4. **User-surface work waits for the desktop contract split**
   - `KnowledgeModal` and Story Bible follow-up should land after the desktop API seam is thinned.
   - This reduces churn around `desktop/src/api/client.ts` and keeps product-surface tasks focused.

5. **Story Bible stays local-first in this queue**
   - The near-term closure is to make the local-only draft boundary explicit.
   - Recovery comes from local export/import/reset, not from project-synced persistence.

## 3. Task Breakdown

| Task | Objective | Wave | Depends On |
|------|-----------|------|------------|
| `IMPL-001` | Collapse duplicated gateway integration adapter ownership | 1 | - |
| `IMPL-002` | Establish the repo-local JS/TS engineering baseline | 1 | - |
| `IMPL-003` | Extract the desktop transport contract from the live desktop invoke surface | 1 | - |
| `IMPL-004` | Fence the deprecated web gateway compatibility surface | 2 | `IMPL-001` |
| `IMPL-005` | Retire legacy pytest defaults and align delivery-gate local anchors | 2 | `IMPL-002` |
| `IMPL-006` | Extract shared desktop gateway schemas and thin the endpoint facade | 2 | `IMPL-001`, `IMPL-003` |
| `IMPL-007` | Close non-skill knowledge tab dead ends in `KnowledgeModal` | 3 | `IMPL-006` |
| `IMPL-008` | Add behavior coverage for the knowledge-surface closure | 4 | `IMPL-007` |
| `IMPL-009` | Make the Story Bible persistence contract explicit | 4 | `IMPL-007` |
| `IMPL-010` | Add local-only backup, restore, and reset for Story Bible drafts | 5 | `IMPL-009` |

## 4. Implementation Strategy

### Wave 1: Foundation Structural and Baseline Work

- `IMPL-001` closes the shared gateway adapter seam across `src-ts/container`, `src-ts/integrations`, and `src-ts/memory`.
- `IMPL-002` adds the repo-local lint, format, and `check:local` baseline for `desktop` and `src-ts`.
- `IMPL-003` extracts the desktop transport contract from `desktop/src/api/client.ts` and the other live `invoke(...)` call sites while keeping the full Tauri command set stable.

### Wave 2: Boundary and Contract Completion

- `IMPL-004` fences the deprecated web compatibility surface only after the adapter boundary is explicit.
- `IMPL-005` removes stale `pytest.ini` defaults and updates `scripts/delivery_gate.py` only where the new local baseline becomes authoritative.
- `IMPL-006` extracts shared desktop gateway schemas after the gateway boundary and desktop transport layer settle.

### Wave 3: Knowledge Surface Functional Closure

- `IMPL-007` turns characters, locations, and plots into explicit read-only selection and detail flows and removes dead create affordances from the active path.

### Wave 4: User-Facing Assurance and Persistence Boundary Clarity

- `IMPL-008` expands `KnowledgeModal` behavior coverage so the new closure path is locked by tests.
- `IMPL-009` makes the Story Bible local-only persistence contract visible in UI, translations, docs, and tests.

### Wave 5: Story Bible Local Recovery Flow

- `IMPL-010` adds explicit local export, import, and reset for Story Bible drafts without implying shared or gateway-backed persistence.

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gateway refactor changes default local-first behavior or singleton initialization order | High | Keep `IMPL-001` scoped to the adapter boundary and require the existing container, integration, and memory tests to pass together |
| Repo-local lint and format rollout expands into noisy whole-repo churn | High | Keep `IMPL-002` limited to `desktop`, `src-ts`, and explicit ignore rules; do not widen the first baseline beyond the active authority path |
| Desktop contract split drifts from the Tauri host wire format | High | Keep `IMPL-003` and `IMPL-006` behavior-preserving, preserve the 5 existing commands, and verify with `cargo check` plus desktop tests |
| Knowledge-surface closure reintroduces dead UI affordances or ambiguous read-only behavior | Medium | Gate `IMPL-008` on `IMPL-007` and lock the exact click-to-detail and inactive-empty-state behavior with focused tests |
| Story Bible backup and restore is mistaken for project persistence | Medium | Make `IMPL-009` explicit about the local-only boundary and keep `IMPL-010` payloads limited to the 5 draft fields only |

## 6. Deliverables

- Workflow plan session:
  - `.workflow/active/WFS-project-current-state-followup-20260407/IMPL_PLAN.md`
  - `.workflow/active/WFS-project-current-state-followup-20260407/plan.json`
  - `.workflow/active/WFS-project-current-state-followup-20260407/TODO_LIST.md`
  - `.workflow/active/WFS-project-current-state-followup-20260407/.task/IMPL-001.json` to `IMPL-010.json`
  - `.workflow/active/WFS-project-current-state-followup-20260407/workflow-session.json`
- Planning support artifacts retained as references only:
  - `.workflow/active/WFS-project-current-state-followup-20260407/planning-notes.md`
  - `.workflow/active/WFS-project-current-state-followup-20260407/.process/context-package.json`
  - `.workflow/active/WFS-project-current-state-followup-20260407/.process/module-plans/*.json`

## 7. Next Step Command

```bash
$workflow-execute --session WFS-project-current-state-followup-20260407
```

Start with Wave 1 only. Keep same-wave edits inside each task `scope`, and continue to treat `WFS-post-governance-hardening-20260407` as completed upstream history rather than an editable target.

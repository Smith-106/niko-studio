# Research Report: US-002 - Enforce deterministic lifecycle transition ordering

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From `PRD-033` `US-002.researchTopics`:

1. Canonical lifecycle transition sequence and guard conditions for roadmap state changes
2. Existing milestone closure and PRD activation/completion interactions requiring normalization

---

## Findings

### Topic 1: Canonical lifecycle transition sequence and guards in execute flow

**Summary:**
`run_execute_phase` already enforces a mostly deterministic state progression, but activation logging is not emitted in the same path that sets PRD status to `in_progress`. The deterministic transition backbone exists; the remaining gap is making lifecycle event emission complete and strictly ordered.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Orchestrator source
- [x] Roadmap state/changelog data
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Pre-selection normalization before pointer read: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:687-693`
- Canonical pointer derivation: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:411-427`
- PRD status flips to `in_progress` without `prd_activated` changelog append: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:776-780`
- PRD completion emits `prd_completed`: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:796-805`
- Milestone completion emits `milestone_completed` only when no remaining non-completed PRDs: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:840-860`
- Project completion guard (no incomplete milestones): `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:709-716`

**Guard conditions observed:**
- Execute target selection uses first PRD with `pending|in_progress` in first non-completed milestone.
- Milestone completion guard is `pending_in_milestone == empty`.
- Project completion guard is `incomplete milestone == empty`.

### Topic 2: Milestone closure and activation/completion interactions

**Summary:**
`prd_completed` and `milestone_completed` are emitted in deterministic order during successful completion, with pointer normalization called after each transition. Activation is currently status-only in this path, so lifecycle sequence observability can drift from status reality.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Roadmap lifecycle changelog snapshots
- [x] PRD acceptance constraints
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Completion path order is status update -> `prd_completed` append -> normalize: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:796-807`
- Conditional milestone closure then `milestone_completed` append -> normalize: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:848-860`
- Existing roadmap changelog includes lifecycle actions (`prd_activated`, `prd_completed`, `milestone_completed`) but activation can come from other flows: `.aha-loop/project.roadmap.json:633-637`, `.aha-loop/project.roadmap.json:600-607`, `.aha-loop/project.roadmap.json:611-614`

**Implication:**
US-002 should make execute-path lifecycle ordering explicit and complete by emitting `prd_activated` when status transitions to `in_progress`, then preserving deterministic ordering for completion and milestone closure.

---

## Implementation Recommendations

1. **Approach:**
   - Introduce one transition routine in execute flow for lifecycle writes (status + changelog + pointer normalization).
   - Enforce event ordering per PRD cycle:
     1) `prd_activated` (on `pending -> in_progress`),
     2) `prd_completed` (on successful run),
     3) `milestone_completed` (only when milestone has no non-completed PRDs).

2. **Pattern to Follow:**
   - Keep pointers as derived state via `normalize_roadmap_pointers`.
   - Keep lifecycle action taxonomy stable and machine-consumable (`prd_activated`, `prd_completed`, `milestone_completed`).

3. **Key Files to Modify (next phase):**
   - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh`
   - `.aha-loop/project.roadmap.json` (state/changelog consistency verification)

4. **Dependencies:**
   - Existing roadmap JSON schema and changelog consumers.
   - No new external dependencies.

### Pitfalls to Avoid

- Emitting lifecycle events in a different branch than status writes.
- Allowing `milestone_completed` before `prd_completed` for the last PRD.
- Updating pointers with ad-hoc logic outside `normalize_roadmap_pointers`.

---

## Exploration Decision Points

No parallel exploration topic required. Sequence semantics are bounded to existing execute lifecycle path and can be implemented deterministically without architecture alternatives.

---

## Checklist

- [x] All research topics investigated
- [x] Canonical transition sequence and guards identified
- [x] Activation/completion/milestone interaction gaps documented
- [x] Deterministic implementation direction documented

# Research Report: US-001 - Keep roadmap pointers aligned with execution state

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From `PRD-033` `US-001.researchTopics`:

1. Current pointer update logic and state ownership boundaries in roadmap lifecycle flow
2. Failure modes causing stale `currentMilestone` / `currentPRD` divergence

---

## Findings

### Topic 1: Pointer update logic is centralized in orchestrator PRD completion flow, but pointer ownership is asymmetric

**Summary:**
`currentPRD` is actively updated by the execute phase transition path, while `currentMilestone` is mostly activated by milestone/scope changes and not automatically cleared/advanced during PRD/milestone completion in the same path. This asymmetry is the main ownership boundary that can create stale pointer combinations.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Orchestrator source
- [x] Roadmap lifecycle data
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Execute flow reads current PRD pointer: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:670`
- PRD activation writes pointer and status: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:756`
- PRD completion clears `currentPRD`: `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:777`
- Milestone completion only updates milestone status/changelog (no pointer normalization): `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:828`
- Current active roadmap state in workspace: `.aha-loop/project.roadmap.json:5-6`, `.aha-loop/project.roadmap.json:471-478`

**Implication:**
US-001 implementation should normalize both pointers from canonical roadmap state after lifecycle writes, instead of relying on event-specific partial updates.

### Topic 2: Stale pointer divergence appears when changelog/event updates and pointer updates are not coupled by one deterministic normalization step

**Summary:**
The roadmap changelog already records activation/completion events (`prd_activated`, `prd_completed`, `milestone_completed`), but pointer updates are only partially represented (`current_prd_updated`) and can lag behind status transitions. A deterministic post-transition normalization step is needed to prevent contradictory states.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Roadmap changelog examples
- [x] PRD acceptance constraints
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Changelog contains lifecycle events: `.aha-loop/project.roadmap.json:629`, `.aha-loop/project.roadmap.json:748`, `.aha-loop/project.roadmap.json:607`
- Prior pointer-clear event exists but is separate: `.aha-loop/project.roadmap.json:613`
- PRD requirement explicitly targets no contradictory pointer state: `.aha-loop/prd.json:16-18`

**Implication:**
US-001 should define a deterministic pointer sync rule set tied to lifecycle transitions:
- derive `currentPRD` from in-progress PRD status (or null)
- derive `currentMilestone` from active/non-completed milestone containing active or pending PRDs (or null when project complete)
- persist pointer updates and lifecycle changelog in one coherent transition sequence

---

## Implementation Recommendations

1. **Approach:**
   - Add one pointer normalization routine in roadmap update flow and call it after lifecycle transitions.
   - Ensure pointer derivation is based on milestone/PRD statuses, not ad-hoc event assumptions.

2. **Pattern to Follow:**
   - Centralized deterministic transition logic in execute phase (`orchestrator.sh`) with additive changelog records.
   - Keep machine-consumable fields stable (`currentMilestone`, `currentPRD`, lifecycle `action` taxonomy).

3. **Key Files to Modify (next phase):**
   - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh`
   - `.aha-loop/project.roadmap.json` (state/changelog consistency checks)
   - `.aha-loop/tasks/prd-033-roadmap-governance-and-lifecycle-sync.md` (if implementation notes need mirroring)

4. **Dependencies:**
   - Existing roadmap JSON schema and changelog action taxonomy.
   - No new external dependency required.

### Pitfalls to Avoid

- Updating `currentPRD` without re-evaluating `currentMilestone` in the same transition.
- Encoding pointer behavior only in free-form changelog descriptions.
- Introducing fallback heuristics that can point to completed milestones/PRDs.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-001. Existing orchestrator lifecycle path is the canonical integration point.

---

## Checklist

- [x] All research topics investigated
- [x] Existing pointer/lifecycle ownership boundaries mapped
- [x] Failure modes for stale pointer divergence identified
- [x] Deterministic implementation direction documented

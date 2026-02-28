# Research Report: US-003 - Stabilize lifecycle changelog semantics

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From `PRD-033` `US-003.researchTopics`:

1. Current roadmap changelog action taxonomy and payload field consistency
2. Deterministic formatting rules for lifecycle event auditability and replay

---

## Findings

### Topic 1: Current changelog taxonomy and payload consistency

**Summary:**
The execute lifecycle path in `orchestrator.sh` uses a stable append pattern for lifecycle actions with consistent envelope keys, but the broader roadmap changelog includes mixed action families (`prd_*`, `milestone_*`, pointer updates, scope/policy events). For deterministic machine consumption, lifecycle events should keep one canonical field contract and action-specific identifiers.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Orchestrator source
- [x] Roadmap changelog data (`.aha-loop/project.roadmap.json`)
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Lifecycle changelog appends in execute path:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:780` (`prd_activated`)
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:806` (`prd_completed`)
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:860` (`milestone_completed`)
- Action taxonomy visible in roadmap changelog includes lifecycle and non-lifecycle classes:
  - `.aha-loop/project.roadmap.json:512` (changelog root)
  - `.aha-loop/project.roadmap.json:515` (`prd_progress`)
  - `.aha-loop/project.roadmap.json:520` (`scope_extended`)
  - `.aha-loop/project.roadmap.json:525` (`milestone_activated`)
  - `.aha-loop/project.roadmap.json:595` (`project_completed`)

**Consistency observations:**
- Lifecycle events currently follow a consistent envelope (`timestamp`, `action`, `description`, plus `prdId`/`milestoneId` as applicable).
- Pointer-update actions (`current_prd_updated`) are descriptive and may not include explicit structured linkage fields beyond text.
- There is a malformed changelog segment in current roadmap data near `.aha-loop/project.roadmap.json:519` (missing object opening brace), which is a concrete auditability/replay risk.

### Topic 2: Deterministic formatting rules for auditability/replay

**Summary:**
Determinism in this codebase is enforced by stable key contracts and ordering-sensitive output patterns. Lifecycle changelog semantics should keep action names and required fields fixed, avoid encoding critical state in free-form descriptions only, and preserve append-only event ordering in the same branch as status writes.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Orchestrator source
- [x] Release evidence formatting tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Lifecycle status+event coupling and ordering in execute path:
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:776-787`
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:801-813`
  - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh:855-867`
- Deterministic machine-formatting precedent:
  - `scripts/release_check_summary.py:131` (`_format_detail_pairs`)
  - `tests/unit/scripts/test_release_check_summary.py:42` (stable key order assertion)

**Deterministic rules inferred:**
1. Keep lifecycle action taxonomy stable (`prd_activated`, `prd_completed`, `milestone_completed`).
2. Keep required envelope fields explicit and fixed per action.
3. Keep event append and status transition in the same control path.
4. Treat `description` as human-readable only; machine-critical linkage should be in explicit keys.
5. Validate changelog JSON integrity before downstream replay/consumption.

---

## Implementation Recommendations

1. **Approach:**
   - Introduce explicit lifecycle changelog schema rules in implementation path and tests.
   - Constrain lifecycle action payloads to deterministic required fields.

2. **Pattern to Follow:**
   - Reuse existing execute append pattern and deterministic ordering discipline already used for lifecycle transitions.

3. **Key Files to Modify (implementation phase):**
   - `参考/Aha-Loop/scripts/aha-loop/orchestrator.sh`
   - Test coverage files validating roadmap/changelog semantics (to be identified in implementation)

4. **Dependencies:**
   - No new external dependencies required.

### Pitfalls to Avoid

- Encoding machine-critical semantics only inside `description` strings.
- Allowing malformed roadmap JSON to pass silently into orchestration/replay tools.
- Introducing new lifecycle action names without schema/update strategy.

---

## Exploration Decision Points

No parallel exploration topic required. The decision space is contract hardening within existing lifecycle append paths.

---

## Checklist

- [x] All research topics investigated
- [x] Taxonomy and payload consistency analyzed in code/data
- [x] Deterministic formatting rules extracted from existing patterns
- [x] Implementation recommendations documented
- [x] Pitfalls identified

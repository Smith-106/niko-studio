# Research Report: PRD-044 US-001 - Pointer transitions recover deterministically after roadmap advance

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Roadmap pointer transition paths for currentMilestone/currentPRD updates during PRD completion and activation
2. Existing tests/assertions for deterministic roadmap state and contradictory-state prevention

---

## Findings

### Topic 1: Pointer transition paths in roadmap state

**Summary:**
Pointer governance currently lives in `.aha-loop/project.roadmap.json` as data-level contracts (not code-level helper functions):
- top-level `currentMilestone/currentPRD` define active execution target
- milestone PRD entries define per-PRD status (`pending/in_progress/completed`)
- changelog entries provide lifecycle trace (`prd_completed`, `prd_activated`, `current_prd_updated`)

For the latest transition chain (PRD-043 -> PRD-044), deterministic consistency requires all three surfaces to align in the same update batch:
1. `currentPRD` must point to the activated PRD
2. previous PRD must be `completed` with `completedAt`
3. changelog sequence must include completion then activation then pointer update

**Data Evidence:**
- Active pointer: `.aha-loop/project.roadmap.json:5-6`
- M12 PRD states and `completedAt`: `.aha-loop/project.roadmap.json:613-652`
- Transition lifecycle sequence (043 close -> 044 activate): `.aha-loop/project.roadmap.json:656-674`

### Topic 2: Existing deterministic checks and guard gaps

**Summary:**
No dedicated Python runtime tests currently assert roadmap JSON transition semantics directly. Existing guarding is process-driven, so recovery robustness depends on explicit deterministic assertions in tests that read roadmap-like structures and reject contradictory state combinations.

**Gap Identified:**
- Missing direct contract test for contradiction scenarios, e.g.:
  - `currentPRD` points to PRD-X while PRD-X remains `pending`
  - previous PRD not marked `completed` when pointer already advanced
  - changelog lifecycle ordering drift

---

## Implementation Recommendation

1. Add deterministic contract tests under roadmap-facing unit test surface (or nearest workflow governance test module) with fixture-style minimal roadmap payloads:
   - PASS case: `prd_completed` -> `prd_activated` -> `current_prd_updated`, pointer and PRD statuses aligned.
   - FAIL case A: pointer advanced without prior PRD completion.
   - FAIL case B: pointer targets PRD with `pending` status.
2. Use ID-keyed assertions (by `prdId` / `milestoneId`) rather than positional assumptions over the full historical changelog.
3. Keep checks schema-focused and backward-safe: validate required invariant fields without constraining unrelated historical entries.

---

## Risks / Pitfalls

- Strictly asserting full changelog global order across all history can be brittle due to long archive tails.
- Validating only `currentPRD` without matching milestone PRD status can miss contradictory active-state combinations.
- Updating pointers without synchronized `updatedAt`/`completedAt` reduces audit clarity.

---

## Checklist

- [x] Research topics investigated
- [x] Pointer transition path mapped
- [x] Existing guard coverage assessed
- [x] Contradiction scenarios identified
- [x] Deterministic implementation guidance documented

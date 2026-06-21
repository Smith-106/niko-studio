---
related:
  - "knowhow-knw-retro-reuse-callapi-wrapper-2026-06-21"
  - "knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21"
  - "knowhow-knw-retro-verification-green-not-healthy-2026-06-21"
---
# Record scope deviations in plan deferred list, not just task Deviations — 2026-06-21

**Source**: quality-retrospective M26-P1 (process lens), INS-0f0144a2
**Type**: gotcha / process tip

## The trap
M26-P1 TASK-001's planned action was to wire real manuscript text from `workspace/manuscript` service, with `definition_of_done = read real novel content`. During execution the scope was **silently narrowed** to an empty-report fallback (per user direct instruction), recorded only in the task summary's Deviations section.

Review later flagged the leftover TODO as a correctness finding (CORR-001): manuscript text hardcoded empty, real analysis path unreachable. The original scope became a hidden gap because it lived only in a summary note, not in any tracked store.

## Lesson
When execution narrows a task's `definition_of_done` mid-flight:
1. Record it in the **plan's `deferred` list** with a follow-up task ID — not just a task summary Deviations note
2. The summary note is ephemeral and invisible to future planning
3. The deferred list is the contract for what scope was dropped and must be picked up later

Otherwise the original scope becomes a hidden gap that review rediscovers as a bug.

## Evidence
- `.workflow/scratch/20260618-plan-P1-reader-simulation-anti-ai-flavor/.task/TASK-001.json` — action (wire manuscript) vs definition_of_done (read real novel)
- `.summaries/TASK-001-summary.md` Deviations — "replaced TODO with empty-report fallback per user direct instruction"
- `.workflow/scratch/20260619-review-P1-reader-simulation-anti-ai-flavor/review.json` CORR-001 — TODO left unresolved
- `.workflow/state.json` accumulated_context.deferred — empty array, scope not recorded

## Related
- [[knowhow-knw-retro-verification-green-not-healthy-2026-06-21]]

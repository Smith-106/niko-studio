# Research Report: PRD-043 US-002 - Artifact trace links remain cross-surface aligned under repeated runs

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Repeated-run drift scenarios in generation snapshot trace links and state artifact references
2. Deterministic assertion patterns for cross-surface artifact/evidence trace parity

---

## Findings

### Topic 1: Repeated-run drift scenarios in generation snapshot and state artifacts

**Summary:**
For workflow runtime, drift can happen when one surface updates trace metadata but the other does not. The highest-risk junctions are:
- generation snapshot `trace.run_id` and returned `generation_snapshot.trace.run_id`
- state snapshot `state_trace_id` evolution across runs
- state `artifacts.*` path linkage and generation snapshot `evidence_links`

**Code Evidence:**
- Generation snapshot persistence and returned trace/meta: `src/workflow/workflow_engine.py:1586`
- Replay-side snapshot trace extraction (`snapshot_trace_id`): `src/workflow/workflow_engine.py:1718`
- State snapshot trace generation + artifact path embedding: `src/workflow/workflow_engine.py:807`
- Existing generation trace assertions: `tests/unit/workflow/test_workflow_engine.py:237`
- Existing state trace/checkpoint assertions: `tests/unit/workflow/test_workflow_engine.py:1763`, `tests/unit/workflow/test_workflow_engine.py:1809`

### Topic 2: Deterministic parity assertion patterns under repeated runs

**Summary:**
The strongest deterministic pattern remains cross-surface parity by stable IDs and contract keys (not positional expectations):
- same run: payload trace == persisted artifact trace
- repeated runs: stable identifiers remain stable (`session_id`, `run_id`), while expected time-varying fields progress (`state_trace_id`, `generated_at`-like timestamps)
- path checks should remain shape-based (`endswith`) to avoid temp directory brittleness

**Reference Pattern:**
- Repeated-run parity by keyed comparison and controlled timestamp drift: `tests/unit/scripts/test_release_check_summary.py:2165`

---

## Implementation Recommendation

1. Add a repeated-run continuity guard in `tests/unit/workflow/test_workflow_engine.py` for generation snapshot path:
   - Run `generate_draft` path twice on same plan.
   - Assert returned `generation_snapshot.trace.run_id` stays `run-{plan_id}`.
   - Assert persisted snapshot `trace.run_id` matches returned payload on each run.
   - Assert `trace.session_id` and `revision_id` shape remain consistent.
2. Pair with state artifact linkage assertions:
   - `state.artifacts.state` and generation snapshot `evidence_links` stay cross-surface aligned by path suffix/identity.
   - Allow `state_trace_id` to change across runs, but assert both surfaces remain internally aligned per run.
3. Keep assertions schema-focused and ID-keyed to minimize brittleness.

---

## Risks / Pitfalls

- Asserting strict absolute paths can produce flaky tests in ephemeral temp directories.
- Asserting global event order across audit lines can overconstrain unrelated changes.
- Ignoring replay-side `snapshot_trace_id` can miss restore-path contract drift.

---

## Checklist

- [x] Research topics investigated
- [x] Repeated-run drift surfaces mapped
- [x] Deterministic parity strategy defined
- [x] Implementation guidance documented

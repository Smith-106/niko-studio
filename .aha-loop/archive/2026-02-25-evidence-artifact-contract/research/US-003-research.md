# Research Report: US-003 - Guarantee deterministic release-check consumption

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Current release-check parser expectations for evidence inputs

---

## Findings

### Topic 1: Current release-check parser expectations for evidence inputs

**Summary:**
Release-check consumption is deterministic by contract in `scripts/release_check_summary.py` + `tests/unit/scripts/test_release_check_summary.py`, and it expects evidence signals from non-template markdown artifacts under `.workflow/evidence/weekly` and `.workflow/evidence/quality`.

The parser/aggregator contract is effectively:
- deterministic machine payload shape:
  - top-level keys: `decision`, `go_no_go_reasons`, `generated_at`, `checks`
  - per-check keys: `check_id`, `priority`, `blocking`, `status`, `exit_code`, `detail`
- deterministic `detail` formatting via ordered `key=value` pairs
- evidence corpus excludes `TEMPLATE-*` files
- traceability signals depend on both `evidence_links` key presence and at least one traceable link/path pattern

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing docs and templates
- [x] Unit tests for release summary contract

**Key Source Anchors:**
- `scripts/release_check_summary.py`
  - `_format_detail_pairs` (deterministic detail serialization)
  - `_count_non_template_markdown`, `_iter_non_template_markdown_paths`, `_read_markdown_corpus` (template exclusion)
  - `evidence_links_signal` (dual-condition traceability check)
  - `main()` machine payload construction (`decision`, `go_no_go_reasons`, `generated_at`, `checks`)
- `tests/unit/scripts/test_release_check_summary.py`
  - `test_detail_formatter_produces_stable_key_order`
  - `test_evidence_links_signal_warn_detail_uses_stable_key_order`
  - `test_tasks_completion_signal_*` / `test_evidence_coverage_signal_*` deterministic detail assertions
- `.workflow/evidence/README.md`
  - canonical envelope fields and artifact-type trace requirements
- `docs/PDD.md` section 16
  - evidence minimum fields + canonical envelope mapping + artifact-specific trace IDs

**Determinism and Diffability Expectations:**
1. `detail` values are machine-consumed and test-asserted; formatting drift is contract drift.
2. Evidence readiness counts must exclude template files to avoid false positives.
3. Signal checks are keyword/pattern-based and therefore require stable, explicit metadata vocabulary (`evidence_links`, trace IDs).
4. Canonical envelope must remain aligned with PDD section 16 and evidence templates.

---

## Implementation Recommendations

1. **Keep parser-visible structures deterministic:**
   - Keep `checks` item shape unchanged for release consumers.
   - Keep `detail` generated only from ordered tuples through `_format_detail_pairs`.

2. **Keep evidence-input assumptions explicit in docs/templates:**
   - Preserve canonical envelope fields in `.workflow/evidence/README.md` and templates.
   - Preserve artifact-specific `trace` IDs (`session_id` + `run_id`/`revision_id`/`check_id`).

3. **Keep repository-friendly diffability constraints:**
   - Keep stable key ordering in machine payload and detail strings.
   - Keep markdown evidence naming conventions and `TEMPLATE-*` exclusion behavior.

### Pitfalls to Avoid

- Introducing free-form `detail` text where tests/consumers expect deterministic `key=value` pairs.
- Counting template files as actual evidence inputs.
- Relaxing traceability semantics to key presence only without a traceable path/link.
- Drifting envelope field names between templates, PDD section 16, and release-check script expectations.

---

## Follow-up Research Needed

- [ ] Evaluate whether release-check should add a strict schema validator for evidence envelope fields at scan time (currently signal-based checks only).

---

## Knowledge Base Updates

Applied updates:
- `.aha-loop/knowledge/project/patterns.md` (added deterministic release-check consumption pattern)
- `.aha-loop/knowledge/project/gotchas.md` (added detail-format drift gotcha)

---

## Checklist

- [x] Research topic investigated
- [x] Parser expectations identified from implementation
- [x] Determinism constraints cross-checked with unit tests
- [x] Evidence contract alignment verified against README/PDD
- [x] Implementation recommendations documented
- [x] Pitfalls identified

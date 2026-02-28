# Research Report: US-002 - Define required evidence metadata fields

**Date:** 2026-02-24
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Release and quality tracking metadata currently consumed by the pipeline

---

## Findings

### Topic 1: Release and quality tracking metadata currently consumed by the pipeline

**Summary:**
The pipeline currently consumes evidence metadata through two layers:
- canonical evidence envelope in markdown/json artifact templates
- release gate signal scanning in `scripts/release_check_summary.py`

`release_check_summary.py` does not parse a strict JSON schema for evidence artifacts, but it does enforce traceability through textual signals and deterministic machine payload output (`checks`, `decision`, `go_no_go_reasons`). Existing tests assert stable key ordering and exact `detail` strings, which acts as the effective contract for auditability.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing docs and templates
- [x] Unit tests for release summary contract

**Repository Evidence Contract (Current):**
- Canonical artifact metadata envelope is documented in:
  - `.workflow/evidence/README.md`
  - `docs/PDD.md` section 16
- Required shared fields:
  - `artifact_type`
  - `schema_version`
  - `date`
  - `owner`
  - `input`
  - `output`
  - `result`
  - `evidence_links`
  - `trace`
- Artifact-type-specific trace IDs are currently:
  - e2e: `session_id`, `run_id`
  - quality: `session_id`, `revision_id`
  - release: `session_id`, `run_id`, `check_id`

**Pipeline Consumption Details:**
- Release and quality evidence are scanned as markdown corpus from weekly/quality directories (non-template files only).
- Evidence link signal requires both:
  - key presence: `evidence_links`
  - at least one traceable path/link pattern
- Deterministic machine output includes:
  - top-level: `decision`, `go_no_go_reasons`, `generated_at`, `checks`
  - per-check: `check_id`, `priority`, `blocking`, `status`, `exit_code`, `detail`
- `detail` is required to be deterministic ordered `key=value` pairs.

**Key Source Anchors:**
- `scripts/release_check_summary.py`
  - `_format_detail_pairs` (stable detail ordering)
  - `evidence_links_signal` (traceability gate)
  - machine payload block with `decision`, `go_no_go_reasons`, `checks`
- `tests/unit/scripts/test_release_check_summary.py`
  - stable ordering assertions for `detail`
  - signal behavior assertions for evidence-link and other gate checks

---

## Implementation Recommendations

1. **Metadata baseline for US-002 should stay aligned with current canonical contract:**
   - Keep required envelope fields exactly as documented in `.workflow/evidence/README.md` and `docs/PDD.md`.
   - Keep `schema_version=evidence.v1` unchanged.

2. **Traceability requirement should be explicit and testable:**
   - `trace` must include at least one run/session correlation id for all artifact types.
   - Release artifacts should continue including `check_id` for gate-level correlation.

3. **Auditability requirement should remain deterministic:**
   - Do not introduce free-form metadata values for machine-consumed signal details.
   - Keep deterministic `detail` serialization pattern unchanged.

4. **Quality/release evidence consumption assumptions to preserve:**
   - Template files (`TEMPLATE-*`) are excluded from readiness counts and corpus checks.
   - Evidence-link validation is key + traceable-link dual condition.

### Pitfalls to Avoid

- Adding new required metadata fields not reflected in templates and PDD mapping.
- Weakening trace requirements to optional-only fields for release artifacts.
- Breaking deterministic `detail` string ordering in release checks.

---

## Follow-up Research Needed

- [ ] Confirm whether release evidence should mandate `check_id` in all contexts or only gate-level artifacts.
- [ ] Confirm whether `generated_at` from release summary should remain report-only instead of evidence-envelope-required.

---

## Knowledge Base Updates

Applied updates:
- `.aha-loop/knowledge/project/patterns.md` (added metadata traceability pattern)

---

## Checklist

- [x] Research topic investigated
- [x] Metadata contract sources cross-checked (README + PDD + templates)
- [x] Pipeline consumption points identified (script + tests)
- [x] Deterministic auditability constraints documented

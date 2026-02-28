# Research Report: US-001 - Define recurring KPI/evidence governance cadence and ownership

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From prd.json `US-001.researchTopics`:

1. Current ownership boundaries for KPI/evidence refresh across roadmap and release workflows
2. Existing scheduling/automation points for recurring governance checks

---

## Findings

### Topic 1: Ownership boundaries already center on `core-workflow` with evidence-contract enforcement split between documentation, templates, and release summary checks

**Summary:**
Ownership is consistently represented as `core-workflow` in active evidence artifacts, while governance constraints are distributed across:
- evidence metadata contract and naming rules,
- PDD acceptance/evidence mapping and cadence constraints,
- release summary script checks that enforce machine-readable readiness signals.

This means US-001 should not invent a new owner model; it should formalize and align the existing `core-workflow` ownership boundary and recurring obligations.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Existing evidence artifacts and templates
- [x] Governance docs (PDD / README / release notes)
- [x] Release check implementation + tests
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Weekly evidence templates define owner field: `.workflow/evidence/weekly/TEMPLATE-plan.md:3`, `.workflow/evidence/weekly/TEMPLATE-review.md:3`
- Active weekly review owner is `core-workflow`: `.workflow/evidence/weekly/2026-W09-review.md:4`
- Release path evidence owner is `core-workflow`: `.workflow/evidence/release/2026-02-26-release-path-check.md:7`
- Canonical evidence envelope requires owner + traceability fields: `.workflow/evidence/README.md:20-39`
- PDD maps weekly/release evidence as mandatory acceptance anchors: `docs/PDD.md:397-409`, `docs/PDD.md:422-433`, `docs/PDD.md:483-488`

**Implication:**
US-001 governance ownership can be defined as:
- **Primary owner:** `core-workflow` (artifact generation + refresh)
- **Governance gate owner:** release summary checks (`scripts/release_check_summary.py`) as deterministic policy enforcer
- **Acceptance owner:** PDD evidence ledger + release notes as decision-facing contract consumers

### Topic 2: Recurring governance checks are already automated through deterministic release summary signals with freshness and evidence-completeness checks over weekly/quality/release artifacts

**Summary:**
Recurring governance checkpoints are not cron-based scheduler jobs; they are execution-time deterministic checks concentrated in `scripts/release_check_summary.py`, run via the documented single-command release entry. The script:
- reads weekly + quality evidence directories,
- checks freshness windows,
- checks evidence coverage/completeness and machine payload presence,
- emits GO/NO_GO and machine-readable release artifact.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Script and test contract
- [x] Documentation and command entrypoints
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Single-command entrypoint documented: `README.md:76-83`, `docs/release/RELEASE_NOTES.md:55-59`
- Release summary main flow binds weekly/quality dirs: `scripts/release_check_summary.py:994`, `scripts/release_check_summary.py:1079-1084`
- Freshness signal exists with deterministic window logic: `scripts/release_check_summary.py:595-618`
- Freshness/evidence signals are included in release checks and final decision: `scripts/release_check_summary.py:1161-1185`, `scripts/release_check_summary.py:1483`, `scripts/release_check_summary.py:1577-1590`
- Release artifact trace determinism is covered by tests: `tests/unit/scripts/test_release_check_summary.py:1331-1389`

**Implication:**
US-001 recurring governance cadence can be grounded in:
- **Weekly cadence artifacts:** `weekly/*-plan.md`, `weekly/*-review.md`, `weekly/*-trend.md`
- **Release-time deterministic verification:** `python scripts/release_check_summary.py`
- **Freshness guard:** evidence freshness signal over non-template weekly/quality markdown corpus

---

## Implementation Recommendations

1. **Approach:**
   - Formalize governance cadence and ownership in the PRD story implementation by codifying existing `core-workflow` + release-summary enforcement responsibilities.
   - Keep governance checks additive and deterministic, leveraging existing release summary signal architecture.

2. **Pattern to Follow:**
   - Deterministic machine-signal governance in release summary (`check_id`, fixed `detail` key-value ordering, GO/NO_GO derivation).
   - Canonical evidence envelope with owner + trace fields.

3. **Key Files to Modify (next phase):**
   - `scripts/release_check_summary.py`
   - `tests/unit/scripts/test_release_check_summary.py`
   - `.workflow/evidence/README.md`
   - `.workflow/evidence/weekly/TEMPLATE-plan.md`
   - `.workflow/evidence/weekly/TEMPLATE-review.md`
   - `.workflow/evidence/weekly/TEMPLATE-trend.md`
   - `.aha-loop/tasks/prd-034-kpi-and-evidence-governance-baseline.md` (if governance notes are mirrored there)

4. **Dependencies:**
   - Existing release gate contract checks and tests
   - Existing evidence directory structure and naming conventions
   - Existing PDD acceptance/evidence mapping

### Pitfalls to Avoid

- Introducing a second ownership taxonomy that diverges from existing `core-workflow` evidence records.
- Counting template files as live evidence for freshness/completeness.
- Replacing deterministic signal details with free-form prose that breaks machine/readability contracts.
- Defining cadence only in docs without coupling to executable checks.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-001. Existing deterministic release summary signal framework is the canonical governance enforcement path.

---

## Checklist

- [x] All research topics investigated
- [x] Ownership boundary evidence mapped
- [x] Scheduling/automation points mapped
- [x] Implementation recommendations documented
- [x] Pitfalls identified

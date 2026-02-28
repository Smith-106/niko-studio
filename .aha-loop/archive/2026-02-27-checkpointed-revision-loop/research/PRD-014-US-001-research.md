# PRD-014 / US-001 Research — Cycle-Time Baseline and Sampling Rules

## Scope

Define deterministic, auditable rules for:
- cycle-time baseline window selection,
- weekly measurement sampling window,
- sample inclusion/exclusion for KPI computation.

## Existing Contract Anchors

### Evidence sources
- `.workflow/evidence/e2e/` run logs provide run/session timeline anchors.
- `.workflow/evidence/release/` outputs provide release-gate pass/fail and check detail signals.
- `.workflow/evidence/quality/` outputs provide quality comparability signals used to pair with cycle-time measurements.

### Deterministic field patterns
- Existing evidence templates and release summary checks already rely on stable machine-parsable detail fields and deterministic status/signal interpretation.
- Current workflow/session artifacts preserve deterministic ordering and traceability, which can be reused for baseline cohort and weekly windows.

## KPI Rule Specification (US-001)

### 1) Baseline window
- Baseline window = the first full 7-day evidence-complete window after PRD activation (`prdId=PRD-014`) where runs satisfy minimum evidence completeness.
- If no full evidence-complete 7-day window exists, baseline is `not_ready` (explicit state), and KPI trend reporting must surface reason code instead of fallback heuristics.

### 2) Measurement window
- Measurement window = rolling last full 7-day window ending before report generation timestamp.
- Only completed windows are eligible; partial-current-week data is excluded from KPI numerator/denominator.

### 3) Sample eligibility
A run/sample is eligible iff all conditions hold:
1. Has required traceable timestamps (start/end) in canonical evidence.
2. Has non-aborted execution outcome.
3. Has release/quality evidence records present (for comparability pairing).
4. Belongs to exactly one chapter gate record in the window.

### 4) Exclusion rules (deterministic)
Exclude sample with explicit reason code:
- `missing_timestamps`
- `aborted_run`
- `missing_quality_evidence`
- `missing_release_evidence`
- `duplicate_gate_mapping`

No manual override path is part of KPI computation.

### 5) Cycle-time metric
- Per-sample cycle time = `end_ts - start_ts` (canonical timestamps only).
- Weekly cycle-time KPI = median(per-sample cycle time) over eligible samples.
- Baseline comparator = median of baseline window eligible samples.

### 6) Readiness states for downstream reporting
- `ready`: baseline + current windows both have >= minimum eligible sample count.
- `insufficient_sample`: window exists but eligible sample count below threshold.
- `not_ready`: baseline window not established yet.

## Implementation Guidance for Next Phase

- Keep formulas additive and derived from existing evidence contracts.
- Persist eligibility/exclusion reason codes in machine-consumable fields to support weekly audits.
- Do not alter existing evidence schema semantics; introduce KPI-layer mapping only.

## Risks / Notes

- The key failure mode is hidden manual interpretation when evidence is incomplete. Use explicit readiness and exclusion reason codes to prevent ambiguity.
- Baseline stability must be fixed once established for PRD-014 reporting continuity.

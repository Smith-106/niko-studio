# Quality Criteria

This document defines quality evaluation rules for PDD KPI measurement.

## 1. Scope
- Applies to outputs that enter MVP acceptance statistics.

## 2. Evaluation Method
- Primary: Critic scoring
- Secondary: Manual review for edge cases

## 3. Pass Threshold
- Quality pass threshold: >= 99%
- If result is marked as "must rewrite", it is not counted as pass.

## 4. Minimum Dimensions
- Clarity
- Coherence
- Completeness
- Actionability

## 5. Recording Requirement
- Every evaluated sample must include:
  - input reference
  - score
  - pass/fail
  - reviewer (if manual)
  - timestamp

## 6. Re-evaluation Rule
- Failed samples must go through at least one revision cycle.
- Re-evaluation result must be recorded in `.workflow/evidence/quality/`.

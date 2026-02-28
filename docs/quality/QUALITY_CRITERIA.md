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

## 7. Runtime Decision Alignment
- Runtime publish gate for novel finalization should use strict threshold aligned with PDD acceptance (target >= 99%).
- Heuristic endpoint (`src/workflow/novel_quality.py`) is precheck only and must not override final acceptance decision.

## 8. Definition of Done (Excellent Long Novel)
- Chapter DoD:
  - Score >= 99%
  - No Critical issue
  - LOCK conflict dimension (`C`) is sufficient
- Volume DoD:
  - No cross-chapter critical consistency conflicts
  - Foreshadowing progression/recovery traceable
- Book DoD:
  - Main plot closed-loop
  - Key foreshadowing recovery rate >= 95%
  - Evidence trace available for quality review and revision loop

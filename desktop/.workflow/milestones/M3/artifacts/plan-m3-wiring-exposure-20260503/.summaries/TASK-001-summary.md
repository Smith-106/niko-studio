# TASK-001 Summary: Register 5 dormant evaluators + structured score transport

**Status**: completed
**Completed**: 2026-05-03T19:30:00+08:00
**Duration**: 45min

## Changes

### critic-engine.js
- Imported 5 dormant evaluator classes: PyramidEvaluator, SubtextEvaluator, FourSelvesEvaluator, ClicheDetector, DeadlySinsChecker
- Registered all 5 in `this.evaluators` map
- Updated `this.weights`: redistributed from 5 to 10 entries
  - fictional_dream: 0.25 → 0.20, voice: 0.20 → 0.15
  - Added: pyramid:0.12, subtext:0.10, four_selves:0.10, cliche:0.08, deadly_sins:0.08

### critic.js
- Added `module_scores` to both return paths:
  - Primary engine path (line ~82): maps raw moduleScores from engine
  - Narrative fallback path (line ~217): maps dimension scores
- Backward-compatible: existing lock_score, style_score, logic_score unchanged

### evaluation.ts
- Added `module_scores?: Record<string, number>` to EvaluationResult interface
- Added `evaluateWithModules()` function with `include_module_scores: true` param

## Convergence
- All 5 evaluators registered in this.evaluators
- Weights sum to 1.0 (10 entries)
- module_scores present in both critic.js return paths
- evaluateWithModules exported from evaluation.ts

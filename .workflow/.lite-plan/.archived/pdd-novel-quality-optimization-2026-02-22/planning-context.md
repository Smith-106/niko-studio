# Planning Context

## Source Inputs
- `.workflow/.analysis/ANL-继续完善优化PDD设计-2026-02-22/explorations.json`
- `.workflow/.analysis/ANL-继续完善优化PDD设计-2026-02-22/conclusions.json`
- `docs/PDD.md`
- `docs/quality/QUALITY_CRITERIA.md`
- `docs/quality/NOVEL_QUALITY_CHECKLIST.md`
- `src/workflow/adapters/novel_adapter.py`
- `src/workflow/state.py`
- `src/workflow/levels/types.py`
- `tests/unit/workflow/test_state.py`
- `tests/unit/workflow/test_novel_adapter.py`

## Consolidated Understanding
1. Novel creation runtime loop is implemented and test-covered.
2. Major gap is not missing feature but mapping completeness from PDD acceptance clauses to executable checks.
3. Threshold governance can drift unless one authority source is enforced and docs reference it.
4. Evidence-chain requirements are currently under-automated for CI verification.
5. Workflow taxonomy wording needs doc/runtime consistency to reduce planning and QA ambiguity.

## Planning Objective
Produce an execution-ready, minimal-change task set that closes the highest-value quality governance gaps in priority order (P0 first, then P1).

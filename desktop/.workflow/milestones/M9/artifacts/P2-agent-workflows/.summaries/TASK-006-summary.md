# TASK-006: Unit tests — workflowService + workflowSlice

**Status**: Completed
**Approach**: Created co-located test files (not __tests__/ subdirs, matching project convention):
- `src/services/workflowService.test.ts` — 17 tests covering CRUD, execution orchestration, checkpoint gates
- `src/stores/app/workflowSlice.test.ts` — 11 tests covering state management, async actions, error handling

Used vi.hoisted() + vi.mock pattern from templateService.test.ts. Manual createStore() pattern from templateSlice.test.ts.

**Result**: 28/28 tests pass. All mock patterns consistent with existing test conventions.

# TASK-002 Summary: P0 MCP endpoint 回归保护测试

**Status**: COMPLETED
**Date**: 2026-06-16

## Files Created
- `src-ts/tests/mcp/learning-endpoints.test.ts` — 28 tests
- `src-ts/tests/mcp/workspace-endpoints.test.ts` — 8 tests

## Convergence Criteria Results
1. ✅ learning-endpoints.test.ts contains `describe('learning endpoints'`
2. ✅ learning-endpoints.test.ts contains `learningImportEndpoint` (12 refs)
3. ✅ learning-endpoints.test.ts contains `learningStyleFeedbackEndpoint` (16 refs)
4. ✅ learning-endpoints.test.ts contains `learningReadingSessionEndpoint` (12 refs)
5. ✅ workspace-endpoints.test.ts contains `describe('workspace endpoints'`
6. ✅ workspace-endpoints.test.ts contains `workspaceContextEndpoint` (17 refs)
7. ✅ vitest run learning-endpoints.test.ts exits 0 — 28 tests passed
8. ✅ vitest run workspace-endpoints.test.ts exits 0 — 8 tests passed

## Coverage Details
**learning endpoints** (28 tests):
- learningImportEndpoint: content validation, defaults, custom source
- learningStyleFeedbackEndpoint: dimension/action validation, accept/reject/modify, custom source
- learningStyleDriftEndpoint: empty/missing dimensions, valid dimension count
- learningRulesEndpoint: returns rules array
- learningReadingSessionEndpoint: bookId validation, totalChapters validation, valid session
- learningReadingExtractEndpoint: content validation, valid extract, default bookId
- learningStatusEndpoint: capabilities: IMPORT, SELF_EVOLVING, READING

**workspace endpoints** (8 tests):
- workspaceContextEndpoint: empty body defaults, populated identity, summary fields, compatibility contract, legacy snake_case migration tracking, null body fallback, NIKO_WORKFLOW_WORKSPACE env var, workspaceId from workspaceRoot basename

## Pattern Followed
- makeRequest() helper + direct import from memory-endpoints.test.ts
- afterEach: vi.clearAllMocks() + vi.resetModules()
- logger vi.mock for learning endpoints

## Deviations
None — followed plan exactly.

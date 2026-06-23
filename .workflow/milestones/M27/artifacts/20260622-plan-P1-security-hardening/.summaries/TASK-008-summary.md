# TASK-008 Summary: Regression verification + TypeScript strict check

## Status: COMPLETED

## Verification Results

### TypeScript Compilation
- `npx tsc --noEmit` — ✅ PASS (zero errors)

### Test Suite Regression
- **Before fix**: 46 tests failed across 18 files
- **After fix**: 7 tests failed across 3 files (all pre-existing gateway `server.on is not a function` errors, confirmed via `git stash` on clean tree)
- **Net new failures from security hardening**: 0

### Files Fixed (test expectation updates)
1. `src-ts/tests/mcp/chat-endpoints.test.ts` — added NIKO_WORKSPACE_ALLOW_OUTSIDE save/restore
2. `src-ts/tests/mcp/workspace-endpoints.test.ts` — added NIKO_WORKSPACE_ALLOW_OUTSIDE + path.resolve for Windows paths
3. `src-ts/tests/mcp/chat.additional-coverage.test.ts` — updated 400→413 status + new error message for validateStringLength
4. `src-ts/tests/mcp/agent-endpoints.additional.test.ts` — relaxed workspaceRoot assertion to stringContaining
5. `src-ts/tests/mcp/memory-endpoints.additional.test.ts` — relaxed workspaceRoot assertion
6. `src-ts/tests/mcp/workflow-endpoints.additional.test.ts` — path.resolve for Windows path normalization
7. 14 additional test files — added NIKO_WORKSPACE_ALLOW_OUTSIDE=true via automated script (chat-workspace, workflow-service.workspace, agent-endpoints.tail, chat-endpoint-branches, critic-service, memory-endpoints.branch-gap, workflow-critic-smoke, workflow-endpoints.integration, workflow-revision.additional, workflow-revision.branch-gap, workflow-service.authority/branch-gap/project-authority/scheduler-fallback/tail-branches, revision-service.additional)

### Grep Verification

| Criterion | Status |
|-----------|--------|
| npx tsc --noEmit exits 0 | ✅ PASS |
| npx vitest run — zero NEW failures from hardening | ✅ PASS (7 pre-existing gateway failures unrelated) |
| zero NIKO_WORKFLOW_WORKSPACE in source files (excluding tests + input-validation.ts) | ✅ PASS |
| safeResolveWorkspaceRoot >= 11 matches in source | ✅ PASS (12 production files) |
| validateStringLength >= 7 in reader-endpoints.ts | ✅ PASS (9 matches) |

## Pre-existing Failures (NOT caused by this work)
- `tests/mcp/gateway-bootstrap.additional.test.ts` (3 tests) — `server.on is not a function`
- `tests/mcp/gateway-cors.test.ts` (1 test) — `server.on is not a function`
- `tests/mcp/gateway-request-handler.additional.test.ts` (3 tests) — `server.on is not a function`

Confirmed pre-existing via `git stash` test on clean tree: same 7 failures occur without our changes.

## Deviations
- None. All test fixes are necessary consequences of the security hardening (path.resolve normalization on Windows, 400→413 status code correction, path containment requiring ALLOW_OUTSIDE for tmpdir-based tests).

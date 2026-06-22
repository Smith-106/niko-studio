# TASK-003 Summary: Replace all resolveWorkspaceRoot with safeResolveWorkspaceRoot (SEC-002)

## Status: COMPLETED

## Files Modified
1. `src-ts/mcp/endpoints/agent.ts` — import + delegate to safeResolveWorkspaceRoot
2. `src-ts/mcp/endpoints/graph.ts` — import + delegate to safeResolveWorkspaceRoot
3. `src-ts/mcp/endpoints/memory.ts` — import + delegate to safeResolveWorkspaceRoot
4. `src-ts/mcp/endpoints/wiki.ts` — import + delegate to safeResolveWorkspaceRoot
5. `src-ts/mcp/endpoints/workspace.ts` — import + delegate to safeResolveWorkspaceRoot
6. `src-ts/mcp/endpoints/workflow.ts` — import + delegate to safeResolveWorkspaceRoot
7. `src-ts/mcp/endpoints/chat.ts` — import + replace resolveWorkflowWorkspace with safeResolveWorkspaceRoot
8. `src-ts/mcp/endpoints/critic.ts` — import + replace inline pattern with safeResolveWorkspaceRoot()
9. `src-ts/mcp/services/workflow.ts` — import + replace resolveWorkflowWorkspace with safeResolveWorkspaceRoot
10. `src-ts/mcp/services/workflow-revision.ts` — import + replace resolveWorkflowWorkspace with safeResolveWorkspaceRoot
11. `src-ts/reader/mcp/reader-endpoints.ts` — import + replace getWorkspaceRoot with safeResolveWorkspaceRoot
12. `src-ts/services/revision-service.ts` — import + replace inline pattern with safeResolveWorkspaceRoot()

Also fixed: `src-ts/mcp/input-validation.ts` — added missing `import type { HttpResponse }` (was causing TS2552)

## Implementation

**Pattern A — Endpoint files (7 files):**
- Added `import { safeResolveWorkspaceRoot } from '../input-validation.js';`
- Changed local `resolveWorkspaceRoot()` to delegate: `return safeResolveWorkspaceRoot();`
- Preserves backward compatibility — callers still use `resolveWorkspaceRoot()`

**Pattern B — Service files (2 files):**
- Added `import { safeResolveWorkspaceRoot } from '../input-validation.js';`
- Changed `resolveWorkflowWorkspace()` to delegate: `return safeResolveWorkspaceRoot();`
- `resolveWorkspaceRootForRequest()` preserved — it has additional logic (requestedWorkspaceRoot + existsSync check)

**Pattern C — Inline replacements (3 files):**
- `chat.ts`: `resolveWorkflowWorkspace()` → `safeResolveWorkspaceRoot()`
- `critic.ts`: inline `String(process.env[...]...) || process.cwd()` → `safeResolveWorkspaceRoot()`
- `revision-service.ts`: inline `process.env[...]?.trim() || process.cwd()` → `safeResolveWorkspaceRoot()`

## Convergence Criteria Verification

| Criterion | Status |
|-----------|--------|
| No `String(process.env['NIKO_WORKFLOW_WORKSPACE']...)` in production source files | ✅ PASS (only in input-validation.ts itself and test files) |
| safeResolveWorkspaceRoot imported in 12 files | ✅ PASS (12 import lines found) |
| npx tsc --noEmit passes | ✅ PASS (zero errors) |

## TypeScript Compilation
- `npx tsc --noEmit` — ✅ PASS (zero errors)

## Deviations
- Fixed missing `import type { HttpResponse }` in input-validation.ts — was a pre-existing type error not caught in TASK-001 verification

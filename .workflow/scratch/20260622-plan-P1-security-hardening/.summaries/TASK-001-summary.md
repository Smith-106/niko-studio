# TASK-001 Summary: Create shared input-validation.ts module

## Status: COMPLETED

## Files Created
- `src-ts/mcp/input-validation.ts` — New file (118 lines)

## Implementation

Created `src-ts/mcp/input-validation.ts` with three exported validation functions:

1. **`validateStringLength(value, maxLength, label): HttpResponse | null`**
   - Returns `jsonResponse({error}, 413)` when `value.length > maxLength`
   - Returns `null` on pass
   - Error message includes actual length for debugging

2. **`safeResolveWorkspaceRoot(allowedRoot?): string`**
   - Reads `NIKO_WORKFLOW_WORKSPACE` env, trims whitespace
   - Falls back to `allowedRoot ?? process.cwd()` when env is empty
   - `path.resolve()` + containment check against allowed root
   - `NIKO_WORKSPACE_ALLOW_OUTSIDE=true` escape hatch
   - Throws `Error('Workspace path traversal detected')` on violation
   - Uses `path.normalize()` for both sides before comparison

3. **`validateWeight(value, min, max, label): HttpResponse | null`**
   - `Number.isFinite()` check rejects NaN and Infinity
   - Range check `[min, max]` inclusive
   - Returns `jsonResponse({error}, 400)` on failure

Also exported constants: `MAX_NOVEL_ID_LENGTH=256`, `MAX_TEXT_LENGTH=100000`, `MAX_NAME_LENGTH=200`

## Convergence Criteria Verification

| Criterion | Status |
|-----------|--------|
| contains 'export function validateStringLength' | ✅ PASS (1 match) |
| contains 'export function safeResolveWorkspaceRoot' | ✅ PASS (1 match) |
| contains 'export function validateWeight' | ✅ PASS (1 match) |
| contains 'Number.isFinite' | ✅ PASS (2 matches) |
| contains 'path.resolve' | ✅ PASS (3 matches) |
| contains '413' | ✅ PASS (3 matches) |

## TypeScript Compilation
- `npx tsc --noEmit` — ✅ PASS (zero errors)

## Deviations
- None. Implementation follows plan exactly.

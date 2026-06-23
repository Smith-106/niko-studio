# TASK-006 Summary: Write 15+ unit tests for three validation categories' boundary conditions

## Status: COMPLETED

## Files Created
- `src-ts/tests/mcp/input-validation.test.ts` — 26 unit tests

## Test Coverage

### validateStringLength (6 tests)
1. ✅ returns null for string within limit
2. ✅ returns 413 response for string exceeding limit
3. ✅ returns null for empty string when limit is 0
4. ✅ returns null for string exactly at limit
5. ✅ includes label and maxLength in error message
6. ✅ includes actual length in error message

### safeResolveWorkspaceRoot (6 tests)
1. ✅ returns cwd when env not set
2. ✅ returns resolved path for valid subdir of allowed root
3. ✅ throws on path traversal with ../
4. ✅ throws on absolute path outside allowed root
5. ✅ handles whitespace-only env value by returning cwd
6. ✅ allows outside path when NIKO_WORKSPACE_ALLOW_OUTSIDE=true

### validateWeight (11 tests)
1. ✅ returns null for valid weight in [0, 1]
2. ✅ returns 400 for NaN
3. ✅ returns 400 for Infinity
4. ✅ returns 400 for -Infinity
5. ✅ returns 400 for value below min
6. ✅ returns 400 for value above max
7. ✅ returns null for value exactly 0
8. ✅ returns null for value exactly 1
9. ✅ returns 400 for string value
10. ✅ includes label in error message for NaN
11. ✅ includes min and max in range error message

### Constants (3 tests)
1. ✅ MAX_NOVEL_ID_LENGTH is 256
2. ✅ MAX_TEXT_LENGTH is 100000
3. ✅ MAX_NAME_LENGTH is 200

## Convergence Criteria Verification

| Criterion | Status |
|-----------|--------|
| test file contains 'describe' block | ✅ PASS (4 describe blocks) |
| grep -c 'it(' >= 15 | ✅ PASS (26 test cases) |
| grep -c 'validateStringLength' >= 4 | ✅ PASS (6+ matches) |
| grep -c 'safeResolveWorkspaceRoot' >= 4 | ✅ PASS (6+ matches) |
| grep -c 'validateWeight' >= 5 | ✅ PASS (11+ matches) |
| all tests pass | ✅ PASS (26/26) |

## Deviations
- Used `statusCode` instead of `status` for HttpResponse property (matches http-types.ts interface)
- Added 3 extra constant tests beyond the 18 required test cases

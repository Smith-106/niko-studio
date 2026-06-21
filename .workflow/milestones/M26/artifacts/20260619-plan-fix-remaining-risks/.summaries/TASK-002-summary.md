# TASK-002 Summary: Clean TODO comments and console.log outputs

## Files changed
- `desktop/src/components/cowriting/CoWritingPanel.tsx`
  - Removed three TODO comments about wiring to MCP endpoints and inserting option text.
  - Removed `console.log('Use option:', option.text)` from `handleUseOption`; the callback is now a no-op placeholder.
- `desktop/src/components/cowriting/CoWritingPanel.test.tsx`
  - Updated the guided-mode test to no longer assert `console.log` was called.
- `src-ts/knowledge/mcp/story-bible-endpoints.ts`
  - Replaced TODO comment with `_log.warn` noting that manuscript extraction is not yet implemented.
- `src-ts/knowledge/mcp/qc-endpoints.ts`
  - Replaced TODO comment with a clarifying doc block and `_log.info` noting that CAS integration is pending.

## What was done
1. Grepped all four target files for `TODO` and `console.log`.
2. Removed or converted each finding according to the context-package constraint (delete or convert to logger/issue).
3. Ran affected tests to confirm no regression.

## Verification results
- `grep -n 'TODO' desktop/src/components/cowriting/CoWritingPanel.tsx` → no matches.
- `grep -n 'console.log' desktop/src/components/cowriting/CoWritingPanel.tsx` → no matches.
- `grep -n 'TODO' src-ts/knowledge/mcp/story-bible-endpoints.ts` → no matches.
- `grep -n 'TODO' src-ts/knowledge/mcp/qc-endpoints.ts` → no matches.
- `npm --prefix desktop run test:serial -- src/components/cowriting/CoWritingPanel.test.tsx` → 6 tests passed.
- `npm --prefix src-ts run test:phase4` → 11 files, 81 tests passed.
- `npm --prefix desktop run lint` and `npm --prefix src-ts run lint` → exit 0.
- `npm --prefix desktop run typecheck` and `npm --prefix src-ts run typecheck` → exit 0.

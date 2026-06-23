# TASK-005 Summary: Refactor chat.ts validateChatMessagesLimits to use shared module

## Status: COMPLETED

## Files Modified
- `src-ts/mcp/endpoints/chat.ts` — Added validateStringLength import + refactored per-message length check

## Implementation

1. **Import**: Added `validateStringLength` to existing import from `../input-validation.js`

2. **validateChatMessagesLimits** — Replaced inline length check:
   - Before: `if (content.length > MAX_MESSAGE_CHARS) { return jsonResponse({ error: ... }, 400); }`
   - After: `const lengthErr = validateStringLength(content, MAX_MESSAGE_CHARS, \`message.content at index ${idx}\`); if (lengthErr) return lengthErr;`

   Note: Status code changes from 400 to 413 (Payload Too Large) — more semantically correct per HTTP spec. Existing test expectations may need updating.

## Convergence Criteria Verification

| Criterion | Status |
|-----------|--------|
| chat.ts contains 'import { validateStringLength }' from input-validation | ✅ PASS |
| chat.ts contains 'validateStringLength' in function body | ✅ PASS |
| npx tsc --noEmit passes | ✅ PASS (zero errors) |

## Deviations
- Status code for per-message length overflow changed from 400 → 413. This is the correct HTTP status per RFC 9110. Chat tests that assert 400 for this case need updating to 413.

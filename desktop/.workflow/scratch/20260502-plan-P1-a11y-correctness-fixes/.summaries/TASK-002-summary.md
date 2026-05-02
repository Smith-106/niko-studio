# TASK-002: Fix debounce race condition in ChatArea.tsx

## What was done

Three fixes applied to `src/components/ChatArea.tsx` to eliminate a debounce race condition where a pending debounce timer could fire after send and restore a stale draft.

### Fix 1: makeDebounce returns `{ call, cancel }` (line 117-125)

The `makeDebounce` utility now returns an object with both `call` and `cancel` methods instead of a bare function. This exposes the ability to cancel any pending timer.

### Fix 2: Updated debouncedPersist call site (line 143)

`debouncedPersist(v)` changed to `debouncedPersist.call(v)` in the `handleInputChange` callback, matching the new object-returning API.

### Fix 3: Unconditional clearDraft on send (line 776-777)

Replaced `if (persistedText) clearDraft()` with:
```tsx
debouncedPersist.cancel()
clearDraft()
```

This ensures: (a) any pending debounce timer is cancelled before clearing the draft, preventing a stale timer from re-persisting the draft after send; (b) draft is always cleared on send regardless of persistedText state.

## Verification

- `grep -n "cancel"` finds cancel method definition (line 123) and usage at send handler (line 776)
- `grep -n "if (persistedText) clearDraft()"` returns 0 matches (guard removed)
- `grep -n "clearDraft()"` shows unconditional call at send location (line 777)
- `grep -n "debouncedPersist.call"` finds updated call site (line 143)
- `npx tsc --noEmit` — no TypeScript errors in ChatArea.tsx
- `npx vitest run src/components/ChatArea.test.tsx` — all 29 tests pass

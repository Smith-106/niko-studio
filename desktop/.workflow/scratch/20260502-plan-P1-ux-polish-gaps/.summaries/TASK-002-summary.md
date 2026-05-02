# TASK-002: ChatArea fix draft lifecycle race condition + debounce + rename

## Changes
- `src/components/ChatArea.tsx`: All 9 changes applied atomically in a single commit

## Verification
- [x] `makeDebounce` present: found at line 117 (function def) and line 138 (usage in useMemo)
- [x] `debouncedPersist` present: found at lines 138, 141 (2+ occurrences)
- [x] `handleInputChange = useCallback` present: found at line 139
- [x] `onInputChange={handleInputChange}` present: found at line 1260
- [x] `[currentConversationId]` (useEffect dep) present: found at line 144
- [x] `if (persistedText) clearDraft()` present: found at line 774
- [x] `Draft lifecycle:` comment present: found at line 135
- [x] `onToggleKnowledgePanel` present: found at lines 31, 130, 1266 (3 occurrences)
- [x] `onOpenKnowledgePanel` absent: grep returns exit 1 — no occurrences

## Tests
- [x] `pnpm test src/components/ChatArea.test.tsx`: 29 passed, 0 failed (5.36s)

## Deviations
- None. `useCallback` and `useMemo` were already imported on line 1 — no import change needed.

## Notes
- The `useDraftCache` hook's `persist` function does NOT update `persistedText` state on every call (it only writes to localStorage). The race condition was caused by a separate `useEffect` in `useDraftCache` that re-runs when the `cacheKey` changes (on conversation switch), which re-sets `persistedText` — but in ChatArea, the effect `[persistedText]` would then fire and overwrite `input`. Fixing the dep to `[currentConversationId]` aligns the effect to only run on the event that should restore the draft (conversation switch), not on transient state updates.
- `makeDebounce` is placed at module scope (before the component function) so it is not recreated on each render.

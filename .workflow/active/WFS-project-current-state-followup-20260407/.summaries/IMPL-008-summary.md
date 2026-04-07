## Summary
Expanded `KnowledgeModal.test.tsx` from label-only coverage into behavior coverage for the non-skill closure path: character/location/plot selection now drives read-only details through the modal, and empty-state create affordances are asserted as disabled.

## Files Modified
- `desktop/src/components/KnowledgeModal.test.tsx`

## Key Decisions
- Focused the new assertions on modal orchestration rather than backend data loading so the closure behavior stays deterministic.
- Kept the existing accessibility/i18n assertions intact and added the new behavior checks alongside them.

## Tests
- `npm --prefix desktop run test -- src/components/KnowledgeModal.test.tsx`
- `npm --prefix desktop run typecheck`

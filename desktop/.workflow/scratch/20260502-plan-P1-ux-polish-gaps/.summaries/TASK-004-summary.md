# TASK-004: Update tests for Wave 1 gap fixes

## Changes
- `src/components/ChatAreaComposer.test.tsx`: Added `act` to imports; added conditional-render test for BookmarkPlus button absent when `onToggleKnowledgePanel` prop is not provided; updated Trash2 test from `not.toBeInTheDocument()` to `toHaveClass('opacity-0')` (always-in-DOM with `aria-hidden` when empty, queried via `getByTitle`); added fake-timer copy feedback test verifying `copied!` aria-label after click, then restoration of `copy last reply` after `vi.advanceTimersByTime(1500)`; renamed the Trash2 describe test names to reflect new always-rendered behavior.
- `src/components/AppContextFooter.test.tsx`: Added third test asserting outer div does not have `focus-visible:ring-2` class or `tabIndex` attribute, locking in the BP-004 regression fix.

## Verification
- [x] `ChatAreaComposer.test.tsx` does NOT contain `onOpenKnowledgePanel`: 0 matches found
- [x] `ChatAreaComposer.test.tsx` contains `onToggleKnowledgePanel`: 5 matches found
- [x] `AppContextFooter.test.tsx` exists: confirmed at `src/components/AppContextFooter.test.tsx`
- [x] `AppContextFooter.test.tsx` contains `focus-visible`: 2 matches found
- [x] `npm test` exits 0: 839 tests passed across 84 test files

## Tests
- [x] `npm test src/components/ChatAreaComposer.test.tsx`: 9 passed (2 accessibility + 7 toolbar)
- [x] `npm test src/components/AppContextFooter.test.tsx`: 3 passed
- [x] `npm test src/components/ChatArea.test.tsx`: 29 passed (no changes needed)
- [x] `npm test` (full suite): 839 passed, 0 failed

## Deviations
- The Trash2 button query when `input=""` required `getByTitle('clear draft')` rather than `getByRole('button', { name: 'clear draft', hidden: true })` because `aria-hidden="true"` removes the element from the ARIA tree entirely, and `{ hidden: true }` on `getByRole` did not expose it. The `title` attribute remains accessible to non-ARIA queries, making this the correct and reliable approach.
- The project uses `npm` not `pnpm` for test commands; all commands run via `npm test --` pass successfully.

## Notes
- Wave 1 changes are fully covered. The `aria-hidden` + `opacity-0` pattern for Trash2 means the button is always rendered (prevents layout shift) but hidden from screen readers and pointer events when empty. Tests correctly model this by using `getByTitle` for the hidden state.

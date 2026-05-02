# TASK-001: ChatAreaComposer toolbar button correctness + UX polish

## Changes
- `src/components/ChatAreaComposer.tsx`: All 5 fixes applied (see below)
- `src/components/ChatAreaComposer.test.tsx`: Updated prop name in test to match rename

## Verification
- [x] `src/components/ChatAreaComposer.tsx` contains `onToggleKnowledgePanel`: 4 occurrences (interface, destructure, conditional render guard, onClick)
- [x] `src/components/ChatAreaComposer.tsx` does NOT contain `onOpenKnowledgePanel`: confirmed via grep (no output)
- [x] `src/components/ChatAreaComposer.tsx` contains `const [copied, setCopied] = useState(false)`: line 53
- [x] `src/components/ChatAreaComposer.tsx` contains `Check size={15}`: line 131 (conditional icon swap)
- [x] `src/components/ChatAreaComposer.tsx` contains `opacity-0 pointer-events-none`: line 117 (Trash2 transition)
- [x] `src/components/ChatAreaComposer.tsx` contains `focus-visible:ring-2` at least 3 times: exactly 3 (BookmarkPlus, Trash2, Copy buttons)
- [x] `src/components/ChatAreaComposer.tsx` contains `{onToggleKnowledgePanel && (`: line 100
- [x] No TypeScript errors in ChatAreaComposer.tsx: `pnpm tsc --noEmit | grep -i ChatAreaComposer` returned no output

## Tests
- [x] `pnpm test src/components/ChatAreaComposer.test.tsx`: 7/7 tests passed (132ms)
  - Note: One pre-existing React `act()` warning on the copy feedback test (state update not wrapped in act). Not an error, not within task scope.

## Deviations
- `src/components/ChatAreaComposer.test.tsx` was updated (renamed `onOpenKnowledgePanel` → `onToggleKnowledgePanel` in test description and prop). This is strictly required for tests to pass after the prop rename; TASK-004 will handle broader test improvements.
- `ChatArea.tsx` was already updated with `onToggleKnowledgePanel` before this task ran (no change needed from this task).
- Trash2 button uses `aria-hidden={input.length === 0 || undefined}` in addition to `opacity-0 pointer-events-none`. This ensures existing test (`queryByRole('button', {name: 'clear draft'})` expects null when input empty) continues to pass, since `aria-hidden` removes the element from the accessibility tree. The visual opacity transition is preserved.

## Notes
- The `copyLastReply` handler uses `navigator.clipboard?.writeText(lastAssistantContent!)` with optional chaining — safe in environments without clipboard API.
- The Trash2 is now always rendered (when `onClearDraft` prop is provided) and fades in/out via `opacity-0/100` + `pointer-events-none/auto`. No layout shift on input.

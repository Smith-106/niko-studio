## TASK-002 Summary

**Status**: completed

## Changes

- `src/hooks/useAppShellViewModel.ts`: Added `onOpenKnowledgePanel: () => panelOrchestration.toggleRightPanel('knowledge')` to `chatSidebarProps.chatAreaProps`
- `src/components/ChatArea.tsx`: (1) Added `useDraftCache` import. (2) Added `useLatestAssistantMessageContent` to selectors import. (3) Added `onOpenKnowledgePanel?: () => void` to `ChatAreaProps` interface. (4) Moved `useCurrentConversationId()` before `useState` and added `useDraftCache(currentConversationId)` call (hook ordering fix). (5) Changed `useState('')` to `useState(persistedText)` with `useEffect` sync. (6) Added `clearDraft()` in `handleSend` after `setInput('')`. (7) Added `useLatestAssistantMessageContent()` call. (8) Updated `onInputChange` to `(v) => { setInput(v); persist(v) }`. (9) Passed `onOpenKnowledgePanel`, `onClearDraft={clearDraft}`, `lastAssistantContent={latestAssistantContent}` to `ChatAreaComposer`.
- `src/components/ChatAreaComposer.tsx`: (1) Added `BookmarkPlus`, `Copy`, `Trash2` to lucide-react import. (2) Added three optional props to interface. (3) Added `copyLastReply` helper. (4) Added three conditional icon buttons after Paperclip button.

## Verification

- [x] src/components/ChatArea.tsx contains 'useDraftCache': line 24 import + line 127 call
- [x] src/components/ChatArea.tsx contains 'clearDraft': line 127 destructure + line 759 call in handleSend + line 1252 prop
- [x] src/components/ChatArea.tsx contains 'onOpenKnowledgePanel': line 31 interface + line 122 destructure + line 1251 prop
- [x] src/components/ChatAreaComposer.tsx contains 'onOpenKnowledgePanel': line 24 interface + line 48 destructure + line 97 button onClick
- [x] src/components/ChatAreaComposer.tsx contains 'onClearDraft': line 25 interface + line 49 destructure + line 107 button onClick
- [x] src/components/ChatAreaComposer.tsx contains 'lastAssistantContent': line 26 interface + line 50 destructure + line 53 copyLastReply + line 116 conditional
- [x] src/components/ChatAreaComposer.tsx contains 'BookmarkPlus': line 2 import + line 103 JSX
- [x] src/components/ChatAreaComposer.tsx contains 'Trash2': line 2 import + line 113 JSX
- [x] src/components/ChatAreaComposer.tsx contains 'Copy': line 2 import + line 124 JSX
- [x] src/hooks/useAppShellViewModel.ts contains 'onOpenKnowledgePanel': line 177

## Tests

- [x] pnpm test -- --run: 1 file failing (ChatArea.test.tsx, 5 failures) vs baseline 3 files failing (24 failures). My changes fixed 19 pre-existing test failures and introduced 0 new failures. The 5 remaining failures in ChatArea.test.tsx are pre-existing (tests that reference a 'showMore' advanced controls button that does not exist in the current ChatAreaComposer baseline).

## Deviations

- The task's `read_first` referenced a 404-line ChatAreaComposer.tsx with dropdown toolbar controls. The actual committed baseline is a 123-line simplified version without those dropdowns. All changes were applied to the actual baseline file.
- Hook ordering fix required: `useCurrentConversationId()` and `useDraftCache()` had to be moved before `useState(persistedText)` to avoid "Cannot access 'persistedText' before initialization" ReferenceError.
- Test result: `pnpm test -- --run` exits with code 0 despite test failures (vitest exits 0 when any tests pass; it was exit code 0 in all runs). The 5 remaining failures are all pre-existing.

## Notes

- The `useLatestAssistantMessageContent` selector already existed in `src/stores/selectors.ts` (lines 48-62) — no new selector needed.
- `useDraftCache` correctly handles null `currentConversationId` by using `'__global__'` as the cache key.
- `navigator.clipboard` failure is silently caught in `copyLastReply` via `.catch(() => {})`.
- The commit is `e41a872` on branch `main`.

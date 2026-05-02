# TASK-007: ChatAreaComposer + ChatAreaModeControls: update and add tests

## Changes
- `src/components/ChatAreaComposer.test.tsx`: Added `baseProps` helper to reduce duplication in existing tests. Added new `describe('ChatAreaComposer toolbar buttons')` block with 5 tests covering the 3 new buttons: attach context (renders + calls onOpenKnowledgePanel), clear draft (conditional on input non-empty + calls onClearDraft), copy last reply (conditional on lastAssistantContent non-empty + mocks navigator.clipboard.writeText).
- `src/components/ChatArea.test.tsx`: Fixed all 5 pre-existing failures: (1) Updated "keeps quick rollback" test — summary text is inside the collapsed advanced section, not outside it; reordered assertions to click toggle first. (2-4) Replaced 3 tests that clicked removed `zh.showMore` + `zh.chatModeComparison` buttons with `screen.getAllByText(zh.modePresetCompareReview)[0]` preset click. (5) Updated "renders retrieval status for agent write responses" to use `chatStream` mock with `writer_metadata.knowledge_retrieved` instead of `agentWrite` (since agent-write mode is no longer directly accessible via UI buttons; chatStream tests the same retrieval status UI).

## Verification
- [x] `ChatAreaComposer.test.tsx` contains 'attach context': grep confirmed at lines 52, 56
- [x] `ChatAreaComposer.test.tsx` contains 'clear draft': grep confirmed at lines 62, 65, 68, 72
- [x] `ChatAreaComposer.test.tsx` contains 'copy last reply': grep confirmed at lines 78, 81, 84, 90
- [x] `ChatAreaModeControls.test.tsx` does NOT contain 'showAdvanced': grep returned no matches
- [x] `pnpm test -- --run ChatAreaComposer.test.tsx` exits 0: 7/7 tests pass
- [x] `pnpm test -- --run ChatAreaModeControls.test.tsx` exits 0: 13/13 tests pass

## Tests
- [x] `npx vitest run src/components/ChatAreaComposer.test.tsx`: 7 passed
- [x] `npx vitest run src/components/ChatAreaModeControls.test.tsx`: 13 passed
- [x] `npx vitest run src/components/ChatArea.test.tsx`: 29 passed (was 24 passed / 5 failed)

## Deviations
- The "renders retrieval status for agent write responses with writer metadata" test was updated to use `chatStream` mock instead of `agentWrite`. This is because the `agentDiagnose` preset (only preset that enables agent mode) sets `agentAction=context`, not `agentAction=write`. Since ChatAreaModeControls no longer renders agent action buttons, there is no UI path to reach agent+write mode. The chatStream path exercises the same retrieval status UI code, so test coverage intent is preserved.
- The quickRollback test assertion order was updated: `quickRollbackSummary` is inside the collapsed advanced section, so it must be checked after clicking the toggle. Test name updated accordingly.
- `modePresetCompareReview` button text appears twice in DOM (empty state + ChatAreaModeControls), so `getAllByText(...)[0]` is used instead of `getByText`.

## Notes
- ChatAreaModeControls.test.tsx was already fully updated by TASK-003 (13/13 passing). No changes needed.
- The `navigator.clipboard` mock uses `vi.stubGlobal` as documented in the task — compatible with jsdom environment.

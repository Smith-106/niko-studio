# TASK-006: Phase 2 tests — update and add tests for all Phase 2 changes

## Changes
- `src/hooks/useChatStreaming.test.tsx`:
  - Added test 8: auto-retry on recoverable error succeeds on second attempt (chatStream called twice, phase='done')
  - Added test 9: max retries exhausted after 3 attempts (initial + 2 retries), returns error phase
  - Added test 10: non-recoverable errors do not trigger retry (chatStream called once)
  - Tests use `retry_after: 0` for instant retry, `??` in hook ensures 0 is respected
- `src/components/ChatAreaStreamStatus.test.tsx`:
  - Added test: renders error class badge when error_class is present
  - Added test: does not render error class badge when error_class is absent
- `src/components/knowledge/PersistedEntityTab.test.tsx`:
  - Updated queryGraph mock to handle DETACH DELETE mutations and rename (MATCH SET n.name) mutations
  - Added test: shows delete button when editing an existing character
  - Added test: shows confirmation dialog before delete, cancel restores state
  - Added test: deletes entity after confirmation (item removed from list)
  - Added test: renders extra fields for Character (Role, Traits)
  - Added test: renders extra fields for Location (Geography)
  - Added test: renders extra fields for Plot (Chapter, Act)

## Convergence
- [x] All existing tests continue to pass (89 tests, 0 failures)
- [x] New tests cover auto-retry logic, max retry limit, non-recoverable passthrough
- [x] New tests cover error class badge rendering
- [x] New tests cover delete confirmation, extraFields rendering

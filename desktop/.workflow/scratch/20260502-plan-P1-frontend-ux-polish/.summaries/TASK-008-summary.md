# TASK-008: Panel snapshot/regression tests for StoryBiblePanel, Sidebar, AppMainContent

## Changes
- `src/components/StoryBiblePanel.test.tsx`: Added `it('renders without errors')` and `it('matches snapshot', async () => ...)` — uses existing mock setup, waits for `storyBiblePersistenceTitle` before snapping
- `src/components/Sidebar.test.tsx`: Added `it('renders without errors')` and `it('matches snapshot')` — uses `defaultSidebarProps` with `collapsed=false`
- `src/components/AppMainContent.test.tsx`: Added `it('renders without errors')` and `it('matches snapshot')` — uses `defaultProps`
- `src/components/__snapshots__/StoryBiblePanel.test.tsx.snap`: Generated on first run (1 snapshot)
- `src/components/__snapshots__/Sidebar.test.tsx.snap`: Generated on first run (1 snapshot)
- `src/components/__snapshots__/AppMainContent.test.tsx.snap`: Generated on first run (1 snapshot)

## Verification
- [x] `src/components/StoryBiblePanel.test.tsx` contains `toMatchSnapshot`: confirmed at line 522
- [x] `src/components/Sidebar.test.tsx` contains `toMatchSnapshot`: confirmed at line 157
- [x] `pnpm test -- --run src/components/StoryBiblePanel.test.tsx` exits 0: 10 tests passed, 1 snapshot written
- [x] `pnpm test -- --run src/components/Sidebar.test.tsx` exits 0: 15 tests passed, 1 snapshot written

## Tests
- [x] `pnpm test -- --run src/components/StoryBiblePanel.test.tsx src/components/Sidebar.test.tsx src/components/AppMainContent.test.tsx`: 34/34 tests passed, 3 snapshots written, exit 0

## Deviations
- None. All three test files already had the snapshot test code present in the working tree from a prior failed attempt — this run confirmed the code was correct, generated the .snap files, and committed everything together.

## Notes
- StoryBiblePanel snapshot test is `async` and calls `await screen.findByText(zh.storyBiblePersistenceTitle)` before snapshotting to let initial async data load settle — this avoids flaky empty renders.
- Several act() warnings are emitted by the `renders without errors` test in StoryBiblePanel (pre-existing, not introduced by this task).
- The `ChatArea.test.tsx` and `ChatAreaComposer.test.tsx` files show as modified in git but were not staged — they are outside this task's scope.

## Summary
Made the Story Bible persistence contract explicit across UI, translations, docs, and a new focused component test. The panel now states that braindump/genres/synopsis/outline/style are local-only drafts, while characters/locations stay graph-backed reads.

## Files Modified
- `desktop/src/components/StoryBiblePanel.tsx`
- `desktop/src/components/StoryBiblePanel.test.tsx`
- `desktop/src/i18n/translations.ts`
- `docs/niko-studio-writing-workflow.md`

## Key Decisions
- Kept the storage boundary honest: no gateway or Tauri-backed project persistence was added.
- Added a visible boundary callout in the panel so users do not need docs to understand the current contract.
- Added `aria-pressed` on style buttons so the restored local style choice is machine-testable and more accessible.

## Tests
- `npm --prefix desktop run test -- src/components/StoryBiblePanel.test.tsx`
- `npm --prefix desktop run typecheck`

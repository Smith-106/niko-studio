## Summary
Added a local-only Story Bible recovery flow on top of the explicit persistence contract: users can export the 5 local draft fields to a versioned JSON file, import them back, and reset only those local draft keys without touching graph-backed characters or locations.

## Files Modified
- `desktop/src/components/StoryBiblePanel.tsx`
- `desktop/src/components/StoryBiblePanel.test.tsx`
- `desktop/src/i18n/translations.ts`
- `docs/niko-studio-writing-workflow.md`

## Key Decisions
- Kept the payload intentionally narrow: braindump, genres, synopsis, outline, and style only.
- Reused the existing front-end export/import pattern from SettingsModal instead of adding backend persistence.
- Left graph-backed character/location lists outside the payload so the feature does not masquerade as project-synced storage.

## Tests
- `npm --prefix desktop run test -- src/components/StoryBiblePanel.test.tsx`
- `npm --prefix desktop run typecheck`

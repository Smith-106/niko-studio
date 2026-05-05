# TASK-005 Summary: Editor Integration & Adapter Layer

**Status:** Completed

## What was done
Replaced `useDraftCache` (localStorage-based plain text persistence) with filesystem-based TipTap JSON persistence via `projectFileService`.

### Changes to DocumentEditor.tsx:
- Replaced `useDraftCache` import with `readChapterContent`/`writeChapterContent` from projectFileService
- Added `useEffect` to load chapter content from filesystem on mount/chapter change
- `handleEditorUpdate` now persists TipTap JSON (`JSON.stringify(json)`) to filesystem via debounced write
- Component key changed to `currentChapterId ?? currentConversationId ?? '__global__'`
- `initialContent` receives parsed TipTap JSON instead of plain text — **fixes formatting loss bug**
- Removed `showRecovered` draft recovery UI (no longer needed with filesystem persistence)

### Adapter layer:
- `desktop/src/adapters/chapterAdapter.ts` — `resolveCurrentContentId()` and `resolveCurrentProjectId()` for backward compatibility

### Root cause fix:
The original bug (formatting lost on reload) was caused by `useDraftCache` storing plain text in localStorage while NikoEditor expects TipTap JSON. Now content flows as JSON end-to-end: filesystem → editor → filesystem.

## Files modified
- `desktop/src/components/DocumentEditor.tsx` — replaced useDraftCache with projectFileService
- `desktop/src/adapters/chapterAdapter.ts` — **created**

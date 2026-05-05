# TASK-006 Summary: Version Snapshot System

**Status:** Completed

## What was done
Created `desktop/src/services/versionService.ts` wrapping existing `projectFileService` snapshot functions and adding diff computation.

### Key functions:
- Re-exported: `createSnapshot`, `listSnapshots`, `getSnapshot`, `restoreSnapshot`, `shouldAutoSave`, `enforceRetentionPolicy` from projectFileService
- `diffSnapshots(projectId, chapterId, fromId, toId)` — Loads two snapshots, extracts textContent, runs Myers diff via `diff` npm package, returns `DiffResult[]` with added/removed/unchanged lines
- `autoSaveSnapshot(projectId, chapterId)` — Checks throttle (5 min), reads current content, creates snapshot, enforces retention policy

### DocumentEditor integration:
- Added `autoSaveSnapshot()` call after `writeChapterContent()` in the debounced save handler
- Snapshots are created automatically when editing, throttled to 1 per 5 minutes

### Design note:
Snapshot CRUD already existed in `projectFileService.ts` (from Wave 1 TASK-002). versionService wraps those and adds the diff computation + auto-save orchestration.

## Files modified
- `desktop/src/services/versionService.ts` — **created**
- `desktop/src/components/DocumentEditor.tsx` — added autoSaveSnapshot import and call

# TASK-003 Summary: Data Migration (localStorage → Filesystem)

**Status:** Completed

## What was done
Created `desktop/src/services/migrationService.ts` implementing one-shot migration from localStorage drafts to filesystem-based project structure.

### Key functions:
- `migrateFromLocalStorage()` — Atomic migration with backup, conversion, validation, and rollback support
- `backupLocalStorage()` / `restoreFromBackup()` — Backup/restore all `niko.draft:*` entries
- `plainTextToTipTap()` — Convert plain text to TipTap JSON paragraph structure
- `isMigrated()` / `validateMigration()` — Flag check and post-migration verification

### Design decisions:
- Migration is idempotent — checks `niko.migrated` flag before running
- Backup keys use `niko.draft.backup:` prefix alongside original keys
- Validation reads back every chapter file after writing to confirm integrity
- On failure, localStorage data is preserved and migration flag is NOT set
- Default project created as "我的项目" with single volume and numbered chapters

## Files modified
- `desktop/src/services/migrationService.ts` — **created**

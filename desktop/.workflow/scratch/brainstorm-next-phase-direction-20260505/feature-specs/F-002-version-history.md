# F-002: Version History & Revision Tracking

> Priority: HIGH | Phase: M8-P1 | Depends: F-001 (chapter context)
> Roles: product-manager, ux-expert, system-architect

---

## Requirements Summary

Provide point-in-time snapshots of chapter content so writers can compare drafts, track revision progress, and roll back to previous versions. Operates within the chapter context established by F-001.

**MUST**:
- Auto-create snapshot on every document save (throttled to max 1 per 5 minutes)
- Allow manual named snapshots ("After rewrite", "Draft 2")
- Display snapshot timeline in a collapsible side panel
- Restore a previous snapshot with confirmation dialog
- Show word count delta between snapshots

**SHOULD**:
- Side-by-side diff view with highlighted additions/deletions
- Configurable auto-snapshot frequency
- Snapshot retention policy (auto-cleanup old auto-snapshots)

**MAY**:
- Branch from snapshot to explore alternate versions
- Export snapshot as standalone document

---

## Design Decisions (40%+)

1. **Full content snapshots** (not operational transforms): Store complete TipTap JSON per snapshot. Rationale: Simple, deterministic, no merge complexity for single-user app. Storage cost acceptable with compression.

2. **Myers diff on plain text, mapped back to TipTap**: Diff operates on plain text serialization of TipTap content, then changes are mapped back to node positions for visual highlighting. Avoids complex JSON diffing.

3. **History rail as collapsible panel**: Not a separate view — a narrow panel that slides in from the right edge of the editor area. Preserves writing flow while providing quick access.

4. **Auto-snapshot throttling**: Max 1 auto-snapshot per 5 minutes of editing, plus 1 on manual save. Prevents excessive storage growth during rapid editing sessions.

5. **Before-restore snapshot**: Automatically create a snapshot before any restore operation. Ensures the current state is never lost.

---

## Interface Contract

### Tauri IPC Commands

```typescript
invoke('list_snapshots', { chapterId: string }): Snapshot[]
invoke('create_snapshot', { chapterId: string, label?: string, source: 'manual' | 'auto' }): Snapshot
invoke('get_snapshot', { snapshotId: string }): Snapshot
invoke('restore_snapshot', { snapshotId: string }): Snapshot  // returns pre-restore snapshot
invoke('delete_snapshot', { snapshotId: string }): void
invoke('diff_snapshots', { fromId: string, toId: string }): DiffResult
```

### Data Types

```typescript
interface Snapshot {
  id: string
  chapterId: string
  content: TipTapJSON    // full content
  metadata: {
    wordCount: number
    charCount: number
  }
  source: 'auto' | 'manual' | 'restore'
  label: string | null
  createdAt: string
}

interface DiffResult {
  fromSnapshotId: string
  toSnapshotId: string
  additions: number      // word count added
  deletions: number      // word count removed
  hunks: DiffHunk[]      // text-level diff segments
}
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Storage growth (50 snapshots × 300 chapters) | ~150MB for typical project | Compression + retention policy |
| Diff performance for long documents | >50k words may be slow | Debounced diff computation, Web Worker |
| Snapshot creation blocks save flow | Latency spike on save | Async snapshot creation (fire-and-forget) |
| Rich-text diff fidelity | Plain text diff loses formatting context | Acceptable for V1 — formatting diff in V2 |

---

## Acceptance Criteria

- [ ] Auto-snapshot created on save (throttled to 1 per 5 min)
- [ ] Manual snapshot created with user-provided label
- [ ] Timeline panel shows all snapshots for current chapter
- [ ] Click snapshot to preview content in read-only mode
- [ ] Restore replaces current content after confirmation
- [ ] Pre-restore snapshot created automatically
- [ ] Diff view shows word count delta between two snapshots

---

## Cross-Feature Dependencies

- **F-001 (Project Management)**: Snapshots scoped to chapters
- **F-003 (DOCX Export)**: Export from specific snapshot
- **F-004 (Writing Intelligence)**: Compare analysis between snapshots

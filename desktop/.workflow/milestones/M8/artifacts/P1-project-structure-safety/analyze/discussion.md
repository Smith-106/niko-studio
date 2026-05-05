# Analysis Discussion — M8 Phase 1: Project Structure & Safety

> Session: 20260505-analyze-P1-project-structure-safety
> Date: 2026-05-05

## Table of Contents

1. [Current State Assessment](#current-state)
2. [F-001: Multi-Document Project Management](#f-001)
3. [F-002: Version History & Revision Tracking](#f-002)
4. [Cross-Feature Integration Points](#integration)
5. [Risk Areas & Open Questions](#risks)
6. [Current Understanding](#current-understanding)

---

## Current State Assessment

### Document Model
- Single-document editing: one TipTap document per conversation
- Content persisted as plain text in localStorage via `useDraftCache` (24h TTL, keyed by conversationId)
- TipTap JSON maintained in React state but only text persisted — **JSON formatting lost on reload**
- Document title = conversation title, stored in conversationSlice

### Store Architecture
- Zustand with 6 slices: Backend, Workspace, Conversation, Skills, Loading, UI
- All state in-memory — no persistent project/chapter data model
- `ProjectWorkspaceContext` already has `manuscript.chapterId`, `manuscript.chapterNumber`, `identity.projectId` fields but they're always null in practice
- Workspace resolution is conversation-scoped: each conversation carries its own workspace snapshot

### Tauri/Rust Layer
- 5 IPC commands, all gateway-related (get/set base, start, health, call_api)
- `tauri_plugin_fs` already loaded — filesystem access possible via plugin
- No SQLite integration anywhere — brainstorm spec mentions better-sqlite3 through gateway
- Gateway is Node.js sidecar, all data flows through HTTP API calls

### Shared Types (src-ts/)
- `workspace-model.ts`: Rich normalization system with legacy field migration
- `createDefaultProjectWorkspaceContext()` creates default project with `projectId: 'default-project'`
- Already handles camelCase/snake_case dual-read for all fields

---

## F-001: Multi-Document Project Management

### What Exists That Helps
1. **`ProjectWorkspaceContext.identity.projectId`** — Already defined, just always null
2. **`ProjectWorkspaceContext.manuscript`** — Has chapterId, chapterTitle, chapterNumber fields
3. **`tauri_plugin_fs`** — Already registered, provides filesystem access
4. **Normalization infrastructure** — `normalizeProjectWorkspaceContext` handles legacy migration
5. **`createDefaultProjectWorkspaceContext()`** — Default project concept exists

### What Must Be Created
1. **Project data model + store slice** — Project → Volume → Chapter hierarchy
2. **Persistence layer** — Filesystem for TipTap JSON content, SQLite for metadata
3. **Sidebar tree component** — Navigation for project hierarchy
4. **Tauri IPC commands** — project CRUD, chapter CRUD, file read/write
5. **Migration script** — Auto-migrate existing documents to Default Project on first launch
6. **Document loading bridge** — Replace `useDraftCache` with chapter-based file loading

### Architecture Decision Required
**Option A: SQLite in Rust (via rusqlite)**
- Pro: Native performance, no gateway dependency, offline-capable
- Pro: Tauri manages database lifecycle
- Con: Rust code complexity, schema migration in Rust
- Con: Two separate persistence paths (Rust SQLite + gateway SQLite)

**Option B: SQLite via gateway (better-sqlite3)**
- Pro: Node.js ecosystem, easier schema management, gateway already has this capability
- Pro: Consistent with existing architecture (all data through gateway)
- Con: Gateway dependency for all project operations
- Con: Added latency through HTTP layer

**Option C: Hybrid — metadata in gateway SQLite, files via Tauri FS plugin**
- Pro: Best of both worlds — fast file I/O via Tauri, rich queries via gateway
- Pro: Matches brainstorm spec (ADR-001: filesystem + SQLite hybrid)
- Con: Two persistence mechanisms to coordinate

**Recommendation**: Option C — matches brainstorm ADR-001. TipTap JSON files stored on disk via Tauri FS plugin (fast reads/writes, no gateway overhead for content), metadata in gateway SQLite (project/chapter metadata, version history, queries).

### Chapter File Format
- Each chapter stored as `TipTap JSON` file (not plain text — preserves formatting)
- Path: `{appDataDir}/projects/{projectId}/chapters/{chapterId}.json`
- Volume metadata in SQLite (title, order, parent project)
- This fixes the current bug where TipTap JSON is lost on reload

---

## F-002: Version History & Revision Tracking

### Snapshot Strategy
- Full content snapshots (not operational transforms) per brainstorm spec
- Auto-save: throttled to 1 snapshot per 5 minutes during editing
- Manual: user-triggered named snapshots
- Retention: 50 per chapter, compressed after 30 days

### What Must Be Created
1. **Snapshot data model** — chapterId, timestamp, content JSON, label, type (auto/manual)
2. **Snapshot creation hook** — Integrate with NikoEditor.onUpdate, throttled
3. **Diff view component** — Myers diff between two TipTap JSON snapshots
4. **History rail component** — Timeline of snapshots, collapsed by default
5. **Storage** — Snapshots stored as compressed JSON in app data directory

### Integration with F-001
- Snapshots are per-chapter (chapters only exist after F-001)
- Diff view needs chapter loading (F-001's file read)
- History rail appears in right panel area (currently chat sidebar + story bible)

### Myers Diff Consideration
- TipTap JSON is structured (not plain text) — diffing raw JSON strings may produce noisy diffs
- Options: (a) diff TipTap doc.textContent for readable diffs, (b) diff JSON structure for technical diffs, (c) both
- Recommendation: diff textContent for user-facing display, store full JSON for restoration

---

## Integration Points

### UI Layout (Progressive Disclosure)
- Left: Project sidebar (collapsed by default, replaces flat conversation list?)
- Center: Document editor (existing)
- Right panels: Chat sidebar + Story Bible + History rail (toggled)
- Status bar: Existing word count + save status

### Store Coordination
- New `ProjectSlice` owns: projects[], volumes[], chapters[], currentChapterId
- `ConversationSlice` continues for AI chat — conversations linked to chapters
- `WorkspaceSlice` resolves workspace from project context, not conversation
- `UISlice` gains: sidebarExpanded, historyRailOpen

### Migration Path
1. First launch with F-001: scan localStorage for all `niko.draft:*` keys
2. Create "Default Project" with single volume "Volume 1"
3. Each localStorage draft becomes a chapter in Volume 1
4. Chapter title = conversation title or "Untitled"
5. Write TipTap JSON to filesystem (currently only text stored — may need to reconstruct)
6. **Critical limitation**: Current `useDraftCache` stores plain text, not TipTap JSON. Migration will create chapters from plain text content (TipTap will parse as paragraph)

---

## Risk Areas

### HIGH — Data Loss Risk
- Migration from localStorage to filesystem must be atomic and validated
- If migration fails partway, user could lose documents
- Mitigation: backup localStorage before migration, verify each chapter write

### HIGH — Store Shape Breaking
- Existing components depend on `currentConversationId` for document loading
- Changing this to `currentChapterId` affects DocumentEditor, NikoEditor, StoryBiblePanel
- Mitigation: adapter pattern — `currentChapterId` resolves to underlying conversation/document

### MEDIUM — Performance
- File I/O for every keystroke save is too slow
- Need debounced saves (existing 1500ms timer in DocumentEditor)
- Version history snapshots must not block editor

### MEDIUM — Sidebar Complexity
- Tree component with drag-reorder, inline rename, context menus
- Significant UI work — consider phased approach (read-only tree first, CRUD second)

### LOW — SQLite Schema Evolution
- Need migration strategy for future schema changes
- Use simple versioned migrations in gateway

---

## Current Understanding

Phase 1 is **feasible** but architecturally significant. It touches nearly every major system:

1. **Data layer**: localStorage → filesystem + SQLite (complete rewrite of persistence)
2. **State layer**: New project store slice, modified workspace/conversation resolution
3. **IPC layer**: New Tauri commands for project/chapter CRUD
4. **UI layer**: New sidebar, new history rail, modified document editor

The workspace model types (`workspace-model.ts`) are well-designed for extension — `projectId` and `chapterId` already exist. The main challenge is the persistence rewrite and ensuring backward compatibility during migration.

**Go/No-Go**: **Go with caveats** — Phase 1 is high-value and foundational, but must be executed carefully with migration safety as the top priority.

# Context — M8 Phase 1: Project Structure & Safety

> Source: 20260505-analyze-P1-project-structure-safety
> Recommendation: **GO**

---

## Locked Decisions (must be respected by plan)

### L-001: Hybrid Storage Architecture
- **Decision**: Filesystem via Tauri FS plugin for TipTap JSON content, gateway SQLite for metadata
- **Why**: Matches brainstorm ADR-001. Fast file I/O without gateway overhead for content, rich queries via SQLite, avoids BLOB bloat with version history
- **Constraint**: Chapter files at `{appDataDir}/projects/{projectId}/chapters/{chapterId}.json`, metadata in gateway SQLite

### L-002: TipTap JSON File Format
- **Decision**: Each chapter stored as TipTap JSON file (not plain text)
- **Why**: Fixes current bug where formatting is lost on reload. Preserves styles, formatting, document structure
- **Constraint**: Migration must convert existing plain-text drafts to TipTap JSON (parse as paragraph node)

### L-003: Project→Volume→Chapter Hierarchy
- **Decision**: 3-level hierarchy: Project → Volume → Chapter
- **Why**: Matches how writers organize work. Aligns with existing `ProjectWorkspaceManuscript` fields (chapterId, chapterTitle, chapterNumber)
- **Constraint**: New `ProjectSlice` in Zustand store owns projects[], volumes[], chapters[], currentChapterId

### L-004: Full Content Snapshots (not OT)
- **Decision**: Version history uses full content snapshots, not operational transforms
- **Why**: Simpler implementation, easier debugging, appropriate for single-user desktop app. Brainstorm F-002 spec specifies snapshots
- **Constraint**: Auto-save throttled to 1 snapshot per 5 minutes, manual named snapshots supported, 50 per chapter, compressed after 30 days

### L-005: Migration Safety
- **Decision**: Backup localStorage before migration, validate each file write, keep localStorage as fallback for one version
- **Why**: Data loss is highest risk. Current drafts have no backup mechanism. Single-shot migration must not fail
- **Constraint**: Migration script must be atomic with rollback capability

### L-006: Adapter Pattern for Backward Compatibility
- **Decision**: Adapter layer resolves chapter → conversation/document for existing components
- **Why**: DocumentEditor, NikoEditor, StoryBiblePanel all depend on `currentConversationId`. Changing to `currentChapterId` affects rendering
- **Constraint**: Existing component interfaces preserved during Phase 1, adapter bridges old and new models

### L-007: Progressive Disclosure
- **Decision**: Sidebar and history rail collapsed by default
- **Why**: Success criterion #7. Existing users should not feel overwhelmed. Reduces scope creep risk
- **Constraint**: UISlice gains `sidebarExpanded`, `historyRailOpen` state, both default false

---

## Free Decisions (plan decides implementation)

### F-001: Tree Component Implementation
- **Question**: Build custom tree component or use headless UI library?
- **Context**: No existing tree component patterns in codebase. Custom matches TailwindCSS style. Headless UI saves implementation time.
- **Guidance**: Prefer custom to match existing codebase patterns (all other components are hand-built TailwindCSS)

### F-002: Sidebar Width and Layout
- **Question**: Fixed or resizable sidebar? Default width?
- **Context**: Left panel replaces flat conversation list. Center remains editor. Right panels: chat + story bible + history rail
- **Guidance**: Fixed width initially (simpler), consistent with existing panel behavior

### F-003: Snapshot Compression Algorithm
- **Question**: Which compression for version history snapshots?
- **Context**: Snapshots stored as compressed JSON in app data directory. 50 per chapter, compressed after 30 days
- **Guidance**: gzip via Tauri FS is simplest; no external dependencies needed

### F-004: Project Slice Store Design
- **Question**: Standalone ProjectSlice or extend ConversationSlice?
- **Context**: New data model (project/volume/chapter) needs store ownership. Conversations continue for AI chat, linked to chapters
- **Guidance**: Standalone ProjectSlice — cleaner separation of concerns, conversations remain chat-focused

### F-005: SQLite Schema Versioning
- **Question**: How to handle future schema migrations in gateway SQLite?
- **Context**: Gateway is Node.js sidecar. Schema will evolve (Phase 2 adds export metadata, future milestones add more)
- **Guidance**: Simple versioned migrations table in gateway, bump version on schema change

### F-006: Chapter ID Generation
- **Question**: UUID, nanoid, or sequential IDs for chapters?
- **Context**: Chapters are filesystem files named by ID. Need to be unique, stable, human-irrelevant
- **Guidance**: nanoid — short, URL-safe, matches existing `Date.now().toString()` simplicity but more robust

---

## Deferred (out of scope for Phase 1)

### D-001: Drag-Reorder in Sidebar Tree
- **Reason**: Complex UI (drag-drop). Phased approach: read-only tree first in Phase 1, drag-reorder in future iteration
- **Trigger**: User request or Phase 2 planning

### D-002: Visual Diff (beyond text diff)
- **Reason**: Phase 1 implements text-based Myers diff. Visual diff with inline formatting changes is non-trivial
- **Trigger**: User feedback on text diff usefulness

### D-003: Cloud Sync
- **Reason**: Out of scope for M8. Adds network dependency, privacy concerns for creative writing
- **Trigger**: M10+ planning

### D-004: Multi-User Collaboration
- **Reason**: Single-user desktop app. OT/CRDT unnecessary at this stage
- **Trigger**: Cloud sync milestone

### D-005: Template System Integration
- **Reason**: F-006 is M9 scope. Project templates depend on F-001 but are not part of Phase 1
- **Trigger**: M9 Phase 1 planning

---

## Key Insights for Plan

1. **8 significant new components + 4 modified components** — plan should use 2+ waves
2. **Gateway SQLite location unclear** — niko-gateway code not in desktop repo; need to determine where to add SQLite integration
3. **useDraftCache plain-text limitation** — migration will create chapters from plain text content (TipTap will parse as single paragraph)
4. **Workspace model well-designed for extension** — `projectId` and `chapterId` already exist in types, just need to be populated
5. **Zustand slice architecture is clean** — new `ProjectSlice` fits naturally alongside existing 6 slices

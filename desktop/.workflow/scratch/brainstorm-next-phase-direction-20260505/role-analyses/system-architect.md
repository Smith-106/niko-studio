# System Architect Analysis: Niko-Studio 下一阶段方向

> Role: System Architect
> Date: 2026-05-05

---

## Current Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                   Tauri 2 Shell                  │
├──────────────────────┬───────────────────────────┤
│   React 18 Frontend  │     Rust Backend          │
│  ┌────────────────┐  │  ┌─────────────────────┐  │
│  │ TipTap Editor  │  │  │ File System Access  │  │
│  │ Zustand Stores │  │  │ SQLite (better-sql) │  │
│  │ Components     │  │  │ IPC Commands        │  │
│  └────────────────┘  │  └─────────────────────┘  │
│  ┌────────────────┐  │                           │
│  │ Vite Build     │  │  ┌─────────────────────┐  │
│  │ i18n           │  │  │ niko-gateway (Node) │  │
│  │ TailwindCSS    │  │  │ AI Model Abstraction│  │
│  └────────────────┘  │  │ Prompt Management   │  │
│                      │  └─────────────────────┘  │
└──────────────────────┴───────────────────────────┘
         External: Skills YAML, Services YAML
```

### Key Architectural Constraints

1. **Local-first**: All data on disk, no remote API dependency
2. **IPC boundary**: Frontend ↔ Rust via Tauri commands, Rust ↔ Node via sidecar
3. **SQLite for persistence**: better-sqlite3 via gateway
4. **TipTap JSON**: Document internal format is ProseMirror/TipTap JSON
5. **Single-process gateway**: niko-gateway handles all AI operations

---

## Feature Architecture Design

### F-001: Multi-Document Project Management

#### Data Model

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  projects    │     │  volumes         │     │  chapters     │
├─────────────┤     ├──────────────────┤     ├──────────────┤
│ id (PK)     │──┐  │ id (PK)          │──┐  │ id (PK)      │
│ title       │  │  │ project_id (FK)  │  │  │ volume_id(FK)│
│ description │  └──│ title            │  └──│ title        │
│ genre       │     │ sort_order       │     │ content      │
│ cover_path  │     │ created_at       │     │ sort_order   │
│ settings    │     │ updated_at       │     │ word_count   │
│ created_at  │     └──────────────────┘     │ status       │
│ updated_at  │                              │ content_ref  │
└─────────────┘                              │ created_at   │
                                             │ updated_at   │
                                             └──────────────┘
```

- `projects.settings` — JSON blob for project-specific settings (word target, deadline, etc.)
- `chapters.content_ref` — reference to TipTap JSON file path (not inline blob)
- `chapters.word_count` — denormalized, updated on save

#### State Machine: Project Lifecycle

```
                    ┌──────────┐
                    │  empty   │
                    └────┬─────┘
                         │ create
                    ┌────▼─────┐
           ┌─────── │  active  │ ───────┐
           │        └────┬─────┘        │
           │ archive     │ pause        │ complete
           │        ┌────▼─────┐   ┌────▼──────┐
      ┌────▼─────┐  │  paused  │   │ completed │
      │ archived │  └──────────┘   └───────────┘
      └──────────┘
```

| Transition | Trigger | Side Effect |
|------------|---------|-------------|
| empty → active | create_project | Initialize project directory + SQLite entry |
| active → paused | pause_project | Disable auto-save, stop word count updates |
| paused → active | resume_project | Re-enable auto-save |
| active → completed | complete_project | Final stats snapshot, mark read-only |
| active → archived | archive_project | Move to archive directory, hide from active list |

#### File Storage Layout

```
~/Niko-Studio/
  projects/
    {project-id}/
      project.json          ← metadata + settings
      volumes/
        {volume-id}/
          chapters/
            {chapter-id}.json  ← TipTap content
      assets/               ← images, references
      snapshots/            ← version history (F-002)
```

#### Integration Points

- **Sidebar**: Replace flat document list with project tree component
- **Editor**: Add chapter context (project name, volume, chapter number) to header
- **Gateway**: Add project-level AI context (project settings, character database)
- **Export**: Project-level export combines chapters with TOC

---

### F-002: Version History & Revision Tracking

#### Data Model

```
┌──────────────────┐
│  snapshots        │
├──────────────────┤
│ id (PK)          │
│ chapter_id (FK)  │
│ content          │  ← full TipTap JSON snapshot
│ metadata         │  ← { word_count, char_count, cursor_pos }
│ source           │  ← "auto" | "manual" | "restore"
│ label            │  ← user-provided name (nullable)
│ created_at       │
└──────────────────┘
```

#### Snapshot Strategy

| Trigger | Type | Retention |
|---------|------|-----------|
| Document save (auto) | auto | Keep last 50 per chapter |
| User manual save | manual | Keep indefinitely |
| Before restore | auto (restore) | Keep indefinitely |
| Session close | auto | Keep last 10 per session |

#### Diff Algorithm

Rich-text diff using TipTap's JSON structure:
1. Serialize both snapshots to plain text (strip marks)
2. Use Myers diff algorithm on text lines
3. Map text-level changes back to TipTap node positions
4. Render as `added`/`removed`/`unchanged` mark decorations in a read-only editor view

**Performance**: For documents <50k words, full snapshot + diff is acceptable (<500ms). No need for operational transforms.

#### Storage Management

- Max snapshots per chapter: 200 (configurable)
- Auto-compression: snapshots older than 30 days compressed via gzip
- Storage alert: warn when total snapshot size exceeds 500MB

---

### F-003: DOCX Export

#### Architecture

```
TipTap JSON → docx.js → .docx File
                ↑
          Style Mapping
          (TipTap marks → Word styles)
```

#### Style Mapping Table

| TipTap Node/Mark | DOCX Style |
|-----------------|------------|
| heading (level 1) | Heading 1 |
| heading (level 2) | Heading 2 |
| paragraph | Normal |
| bold | Bold character formatting |
| italic | Italic character formatting |
| strikethrough | Strikethrough |
| code | Courier New, shaded |
| bulletList | List Bullet |
| orderedList | List Number |
| blockquote | Quote |
| image | Inline image (base64) |
| table (F-005) | Word table |

#### Dependencies

- `docx` npm package (MIT license, actively maintained)
- No native dependencies — runs in renderer process or Node gateway

#### Project-Level Export Flow

```
1. Collect chapters in sort_order
2. Concatenate with page breaks between chapters
3. Insert title page (project metadata)
4. Optional: generate TOC with page references
5. Apply style mapping
6. Generate .docx buffer
7. Save via Tauri file dialog
```

---

### F-004: Writing Intelligence Enhancement

#### Architecture (Leverages Existing Gateway)

```
┌──────────┐     ┌──────────────────┐     ┌───────────┐
│ Frontend │────▶│ niko-gateway     │────▶│ AI Models │
│ UI Panel │     │ Intelligence API │     │ (local)   │
└──────────┘     └──────────────────┘     └───────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ Analysis     │
                 │ Pipeline     │
                 │ (prompt-based│
                 │  extraction) │
                 └──────────────┘
```

#### Intelligence Modules

| Module | Input | Output | Storage |
|--------|-------|--------|---------|
| Character Arc Tracker | All chapters + character entries | Arc timeline (events per chapter) | `project.analysis.character_arcs` |
| Pacing Analyzer | Chapter word counts + scene breaks | Pacing graph (tension curve) | `project.analysis.pacing` |
| Consistency Checker | Full text + Story Bible | Inconsistency report | `project.analysis.consistency` |
| Reading Level | Chapter text | Readability scores | `project.analysis.readability` |

#### Performance Strategy

- **Incremental analysis**: Only re-analyze changed chapters since last snapshot
- **Lazy loading**: Analysis triggered on-demand (user clicks "Analyze"), not automatically
- **Caching**: Results cached in SQLite, invalidated on content change

---

### F-005: Custom TipTap Extensions

#### Extension Architecture

```
TipTap Editor
  ├── @tiptap/extension-table (community) — or custom
  ├── @tiptap/extension-math (KaTeX integration)
  ├── extension-callout (custom)
  └── extension-drag-handle (custom)
```

#### Extension Selection Criteria

| Extension | Build vs Buy | Library |
|-----------|-------------|---------|
| Table | Buy | `@tiptap/extension-table` (prosemirror-table) — mature |
| Math | Buy | `@tiptap/extension-math` or `tiptap-math-extension` + KaTeX |
| Callout | Build | Simple custom node extension (4 variants) |
| Drag handle | Build | Prosemirror-gapcursor + custom plugin |

#### Data Format

- **Table**: Standard ProseMirror table nodes — no schema changes needed
- **Math**: Inline node with `latex` attribute, rendered via KaTeX — stored as plain text in JSON
- **Callout**: Custom node with `type` attribute (info/warning/tip/important)

All extensions use TipTap's standard JSON serialization — compatible with existing storage.

---

## Error Handling & Observability

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Storage | Disk full, corrupted JSON | Alert user, offer recovery from last snapshot |
| Export | DOCX generation failure | Show error in dialog, offer retry with fallback format |
| Project | Missing chapter file | Show in sidebar with warning icon, offer re-import |
| Performance | Large document (>100k words) | Debounced save, virtualized diff, progress indicators |

### Key Metrics

| Metric | Instrumentation | Target |
|--------|----------------|--------|
| Document save latency | Timer around IPC call | <200ms for 50k words |
| Snapshot creation time | Timer around diff+store | <500ms |
| DOCX export time | Timer around generation | <5s for 200k words |
| Project switch time | Timer around state load | <300ms |
| Chapter open time | Timer around content load | <100ms |

---

## Migration Strategy

### M8 Data Migration

No breaking changes to existing data. Migration is additive:

1. **Existing documents** → auto-wrapped into "Default Project" on first launch after upgrade
2. **SQLite schema** → additive migrations (ALTER TABLE for new columns)
3. **File layout** → existing files remain; new files created in project structure on demand

### Migration Checklist

- [ ] Add `projects`, `volumes`, `chapters`, `snapshots` tables
- [ ] Migration script: existing documents → default project
- [ ] TipTap editor loads from chapter ref (not direct file path)
- [ ] Backward compatibility: standalone documents still work without project

---

## Dependency Impact

| New Dependency | Size | License | Purpose |
|---------------|------|---------|---------|
| docx | ~200KB | MIT | DOCX generation |
| @tiptap/extension-table | ~50KB | MIT | Table support |
| katex | ~300KB | MIT | Math rendering |
| diff (Myers) | ~20KB | BSD | Text diffing |

Total bundle size increase: ~570KB (gzipped ~180KB). Acceptable for desktop app.

---

## Architecture Decision Records

### ADR-001: Project storage = filesystem + SQLite metadata

**Context**: Need to store multi-document projects with metadata, search, and fast access.
**Decision**: Filesystem for TipTap JSON content, SQLite for metadata and relationships.
**Consequences**: (+) Git-friendly, human-readable files. (+) Leverages existing SQLite infrastructure. (-) Need to keep filesystem and DB in sync.

### ADR-002: Version history = full snapshots (not OT)

**Context**: Need revision tracking for single-user desktop app.
**Decision**: Store full content snapshots, not operational transforms.
**Consequences**: (+) Simple implementation. (+) No merge conflicts (single user). (-) Higher storage usage (mitigated by compression). (-) Linear scaling with edit count.

### ADR-003: DOCX generation in renderer process

**Context**: docx.js runs in browser environments.
**Decision**: Generate DOCX in the renderer process, save via Tauri file dialog.
**Consequences**: (+) No gateway changes needed. (+) Fast (no IPC round-trip for generation). (-) Large documents may block UI (mitigated by Web Worker).

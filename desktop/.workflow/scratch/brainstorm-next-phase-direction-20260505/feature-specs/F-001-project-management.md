# F-001: Multi-Document Project Management

> Priority: HIGH | Phase: M8-P1 | Depends: None
> Roles: product-manager, ux-expert, system-architect

---

## Requirements Summary

Provide a hierarchical project container (Project → Volume → Chapter) for organizing multi-document writing projects. Writers currently manage chapters as independent documents with no structural coherence; this feature introduces the fundamental organizational layer that unlocks downstream features (version history, DOCX export, writing intelligence).

**MUST**:
- Create, rename, delete projects
- Organize documents into volumes and chapters with sort ordering
- Display project dashboard with aggregate stats (word count, chapter count, last edited)
- Navigate between chapters via tree sidebar
- Support drag-and-drop reordering of chapters and volumes
- Auto-migrate existing standalone documents into a "Default Project" on upgrade

**SHOULD**:
- Project-level search across all chapters
- Import existing documents into a project
- Project-level word count targets with progress tracking

**MAY**:
- Project cover image
- Project-level tags/labels

---

## Design Decisions (40%+)

1. **Filesystem + SQLite hybrid**: TipTap JSON stored as files (`chapters/{id}.json`), metadata in SQLite `projects`/`volumes`/`chapters` tables. Rationale: Git-friendly content, fast metadata queries.

2. **Backward-compatible migration**: On first launch after upgrade, existing standalone documents are wrapped into a "Default Project" with single volume. No data loss, transparent to user.

3. **Tree sidebar replaces document list**: Current flat document list in Sidebar component is replaced with a project tree component. Selected project persists in app settings.

4. **Chapter content_ref pattern**: Chapters reference their TipTap JSON file path rather than storing content inline. This keeps content files human-readable and compatible with existing editor load/save flow.

5. **Sort order via integer column**: `sort_order` integer column on volumes and chapters. Drag-and-drop updates via batch SQL UPDATE within transaction.

---

## Interface Contract

### Tauri IPC Commands (Rust → Frontend)

```typescript
// Project CRUD
invoke('create_project', { title: string, description?: string, genre?: string }): Project
invoke('get_project', { projectId: string }): Project
invoke('list_projects', {}): Project[]
invoke('update_project', { projectId: string, updates: Partial<Project> }): Project
invoke('delete_project', { projectId: string }): void

// Volume CRUD
invoke('create_volume', { projectId: string, title: string }): Volume
invoke('reorder_volumes', { projectId: string, volumeIds: string[] }): void

// Chapter CRUD
invoke('create_chapter', { volumeId: string, title: string }): Chapter
invoke('get_chapter', { chapterId: string }): Chapter
invoke('update_chapter', { chapterId: string, updates: Partial<Chapter> }): Chapter
invoke('delete_chapter', { chapterId: string }): void
invoke('reorder_chapters', { volumeId: string, chapterIds: string[] }): void

// Project stats
invoke('get_project_stats', { projectId: string }): ProjectStats
```

### Zustand Store

```typescript
interface ProjectStore {
  currentProjectId: string | null
  currentChapterId: string | null
  projects: Project[]
  projectTree: ProjectTreeNode[]
  stats: ProjectStats | null
  loading: boolean

  loadProjects(): Promise<void>
  selectProject(projectId: string): Promise<void>
  selectChapter(chapterId: string): Promise<void>
  createProject(title: string): Promise<Project>
  createChapter(volumeId: string, title: string): Promise<Chapter>
  reorderChapters(volumeId: string, chapterIds: string[]): Promise<void>
}
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| SQLite migrations must be additive only | Cannot rename/drop columns | Design schema carefully upfront |
| TipTap content files must stay synchronized with DB | File deletion without DB update = orphaned chapters | Wrap operations in transaction-like flow |
| Existing editor load assumes single document path | Editor integration needs chapter-aware loading | Abstract content loading through chapter service |
| Large projects (300+ chapters) may slow tree rendering | Sidebar performance | Virtualized list for chapter tree |

---

## Acceptance Criteria

- [ ] User can create a new project with title and genre
- [ ] User can create volumes and chapters within a project
- [ ] User can reorder chapters via drag-and-drop
- [ ] Project dashboard displays aggregate word count and chapter count
- [ ] Existing documents auto-migrate to "Default Project" on first launch
- [ ] Selecting a chapter loads its content in the TipTap editor
- [ ] All existing features (chat, agent, knowledge) work within chapter context
- [ ] 937+ existing tests continue to pass

---

## Cross-Feature Dependencies

- **F-002 (Version History)**: Snapshots are scoped to chapters within projects
- **F-003 (DOCX Export)**: Project-level export combines chapters
- **F-004 (Writing Intelligence)**: Analysis operates on project scope (all chapters)
- **F-006 (Templates)**: Templates applied at chapter level within project context

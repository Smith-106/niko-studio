# TASK-003 Summary: Audit SkillTab and skill API surface

**Status**: completed (audit)

## Findings

### Current SkillTab (Read-Only)
- `SkillTab.tsx` (235 lines) lists skills as cards with click-to-select
- Three action buttons: Task Match, Skill Details, Skill Chain
- No create, edit, rename, or delete capability
- Skills loaded via `listSkills()` from `src/api/client.ts`

### Skill API Surface
- `listSkills()` — lists available skills from skills/ directory
- `loadSkill(id)` — reads skill content file
- `matchSkills(text?, keywords?)` — matches skills to context
- `getSkillChain(id)` — gets ordered skill chain steps
- **Missing**: createSkill, saveSkill, deleteSkill, renameSkill

### Skill Storage
- Skills are markdown files in `skills/` directory
- Loaded at runtime via Tauri fs commands
- No database storage — pure file-based

### CRUD Plan
- Need to add Tauri fs API calls: write file (create/save), delete file, rename file
- Create: new .md file from template in skills/ directory
- Edit: load content into textarea, save writes back to file
- Rename: rename file in skills/ directory
- Delete: remove file with confirmation dialog (reuse PersistedEntityTab pattern)

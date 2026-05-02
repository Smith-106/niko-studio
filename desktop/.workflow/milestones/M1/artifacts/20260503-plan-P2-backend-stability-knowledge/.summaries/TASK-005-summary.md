# TASK-005: Knowledge CRUD completeness — delete, rename fix, type-specific fields

## Changes
- `src/components/knowledge/KnowledgeTypes.ts`:
  - Added `FieldConfig` interface: `{ key: string; label: string; type: 'text' | 'textarea' }`.
- `src/components/knowledge/knowledgeUtils.ts`:
  - Added `buildGraphDeleteMutation(entityType, name, workspaceId)` returning `MATCH ... DETACH DELETE` Cypher.
- `src/components/knowledge/PersistedEntityTab.tsx`:
  - Accepts `extraFields?: FieldConfig[]` prop.
  - Renders extra field inputs (text/textarea) after description textarea.
  - `draftExtraFields` state for extra field values, loaded from selectedItem, saved to entity properties.
  - Added delete button with confirmation dialog (Trash2 icon). Shows confirm/cancel inline. Calls `buildGraphDeleteMutation` then reloads.
  - Fixed rename: when `matchName !== name`, executes `MATCH ... SET n.name = newName` before the MERGE to prevent duplicate creation.
- `src/components/knowledge/CharacterTab.tsx`:
  - Passes `extraFields={[{key:'role', label:'Role', type:'text'}, {key:'traits', label:'Traits', type:'textarea'}]}`.
- `src/components/knowledge/LocationTab.tsx`:
  - Passes `extraFields={[{key:'geography', label:'Geography', type:'textarea'}]}`.
- `src/components/knowledge/PlotTab.tsx`:
  - Passes `extraFields={[{key:'chapter', label:'Chapter', type:'text'}, {key:'act', label:'Act', type:'text'}]}`.

## Convergence
- [x] PersistedEntityTab contains delete button element
- [x] PersistedEntityTab has confirmation dialog before delete
- [x] PersistedEntityTab handles name change without creating duplicates (MATCH+SET before MERGE)
- [x] CharacterTab passes role/traits extraFields
- [x] LocationTab passes geography extraFields
- [x] PlotTab passes chapter/act extraFields

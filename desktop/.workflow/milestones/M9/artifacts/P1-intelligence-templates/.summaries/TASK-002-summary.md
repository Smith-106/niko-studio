# TASK-002: Template Service + Built-in Templates + Slice

**Status:** completed

## What was done

Created the template/scaffold backend layer:

- `src/types/template.ts` — Template, TemplatePlaceholder, TemplateCategory type definitions
- `src/services/templates/builtins.ts` — 5 built-in templates (basic chapter, three-act, hero's journey, parallel timeline, epistolary) as static TypeScript objects
- `src/services/templateService.ts` — Template CRUD service with `listTemplates`, `getTemplate`, `saveTemplate`, `deleteTemplate`, `duplicateTemplate`, `substitutePlaceholders`
- `src/stores/app/templateSlice.ts` — Zustand slice with templates array, loading state, and CRUD actions

## Key decisions

- Built-in templates defined as TypeScript objects in builtins.ts (not separate JSON files) — simpler imports
- TipTap JSON content format for zero-conversion editor application
- User templates stored at `projects/{projectId}/templates/{templateId}.json` in Tauri appDataDir
- `substitutePlaceholders()` does string replacement on JSON-stringified content for simplicity

## Files modified/created

- `src/types/template.ts` (new)
- `src/services/templates/builtins.ts` (new)
- `src/services/templateService.ts` (new)
- `src/stores/app/templateSlice.ts` (new)
- `src/stores/app/appStore.ts` (modified — added slice)

## Verification

- `npx tsc --noEmit` passes with zero errors
- All 5 built-in templates have valid structure with required fields

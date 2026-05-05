# TASK-004: Template Browser UI + Integration

**Status:** completed

## What was done

Created the template browser UI and integration wiring:

- `src/components/TemplateBrowserPanel.tsx` — Full template browser panel with category filtering, template preview, placeholder form, and save-as-template dialog
- `TemplatePreview` sub-component with back navigation and placeholder filling
- `PlaceholderForm` sub-component supporting text, number, and select input types
- `SaveAsTemplateDialog` sub-component for creating new user templates
- Template application via CustomEvent dispatch (`template:apply`)
- `src/hooks/useAppUiPersistence.ts` — Added `'analysis'` and `'templateBrowser'` to RightPanelType and isRightPanelType
- `src/components/AppRightPanels.tsx` — Added lazy imports and render entries for both panels
- `src/stores/app/projectSlice.ts` — Extended `addChapter` with optional `templateContent` parameter

## Key decisions

- All sub-components (TemplatePreview, PlaceholderForm, SaveAsTemplateDialog) kept in single file for simplicity — not split into separate component files
- Template application uses `window.dispatchEvent(new CustomEvent('template:apply'))` for decoupled editor integration
- Removed unused imports (`extractPlaceholders`, `CATEGORY_ALL`) to keep code clean
- Fixed intelligenceSlice import path: `AnalysisModule` imported from `../../api/intelligence` (not from service)
- Removed unused `get` parameter from intelligenceSlice `(set) =>` instead of `(set, get) =>`

## Files modified/created

- `src/components/TemplateBrowserPanel.tsx` (new)
- `src/components/AnalysisPanel.tsx` (new — TASK-003)
- `src/components/AppRightPanels.tsx` (modified)
- `src/hooks/useAppUiPersistence.ts` (modified)
- `src/stores/app/projectSlice.ts` (modified)
- `src/stores/app/intelligenceSlice.ts` (fixed import + removed unused param)

## Verification

- `npx tsc --noEmit` passes with zero errors in all modified/created files

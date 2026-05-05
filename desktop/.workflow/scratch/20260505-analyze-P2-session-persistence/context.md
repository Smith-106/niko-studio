# Analysis: M7 Phase 2 — Session Persistence & Polish

## Related Files
- `src/hooks/useDraftCache.ts` - Handles loading and saving editor content to localStorage
- `src/components/DocumentEditor.tsx` - Orchestrates the editor, title, and auto-save logic
- `src/hooks/useAppUiPersistence.ts` - Manages persistence for UI state (sidebars, panels) in localStorage
- `src/stores/appStore.ts` - Central Zustand store for in-memory application state
- `src/components/ExportDialog.tsx` - UI for exporting, lacks history tracking
- `src/components/NikoEditor.tsx` - The underlying rich text editor, which reports content changes

## Summary
The application currently uses `localStorage` for persistence, managed by several focused hooks. `useDraftCache` is responsible for the editor's content (auto-save and draft recovery), while `useAppUiPersistence` handles UI state like panel visibility. The central `appStore` is in-memory. A basic auto-save feature is implemented with a debounce timer in `DocumentEditor`. Exporting is functional but does not record any history. The current architecture provides a solid foundation but has clear opportunities for enhancement in storage robustness, user feedback on save status, and implementing new features like export history.

## Locked, Free, and Deferred Decisions

### Locked Decisions (Keep As-Is)
1.  **State Management Pattern**: Continue using **Zustand (`useAppStore`)** for reactive, in-memory state. It's established throughout the app.
2.  **Component-Scoped Persistence Hooks**: The pattern of using specific hooks (`useDraftCache`, `useAppUiPersistence`) to manage persistence for a feature is clean and should be maintained. A new hook, `useExportHistory`, would fit this pattern.
3.  **i18n Pattern**: The existing `useI18n` hook and translation key structure are well-defined and should be used for any new user-facing text.
4.  **Editor-Component Separation**: The separation of concerns between `NikoEditor` (the editor engine) and `DocumentEditor` (the feature orchestrator) is a strong pattern to continue. `NikoEditor` emits updates, and `DocumentEditor` handles the side effects (like saving).

### Free Decisions (Areas to Design/Implement)
1.  **Export History Storage Backend**: Start with `localStorage` for simplicity, consistent with existing patterns. Key: `'niko.export-history-v1'`, storing an array of export events.
2.  **Auto-Save Debounce Interval**: The current interval is hardcoded at **1500ms** in `DocumentEditor.tsx`. Could be made configurable via settings.
3.  **Auto-Save/Draft Recovery UI**: Current "Saved" text is minimal. A more persistent indicator (e.g., "Saving..." -> "Saved at 10:45 AM") and a draft recovery banner ("Unsaved draft restored") would improve UX.
4.  **Shape of Export History Data**: `{ id: string; exportedAt: number; format: 'md' | 'html' | 'pdf'; title: string; wordCount: number }`.

### Deferred Items (Out of Scope for M7 Phase 2)
1.  **Full Version History**: Git-like version history with diffs and restore. Current scope is limited to recovering the *last saved* draft.
2.  **Backend Synchronization**: Syncing drafts or export history with a backend server for multi-device access. All persistence is client-side only.
3.  **Real-time Collaboration**: Major architectural change, not part of current plan.

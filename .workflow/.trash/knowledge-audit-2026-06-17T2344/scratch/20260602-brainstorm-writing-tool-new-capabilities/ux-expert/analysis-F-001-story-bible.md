# F-001 — Story Bible 引擎

> Role: ux-expert | Related decisions: UX-04, UX-09

## Architecture

The Story Bible feature integrates into the existing WritingWorkspace sidebar as a collapsible panel. The architecture consists of three interaction layers: a sidebar panel for browsing and quick edits, an inline editor overlay for editing entries without leaving the editor, and a background auto-extraction service that populates Story Bible from manuscript text.

The sidebar panel displays Story Bible entities (CharacterProfile, WorldRule, PlotThread, TimelineEvent) in a tree structure with expand/collapse sections. Each entity shows a summary line and a hover-activated edit affordance (pencil icon). Clicking the edit affordance opens the inline editor overlay positioned near the entity in the sidebar, not in the main editor area.

The inline editor overlay is a modal-free floating panel that appears when the user activates edit mode on a Story Bible entry. It contains form fields appropriate to the entity type (text inputs, textareas, dropdowns for relationships). The overlay dismisses on blur, Enter key, or explicit close button, persisting changes immediately.

The auto-extraction service runs in the background when a manuscript is first loaded or when significant text changes occur. It uses existing Craft Analysis Services to identify characters, relationships, plot threads, and world rules. Progress is shown in the sidebar panel as a progress bar with percentage and current operation label.

## Interface Contract

**StoryBibleInlineEditor** interface:
- Input: entity (SBEntity with type-specific fields), position (ViewportPosition for overlay placement), onSave callback
- Output: void (changes persist immediately via onSave)
- Behavior: Overlay appears within 100ms of edit activation; form fields pre-populated with current entity data; Tab cycles through fields; Enter or blur triggers save; Escape cancels and reverts

**StoryBibleAutoExtractionProgress** interface:
- Input: manuscriptId (string), onProgress callback, onComplete callback
- Output: void (progress updates via callback)
- Behavior: Progress bar updates every 500ms; completion triggers toast notification; extracted entities appear in sidebar tree with highlight animation

**StoryBibleEntityTree** interface:
- Input: entities (SBEntity[]), onEdit callback, onExpand callback
- Output: void (user interactions trigger callbacks)
- Behavior: Tree renders with collapsed sections by default; expand reveals child entities; hover shows edit affordance after 500ms delay; click edit triggers onEdit

## Constraints (RFC 2119)

- Inline editing MUST NOT navigate away from the editor or sidebar context
- Edits MUST persist immediately on blur or Enter key press without explicit save button
- Edit affordance (pencil icon) SHOULD be discoverable within 2 seconds of hover on an entity
- Auto-extraction progress indicator MUST appear in the sidebar panel during extraction
- Extraction MUST run in background and MUST NOT block the UI or editor interaction
- Completion notification SHOULD be non-intrusive (toast in bottom-right corner, auto-dismiss after 5 seconds)
- Inline editor overlay MUST be dismissible via Escape key without saving changes
- Entity tree sections MUST be collapsible to reduce visual clutter
- Newly extracted entities MUST be visually distinguished (highlight animation for 2 seconds)
- Inline editor form fields MUST have appropriate ARIA labels for accessibility

## Test Approach

**Unit tests**:
- StoryBibleInlineEditor component: verify form field population, save on blur, save on Enter, cancel on Escape, field validation
- StoryBibleEntityTree component: verify expand/collapse, edit affordance visibility, callback invocation
- Auto-extraction progress: verify progress bar updates, completion notification, error handling

**Integration tests**:
- End-to-end flow: load manuscript, trigger auto-extraction, view extracted entities in sidebar, edit entity inline, verify persistence
- Keyboard navigation: Tab through inline editor fields, Escape to cancel, Enter to save
- Concurrent operations: edit one entity while auto-extraction is running, verify no interference

**Usability tests**:
- Task: Edit a character profile without leaving the editor. Measure time to complete and error rate.
- Task: Find and expand a specific plot thread in the entity tree. Measure time and navigation path.
- Task: Understand auto-extraction progress and know when it completes. Measure comprehension.

## TODOs

- Define precise form fields for each entity type (CharacterProfile, WorldRule, PlotThread, TimelineEvent) in collaboration with Subject Matter Expert
- Specify validation rules for entity fields (required fields, format constraints, relationship integrity)
- Design highlight animation for newly extracted entities (timing, color, fade-out curve)
- Determine auto-extraction trigger conditions (on manuscript load, on significant text change threshold, manual trigger option)
- Specify toast notification design (position, duration, action buttons for undo or view details)
- Map existing Craft Analysis Services outputs to Story Bible entity schemas
- Define entity relationship visualization in the tree (parent-child links, cross-references)
- Evaluate sidebar panel capacity for large Story Bibles (scroll behavior, search/filter, virtualization)
- Specify keyboard shortcuts for Story Bible operations (open panel, new entity, search)
- Research Sudowrite Story Bible UI for concrete interaction patterns

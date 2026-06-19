# F-008 — 多模态故事智能

> Role: ux-expert | Related decisions: UX-07

## Architecture

Multi-Modal Story Intelligence defines operation semantics (filter, lasso, perspective shift) that work uniformly on text and visual targets. Following the Vistoria Instrumental Interaction pattern (see design-research.md), the same interaction primitives apply to both text ranges and image regions, enabling future image-text co-editing without redesigning the interaction model.

The initial implementation targets text-only operations. Three core operations are defined:

1. **Filter**: Select text by metadata criteria (character, plot thread, emotion, craft dimension). The filtered text highlights in the editor with a dimmed background for non-matching text. Filter controls appear in the sidebar panel as dropdown selectors.

2. **Lasso**: Free-form selection of a text region that becomes an editable unit. Lassoed text can be moved, duplicated, or transformed as a group. The lasso tool activates via toolbar button or keyboard shortcut, then the user draws a selection boundary around the target text.

3. **Perspective Shift**: Change the narrative viewpoint of selected text (e.g., rewrite from a different character perspective). This operation triggers AI generation using the Directed mode instruction pattern with a pre-filled perspective instruction.

All three operations use the same visual feedback pattern: a selection outline (dashed border for filter, solid border for lasso, gradient border for perspective shift) that appears on the target text. When image targets are added in the future, the same operations produce analogous visual feedback (outline on image regions instead of text highlights).

This feature is classified as MAY priority (see PM-01) and is the lowest priority for implementation. The UX contribution is defining the operation semantics and interaction patterns that will remain stable when visual targets are added.

## Interface Contract

**FilterOperation** interface:
- Input: criteria (FilterCriteria: character, plotThread, emotion, craftDimension), targetText (string or null)
- Output: onFilterApply callback (filteredRanges: TextRange[])
- Behavior: Dropdown selectors in sidebar; apply highlights matching text; dim non-matching text; clear filter restores original view

**LassoOperation** interface:
- Input: isActive (boolean), selectedRange (TextRange or null)
- Output: onLassoComplete callback (range: TextRange), onLassoAction callback (action: move or duplicate or transform)
- Behavior: Toolbar button activates lasso mode; cursor changes to crosshair; draw selection boundary; action menu on completion

**PerspectiveShiftOperation** interface:
- Input: selectedRange (TextRange), targetPerspective (string: character name or narrative voice)
- Output: onShiftTrigger callback (range, perspective)
- Behavior: Context menu option on selected text; perspective selector dropdown; triggers AI generation with perspective instruction; follows Directed mode revision pattern

## Constraints (RFC 2119)

- Filter, lasso, and perspective shift operations MUST work identically on text ranges and (future) image regions
- Operation feedback MUST be mode-appropriate: text highlight for text targets, visual outline for image targets
- Filter criteria MUST include character, plot thread, emotion, and craft dimension options
- Lasso selection MUST support move, duplicate, and transform actions on the selected unit
- Perspective shift MUST trigger AI generation using the Directed mode instruction pattern
- All operations MUST be accessible via both toolbar buttons and keyboard shortcuts
- Operation visual feedback MUST use distinct border styles (dashed for filter, solid for lasso, gradient for perspective shift)
- Filter highlight MUST dim non-matching text to reduce visual noise
- Lasso mode cursor change (to crosshair) MUST be clearly distinguishable from normal editing cursor
- Perspective shift selector MUST list available perspectives from Story Bible character profiles

## Test Approach

**Unit tests**:
- FilterOperation: verify criteria selectors, highlight application, dim behavior, filter clear
- LassoOperation: verify activation, cursor change, selection boundary, action menu
- PerspectiveShiftOperation: verify context menu, perspective selector, AI generation trigger

**Integration tests**:
- End-to-end filter: select character filter, verify text highlights, clear filter, verify restoration
- End-to-end lasso: activate lasso, select text region, choose transform action, verify AI generation
- End-to-end perspective shift: select text, choose perspective shift, select character, verify revision output

**Usability tests**:
- Task: Filter text by a specific character. Measure filter application time and result comprehension.
- Task: Lasso a text region and apply a transform. Measure lasso precision and action discoverability.
- Task: Shift perspective of a paragraph to a different character. Measure perspective selection and revision quality assessment.

## TODOs

- Define filter criteria dropdown design (multi-select, search within options, clear all)
- Specify lasso selection boundary visual (border style, handles for resize, drag affordance)
- Design lasso action menu (position, options, keyboard shortcuts)
- Define perspective shift context menu integration (position relative to selection, available options)
- Specify how filter results interact with existing text selection and cursor
- Design dim behavior for non-matching text (opacity level, readability threshold)
- Define operation keyboard shortcuts (avoid conflicts with existing editor shortcuts)
- Specify how operations compose (filter then lasso, lasso then perspective shift)
- Design future image target interaction patterns (outline style, resize handles, drag behavior)
- Research Vistoria Instrumental Interaction pattern for concrete polymorphic operation examples

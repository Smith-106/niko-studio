# UX Expert Analysis — Writing Tool New Capabilities

> Contract: guidance-specification.md section 6 (decisions UX-01 through UX-04)
> Owns: Interaction patterns, display strategies, information architecture, accessibility, cognitive load management, microinteractions, state management for AI-driven features
> Does not own: Backend architecture (SA), product prioritization (PM), domain quality rules (SME), visual branding, production frontend code

## 1. Role Mandate

The UX Expert defines how users interact with three new AI-driven writing capabilities: Co-Writing Engine, Reader Simulation, and Multi-Modal Story Intelligence. This role owns the hybrid display strategy for AI suggestions (inline + sidebar), the overlay-and-linkage pattern for reader simulation visualization, the creativity spectrum control design, and the inline editing model for Story Bible entries. The UX Expert ensures all new interactions integrate with the existing WritingWorkspace page and narrative visualization panels without increasing cognitive load or breaking established patterns. Decisions about backend architecture, MCP endpoint design, and domain-specific quality rules are deferred to System Architect and Subject Matter Expert respectively.

## 2. Decision Digest

### Decisions
| ID | Feature | Stance | Constraints (RFC 2119) |
|----|---------|--------|------------------------|
| UX-01 | F-002, F-003, F-004 | AI co-writing suggestions use hybrid inline + sidebar display with user-switchable views | Inline hints MUST appear at cursor position; sidebar panel MUST show full suggestion detail; view switching MUST NOT lose unsaved suggestions |
| UX-02 | F-005, F-006 | Reader Simulation results overlay existing narrative visualizations with independent detail panel and click-through linkage | Overlay markers MUST NOT obscure existing data points; detail panel MUST open on marker click; linkage MUST be bidirectional |
| UX-03 | F-007 | Creativity spectrum control is a visual slider with labeled presets | Slider MUST provide four labeled presets; default MUST be Balanced; preset labels MUST be visible at all times |
| UX-04 | F-001 | Story Bible entries are editable inline from the writing workspace | Inline editing MUST NOT navigate away from the editor; edits MUST persist immediately on blur or Enter; edit affordance SHOULD be discoverable within 2 seconds of hover |
| UX-05 | F-002, F-003 | Co-Writing mode switching MUST preserve session context and generated content | Mode switch MUST NOT discard in-progress suggestions; transition animation SHOULD complete within 300ms; current mode indicator MUST be visible at all times |
| UX-06 | F-005 | Reader persona selection supports both preset and custom personas with clear visual distinction | Preset personas MUST display with predefined icons; custom personas MUST show user-defined labels; persona parameters MUST be editable before simulation run |
| UX-07 | F-008 | Multi-modal operations MUST use consistent interaction primitives for text and visual targets | Filter, lasso, and perspective shift MUST work identically on text and images; operation feedback MUST be mode-appropriate |
| UX-08 | F-007 | Quality constraint violations MUST be surfaced non-modally with severity indicators | Hard constraint violations MUST display as inline markers with red severity; soft constraint advisories MUST display as subtle indicators with amber severity; violations MUST NOT block writing flow |
| UX-09 | F-001 | Story Bible auto-extraction progress MUST be visible and non-blocking | Progress indicator MUST appear in sidebar; extraction MUST run in background; completion notification SHOULD be non-intrusive |
| UX-10 | cross-cutting | All AI-generated content MUST be visually distinguished from user-authored content | AI text MUST use distinct background tint or border; metadata badge SHOULD be accessible on hover; distinction MUST survive copy-paste as metadata |

### Interfaces
| Name | Contract | Consumers |
|------|----------|-----------|
| CoWritingSuggestionDisplay | mode: inline or sidebar, suggestion: Suggestion, position: CursorPosition | System Architect (CWE pipeline), UI Designer (component states) |
| ReaderSimulationOverlay | personaResults: PersonaResult[], visualizationType: tension or timeline or character, markers: OverlayMarker[] | System Architect (RS dual-engine), Data Architect (result schemas) |
| CreativitySpectrumControl | value: number, preset: PresetLabel, onChange: function | System Architect (QC soft constraints), Product Manager (default settings) |
| StoryBibleInlineEditor | entity: SBEntity, position: ViewportPosition, onSave: function | System Architect (KE extension), Data Architect (entity schemas) |
| QualityViolationMarker | severity: hard or soft, dimension: QualityDimension, message: string, position: TextPosition | Subject Matter Expert (4-dimension rules), System Architect (CAS integration) |

### Cross-Cutting Positions
| Topic | Stance |
|-------|--------|
| Information Architecture | New AI features extend the existing WritingWorkspace layout; no separate top-level navigation added. Co-writing controls live in the editor toolbar; reader simulation integrates into the existing visualization panel strip; Story Bible occupies a collapsible sidebar section. |
| Sigil/Input | AI suggestion acceptance uses keyboard shortcut (Tab for inline, Enter for sidebar focus); creativity slider supports both pointer and keyboard interaction; all controls MUST be operable without mouse. |
| Visual Choreography | AI content appears with subtle fade-in (200ms); mode transitions use slide animation (300ms); overlay markers pulse gently on first appearance then settle; violation indicators use color-coded borders, not popups. |
| Streaming | Auto mode suggestions stream character-by-character with cursor tracking; Guided mode options appear simultaneously after generation completes; streaming state MUST show progress indicator. |
| Confirmation | Accepting AI suggestions requires explicit action (Tab/Click); rejecting requires no action; destructive actions (discard all suggestions, reset Story Bible) MUST require confirmation dialog. |
| Interrupt | User typing MUST immediately dismiss inline suggestion; sidebar suggestions persist during typing; mode switching MUST NOT interrupt active generation. |
| Accessibility | All new components MUST meet WCAG 2.1 AA; AI content distinction MUST not rely solely on color; creativity slider MUST have ARIA labels and keyboard operation; overlay markers MUST have screen reader announcements. |

### Findings Summary
| Slug | Title | Impact |
|------|-------|--------|
| cognitive-load-accumulation | Cognitive Load Accumulation from Multi-Feature Overlay | HIGH |
| suggestion-lifecycle | Suggestion Lifecycle Management Gap | MEDIUM |
| mode-discoverability | Co-Writing Mode Discoverability Challenge | MEDIUM |

## 3. Cross-Cutting Foundations

### Information Architecture

The existing WritingWorkspace page uses a three-column layout: editor (center), narrative visualization panels (right strip), and a collapsible sidebar. All new AI features MUST integrate into this existing structure without adding new top-level navigation items. The Co-Writing Engine controls occupy the editor toolbar area with a mode selector and creativity slider. Reader Simulation results overlay the existing visualization panels (TensionCurveView, TimelineView, CharacterGraphView) and add a detail panel that shares the sidebar space. Story Bible entries appear in a dedicated sidebar section with inline editing capability. The ForeshadowPanel remains unchanged; its data feeds into Story Bible auto-extraction but its UI is not modified.

The key architectural constraint is that the sidebar MUST support multiple concurrent panels (Story Bible, Co-Writing detail, Reader Simulation detail) with tab-based switching. Panel priority follows the active feature: when Co-Writing is generating, its detail panel takes focus; when Reader Simulation completes, its results panel surfaces.

### Sigil/Input

All AI interaction controls MUST support keyboard-first operation. The inline suggestion acceptance pattern follows the established code-completion convention: Tab to accept, Escape to dismiss, arrow keys to navigate between Guided mode options. The creativity spectrum slider MUST support arrow-key increment/decrement with labeled preset snap points. Reader Simulation overlay markers MUST be keyboard-navigable via a marker list in the detail panel. Story Bible inline editing MUST activate on a dedicated keyboard shortcut (not on accidental focus) and MUST support standard text editing keys.

Pointer interactions supplement keyboard: click to accept/reject suggestions, drag to adjust creativity slider, click overlay markers to open detail panel. Touch gestures SHOULD be supported for future tablet use cases but are not MVP requirements.

### Visual Choreography

Animation and transition design follows a calm workspace principle: the writing editor is the primary focus, and all AI-driven visual changes MUST be subtle and non-distracting. Inline suggestions fade in over 200ms with a slight left-offset from the cursor. Sidebar panel transitions use a 300ms slide animation. Reader Simulation overlay markers pulse once on appearance (500ms) then remain static. Quality violation indicators use colored left-border highlights rather than background fills to minimize visual disruption.

Co-Writing mode switching uses a smooth transition: the current mode controls fade out while the new mode controls fade in, with a 300ms total duration. During mode transition, any in-progress generation continues uninterrupted. The creativity slider thumb animates smoothly between positions with a 150ms easing curve.

### Streaming

Auto mode (F-002) generates text in a streaming fashion: characters appear incrementally at the cursor position, following the established useChatStreaming hook pattern. A streaming progress indicator (subtle pulsing cursor) MUST be visible during generation. The user MAY continue reading the streamed text but typing MUST pause the stream display until the user stops typing.

Guided mode (F-003) generates three options concurrently; all three appear simultaneously after generation completes, not incrementally. Each option card shows a confidence score and brief rationale. The simultaneous reveal prevents anchoring bias toward the first-completed option.

Directed mode (F-004) streams the revision output inline, using the existing revision annotation pattern from IRevisionService.

### Confirmation

The confirmation strategy follows a graduated model based on action reversibility. Accepting an AI suggestion is immediately reversible (Ctrl+Z undo), so it requires only a single explicit action (Tab or Click). Rejecting a suggestion requires no action at all: inline suggestions fade after 10 seconds of inactivity, and sidebar suggestions persist until manually dismissed or the session ends.

Destructive actions that are not easily reversible MUST require a confirmation dialog: discarding all pending suggestions, resetting Story Bible to auto-extracted state, and deleting a custom reader persona. The confirmation dialog MUST clearly state what will be lost and offer a cancel option.

### Interrupt

User typing is the primary interrupt signal. When the user begins typing in the editor, inline AI suggestions MUST immediately dismiss to avoid collision with user input. Sidebar suggestions and detail panels MUST remain visible and accessible during typing since they do not obstruct the editor.

Active AI generation MUST NOT be interrupted by mode switching. If the user switches from Auto to Guided mode while Auto is generating, the current generation completes and the result is presented, then the mode switch takes effect for subsequent generations. The user MAY explicitly cancel an active generation via a stop button in the toolbar.

Reader Simulation runs are long-running operations; they MUST NOT block the UI. A progress indicator in the visualization panel strip shows simulation status. The user MAY continue writing during simulation execution.

### Accessibility

All new components MUST conform to WCAG 2.1 AA standards. Specific requirements: AI-generated text distinction MUST use both color and a visual indicator (left border plus subtle background tint) to be perceivable without color vision. The creativity spectrum slider MUST have aria-label, aria-valuenow, aria-valuemin, and aria-valuemax attributes, and MUST be operable via arrow keys. Reader Simulation overlay markers MUST have aria-describedby linking to their detail panel content. Co-Writing mode selector MUST use role radiogroup with role radio for each mode option.

Screen reader users MUST receive announcements for: suggestion appearance, suggestion acceptance, quality violation detection, and simulation completion. Live regions (aria-live polite) MUST be used for non-urgent notifications; aria-live assertive is reserved for hard constraint violations only.

## 4. File Index

| File | Type | Feature | Headings |
|------|------|---------|----------|
| [analysis-F-001-story-bible.md](analysis-F-001-story-bible.md) | feature | F-001 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-002-co-writing-auto.md](analysis-F-002-co-writing-auto.md) | feature | F-002 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-003-co-writing-guided.md](analysis-F-003-co-writing-guided.md) | feature | F-003 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-004-co-writing-directed.md](analysis-F-004-co-writing-directed.md) | feature | F-004 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-005-reader-simulation.md](analysis-F-005-reader-simulation.md) | feature | F-005 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-006-reader-visualization.md](analysis-F-006-reader-visualization.md) | feature | F-006 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-007-quality-control.md](analysis-F-007-quality-control.md) | feature | F-007 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [analysis-F-008-multimodal-intelligence.md](analysis-F-008-multimodal-intelligence.md) | feature | F-008 | Architecture, Interface Contract, Constraints, Test Approach, TODOs |
| [findings-cognitive-load-accumulation.md](findings-cognitive-load-accumulation.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-suggestion-lifecycle.md](findings-suggestion-lifecycle.md) | finding | — | Description, Affected Features, Recommendation |
| [findings-mode-discoverability.md](findings-mode-discoverability.md) | finding | — | Description, Affected Features, Recommendation |

## 5. Outstanding TODOs

- Study existing WritingWorkspace.tsx layout to confirm sidebar panel capacity and tab-switching feasibility
- Audit existing useChatStreaming.ts hook for reuse in Auto mode streaming display
- Review ForeshadowPanel.tsx interaction patterns for consistency with Story Bible inline editing
- Define precise animation timing values in collaboration with UI Designer (design tokens)
- Conduct heuristic evaluation of the three-mode Co-Writing selector against recognition rather than recall principle
- Specify ARIA live region strategy for concurrent AI notifications (suggestion plus violation plus simulation)
- Research Sudowrite Guided mode card layout for concrete interaction reference
- Define suggestion timeout and archival behavior for session persistence
- Map existing narrative visualization panel APIs to Reader Simulation overlay requirements
- Evaluate cognitive load impact of simultaneous overlay markers across multiple visualization panels

# F-006 — 读者模拟可视化

> Role: ux-expert | Related decisions: UX-02

## Architecture

Reader Simulation visualization overlays reader feedback on the existing narrative visualization panels (TensionCurveView, TimelineView, CharacterGraphView) and provides an independent detail panel with click-through linkage. The design principle is augmentation, not replacement: existing visualization data remains fully visible and interactive, with reader simulation markers added as a supplementary layer.

Overlay markers are positioned at the corresponding narrative coordinates on each visualization. On the TensionCurveView, markers appear at tension peaks and valleys where reader personas reported pacing issues. On the TimelineView, markers appear at plot events where coherence concerns were flagged. On the CharacterGraphView, markers appear at character nodes where consistency problems were detected.

Each marker is a small circular indicator with a color-coded severity (red for hard issues, amber for soft advisories). Markers pulse once on first appearance (500ms) then remain static. Hovering a marker shows a tooltip with the persona name, dimension, and brief feedback. Clicking a marker opens the detail panel scrolled to the corresponding feedback entry.

The detail panel occupies the sidebar space and shows per-persona feedback organized by dimension. Each feedback entry includes the persona name, dimension label, severity, feedback text, and a "Locate" button that scrolls the visualization to the corresponding marker and highlights it briefly.

## Interface Contract

**OverlayMarker** interface:
- Input: id (string), visualizationType (tension or timeline or character), position (Coordinate), severity (hard or soft), personaName (string), dimension (string), briefFeedback (string)
- Output: onClick callback, onHover callback
- Behavior: Circular indicator at position; color by severity; pulse on first appearance; hover shows tooltip; click opens detail panel

**VisualizationOverlayLayer** interface:
- Input: markers (OverlayMarker[]), visualizationType (string), isVisible (boolean)
- Output: onMarkerClick callback
- Behavior: Renders markers on top of existing visualization; toggle visibility; markers MUST NOT obscure existing data points; z-index above visualization but below UI controls

**DetailPanelWithLinkage** interface:
- Input: feedbackEntries (FeedbackEntry[]), selectedEntry (string or null)
- Output: onEntryClick callback, onLocateClick callback
- Behavior: Scrollable list of feedback entries; click entry highlights corresponding marker; Locate button scrolls visualization to marker; bidirectional linkage

## Constraints (RFC 2119)

- Overlay markers MUST NOT obscure existing visualization data points or interactive elements
- Markers MUST be toggleable (show/hide overlay layer) without affecting underlying visualization
- Detail panel MUST open on marker click with the corresponding feedback entry in view
- Linkage MUST be bidirectional: marker click opens detail panel, Locate button scrolls visualization to marker
- Marker severity MUST use both color and shape (red circle for hard, amber diamond for soft) for accessibility
- Markers MUST pulse once on first appearance then remain static (no continuous animation)
- Hover tooltip MUST show persona name, dimension, and brief feedback (max 100 characters)
- Detail panel MUST support keyboard navigation between feedback entries
- Overlay layer z-index MUST be above visualization but below UI controls (toolbar, panels)
- Multiple persona markers at the same position MUST stack vertically with offset to remain individually clickable

## Test Approach

**Unit tests**:
- OverlayMarker: verify rendering at correct position, severity color, pulse animation, hover tooltip, click callback
- VisualizationOverlayLayer: verify marker rendering, visibility toggle, z-index, non-occlusion of data points
- DetailPanelWithLinkage: verify feedback entry list, click-to-marker linkage, Locate button, keyboard navigation

**Integration tests**:
- End-to-end flow: run simulation, view overlay markers on TensionCurveView, click marker, verify detail panel opens at correct entry
- Bidirectional linkage: click Locate button in detail panel, verify visualization scrolls to marker and highlights it
- Marker stacking: simulate multiple personas flagging the same position, verify vertical offset and individual clickability
- Toggle flow: hide overlay layer, verify markers disappear and visualization is unmodified; show overlay, verify markers reappear

**Usability tests**:
- Task: Identify the most critical reader feedback from the overlay. Measure time to locate and interpret markers.
- Task: Navigate from a marker to the detail panel and back. Measure linkage discoverability and efficiency.
- Task: Distinguish hard issues from soft advisories using marker visual cues. Measure accuracy for color-vision-impaired users.

## TODOs

- Define marker size and position offset calculations for each visualization type
- Specify marker stacking algorithm for overlapping positions (vertical offset, max stack height)
- Design tooltip content and layout (persona name, dimension, brief feedback truncation)
- Define detail panel entry layout (persona avatar, dimension icon, severity badge, feedback text, Locate button)
- Specify highlight animation for Locate button target (duration, color, fade-out)
- Design overlay layer toggle control (position in visualization panel, icon, keyboard shortcut)
- Define marker color palette for accessibility (color-blind safe red/amber alternatives)
- Specify how overlay markers interact with existing visualization hover/click behaviors
- Determine detail panel scroll behavior when many feedback entries exist (virtualization, grouping)
- Map existing TensionCurveView, TimelineView, CharacterGraphView APIs for overlay integration points

# Finding: Cognitive Load Accumulation from Multi-Feature Overlay

> Role: ux-expert | Impact: HIGH

## Description

The WritingWorkspace page will simultaneously host multiple AI-driven visual layers: inline co-writing suggestions, reader simulation overlay markers on narrative visualizations, quality violation indicators in the editor, and Story Bible auto-extraction progress. Each layer individually adds modest cognitive load, but their combined presence risks overwhelming the user, especially during active writing sessions where multiple features produce output concurrently.

The design-research.md notes that Sudowrite uses a single-focus model (one active AI feature at a time), while Slima runs dual engines but with sequential result presentation. Neither tool faces the same density of concurrent visual feedback that niko-studio will introduce.

## Affected Features

- F-002 (Auto mode): inline ghost text competes for visual attention with violation markers
- F-005 (Reader Simulation): overlay markers on visualizations add visual noise during writing
- F-006 (Reader Visualization): marker density increases with multiple personas
- F-007 (Quality Control): violation markers in editor overlap with AI suggestion ghost text
- Cross-cutting: all features producing concurrent visual output

## Recommendation

Implement a visual priority system that limits concurrent active visual layers to two at any time. The priority order follows the user's current action: if the user is actively writing, editor-layer indicators (suggestions, violations) take priority; if the user is reviewing, visualization-layer indicators (simulation markers) take priority. Lower-priority indicators collapse to count badges that the user can expand on demand. This approach MUST be validated through usability testing with realistic multi-feature scenarios before implementation.

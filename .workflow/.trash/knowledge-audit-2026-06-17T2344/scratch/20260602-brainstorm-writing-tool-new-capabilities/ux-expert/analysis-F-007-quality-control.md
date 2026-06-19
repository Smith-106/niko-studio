# F-007 — 质量控制机制

> Role: ux-expert | Related decisions: UX-03, UX-08

## Architecture

Quality Control implements a two-tier constraint system: hard constraints from Craft Analysis Services (enforced) and soft constraints from the creativity spectrum (advisory). The UX architecture provides two primary interaction surfaces: the creativity spectrum slider for soft constraint control, and non-modal violation indicators for hard constraint feedback.

The creativity spectrum slider (UX-03) is a visual control with four labeled presets: Conservative, Balanced, Creative, and Experimental. The slider occupies a compact space in the Co-Writing toolbar area. Each preset label is always visible (no tooltip required). The slider thumb snaps to preset positions but also supports intermediate values for fine-grained control. The current preset label updates in real-time as the slider moves. The default is Balanced for Auto and Guided modes, Conservative for Directed mode.

Hard constraint violations are surfaced as inline markers in the editor. Each marker is a colored left-border highlight on the affected text range: red for hard violations (enforced by Craft Analysis Services), amber for soft advisories (from creativity spectrum). Hovering a marker shows a tooltip with the dimension name, violation description, and suggested fix. Clicking a marker opens a detail popover with the full violation context and a one-click fix action (when available).

Violations are non-modal: they do not block writing flow or require immediate action. They appear as the user writes or after AI generation completes. A violation count badge in the toolbar shows the total number of active violations by severity. Clicking the badge opens a violation summary panel in the sidebar.

## Interface Contract

**CreativitySpectrumSlider** interface:
- Input: value (number 0-100), preset (Conservative or Balanced or Creative or Experimental), onChange callback
- Output: onValueChange callback (value, preset)
- Behavior: Four labeled preset positions; thumb snaps to presets; intermediate values supported; label updates in real-time; keyboard operable (arrow keys); ARIA attributes

**QualityViolationMarker** interface:
- Input: severity (hard or soft), dimension (plot or character or style or pacing), message (string), position (TextRange), suggestedFix (string or null)
- Output: onClick callback, onFixApply callback
- Behavior: Left-border highlight on text range; color by severity; hover tooltip; click opens detail popover; one-click fix when available

**ViolationSummaryPanel** interface:
- Input: violations (Violation[]), filterBySeverity (hard or soft or all)
- Output: onViolationClick callback, onFilterChange callback
- Behavior: Grouped list by dimension; severity filter tabs; click navigates to violation in editor; count badges per dimension

## Constraints (RFC 2119)

- The creativity spectrum slider MUST provide four labeled presets: Conservative, Balanced, Creative, Experimental
- The default preset MUST be Balanced for Auto and Guided modes, Conservative for Directed mode
- Preset labels MUST be visible at all times (no tooltip or expand required)
- Hard constraint violations MUST display as inline markers with red severity
- Soft constraint advisories MUST display as subtle indicators with amber severity
- Violations MUST NOT block writing flow or require immediate user action
- Violation markers MUST use both color and shape for accessibility (red left-border for hard, amber underline for soft)
- Hover tooltip MUST show dimension name, violation description, and suggested fix
- One-click fix action MUST be available when a suggested fix exists
- Violation count badge in toolbar MUST show total violations by severity
- The slider MUST support keyboard operation via arrow keys with preset snap points
- The slider MUST have ARIA attributes (aria-label, aria-valuenow, aria-valuemin, aria-valuemax)

## Test Approach

**Unit tests**:
- CreativitySpectrumSlider: verify preset labels, snap behavior, intermediate values, keyboard operation, ARIA attributes
- QualityViolationMarker: verify left-border rendering, severity color, hover tooltip, click popover, one-click fix
- ViolationSummaryPanel: verify grouped list, severity filter, click navigation, count badges

**Integration tests**:
- End-to-end flow: generate AI text with Experimental creativity, observe soft advisories, adjust slider to Conservative, verify advisory changes
- Violation flow: write text that triggers hard constraint violation, verify marker appearance, hover tooltip, click popover, apply one-click fix
- Badge flow: accumulate violations, verify count badge updates, click badge to open summary panel, navigate to specific violation

**Usability tests**:
- Task: Adjust creativity slider from Balanced to Experimental and observe output change. Measure understanding of slider effect.
- Task: Identify and fix a hard constraint violation. Measure time from violation appearance to fix application.
- Task: Use violation summary panel to navigate between multiple violations. Measure navigation efficiency.

## TODOs

- Define slider visual design (track style, thumb style, preset label positioning) with UI Designer
- Specify left-border highlight width and color values for hard (red) and soft (amber) violations
- Design detail popover layout (dimension icon, violation text, suggested fix, apply button)
- Define one-click fix behavior (auto-apply vs preview-then-confirm)
- Specify violation count badge design (position in toolbar, color coding, animation on count change)
- Design violation summary panel layout (dimension grouping, severity filter tabs, scroll behavior)
- Determine how creativity slider value maps to soft constraint thresholds (prompt parameter mapping)
- Specify violation persistence (clear on text change, clear on fix, session-based accumulation)
- Define violation marker interaction with existing text selection and cursor positioning
- Research NovelAI Prose Augmenter creativity control for concrete slider interaction patterns

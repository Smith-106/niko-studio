# Finding: Co-Writing Mode Discoverability Challenge

> Role: ux-expert | Impact: MEDIUM

## Description

The Co-Writing Engine offers three modes (Auto, Guided, Directed) with distinct interaction models: Auto streams ghost text at the cursor, Guided presents three option cards in the sidebar, and Directed uses an instruction input with revision annotations. Users must understand which mode suits their current creative state and how to switch between modes effectively. The three modes have different trigger mechanisms, different output presentations, and different creativity slider defaults, creating a discoverability and learnability challenge.

Nielsen's heuristic "recognition rather than recall" applies here: the mode selector MUST make each mode's behavior immediately apparent without requiring the user to remember the differences. A simple radio-button selector with mode names (Auto / Guided / Directed) does not communicate the interaction model differences. Users may select a mode expecting one behavior and encounter another, leading to frustration and mode errors.

## Affected Features

- F-002 (Auto mode): users may expect option cards but get streaming ghost text
- F-003 (Guided mode): users may expect continuous generation but get discrete option sets
- F-004 (Directed mode): users may expect free-form generation but get instruction-based revision
- Cross-cutting: mode switching UX-05

## Recommendation

Design the mode selector with descriptive sub-labels and visual previews. Each mode option SHOULD display a one-line description of its behavior (Auto: "Continuous streaming at cursor", Guided: "Three scored options to choose from", Directed: "Instruction-based revision"). Additionally, the first-time mode activation SHOULD show a brief onboarding tooltip (auto-dismiss after 5 seconds) explaining the mode's interaction model. The mode selector SHOULD also indicate the current creativity default for each mode. This approach reduces mode errors and accelerates learning without adding persistent clutter to the toolbar.

## 2026-03-24 - Missing Escape Key Handlers on Custom Modals
**Learning:** While checking `McpStatusPanel`, I discovered it lacked an `Escape` key handler to close the dialog, which is a critical keyboard accessibility requirement. Upon further investigation, this seems to be an accessibility issue pattern across some custom slide-over panels and modals in this app (e.g., missing in `SettingsModal` as well), whereas others (`KnowledgeModal`, `EvaluationPanel`, `WritingHelperPanel`) have it correctly implemented.
**Action:** When working on or reviewing any new or existing custom modals/slide-overs in this design system, always verify the presence of a global `keydown` listener for the `Escape` key, and ensure the close mechanism announces its keyboard shortcut (`aria-keyshortcuts="Escape"`).

## 2026-03-24 - Explaining Disabled States
**Learning:** In `WritingHelperPanel`, the main action button was disabled when the text area was empty, but provided no feedback on *why* it was disabled. This pattern is common across the app where buttons are conditionally disabled without explanation.
**Action:** When disabling buttons due to conditional state (like missing input), always add a `title` attribute or a tooltip to explain the reason. This prevents users from guessing what needs to be done to enable the action.

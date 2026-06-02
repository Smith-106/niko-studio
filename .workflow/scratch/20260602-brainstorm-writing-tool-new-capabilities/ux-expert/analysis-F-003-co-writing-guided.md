# F-003 — AI 引导选择模式（Guided mode，3 选项评分）

> Role: ux-expert | Related decisions: UX-01, UX-03, UX-05, UX-10

## Architecture

Guided mode presents three AI-generated options simultaneously after generation completes. Each option is displayed as a card in the sidebar panel with a confidence score and brief rationale. The user selects one option for insertion, requests regeneration, or dismisses all.

The three-option card layout follows the Sudowrite Guided pattern (see design-research.md): options appear side-by-side in the sidebar panel when space permits, or as a vertical stack on narrow viewports. Each card shows a preview of the suggested text (truncated to 3 lines with expand option), a confidence score badge, and accept/dismiss actions. The highest-scored option is visually emphasized with a subtle border highlight.

Unlike Auto mode, Guided mode does not stream. All three options generate concurrently and appear simultaneously after completion. This design prevents anchoring bias toward the first-completed option and allows direct comparison. A loading state with three skeleton cards shows during generation.

The creativity spectrum slider in Guided mode defaults to Balanced but the user MAY adjust it. Changing the slider after options are generated triggers a regeneration with the new creativity setting (after confirmation dialog per the Confirmation foundation).

## Interface Contract

**GuidedModeOptionCard** interface:
- Input: optionText (string), confidenceScore (number), rationale (string), rank (1-3)
- Output: onAccept callback, onExpand callback
- Behavior: Card renders with truncated text preview; expand shows full text; accept inserts text at cursor; highest-scored card has emphasis border

**GuidedModeOptionSet** interface:
- Input: options (Option[], length 3), isLoading (boolean), creativityPreset (PresetLabel)
- Output: onAccept callback, onRegenerate callback, onDismissAll callback
- Behavior: Three cards render simultaneously; loading state shows skeleton cards; regenerate triggers new generation with current settings; dismiss all clears cards

**GuidedModeSelector** interface:
- Input: currentMode (string), options (Option[])
- Output: onModeSwitch callback
- Behavior: Mode selector shows Guided as active; switch preserves current options as reference; transition animation 300ms

## Constraints (RFC 2119)

- Three options MUST be generated concurrently and displayed simultaneously (no sequential reveal)
- Each option card MUST show confidence score and brief rationale
- The highest-scored option MUST be visually emphasized (subtle border highlight)
- Option text preview MUST be truncated to 3 lines with expand action
- Loading state MUST show three skeleton cards during generation
- Regeneration with changed creativity setting MUST require confirmation (destructive action: discards current options)
- Accepting an option MUST insert text at cursor position with visual distinction (see UX-10)
- Dismissing all options MUST require confirmation if any option was previously accepted and then undone
- Arrow keys MUST navigate between option cards in sidebar panel
- Option selection via keyboard MUST use Enter key on focused card

## Test Approach

**Unit tests**:
- GuidedModeOptionCard: verify text truncation, expand/collapse, accept action, confidence score display
- GuidedModeOptionSet: verify simultaneous rendering, loading skeleton, regenerate, dismiss all
- GuidedModeSelector: verify mode indicator, switch animation, option preservation

**Integration tests**:
- End-to-end flow: trigger Guided mode, wait for three options, select one, verify text insertion
- Regeneration flow: generate options, adjust creativity slider, confirm regeneration, verify new options
- Keyboard flow: Tab to option cards, arrow keys between cards, Enter to accept, Escape to dismiss

**Usability tests**:
- Task: Compare three options and select the best one. Measure comparison time and selection accuracy.
- Task: Regenerate options with higher creativity setting. Measure understanding of creativity effect.
- Task: Navigate options using keyboard only. Measure keyboard discoverability and efficiency.

## TODOs

- Define option card layout for sidebar panel (width, padding, scroll behavior with three cards)
- Specify skeleton card animation during loading (pulse, shimmer)
- Design confidence score visual representation (numeric badge, color scale, progress bar)
- Define text truncation and expand behavior (max lines, expand animation, collapse action)
- Specify regeneration confirmation dialog content and behavior
- Design emphasis treatment for highest-scored option (border style, background tint)
- Determine sidebar panel overflow behavior when three cards exceed available height
- Specify how accepted option replaces cursor text (insert, replace selection, append)
- Define comparison affordances (side-by-side highlight of differences between options)
- Research Sudowrite Guided mode card layout for concrete visual patterns

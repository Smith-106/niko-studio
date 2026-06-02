# F-002 — AI 自动续写模式（Auto mode）

> Role: ux-expert | Related decisions: UX-01, UX-05, UX-10

## Architecture

Auto mode provides continuous AI-generated text that streams at the cursor position. The interaction model is minimal: the user triggers generation (keyboard shortcut or toolbar button), text streams inline at the cursor, and the user accepts or dismisses the suggestion.

The display follows the hybrid model defined in UX-01: inline hints appear at the cursor position as ghost text with a distinct visual treatment (lighter opacity, left border accent). A corresponding sidebar panel shows the full suggestion with metadata (generation mode, confidence score, creativity spectrum setting). The user switches between inline-only and inline-plus-sidebar views via a toggle in the toolbar.

Streaming uses the existing useChatStreaming hook pattern. Characters appear incrementally with a subtle pulsing cursor indicator. The stream pauses when the user begins typing and resumes when typing stops (debounced 500ms). A stop button in the toolbar allows explicit cancellation.

The creativity spectrum slider (see UX-03) appears in the toolbar next to the mode selector. In Auto mode, the slider defaults to Balanced. The user MAY adjust it before or during generation; changes take effect on the next generation cycle.

## Interface Contract

**CoWritingSuggestionDisplay** (Auto mode specialization):
- Input: mode (inline or sidebar), suggestion (streaming text with metadata), position (CursorPosition)
- Output: void (user actions: accept via Tab, dismiss via Escape, ignore for auto-timeout)
- Behavior: Inline ghost text appears at cursor; sidebar panel updates in real-time during streaming; accept inserts text at cursor; dismiss removes ghost text; auto-timeout after 10 seconds of user inactivity

**AutoModeControls** interface:
- Input: isGenerating (boolean), creativityValue (number), creativityPreset (PresetLabel)
- Output: onTrigger callback, onStop callback, onCreativityChange callback
- Behavior: Trigger button activates generation; stop button cancels; creativity slider adjusts output style; mode indicator shows current mode

**StreamingProgressIndicator** interface:
- Input: isStreaming (boolean), charactersGenerated (number)
- Output: void (visual indicator only)
- Behavior: Pulsing cursor during streaming; character count in sidebar panel; progress bar for long generations

## Constraints (RFC 2119)

- Inline suggestions MUST appear at the current cursor position as ghost text
- Sidebar panel MUST show full suggestion detail including metadata (mode, confidence, creativity setting)
- View switching (inline-only vs inline-plus-sidebar) MUST NOT lose unsaved or in-progress suggestions
- User typing MUST immediately dismiss the inline suggestion to avoid collision
- Streaming progress indicator MUST be visible during generation
- The user MAY explicitly cancel generation via a stop button
- Auto-timeout for inline suggestions MUST occur after 10 seconds of user inactivity
- Accepted suggestions MUST be visually distinguished from user-authored text (see UX-10)
- The creativity slider default MUST be Balanced for Auto mode
- Mode switching MUST NOT discard in-progress suggestions (see UX-05)

## Test Approach

**Unit tests**:
- CoWritingSuggestionDisplay: verify ghost text rendering, accept on Tab, dismiss on Escape, auto-timeout behavior
- AutoModeControls: verify trigger, stop, creativity slider interaction
- StreamingProgressIndicator: verify pulsing animation, character count updates

**Integration tests**:
- End-to-end flow: trigger Auto mode, stream suggestion, accept via Tab, verify text insertion and visual distinction
- Interrupt flow: trigger Auto mode, begin typing during stream, verify inline dismissal and sidebar persistence
- Mode switch flow: generate in Auto mode, switch to Guided mode, verify suggestion preservation

**Usability tests**:
- Task: Generate and accept an Auto mode suggestion. Measure time from trigger to acceptance.
- Task: Dismiss an unwanted Auto mode suggestion. Measure discoverability of dismiss action.
- Task: Adjust creativity slider and observe output difference. Measure understanding of slider effect.

## TODOs

- Define ghost text visual treatment (opacity, border color, font style) in collaboration with UI Designer
- Specify streaming character rate and debouncing behavior for typing interruption
- Design stop button placement and visual state (active generation vs idle)
- Define auto-timeout behavior for sidebar suggestions (persist until manual dismiss vs session-based)
- Specify metadata badge design for accepted AI text (hover tooltip content, click behavior)
- Determine creativity slider effect on Auto mode output (prompt parameter mapping)
- Design inline-to-sidebar view toggle (icon, position, keyboard shortcut)
- Specify cursor behavior during streaming (position lock, scroll-follow)
- Define undo behavior for accepted Auto mode suggestions (single Ctrl+Z vs granular)
- Research Sudowrite Auto mode interaction for concrete streaming patterns

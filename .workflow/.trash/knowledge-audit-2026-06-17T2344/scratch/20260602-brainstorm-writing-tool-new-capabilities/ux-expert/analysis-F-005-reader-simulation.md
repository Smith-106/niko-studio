# F-005 — 读者模拟引擎

> Role: ux-expert | Related decisions: UX-02, UX-06

## Architecture

The Reader Simulation engine runs multiple AI reader personas in parallel, each producing feedback across four dimensions (plot coherence, character consistency, style consistency, pacing/tension). The UX architecture focuses on persona selection, simulation triggering, and result delivery.

Persona selection uses a card-based interface in the sidebar panel. Preset personas (Suspense Enthusiast, Literary Critic, General Reader) appear as predefined cards with icons and brief descriptions. Custom persona creation is accessible via an "Add Custom Reader" button that opens a form with parameters: name, age range, taste preferences, reading history, and emphasis dimensions. Custom personas are visually distinguished from presets by a user-defined label badge instead of a predefined icon.

Simulation triggering is a single action: after selecting one or more personas, the user clicks "Run Simulation" or uses a keyboard shortcut. A progress indicator appears in the visualization panel strip showing which personas have completed. The simulation runs in the background and MUST NOT block the editor.

Result delivery follows the dual-channel model defined in UX-02: overlay markers on existing narrative visualizations plus an independent detail panel. Each persona produces dimension-specific feedback that maps to overlay markers on the TensionCurveView (pacing feedback), TimelineView (plot coherence feedback), and CharacterGraphView (character consistency feedback). The detail panel shows per-persona feedback with click-through linkage to overlay markers.

## Interface Contract

**PersonaSelector** interface:
- Input: presetPersonas (Persona[]), customPersonas (Persona[]), selectedPersonas (Persona[])
- Output: onPersonaSelect callback, onCustomCreate callback, onCustomEdit callback, onCustomDelete callback
- Behavior: Preset cards with predefined icons; custom cards with user labels; multi-select via checkboxes; custom creation opens form; custom deletion requires confirmation

**SimulationProgress** interface:
- Input: personas (Persona[]), completedPersonas (string[]), isRunning (boolean)
- Output: void (visual indicator only)
- Behavior: Progress bar per persona; completion checkmarks; total progress percentage; non-blocking overlay in visualization strip

**PersonaFeedbackPanel** interface:
- Input: personaResults (PersonaResult[]), selectedPersona (string or null)
- Output: onPersonaSelect callback, onMarkerClick callback
- Behavior: Tab-based persona switching; dimension scores per persona; feedback text with linked markers; click marker to scroll to detail

## Constraints (RFC 2119)

- Preset personas MUST display with predefined icons and descriptions
- Custom personas MUST show user-defined labels and MUST be visually distinct from presets
- Persona parameters MUST be editable before simulation run
- Custom persona deletion MUST require confirmation dialog (destructive action)
- Simulation MUST run in background and MUST NOT block the editor or UI
- Progress indicator MUST show per-persona completion status
- Multiple personas MAY be selected for a single simulation run
- At minimum one persona MUST be selected to trigger simulation
- Simulation results MUST be delivered via overlay markers on existing visualizations plus detail panel (see UX-02)
- Persona feedback MUST be organized by dimension (plot, character, style, pacing)

## Test Approach

**Unit tests**:
- PersonaSelector: verify preset display, custom creation form, multi-select, custom deletion confirmation
- SimulationProgress: verify per-persona progress, completion indicators, non-blocking behavior
- PersonaFeedbackPanel: verify tab switching, dimension scores, marker linkage

**Integration tests**:
- End-to-end flow: select personas, run simulation, view overlay markers, click marker to open detail panel
- Custom persona flow: create custom persona, run simulation with custom persona, verify feedback includes custom parameters
- Concurrent operation: run simulation while writing, verify no UI blocking

**Usability tests**:
- Task: Select appropriate personas for a mystery novel. Measure persona understanding and selection accuracy.
- Task: Create a custom persona matching a specific target audience. Measure form completion time and parameter understanding.
- Task: Interpret simulation results across multiple personas. Measure comprehension of dimension scores and feedback.

## TODOs

- Define preset persona icons and descriptions (visual design collaboration with UI Designer)
- Specify custom persona form fields and validation rules (age range format, taste preference options)
- Design persona card layout for sidebar panel (compact vs expanded, multi-select affordance)
- Define simulation progress indicator design (position, size, animation)
- Specify overlay marker design per visualization type (tension curve, timeline, character graph)
- Design detail panel tab layout for multiple persona results
- Define click-through linkage behavior (marker-to-detail and detail-to-marker bidirectional)
- Specify how dimension feedback maps to visualization overlay positions
- Determine simulation result persistence (session-based, saveable, exportable)
- Research Slima dual-engine UI for concrete persona and feedback display patterns

# Phase 4: Prompt Synthesis

> **COMPACT SENTINEL [Phase 4: prompt-synthesis]**
> This phase contains 3 execution steps (Step 4.1 — 4.3).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/04-prompt-synthesis.md")`

Transform diagram specifications into polished, self-contained image generation prompts with consistent visual language.

## Objective

- Build a shared style guide based on user preferences
- Generate one complete prompt per diagram spec
- Adapt prompt syntax to the target generation tool
- Present the full prompt set and optionally save to file

## Execution

### Step 4.1: Style Guide Construction

Build the shared style directive from `workflowPreferences.style`:

**Minimalist Academic** (default):
```
Style directive:
  Clean white or off-white (#FAFAFA) background. Thin precise lines (1-2px) in dark gray (#333).
  Sans-serif typography (Inter, Helvetica Neue, or similar). Muted accent palette:
  slate blue (#64748B), warm gray (#78716C), sage (#6B8E6B), dusty rose (#B5838D), soft gold (#C9A96E).
  No gradients, no shadows, no 3D effects. Generous whitespace. Small-caps for labels.
  Subtle grid or dot pattern at very low opacity if background feels empty.
  Inspired by Edward Tufte's information design and Swiss typographic tradition.
  Academic paper figure quality — suitable for journal publication.
```

**Technical Blueprint**:
```
Style directive:
  Dark navy (#1A1F36) or white background. Monochrome line art with single accent color (cyan #00D4FF).
  Monospace typography (JetBrains Mono, Fira Code). Precise geometric shapes.
  Engineering drawing conventions — dimensioning lines, cross-hatching for sections.
  Grid background at low opacity. Inspired by CAD drawings and technical schematics.
```

**Organic Flow**:
```
Style directive:
  Warm cream (#FFF8F0) background. Soft curved lines with variable width.
  Rounded sans-serif (Nunito, Quicksand). Watercolor-inspired accent fills at low opacity.
  Earth tones: forest green, terracotta, ocean blue, sand. Gentle shadows.
  Hand-drawn feel without being sketch-like. Inspired by scientific illustration.
```

**Custom**: Use the user's style description verbatim as the style directive.

### Step 4.2: Prompt Generation

> **CHECKPOINT**: Before proceeding, verify:
> 1. This phase is TodoWrite `in_progress`
> 2. Full protocol (Step 4.1 — 4.3) is in active memory
> If only sentinel remains → `Read("phases/04-prompt-synthesis.md")` now.

For each `diagramSpec` in `diagramSpecs[]`, generate a prompt using this template:

---

**Prompt Template (General)**:

```
[TITLE]
{diagramSpec.title.en} / {diagramSpec.title.zh}

[DESCRIPTION]
An architectural diagram depicting {diagramSpec.narrative}.

[COMPOSITION]
Layout: {diagramSpec.layout.orientation} composition with {diagramSpec.layout.density} element density.
Focus: {diagramSpec.layout.focusPoint}.
Symmetry: {diagramSpec.layout.symmetry}.

[ELEMENTS]
{For each element in diagramSpec.elements:}
- {element.name}: {element.shape} shape, {element.emphasis} emphasis, representing {element.content}

[RELATIONSHIPS]
{For each relationship in diagramSpec.relationships:}
- {relationship.from} → {relationship.to}: {relationship.type} ({relationship.label})

[COLOR ENCODING]
Color variation encodes: {diagramSpec.colorIntent}
Accent palette: {from style guide}

[STYLE]
{Full style directive from Step 4.1}

[ANNOTATIONS]
{diagramSpec.annotationNotes as comma-separated list}

[ASPECT RATIO]
16:9 landscape for horizontal/timeline layouts
1:1 square for radial/mandala layouts
3:4 portrait for vertical/tree layouts
```

---

**Tool-Specific Adaptations**:

**Midjourney**: Compress to single paragraph. Add `--ar 16:9` (or appropriate ratio). Add `--v 7` and `--style raw`. Prepend with "Technical diagram, " for better results. Remove markdown structure.

**DALL-E**: Keep structured but in natural language paragraphs. Explicitly state "No text in the image" if labels should be added post-generation. Focus on visual description over technical terms.

**Stable Diffusion**: Add negative prompt: "blurry, low quality, 3D render, photorealistic, gradient, shadow, decorative border". Add quality tags: "masterpiece, best quality, ultra detailed". Weight key terms with `(term:1.2)` syntax.

**General** (default): Keep the structured template format as-is — usable with any tool, human illustrator, or diagram software.

### Step 4.3: Assemble & Present

Build the final output document:

```markdown
# Diagram Prompts — {systemName}

> Generated from analysis of `{targetPath}`
> Style: {workflowPreferences.style} | Language: {language} | Target: {genTarget}
> Diagrams: {count}

---

## Shared Style Guide

{Full style directive}

---

## Diagram 1: {title}

**Narrative**: {narrative}

**Prompt**:
{Full generated prompt text}

---

## Diagram 2: {title}

**Narrative**: {narrative}

**Prompt**:
{Full generated prompt text}

---

... (repeat for all diagrams)

---

## Usage Notes

- Each prompt is self-contained — includes style directive
- For best results, generate each diagram separately
- Post-generation: add text labels, annotations, and legend as needed
- Recommended resolution: 2048x2048 or higher for print quality
```

**Presentation**:
1. Display the full document inline to the user
2. Ask if user wants to save to `.workflow/.scratchpad/diagram-prompts-{timestamp}.md`
3. Ask if any diagram needs refinement (adjust elements, change perspective, modify style)

## Output

- **Variable**: `promptSet` — complete prompt document
- **File** (optional): `.workflow/.scratchpad/diagram-prompts-{timestamp}.md`
- **TodoWrite**: Mark Phase 4 completed

## Completion

All phases complete. Present the prompt set and offer refinement options.

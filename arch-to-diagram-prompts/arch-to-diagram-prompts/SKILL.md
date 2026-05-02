---
name: arch-to-diagram-prompts
description: Analyze target system/workflow architecture, extract design essence, and generate multiple diagram prompts in minimalist academic style. Triggers on "arch diagram", "diagram prompts", "架构绘图".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion
---

# Architecture-to-Diagram Prompts

Analyze any target system, workflow, or codebase architecture — extract core design philosophy, command chaining patterns, unique features, and supporting module functions — then decompose into multiple focused diagram prompts in minimalist academic style, ready for AI image generation or manual illustration.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  arch-to-diagram-prompts                                        │
│  Target Path → Discovery → Extraction → Decompose → Prompts    │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Phase 1 │ │ Phase 2 │ │ Phase 3 │ │ Phase 4 │
│Discovery│ │Extraction│ │Decompose│ │ Prompts │
│& Mapping│ │& Essence │ │& Layout │ │Synthesis│
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │
  inventory   essenceDoc  diagramSpecs  promptSet
  (JSON-like)  (structured) (per-diagram) (final output)
```

## Key Design Principles

1. **Universal Target**: Works on any directory — workflow systems, libraries, apps, mono-repos
2. **Delegate-Powered Extraction**: Uses `maestro delegate` for deep analysis when target is large
3. **Multi-Perspective Decomposition**: Each diagram captures one architectural facet — no overloaded diagrams
4. **Style Consistency**: All prompts share a unified minimalist academic visual language
5. **Prompt-Ready Output**: Prompts are self-contained, directly usable with image generation tools

## Interactive Preference Collection

Collect preferences before dispatching to phases:

```
AskUserQuestion:
  1. Target path — directory or file set to analyze
  2. Diagram style preference:
     - "Minimalist Academic" (default) — clean lines, muted palette, sans-serif labels
     - "Technical Blueprint" — schematic, monochrome, precise annotations
     - "Organic Flow" — soft curves, gradient accents, natural metaphors
     - Custom style description
  3. Output language — prompts in English / Chinese / bilingual
  4. Diagram count preference — auto (let system decide) / specific number (3-8)
  5. Image generation target — general (works with any tool) / Midjourney / DALL-E / Stable Diffusion
```

Derive `workflowPreferences`:
- `targetPath`: absolute path to analyze
- `style`: style descriptor string
- `language`: "en" | "zh" | "bilingual"
- `diagramCount`: "auto" | number
- `genTarget`: "general" | "midjourney" | "dalle" | "sd"

## Auto Mode Defaults

When user provides only a target path without interactive preferences:
- `style`: "Minimalist Academic"
- `language`: "bilingual"
- `diagramCount`: "auto"
- `genTarget`: "general"

## Execution Flow

> **COMPACT DIRECTIVE**: Context compression MUST check TodoWrite phase status.
> The phase currently marked `in_progress` is the active execution phase — preserve its FULL content.
> Only compress phases marked `completed` or `pending`.

```
Phase 1: System Discovery & Mapping
   └─ Ref: phases/01-system-discovery.md
      ├─ Input: workflowPreferences.targetPath
      └─ Output: systemInventory (components, relationships, file tree)

Phase 2: Design Essence Extraction
   └─ Ref: phases/02-essence-extraction.md
      ├─ Input: systemInventory + target files
      └─ Output: essenceDoc (philosophy, patterns, features, modules)

Phase 3: Diagram Decomposition
   └─ Ref: phases/03-diagram-decomposition.md
      ├─ Input: essenceDoc + workflowPreferences
      └─ Output: diagramSpecs[] (one spec per diagram)

Phase 4: Prompt Synthesis
   └─ Ref: phases/04-prompt-synthesis.md
      ├─ Input: diagramSpecs[] + workflowPreferences.style/genTarget
      └─ Output: Final prompt set (written to session file)
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose | Compact |
|-------|----------|---------|---------|
| 1 | [phases/01-system-discovery.md](phases/01-system-discovery.md) | Scan target, build component inventory | TodoWrite driven |
| 2 | [phases/02-essence-extraction.md](phases/02-essence-extraction.md) | Extract design philosophy & patterns | TodoWrite driven |
| 3 | [phases/03-diagram-decomposition.md](phases/03-diagram-decomposition.md) | Define diagram types & visual elements | TodoWrite driven + sentinel |
| 4 | [phases/04-prompt-synthesis.md](phases/04-prompt-synthesis.md) | Generate final diagram prompts | TodoWrite driven + sentinel |

**Compact Rules**:
1. **TodoWrite `in_progress`** -> preserve full content
2. **TodoWrite `completed`** -> may compress to summary
3. **Sentinel fallback** -> phases marked sentinel: if only sentinel remains, `Read()` to recover

## Core Rules

1. **Read before extracting** — never assume structure; scan first
2. **One concept per diagram** — each prompt captures exactly one architectural facet
3. **No code in prompts** — diagrams represent abstractions, not implementation details
4. **Style words are sacred** — every prompt includes the style directive verbatim
5. **Bilingual labels** — when language=bilingual, key labels appear in both languages

## Input Processing

User input is converted to structured format:

```
TARGET: [absolute path to analyze]
STYLE: [style descriptor — default "Minimalist Academic"]
LANGUAGE: [en | zh | bilingual]
COUNT: [auto | N]
GEN_TARGET: [general | midjourney | dalle | sd]
```

## Data Flow

```
Phase 1                    Phase 2                   Phase 3                  Phase 4
systemInventory ────────→  essenceDoc ─────────────→ diagramSpecs[] ────────→ promptSet
  ├─ components[]            ├─ corePhilosophy         ├─ [0] overview         ├─ prompt[]
  ├─ relationships[]         ├─ chainPatterns[]         ├─ [1] flow            │   ├─ title
  ├─ fileTree                ├─ uniqueFeatures[]        ├─ [2] modules         │   ├─ prompt_text
  └─ componentTypes{}        ├─ moduleMap{}             ├─ [N] ...             │   ├─ style_dir
                             └─ designDecisions[]       └─ each has:           │   └─ notes
                                                           ├─ title            └─ style_guide
                                                           ├─ perspective
                                                           ├─ elements[]
                                                           └─ relationships[]
```

## TodoWrite Pattern

```
Skill starts:
  → Create 4 high-level tasks (Phase 1-4)

Phase N starts:
  → Mark Phase N as in_progress
  → Sub-tasks attached as needed

Phase N ends:
  → Mark Phase N as completed
  → Next phase begins
```

## Error Handling

1. **Empty target**: AskUserQuestion to get a valid path
2. **Target too large** (>500 files): Auto-scope to top-level + key config files; warn user
3. **Delegate failure**: Fall back to direct file reading (slower but works offline)
4. **No extractable patterns**: Generate fewer diagrams; inform user of limited findings

## Coordinator Checklist

**Before each phase**:
- [ ] Verify previous phase output exists
- [ ] TodoWrite: mark current phase `in_progress`

**After each phase**:
- [ ] TodoWrite: mark current phase `completed`
- [ ] Verify output data structure is populated

**After Phase 4**:
- [ ] Present all prompts to user
- [ ] Ask if any diagram needs refinement or re-generation

## Output Format

Final output is presented inline and optionally saved to `.workflow/.scratchpad/diagram-prompts-{timestamp}.md`:

```markdown
# Diagram Prompts — {System Name}

## Style Guide
{Shared style directive}

## Diagram 1: {Title}
{Full prompt text}

## Diagram 2: {Title}
{Full prompt text}

...
```

# M4 UI Design Brief — Writer Intelligence Dashboard

**Product**: Niko Studio — AI writing assistant for Chinese novelists (Tauri 2 desktop app)
**Phase**: M4 — Writer Intelligence Dashboard
**Date**: 2026-05-03

## Product Context

Niko Studio is a desktop writing tool that helps Chinese novelists plan, write, and refine long-form fiction. It combines a rich text editor (TipTap) with AI-powered narrative intelligence modules running in a Node.js sidecar.

The app uses a **left sidebar + center editor + right panel** layout. Right panels are lazy-loaded overlays that slide in from the right edge. The existing design system is Slate-based with violet accents, supporting light ("Sorbet") and dark ("Aurora/Charcoal") themes.

## Design Challenge

12+ backend narrative intelligence modules (evaluators, analyzers, foreshadowing tracker, pattern detector, session clustering) have no writer-facing UI. Writers see scores but not the intelligence behind them. M4 must surface this data through panels that are:

1. **Scannable** — Writers glance at panels between writing sessions, not during active composition
2. **Actionable** — Each data point should suggest what to do next (fix pacing, plant foreshadowing, develop a character)
3. **Contextual** — Intelligence relates to the current manuscript; excerpts and chapter references ground abstract data

## Target Panels (5)

| # | Panel | Primary Data | Layout Need |
|---|-------|-------------|-------------|
| 1 | **Foreshadowing Tracker** | Plant/hint/harvest events with chapter refs | Timeline or grouped list |
| 2 | **Pattern Dashboard** | Detected narrative patterns (type, frequency, chapters) | Categorized grid or table |
| 3 | **Session Analytics** | Writing session clusters, productivity metrics | Summary cards + list |
| 4 | **Evaluation Drill-Down** | Per-evaluator scores with reasoning | Expandable detail rows |
| 5 | **Character Relationships** | Character-to-character relationship data | Structured list with tags |

## Constraints

- **Extend existing design system** — Use current CSS variables, Tailwind tokens, font stack
- **No new dependencies** — CSS-based layouts only, no graph visualization libraries
- **Right panel width** — 400px (matches existing panel convention)
- **Accessibility** — Focus trap, keyboard navigation, screen reader labels
- **i18n-ready** — All labels through translation keys
- **Dark/light theme** — Must work in both modes

## Existing Design Tokens (Reference)

```
Colors (Light):    bg #f8fafc, surface #ffffff, text #0f172a, border #e2e8f0, accent #4808d1
Colors (Dark):     bg #0f172a, surface #1e293b, text #f8fafc, border #334155, accent #4f46e5
Surfaces:          base → elevated → sunken
Radii:             sm 8px, md 10px, pill 20px
Shadows:           tiny/default/card
Font:              Inter (UI), Merriweather (prose), Fira Code (mono)
Animation:         fadeIn 200ms, slideInRight 250ms
```

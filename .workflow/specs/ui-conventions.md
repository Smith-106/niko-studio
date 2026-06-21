---
title: UI Conventions
readMode: optional
priority: medium
category: ui
keywords:
  - ui
  - design
  - tailwind
  - component
  - shadcn
related:
  - "spec:project:ui-conventions-005"
  - "spec:project:ui-conventions-006"
  - "spec:project:ui-conventions-007"
  - "spec:project:ui-conventions-008"
  - "spec:project:architecture-constraints"
  - "spec:project:coding-conventions"---



# UI Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Framework
- React 18 + TipTap 3.22 (rich text editor)
- Tauri 2 (desktop shell)
- Zustand 4.5 (state management)
- TailwindCSS 3.4

## Component Library
- shadcn-vue + Radix Vue (headless primitives)
- lucide-react (icons)
- All UI components are custom-built (no heavy UI lib)

## Color & Theme
- Dark mode via CSS classes (dark:bg-dark-bg, dark:text-dark-text)
- Semantic color tokens (CSS variables: --surface-base, --primary-cta)
- i18next for zh/en bilingual

## Typography
- Sans: Inter
- Serif: Merriweather
- Mono: Fira Code

## Layout & Spacing
- Tailwind utility-first
- @tanstack/react-virtual for virtual lists
- tippy.js for tooltips

## Component Patterns
- Zustand stores with persist middleware
- React hooks for shared logic
- TipTap extensions for editor features

## Entries

<spec-entry category="ui" keywords="docs-site,page-template,progressive-disclosure" date="2026-06-13" title="Docs page template: 7-section progressive disclosure pattern" description="Concept→Mental model→When to use→How it works→Example→Status→Troubleshooting">
### Docs page template: 7-section progressive disclosure pattern
Concept→Mental model→When to use→How it works→Example→Status→Troubleshooting。
</spec-entry>

<spec-entry category="ui" keywords="docs-site,writing-problem-first,user-centric" date="2026-06-13" title="Concept before mechanics: explain writing problem first then implementation" description="不在 writer-facing docs 中直接使用 Maestro CLI 术语">
### Concept before mechanics: explain writing problem first then implementation
不在 writer-facing docs 中直接使用 Maestro CLI 术语。
</spec-entry>
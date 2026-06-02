---
title: "UI Conventions"
readMode: optional
priority: medium
category: ui
keywords:
  - ui
  - design
  - tailwind
  - component
  - shadcn
---

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
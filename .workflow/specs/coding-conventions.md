---
title: "Coding Conventions"
readMode: required
priority: high
category: coding
keywords:
  - coding
  - style
  - naming
  - import
  - formatting
  - pattern
---

# Coding Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Formatting
- Indentation: 2 spaces
- Line length: not enforced
- Trailing commas: yes (ES5, multi-line)
- Semicolons: no
- Quotes: single (ESLint/Prettier)

## Naming
- Variables/functions: camelCase
- Classes/types/interfaces: PascalCase
- Constants: camelCase
- Files: kebab-case (.ts/.tsx), PascalCase (.vue)
- CSS classes: BEM or utility-first (Tailwind)

## Imports
- Style: named imports (ESM)
- Path aliases: @ → src/
- Order: vue → external → internal → relative

## Patterns
- Vue 3 Composition API with `<script setup lang="ts">`
- Nuxt 3 auto-imports (ref, computed, navigateTo, etc.)
- Pinia stores for state (defineStore + composition style)
- Server routes in server/ (Nitro)
- Composables for shared logic (useAuth, useI18n, etc.)
- Tailwind CSS for styling
- Shadcn-vue + Radix Vue for UI components

## Entries

<spec-entry category="coding" keywords="search,codegraph,代码搜索" date="2026-06-01">

### mcp-semantic-search

代码搜索优先使用 CodeGraph MCP（`mcp__codegraph__codegraph_context`），精确符号查找用 `codegraph_search`/`codegraph_callers`，简单文本匹配用 Grep

</spec-entry>

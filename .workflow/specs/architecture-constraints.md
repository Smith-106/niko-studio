---
title: "Architecture Constraints"
readMode: required
priority: high
category: arch
keywords:
  - architecture
  - module
  - layer
  - boundary
  - dependency
  - nuxt
---

# Architecture Constraints

Auto-generated from project structure. Update manually as architecture evolves.

## Module Structure
- Type: Nuxt 3 monolith (full-stack)
- Key directories:
  - pages/ — 路由页面 (Nuxt 文件路由)
  - components/ — Vue 组件
  - composables/ — 共享组合式函数
  - server/ — Nitro API 路由 + 中间件
  - stores/ — Pinia 状态管理
  - layouts/ — 页面布局
  - plugins/ — Nuxt 插件
  - middleware/ — 路由守卫
  - assets/ + public/ — 静态资源
  - utils/ — 工具函数
  - types/ — TypeScript 类型定义
  - i18n/ — 国际化

## Layer Boundaries
- UI 层: pages/ → components/ → composables/ → stores/
- API 层: server/routes/ → server/utils/ → stores/
- 禁止 server/ 导入前端组件
- Composables 可导入 stores 和 utils
- Components 通过 composables 访问数据，不直接调用 API

## Dependency Rules
- Nuxt auto-imports: ref, computed, navigateTo 等 (无需显式导入)
- 优先用 composables 而非直接在组件中写逻辑
- 服务端路由使用 defineEventHandler + H3

## Technology Constraints
- Runtime: Node.js >= 18
- Framework: Nuxt 3 (Vue 3 + Nitro)
- Module system: ESM
- TypeScript: strict mode
- CSS: Tailwind CSS v3

## Entries

---
type: knowhow
slug: harvest-debug-i18n-split
title: i18n 模块拆分 + index 聚合器模式
tags: i18n,module-split,aggregator-pattern
source: harvest
source_id: 20260525-test-P1-tech-debt-cleanup
fragment_id: HRV-d4e5f6a7
created: 2026-06-13
---

i18n 模块拆分：app/, chat/, evaluation/, mcp/, sidebar/, storybible/。translations.ts (或 index.ts) 聚合所有模块导出。共 11 个 .ts 文件在 i18n/modules/。

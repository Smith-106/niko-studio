---
type: note
slug: harvest-analysis-duplicate-types
title: NarrativeVisualization 类型在 desktop 和 src-ts 间重复定义
tags: narrative-visualization,type-duplication,maintenance-risk
source: harvest
source_id: 20260525-analyze-P2-narrative-visualization-mvp
fragment_id: HRV-a5b6c7d8
created: 2026-06-13
---

API 契约类型在 desktop/src/api/ 和 src-ts/narrative/ 各定义一次。修改一方容易遗漏另一方，维护风险高。决策：创建 src-ts/narrative/types/visualization-types.ts 为单一真源，desktop 重新导出。

---
title: Workflow engine 鍏叡 API camelCase 鍛藉悕绾﹀畾
createdBy: harvest
---
---
type: knowhow
slug: harvest-debug-camelcase-api
title: Workflow engine 公共 API camelCase 命名约定
tags: naming-convention,camelCase,public-API
source: harvest
source_id: 20260525-test-P1-tech-debt-cleanup
fragment_id: HRV-b2c3d4e5
created: 2026-06-13
---

publicEntryApi() 返回 ['route','plan','execute','run','runStream']。src-ts/ 中无 'run_stream' 出现于任何 .ts 文件。确认 camelCase 为公共 API 命名约定。

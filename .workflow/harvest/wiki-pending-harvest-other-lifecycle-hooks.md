---
type: knowhow
slug: harvest-other-lifecycle-hooks
title: OpenStory agent lifecycle: perception→planning→execution→reflection
tags: OpenStory,agent-lifecycle,perception,planning
source: harvest
source_id: 20260507-analysis-P1
fragment_id: HRV-d0e1f2a3
created: 2026-06-13
---

重构 agent base 支持生命周期钩子：perception → planning → execution → reflection。现有能力（sequential-thinking.ts, critic.ts 等）变为可插拔生命周期阶段。映射到 agents/base.ts, factory.ts, skills/skill-loader.ts。Effort: medium, risk: medium。

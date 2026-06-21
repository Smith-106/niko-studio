---
title: Style learning锛氭彁鍙?via builtin-style-analysis锛屾敞鍏?via style_profile
createdBy: harvest
related:
  - "spec:project:coding-conventions-008"
---

---
type: knowhow
slug: harvest-other-m10-style-learning
title: Style learning：提取 via builtin-style-analysis，注入 via style_profile
tags: style-learning,style-profile,style-analysis
source: harvest
source_id: m10-phase1
fragment_id: HRV-a3b4c5d6
created: 2026-06-13
---

Style learning 流程：1) 执行 builtin-style-analysis 工作流提取风格特征；2) 存储 JSON 输出为 Style Profile；3) 注入 Style Profile 到 LLM prompt 上下文用于生成/修订；4) 通过 evaluation 的 style_score 验证。

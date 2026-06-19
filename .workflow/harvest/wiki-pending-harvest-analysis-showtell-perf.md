---
type: note
slug: harvest-analysis-showtell-perf
title: ShowTellDecorations 逐段 selection 触发多次 transaction
tags: performance,ShowTell,editor,transaction-batching
source: harvest
source_id: 20260515-review-deferred-ui-components
fragment_id: HRV-f0a1b2c3
created: 2026-06-13
---

ShowTellDecorations.tsx:32 对每个段落调用 editor.commands.setTextSelection + setMark，触发多次 transaction。文本长时造成明显卡顿。修复：应用 DecorationSet 一次性绘制替代逐段 selection。

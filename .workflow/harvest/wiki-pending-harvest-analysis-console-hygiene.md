---
type: note
slug: harvest-analysis-console-hygiene
title: Desktop 代码库零 console.* 直接调用
tags: console-hygiene,logger,grep-verification
source: harvest
source_id: analysis-console-hygiene
fragment_id: HRV-a3b4c5d6
created: 2026-06-13
---

grep 在 desktop/src/ 只找到 2 处 test/setup.ts（测试基础设施）。所有运行时日志通过 logger 模块。

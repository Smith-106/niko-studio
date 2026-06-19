---
type: note
slug: harvest-m26-chunk-commit-governance
title: M26 交付前工作树 2088 变更文件须分块提交
tags: release,git,governance
source: harvest
source_id: ANL-20260619-fix-remaining-risks
date: 2026-06-20
---

M26 交付前发现工作树积压 ~2088 个变更文件，需按语义分块提交：
- deps: 依赖修复
- cleanup: TODO/console.log 清理
- docs: 监控文档补充
- governance: 治理清理

规范：不允许一次性大杂烩提交，每块 <=5 个 commit，中文 commit message。

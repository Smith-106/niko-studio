---
type: note
slug: harvest-analysis-catalog-issues
title: craft-catalog const 导出架空延迟缓存 + 循环依赖
tags: architecture,performance,circular-dependency,catalog-loader
source: harvest
source_id: 20260525-review-P1-tech-debt-cleanup
fragment_id: HRV-d8e9f0a1
created: 2026-06-13
---

craft-catalog.ts:58-340 中 18 个模块级 const 导出立即调用 getter 函数，同步加载 5 个 JSON 文件，延迟缓存被完全架空。reloadCatalog() 因 const 绑定不可重赋值而 broken。catalog-loader.ts 与 craft-catalog.ts 循环依赖（30+ 类型交叉导入），无法独立编译/测试/替换。修复：抽取 craft-types.ts，改为 lazy getter。

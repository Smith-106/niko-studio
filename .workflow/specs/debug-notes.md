---
title: "Debug Notes"
readMode: optional
priority: medium
category: debug
keywords:
  - debug
  - issue
  - workaround
  - root-cause
  - gotcha
---

# Debug Notes

## Entries

<spec-entry category="debug" keywords="i18n,CJK,slug,normalizeAscii" date="2026-06-13" title="normalizeAscii 剥离 CJK 字符 — slug 生成断裂" description="wiki-schema.ts:92-101 的 normalizeAscii 剥离所有非 ASCII，中文标题 slug 变为 '-'">
### normalizeAscii 剥离 CJK 字符 — slug 生成断裂
wiki-schema.ts:92-101 的 normalizeAscii 剥离所有非 ASCII，中文标题 slug 变为 '-'。
</spec-entry>

<spec-entry category="debug" keywords="SSE,parser,cross-chunk,chat" date="2026-06-13" title="SSE parser 跨 chunk 事件丢失根因" description="currentEvent/currentData 在 while 循环内初始化，跨 chunk 事件被丢弃">
### SSE parser 跨 chunk 事件丢失根因
currentEvent/currentData 在 while 循环内初始化，跨 chunk 事件被丢弃。
</spec-entry>

<spec-entry category="debug" keywords="catalog-loader,lazy-loading-defeated,const-bindings" date="2026-06-13" title="craft-catalog 模块级 const 导出架空延迟缓存" description="18 个模块级 const 立即调用 getter，reloadCatalog 因 const 绑定不可重赋值而 broken">
### craft-catalog 模块级 const 导出架空延迟缓存
18 个模块级 const 立即调用 getter，reloadCatalog 因 const 绑定不可重赋值而 broken。
</spec-entry>
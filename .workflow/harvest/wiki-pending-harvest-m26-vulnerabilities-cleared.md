---
type: note
slug: harvest-m26-vulnerabilities-cleared
title: desktop/src-ts 关键/高危漏洞已清零
tags: security,audit,milestone
source: harvest
source_id: ANL-20260619-fix-remaining-risks
date: 2026-06-20
---

M26 交付前安全审计结论：
- desktop 与 src-ts 的 critical/high 漏洞已清零
- 剩余 low/moderate 漏洞均为开发/构建依赖（esbuild 0.27.3 等待 Vite 升级）
- npm audit --audit-level=high 通过
- 2 个低危 esbuild 漏洞已注册为 issue (ISS-20260619-001, ISS-20260619-002)

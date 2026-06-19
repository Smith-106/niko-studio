---
type: note
slug: harvest-analysis-release-evidence-drift
title: Release NO_GO 根因是 evidence 版本漂移而非功能缺陷
tags: release,NO_GO,evidence-drift,version-mismatch
source: harvest
source_id: analysis-release-evidence-drift
fragment_id: HRV-a1b2c3d4
created: 2026-06-13
---

4 个 blocking FAIL 均源于 v9.2.2 evidence 运行在 v9.2.5 上。功能测试本身全部 PASS。修复：刷新 evidence → 重跑 release_check_summary.py。

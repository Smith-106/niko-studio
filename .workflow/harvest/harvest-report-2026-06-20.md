# Harvest Report — 2026-06-20

## Source
- Type: M26 pipeline (7 artifacts)
- IDs: RMAP-20260618, ANL-20260618, PLN-20260618, EXC-20260618, REV-20260619, TST-20260619, ANL-20260619, PLN-20260619, EXC-20260619
- Path: `.workflow/scratch/20260618-*`, `.workflow/scratch/20260619-*`, `.workflow/.roadmap/`

## Extraction Summary
- Fragments found: 38
- Filtered by confidence ≥ 0.5: 28
- Duplicates skipped: 0

## Routing Results

### Wiki (7 entries)
| # | Type | Slug | Title | Status |
|---|------|------|-------|--------|
| 1 | knowhow | harvest-m26-dual-engine-extensibility | DualEngine 架构支持横向扩展新检测引擎 | CREATED |
| 2 | knowhow | harvest-m26-de-ai-revision-service | De-AI rewrite 通过 IRevisionService 注入 | CREATED |
| 3 | knowhow | harvest-m26-reader-coverage-baseline | M26 Reader 模块测试覆盖率 98.67% 基线 | CREATED |
| 4 | knowhow | harvest-m26-ai-templates-dedup | AI_TEMPLATE_PATTERNS 需跨模块去重提取 | CREATED |
| 5 | spec | harvest-m26-reader-closed-loop | 读者模拟闭环: 分析→模拟→修订→反馈 | CREATED |
| 6 | note | harvest-m26-vulnerabilities-cleared | desktop/src-ts 关键/高危漏洞已清零 | CREATED |
| 7 | note | harvest-m26-chunk-commit-governance | M26 交付前工作树 2088 变更文件须分块提交 | CREATED |

### Spec (6 entries)
| # | Type | Content (truncated) | Status |
|---|------|---------------------|--------|
| 1 | arch | Anti-AI-flavor 采用独立 detector 层 | ADDED |
| 2 | arch | De-AI rewrite 复用 IRevisionService.revise | ADDED |
| 3 | arch | 前后端 ConsensusReport 统一 | ADDED |
| 4 | arch | 自定义画像持久化 .niko-studio/reader-personas.json | ADDED |
| 5 | coding | 前端新建 reader.ts API 层复用 callApi/ApiResponse 模式 | ADDED |
| 6 | quality | console.log 统一替换为 logger 或删除 | ADDED |

### Issue (15 entries)
| # | Severity | Title | ID | Status |
|---|----------|-------|-----|--------|
| 1 | high | ConsensusEngine calculateDimensionSummaries 除零风险 | ISS-20260620-001 | CREATED |
| 2 | high | RevisionService LLM 调用缺 HTTPS 协议校验与超时 | ISS-20260620-002 | CREATED |
| 3 | medium | AI_TEMPLATE_PATTERNS 重复条目膨胀匹配计数 | ISS-20260620-003 | CREATED |
| 4 | medium | /reader/feedback modify 操作不触发权重调整 | ISS-20260620-004 | CREATED |
| 5 | medium | DetailPanel 按 description 字符串匹配 OverlayMarker | ISS-20260620-005 | CREATED |
| 6 | medium | RevisionService weak points 仅基于原始文本 | ISS-20260620-006 | CREATED |
| 7 | medium | reader endpoints 无文本长度限制 | ISS-20260620-007 | CREATED |
| 8 | medium | NIKO_WORKFLOW_WORKSPACE 环境变量未校验路径穿越 | ISS-20260620-008 | CREATED |
| 9 | medium | persona weight 参数未校验 NaN/Infinity/越界 | ISS-20260620-009 | CREATED |
| 10 | medium | ReportGenerator 直接导入后端 ConsensusEngine 类型 | ISS-20260620-010 | CREATED |
| 11 | medium | reader-endpoints 多个手动单例 + 模块级可变状态 | ISS-20260620-011 | CREATED |
| 12 | medium | DIMENSION_TO_PARAM 12 条映射冗余 | ISS-20260620-012 | CREATED |
| 13 | medium | AI 模板模式在 detector 和 revision-service 间重复且已分化 | ISS-20260620-013 | CREATED |
| 14 | medium | ReportGenerator dimensionSummaries fallback 覆盖 avgScore | ISS-20260620-014 | CREATED |
| 15 | low | RevisionService 动态 import .js 扩展名绕过类型检查 | ISS-20260620-015 | CREATED |

## Skipped
| Fragment | Reason |
|----------|--------|
| 10 low-severity review findings | Confidence < 0.5 threshold (BP-001/002/003, MAINT-003/004, ARCH-003 rerouted to issue at lower confidence) |

## State Updates
- 9 artifacts marked harvested=true in state.json
- harvest-log.jsonl updated with 28 fragment entries (HRV-m26*)

## Key Decisions Captured
1. Anti-AI-flavor 独立 detector 层 → spec (arch)
2. De-AI rewrite 复用 IRevisionService → spec (arch)
3. 前后端 ConsensusReport 统一 → spec (arch)
4. 自定义画像持久化 JSON → spec (arch)
5. Reader API 层复用 callApi → spec (coding)
6. console.log→logger → spec (quality)

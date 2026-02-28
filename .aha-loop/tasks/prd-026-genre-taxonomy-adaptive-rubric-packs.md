# PRD: Genre Taxonomy and Adaptive Rubric Packs

**ID:** PRD-026
**Milestone:** M6
**Status:** Pending

## Overview

Define canonical genre taxonomy and map each genre to rubric packs for quality scoring.

## Context

Different genres require different quality expectations. A single universal rubric has weak signal quality for specialized narrative forms.

## Goals

- Freeze canonical genre taxonomy and multi-tag mapping rules.
- Define rubric-pack schema and loading strategy by genre.
- Keep rubric behavior deterministic across CLI/UI execution surfaces.

## Canonical Genre Taxonomy

- Suspense/Detective（悬疑推理：侦探、破案、解谜）
- Modern Romance（现代言情：都市、职场、恋爱）
- Ancient Romance（古代言情：宫廷、江湖、穿越）
- Fantasy/Xuanhuan（奇幻玄幻：魔法、异世界、修真）
- Sci-Fi/Future（科幻未来：科技、太空、末世）
- Wuxia/Xianxia（武侠仙侠：江湖、门派、飞升）
- Alternate History（历史架空：朝堂、战争、权谋）
- Urban Realism（都市现实：生活、成长、社会）

## Rubric Pack Mapping (Minimum)

- Suspense/Detective: clue continuity, fair-play reveal, misdirection quality, resolution coherence.
- Modern Romance: character chemistry progression, emotional plausibility, relationship conflict cadence.
- Ancient Romance: etiquette/title consistency, historical-culture plausibility, court/jianghu role logic.
- Fantasy/Xuanhuan: power-system consistency, world-rule continuity, progression pacing.
- Sci-Fi/Future: tech assumption consistency, causality plausibility, world-state continuity.
- Wuxia/Xianxia: sect hierarchy logic, cultivation ladder consistency, martial-system coherence.
- Alternate History: era plausibility, institution consistency, chronology continuity, warfare/politics realism.
- Urban Realism: social-context authenticity, profession detail plausibility, everyday-scene believability.

## User Stories

### US-001: 类型体系标准化
- 作为作者，我希望在固定类型体系中选择/组合题材，以便稳定获得匹配规则。
- 范围：类型枚举、别名映射、多标签策略。

### US-002: 类型评分卡包加载
- 作为作者，我希望系统按类型自动加载评分卡，以便评估标准与题材一致。
- 范围：rubric pack schema、加载顺序、冲突合并策略。

### US-003: 执行面一致性
- 作为维护者，我希望 CLI/UI 对同一 profile 使用同一 rubric 结果，以便避免分歧。
- 范围：同源配置、序列化结构、一致性校验。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 收集现有 genre 字段与评价维度使用点。
- 盘点可复用 quality score 结构。

### Phase P: Plan Review
- 冻结类型清单与别名表。
- 确定 rubric pack 合并优先级与冲突策略。

### Phase I: Implement
- I1（US-001）：实现类型体系与 profile 绑定。
- I2（US-002）：实现 rubric pack 注册与加载机制。
- I3（US-003）：统一 CLI/UI 评分卡输出结构。

### Phase Q: Quality
- Q1：单测覆盖类型映射、rubric 加载与冲突合并。
- Q2：集成验证多类型项目评分结果稳定。
- Q3：证据验证 CLI/UI 一致性输出可追溯。

## Dependencies

- PRD-025: Novel Profile and Scoped Reference Library.

## Acceptance Criteria

- [ ] Canonical genre taxonomy is defined and persisted.
- [ ] Rubric packs are selected/merged by profile genres deterministically.
- [ ] CLI/UI outputs use the same rubric mapping contract.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*

---
title: "Learnings"
readMode: optional
priority: medium
category: learning
keywords:
  - bug
  - lesson
  - gotcha
  - learning
---

# Learnings

## Entries

<spec-entry category="learning" keywords="writing-craft,knowledge-integration,Record-pattern,enum-driven" date="2026-05-07" source="milestone-complete">

### 写作知识引擎的数据驱动架构模式

M13 成功将 54 本写作书籍 + 4 条悬疑路径 + 5 卷网文研究的结构化知识整合到 niko-studio 分析引擎中。

核心模式：每个知识模块使用 `enum + interface + Record<Enum, Interface> + 检测函数` 的四层结构。这确保了：
- 类型安全（enum 驱动所有 key）
- 可扩展（新增知识只需添加枚举值 + record entry）
- 可测试（每个检测函数可独立验证）
- 与 LLM 分析器解耦（关键词检测作为第一层，LLM 作为增强层）

此模式已在 `plot-templates.ts`（20 种情节模式）、`archetype-catalog.ts`（45 种原型）、`craft-catalog.ts`（SUBGENRE_RULES + SATISFACTION_PATTERNS）中验证。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="Chinese-web-novel,reader-satisfaction,satisfaction-density,hook-detection" date="2026-05-07" source="milestone-complete">

### 中文网络文学的读者满意度量化分析

基于《中国网络文学阅读潮流研究》（5 卷）实现的 `reader-satisfaction-analyzer.ts` 提供了：
- 4 层爽点模型（生理/心理/社交/成就）
- 章节钩子检测（5 种类型：悬念/问题/预告/威胁/承诺）
- 期待-延迟-释放节奏分析
- 爽点密度（每千字）量化

关键发现：中文网文的读者留存与爽点密度高度相关（黄金三章法则），这与西方创意写作教学中强调的 "tension curve" 有本质差异。两种传统互补使用效果最佳。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="suspense-subgenre,本格推理,社会派,公平线索,detective-fiction" date="2026-05-07" source="milestone-complete">

### 悬疑流派的规则化检测

4 种悬疑流派的规则检测（本格推理/社会派/硬汉派/惊悚悬疑）通过 `SuspenseSubgenre` + `SUBGENRE_RULES` 实现。

每种流派定义：
- `coreRules`（必须遵守的创作规则）
- `requiredElements`（必须出现的元素）
- `forbiddenElements`（禁止出现的内容）
- `keywords`（典型/非典型信号词）

检测通过 `typical keyword 命中率 + required elements 覆盖率 - atypical 惩罚分` 计算置信度。第一版使用关键词匹配，后续可接入 LLM 进行深度语义分析。
Milestone: M13

</spec-entry>

<spec-entry category="learning" keywords="release,evidence-refresh,dependency-order" date="2026-06-13" title="先修 gate 再刷 evidence — 否则产生无效 NO_GO 证据" description="若先刷新 retained evidence 再修脚本，会产生更新但仍无效的 NO_GO 证据。不可 blanket disable triage blocker">
### 先修 gate 再刷 evidence — 否则产生无效 NO_GO 证据
若先刷新 retained evidence 再修脚本，会产生更新但仍无效的 NO_GO 证据。不可 blanket disable triage blocker。
</spec-entry>

<spec-entry category="learning" keywords="BookWorld,ablation,environment-response,scene-mode" date="2026-06-13" title="BookWorld ablation：移除环境响应损害沉浸感；移除场景模式损害所有维度" description="验证 win rate 75.36%，环境响应和场景模式是核心贡献因子">
### BookWorld ablation：移除环境响应损害沉浸感；移除场景模式损害所有维度
验证 win rate 75.36%，环境响应和场景模式是核心贡献因子。
</spec-entry>

<spec-entry category="learning" keywords="decision-threshold,writing,critic,quality,alignment" date="2026-06-18" title="决策阈值不一致已修复" description="writing.ts 与 critic.ts 的 totalScore 阈值统一为 APPROVED>=80, REVISE>=60, REWRITE<60">
### 决策阈值不一致已修复
writing.ts 使用 totalScore >= 40 判定 REWRITE 但 critic.ts 使用 >= 60。修复后统一为：APPROVED >= 80, REVISE >= 60, REWRITE < 60。移除了未文档化的 HUMAN_REVIEW 层级。
</spec-entry>

<spec-entry category="learning" keywords="autonovel,competitor-analysis,AI-novel-pipeline,quality-control" date="2026-06-18" title="autonovel 竞品分析：端到端 AI 小说生成管道的关键洞察" description="NousResearch/autonovel 展示了完整的 AI 小说生成管道，其双层质量控制系统和反 slop 机制值得借鉴">

### autonovel 竞品分析：端到端 AI 小说生成管道的关键洞察

**项目**: https://github.com/NousResearch/autonovel (1.2k stars, 229 forks)

**核心架构**:
- 5 层协同演化文档：voice.md → world.md → characters.md → outline.md → chapters/
- 4 阶段管道：Foundation → First Draft → Revision → Export
- 双层质量控制系统：
  - 机械层：regex 禁用词 + 结构反模式检测（OVER-EXPLAIN, TRIADIC LISTING 等）
  - LLM 层：Claude Opus 双角色评审（文学评论家 + 小说教授）
- 读者模拟：4 人格评审面板（编辑/类型读者/作家/初读者）

**与 niko-studio 的差异与启示**:
1. **autonovel 优势**: 完整的出版级输出（LaTeX PDF + ePub + 有声书 + 封面），niko-studio 目前缺少排版和导出能力
2. **niko-studio 优势**: 更丰富的中文写作知识库（54 本书 + 网文研究），更精细的读者满意度分析（爽点密度/钩子检测）
3. **可借鉴点**: 反 slop 检测机制（ANTI-SLOP.md + ANTI-PATTERNS.md）可补充到 writing-craft 分析器中；Elo 章节对比可用于 niko-studio 的章节质量排序
4. **关键差距**: autonovel 已实现端到端自动化，niko-studio 的 AI 共创引擎仍需人工介入较多

**Why**: 了解竞品技术路线有助于定位 niko-studio 的独特价值和改进方向。
**How to apply**: 将 autonovel 的反 slop 检测和双层质量控制思想整合到 niko-studio 的写作分析引擎中，同时保持中文写作知识库的优势壁垒。

</spec-entry>

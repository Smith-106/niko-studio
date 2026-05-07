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

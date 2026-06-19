# Context: M14 — 写作知识引擎扩展 Phase 1

**Date**: 2026-05-07
**Source**: ANL-m14-writing-craft-2026-05-07
**Areas discussed**: Frey叙事技巧、麦基角色弧线、救猫咪2类型片节拍、情感描写层次、大纲质量、人设心理模型

## Decisions

### Decision 1: 扩展现有模块 vs 新建模块
- **Context**: M13 已建立 `enum+interface+Record+detector` 四层模式，新增知识应融入现有架构
- **Options**:
  1. 扩展现有 writing-craft/ 模块（在现有文件中追加知识数据）
  2. 新建独立模块文件（每个新知识源一个独立文件）
- **Chosen**: 选项 1 — 扩展现有模块
- **Reason**: 与 M13 模式一致，避免 barrel export 膨胀，减少开发者需要了解的文件数量

### Decision 2: Frey高级叙事技巧存储位置
- **Context**: Frey的劲爆小说和悬疑小说创作指导提供了2套叙事技巧体系
- **Options**:
  1. 新建 `writing-craft/frey-narrative.ts`
  2. 追加到 `craft-catalog.ts` 的 NARRATIVE_TECHNIQUES 区域
- **Chosen**: 选项 2 — 追加到 craft-catalog.ts
- **Reason**: craft-catalog.ts 已是写作知识的中央注册表；避免碎片化

### Decision 3: 麦基角色弧线模型集成方式
- **Context**: 麦基《人物》提供了角色弧线的深层转变理论
- **Options**:
  1. 扩展 `archetype-catalog.ts`（在原型定义中增加弧线维度）
  2. 扩展 `character-depth.ts`（在5维评分中增加弧线评估）
- **Chosen**: 选项 2 — 扩展 character-depth.ts
- **Reason**: 弧线是动态变化过程，更接近深度评分；archetype-catalog 聚焦静态原型定义

## Constraints

### Locked
- 必须使用 M13 验证的 `enum+interface+Record+detector` 四层模式
- 所有新检测函数必须返回结构化结果对象（带 confidence/evidence/suggestions）
- 测试用 vitest，遵循现有 test 目录结构
- barrel export 通过 `writing-craft/index.ts` 统一管理
- 关键词检测为第一层，LLM 为增强层（保持架构一致性）

### Free
- 实现者可根据知识源结构选择合适的 enum 粒度
- 检测函数的具体关键词列表由实现者根据知识源内容确定
- 测试文件可以新建或追加到已有测试文件（视任务大小决定）
- emotion-craft 的增强方式：追加 EMO_LAYERS 或修改现有 evaluate 函数均可

### Deferred
- 互动叙事设计（剧本游戏写作入门）— 需要跨领域知识
- 游戏叙事结构（游戏剧本怎么写）— 不适合当前纯文本分析引擎
- 《一个故事的99种讲法》— 漫画叙事形式，与当前文本分析差异大
- 《网文成才21天》《写作高手速成手册》— 实操指导性质，非结构化知识
- 《南周评论写作课》— 评论/议论文写作，非虚构叙事
- 《怎样讲好一个故事》— 口语叙事，与写作分析差异大

## Code Context

### 现有目标模块
- `src-ts/narrative/writing-craft/craft-catalog.ts` — 中央知识注册表（SATISFACTION_PATTERNS, SUSPENSE_SUBGENRES, DIALOGUE_RULES, STORY_STRUCTURES, WEB_NOVEL_PSYCHOLOGY）
- `src-ts/narrative/suspense-analyzer.ts` — 悬疑分析器（Frey三柱 + Bell三幕 + 蔡骏设局解局 + 流派检测）
- `src-ts/narrative/character-depth.ts` — 角色深度（5维评分 + 人格类型）
- `src-ts/narrative/writing-craft/emotion-craft.ts` — 情感描写（show/tell 检测）
- `src-ts/narrative/premise-validator.ts` — 前提验证
- `src-ts/narrative/writing-craft/index.ts` — barrel exports

### M13 已有模式参考
- `PLOT_PATTERNS: Record<PlotPattern, PlotPatternDef>` — 20种情节模板
- `ARCHETYPE_CATALOG: Record<CharacterArchetype, ArchetypeDef>` — 45种原型
- `SUBGENRE_RULES: Record<SuspenseSubgenre, SubgenreRules>` — 4种悬疑流派
- `SATISFACTION_PATTERNS: Record<SatisfactionPattern, SatisfactionPatternDef>` — 10种爽点模式

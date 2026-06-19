---
name: outline-generator
description: 提纲生成技能，负责把主题、角色与冲突整理成可直接开写的章节结构和场景卡
version: "2.0"
author: niko-studio
tags: [writing, outline, structure, planning, chapter-design]
triggers:
  - 用户请求生成小说、文章或项目提纲
  - 已有主题或角色，但缺少稳定结构
  - 章节写作反复发散，需要先固化路径
  - 用户要求“先给我大纲，再开始写正文”
requires:
  - topic: 主题、题材或故事 premise
  - goal: 写作目标、目标读者或预期效果
optional:
  - cast: 主要角色
  - expected_length: 预计篇幅或章节数
  - structure_preference: 三幕 / 线性 / 问题-分析-方案 / 其他
outputs:
  - master_outline: 分层提纲
  - scene_cards: 可直接用于章节写作的场景卡
---

# Outline Generator

## 技能定位

本技能的目标不是“把想法说得更完整”，而是把模糊想法压缩成可执行结构：

- 明确主线问题是什么。
- 明确角色要什么、为什么拿不到、代价是什么。
- 明确每一章存在的功能，而不是只给标题。
- 为 `novel-chapter` 提供可直接消费的场景卡。

## 适用场景

- 从 0 到 1 起一个故事或长文结构。
- 已有设定、人物或若干片段，但缺少可推进骨架。
- 中段写崩了，需要回到结构层重新组织。
- 希望在写正文前先验证节奏、转折和章节功能。

## 不适用场景

- 只需要改写一个已成型章节的表达。
  这时使用 `revision-craft`。
- 只需要分析现有故事的问题而不生成结构。
  这时使用 `script-doctor`。

## 核心原则

1. 每一章都必须承担功能。
2. 大纲不是摘要，而是行动顺序。
3. 不同时求“完整世界观”与“立刻可写”，先保可写。
4. 结构优先于措辞，顺序优先于漂亮概念。

## 输入整理

执行前先把用户输入压成下面的骨架：

```yaml
outline_input:
  topic: ""
  premise: ""
  protagonist: ""
  protagonist_goal: ""
  primary_obstacle: ""
  stakes: ""
  target_reader: ""
  target_length: ""
```

若 `protagonist_goal`、`primary_obstacle`、`stakes` 三项缺两项以上，不直接产提纲，先补问题。

## 工作流

### Step 1：定义结构任务

先判断本次大纲是：

- `全书/全项目提纲`
- `单卷提纲`
- `单章到多章提纲`
- `问题修复式提纲`

不同范围的提纲，粒度不同：

- 全书级：写到幕与章节功能。
- 单卷级：写到章节目标与关键转折。
- 单章级：写到场景卡。

### Step 2：给出结构候选

至少给出 2 到 3 个结构方向，再收束成一个主方案。

优先候选：

- 三幕结构
- 场景推进结构
- 问题升级结构

参考资源：
- `techniques/three-act-structure.md`
- `templates/outline_template.md`

### Step 3：选主结构并细化

确定一个主结构后，细化时必须包含：

- 每章目标
- 每章冲突
- 每章局面变化
- 每章结束后留给下一章的接口

禁止只输出“第 1 章：主角出场，第 2 章：发生事件”这种无功能标题流。

### Step 4：生成场景卡

当提纲要给 `novel-chapter` 使用时，必须继续下钻到场景卡。

每张场景卡至少包含：

- POV
- objective
- conflict
- stakes
- outcome
- plot_beat
- foreshadowing

参考模板：
- `templates/scene_card_template.md`

### Step 5：可写性检查

提交前检查：

- 是否存在重复章节功能。
- 是否存在没有冲突的空章节。
- 是否存在关键转折缺少前置铺垫。
- 章节终点能否自然导向下一章。

## 与其他技能的边界

- 当已经有稳定提纲，需要开始产正文时，切到 `novel-chapter`。
- 当提纲问题在于人物动机不成立，调用 `character-forge`。
- 当提纲问题在于主命题与设定不稳，调用 `premise-magic` 或 `worldview-craft`。

## 输出契约

默认输出必须包含 2 层：

```markdown
# Master Outline

## 项目信息
- 题材：
- 主题命题：
- 目标读者：
- 预计章节数：

## 三幕 / 主结构总览
- 第一幕：
- 第二幕：
- 第三幕：

## 章节清单
### 第 1 章
- 章节目标：
- 关键冲突：
- 局面变化：
- 章尾接口：

### 第 N 章
- 章节目标：
- 关键冲突：
- 局面变化：
- 章尾接口：
```

如果用户明确要求可直接开写，还要追加：

```markdown
# Scene Cards

## Scene 1
- pov:
- objective:
- conflict:
- stakes:
- outcome:
- plot_beat:
```

## 成功标准

一个合格的大纲应满足：

- 不看正文，也知道故事怎么推进。
- 任取一章，都能说出这一章为什么必须存在。
- 给 `novel-chapter` 后，能够直接开始写，而不是重新猜结构。

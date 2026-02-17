---
name: worldbuilding
description: 世界观构建技能，帮助建立可叙事、可持续、可检验的故事世界
version: "1.0"
author: niko-studio
tags: [writing, worldbuilding, setting, planning]
triggers:
  - 用户请求构建世界观
  - 设定很多但缺少规则闭环
  - 剧情推进与世界规则冲突
requires:
  - genre: 题材类型
  - core_conflict: 核心冲突
  - protagonist: 主角与关键角色
outputs:
  - 世界观骨架
  - 规则约束与例外边界
  - 可直接复用的设定条目
---

# Worldbuilding

## 适用场景
- 新开题材，需要快速搭建可写作设定。
- 中后期发现设定不自洽，影响剧情可信度。
- 需要把零散灵感整理为统一世界手册。

## 执行步骤
1. 锁定叙事目标。
   - 这个世界要放大什么冲突。
   - 读者要在其中体验什么问题。
2. 搭建三层骨架。
   - 底层规则：自然法则、超常系统、资源约束。
   - 中层结构：社会秩序、权力分配、组织关系。
   - 表层呈现：地理风貌、日常习俗、语言符号。
3. 建立因果闭环。
   - 每条核心设定都回答“为什么存在、如何运转、失效后果”。
4. 对齐角色与剧情。
   - 主角目标必须与世界规则发生真实摩擦。
   - 关键冲突必须能在该世界里独有地成立。
5. 产出世界手册。
   - 统一术语、时间线、禁忌和例外条件。

## 技术清单
- `techniques/magic-system.md`
- `techniques/society-structure.md`
- `techniques/history-building.md`
- `templates/world_bible.md`

## 输出模板
```markdown
## 世界观摘要
- 一句话设定：
- 核心矛盾：
- 叙事价值：

## 规则清单
1. 规则：
   - 运作方式：
   - 边界与代价：
   - 剧情影响：

## 社会结构
- 权力中心：
- 底层秩序：
- 冲突断层：

## 历史锚点
- 关键事件：
- 当前后遗症：
```

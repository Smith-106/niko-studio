---
name: revision-craft
description: 修订工艺技能，负责对既有草稿做结构、节奏、表达和一致性的分层修复
version: "2.0"
author: niko-studio
tags: [writing, revision, editing, quality, rewrite]
triggers:
  - 用户请求润色、重写、精修
  - 草稿存在逻辑断裂、节奏失衡或口吻漂移
  - 章节评估后需要进入定向修订
requires:
  - draft: 待修订文本
  - target_style: 目标风格、目标效果或不能破坏的约束
optional:
  - issue_focus: 结构 / 节奏 / 描写 / 对话 / 一致性
  - preserve_list: 必须保留的信息或句段
outputs:
  - revised_draft: 修订后文本
  - change_log: 修改说明与后续待办
---

# Revision Craft

## 技能定位

`revision-craft` 不是随手润色器，而是“分层修订器”：

- 先判断问题在哪一层。
- 按层级顺序修，不乱序散改。
- 只做必要修改，不把原稿改成另一篇文章。

它尤其适合承接 `novel-chapter` 的低分维度修复。

## 适用场景

- 初稿可读，但结构、节奏或文风明显不稳。
- 章节功能正确，但局部表达拖后腿。
- 需要一轮有说明、有边界、有可追踪记录的修订。

## 不适用场景

- 还没有成稿。
  这时先用 `novel-chapter` 或 `outline-generator`。
- 用户要的是系统化诊断，而不是修文本身。
  这时优先 `script-doctor`。

## 修订原则

1. 先修结构，再修节奏，再修句子。
2. 每轮只解决一类主问题，不混改。
3. 保留原意、关键信息和有效段落。
4. 不为了“更文学”而擅自改剧情、设定或人物立场。

## 分层诊断

开始修订前，先给草稿打标签：

| 层级 | 典型问题 | 处理策略 |
|------|----------|----------|
| 结构层 | 顺序错乱、重复、场景功能缺失 | 先重排、删冗、补桥接 |
| 节奏层 | 解释过长、冲突过短、张弛失衡 | 压缩低价值段，放大关键段 |
| 表达层 | 句式单调、抽象、描写失衡 | 局部重写，增强具体性 |
| 一致性层 | 人称、时态、术语、口吻漂移 | 统一规则并回查全文 |

如果结构层有明显问题，不允许直接跳去做句子美容。

## 工作流

### Step 1：问题标注

先输出一个简短问题清单：

- 哪些是必须修改的问题。
- 哪些是建议修改的问题。
- 哪些问题暂时不动，避免过修。

### Step 2：确定本轮修订范围

本轮只选一个主问题类型：

- `structure-pass`
- `pacing-pass`
- `description-pass`
- `dialogue-pass`
- `consistency-pass`

参考资源：
- `techniques/pacing-adjustment.md`
- `techniques/description-balance.md`
- `techniques/dialogue-polish.md`
- `techniques/tension-enhancement.md`
- `templates/revision_checklist.md`

### Step 3：执行最小有效修改

操作要求：

1. 先保留有效段落，再修改问题段落。
2. 删除重复信息，而不是换一种说法重复一遍。
3. 对于结构问题，优先移动、合并、删减，不急着扩写。
4. 对于表达问题，优先把抽象词换成具体证据。

### Step 4：一致性回查

至少回查以下项目：

- 人称是否稳定。
- 时态是否稳定。
- 角色口吻是否符合人设。
- 新增句段是否破坏设定与前后逻辑。

### Step 5：输出修改说明

修订结果必须可追踪，不能只给成稿。

## 路由建议

根据问题类型选择协作技能：

- 沉浸感不足：`show-dont-tell`、`expression-craft`
- 对话发僵：`tone-craft`、`dialogue-system`
- 张力不足：`suspense-craft`、`tension-scene`
- 人物失真：`character-forge`、`psychology-craft`
- 叙述口吻漂移：`voice-workshop`

`revision-craft` 负责总修，不替代这些专项技能。

## 输出契约

```markdown
## Revised Draft
[修订后文本]

## Change Log
1. [位置]：[问题类型] -> [修改动作] -> [预期收益]
2. [位置]：[问题类型] -> [修改动作] -> [预期收益]

## Remaining Risks
- [仍未处理的问题]

## Next Pass Recommendation
- [下一轮应该优先处理什么]
```

## 完成标准

一轮合格修订应满足：

- 主要问题数量明显下降。
- 文本没有因为修订而出现新的设定冲突。
- 用户能看懂你改了什么、为什么改。

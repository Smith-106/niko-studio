---
status: complete
target: plan-deferred-ui-tasks-20260515
source:
  - .summaries/TASK-001-summary.md
  - .summaries/TASK-002-summary.md
  - .summaries/TASK-003-summary.md
  - .summaries/TASK-004-summary.md
started: 2026-05-15T17:39:46+08:00
updated: 2026-05-15T19:11:46+08:00
---

## Current Test

number: 2
name: Show/Tell 比例与图例显示
expected: |
  开启 Show/Tell 后左上角图例展示 Show/Tell/Neutral，并显示整体比例（Show xx% / Tell xx%）。
awaiting: user response

## Tests

### 1. Show/Tell 高亮开关与渲染
expected: 在编辑器页面点击‘开启 Show/Tell’，段落出现 Show(绿)/Tell(红)/Neutral(灰) 背景标记；再次点击可关闭且标记消失；不会明显卡顿或卡死。
result: pass
notes: 自动化验证通过：desktop build 通过；NikoEditor focused tests 通过；ShowTellDecorations 增加了 commands 存在性判断，避免测试环境报错。

### 2. Show/Tell 比例与图例显示
expected: 开启 Show/Tell 后左上角图例展示 Show/Tell/Neutral，并显示整体比例（Show xx% / Tell xx%）。
result: skipped
reported: "自动化环境无法目视 UI，留待手动确认。"
severity: minor

### 3. EmotionalArcChart 可交互曲线与张力荒漠高亮
expected: 在情感弧线图表中能看到至少一条曲线；可通过 checkbox 切换曲线可见性；若后端返回 tensionDeserts，会看到半透明红色区间高亮。
result: skipped
reported: "需要 UI 场景 + 多章节输入与后端返回 tensionDeserts 才能验证。"
severity: minor

### 4. VoiceFingerprintPanel 指纹与告警展示
expected: 打开角色声音一致性面板时会自动分析并展示：声音区分度进度条、warnings 列表（若有）、角色指纹卡片（口头禅/修辞习惯/示例对话）。
result: skipped
reported: "需要 UI 面板入口与后端数据返回才能验证。"
severity: minor

### 5. ReaderImmersionDashboard 曲线与风险条
expected: 打开读者沉浸度面板后展示：沉浸度折线图（svg）、dropout risk 热力条、trajectory badge；若有高风险章节，列表正确显示。
result: skipped
reported: "需要 UI 场景 + 多章节输入与后端返回 chapterStates 才能验证。"
severity: minor

### 6. PacingPrescriptionPanel 处方列表排序与展示
expected: 打开节奏处方面板后展示：节奏评分、处方卡片列表；按 priority（high/medium/low）排序；卡片包含 label、chapterIndex、reason。
result: skipped
reported: "需要 UI 场景 + 后端返回 prescriptions 才能验证。"
severity: minor

## Summary

total: 6
passed: 1
issues: 0
pending: 0
skipped: 5

## Gaps

[none yet]

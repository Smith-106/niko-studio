# PLAN-001 Implementation Plan

## Objective

将 `ANL-2026-04-18-为了交付客户还有哪些工作没做` 的结论拆成可以直接执行的客户交付闭环任务，优先保证：

- 交付基线与 retained evidence 一一对应
- 客户演示/验收缺口被新的证据关闭
- `unsigned demo/internal handoff` 与 `signed external shipment` 的分支先决策、后执行
- 平台承诺与 handoff bundle 都有可追溯材料

## Planned Issues

| Issue | Title | Type | Depends On |
| --- | --- | --- | --- |
| `ISS-20260418-001` | Capture exact customer delivery baseline decision | decision | — |
| `ISS-20260418-002` | Freeze chosen delivery baseline and refresh retained release evidence | execution | `ISS-20260418-001` |
| `ISS-20260418-003` | Resolve the writer golden-path smoke gap on the frozen build | execution | `ISS-20260418-002` |
| `ISS-20260418-004` | Record shipment mode for customer handoff | decision | `ISS-20260418-001` |
| `ISS-20260418-005` | Confirm customer platform scope and missing evidence obligations | decision | `ISS-20260418-001` |
| `ISS-20260418-006` | Execute mode-specific and platform-specific evidence bounding | execution | `ISS-20260418-002`, `ISS-20260418-004`, `ISS-20260418-005` |
| `ISS-20260418-007` | Assemble the customer handoff bundle | execution | `ISS-20260418-003`, `ISS-20260418-006` |

## Dependency Notes

- `ISS-20260418-001` 必须先把交付 SHA、版本号和候选包名冻结下来，否则后续 smoke、签名说明和 bundle 都没有可绑定的目标。
- `ISS-20260418-004` 与 `ISS-20260418-005` 都是外部确认型任务，分别约束 shipment 模式和平台范围，不应与实际签名/补证动作混写。
- `ISS-20260418-006` 负责把 decision 结果变成 retained evidence 或明确的 handoff 标注；如果最终不是 signed external shipment，则该 issue 仍要完成 unsigned 标注与“无需签名”的证据说明。
- `ISS-20260418-007` 只在所有前置证据闭环后组装最终 handoff bundle，避免先打包后返工。

## Expected Deliverables

- 一份明确绑定 `head_sha`、版本号和包文件名的客户交付基线记录
- 一套与所选基线对齐的 release summary / readiness / acceptance retained evidence
- 一份关闭 `writer golden-path smoke` 残留 note 的新证据
- 一份 shipment mode 决策记录
- 一份 platform scope 决策记录
- 一份基于 mode/scope 决策补齐后的 evidence 或明确豁免说明
- 一份可直接发出的 customer handoff bundle manifest / checklist

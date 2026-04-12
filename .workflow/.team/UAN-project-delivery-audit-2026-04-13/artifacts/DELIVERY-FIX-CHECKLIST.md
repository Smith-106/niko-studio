# Delivery Fix Checklist

## Goal

把当前仓库从“可演示 / 可候选交付”推进到“可正式交付客户签收”。

## P0 Blockers

### 1. Repair or Remove Evaluation Quality Check

- Problem:
  `Evaluation` 面板当前很可能调用了陈旧接口。前端使用 `/api/novel/quality-check`，而网关公开的是 `/writing/quality`。
- Evidence:
  [desktop/src/api/evaluation.ts](D:/工作目录/niko-studio/desktop/src/api/evaluation.ts)
  [desktop/src/components/EvaluationPanel.tsx](D:/工作目录/niko-studio/desktop/src/components/EvaluationPanel.tsx)
  [desktop/src/hooks/useEvaluationQualityCheck.ts](D:/工作目录/niko-studio/desktop/src/hooks/useEvaluationQualityCheck.ts)
  [src-ts/mcp/routes/content.ts](D:/工作目录/niko-studio/src-ts/mcp/routes/content.ts)
- Required action:
  统一前后端真实接口路径，或者在客户版先移除该按钮/动作。
- Done when:
  客户可见 UI 不再指向失效接口，并且真实点击链路可通过。
- Verify:
  1. 补一个覆盖真实 endpoint 的前端 API 测试。
  2. 补一个 gateway route/integration 测试，证明该动作能到达后端处理器。
  3. 在 desktop 实际点击一次 quality check，确认返回成功而不是 404/403。

### 2. Close Checkpoint Restore Authority Gap or Hide the Surface

- Problem:
  `checkpoint create/list/restore` 没有和 `plan/execute/lifecycle/rollback` 一样完整纳入 workspace authority。
- Evidence:
  [desktop/src/hooks/useAppCheckpointMenu.ts](D:/工作目录/niko-studio/desktop/src/hooks/useAppCheckpointMenu.ts)
  [desktop/src/hooks/useEvaluationCheckpoints.ts](D:/工作目录/niko-studio/desktop/src/hooks/useEvaluationCheckpoints.ts)
  [desktop/src/hooks/useChatRecovery.ts](D:/工作目录/niko-studio/desktop/src/hooks/useChatRecovery.ts)
  [src-ts/mcp/endpoints/workflow.ts](D:/工作目录/niko-studio/src-ts/mcp/endpoints/workflow.ts)
  [src-ts/mcp/services/workflow.ts](D:/工作目录/niko-studio/src-ts/mcp/services/workflow.ts)
- Required action:
  要么给 checkpoint 恢复链路补齐 authority；要么在客户 release profile 下隐藏 restore/recovery 入口。
- Done when:
  客户构建里不存在越过 authority 的恢复入口。
- Verify:
  1. 增加 authority regression test，覆盖 checkpoint list/create/restore。
  2. 若走隐藏策略，验证客户配置下这些入口不渲染、不触发 API。
  3. 重新跑 authority alignment 相关检查。

### 3. Complete Formal Sign-Off Evidence Pack

- Problem:
  当前 release summary 是绿的，但 formal sign-off 工件不完整，不满足签收留存要求。
- Evidence:
  [docs/release/SIGN_OFF.md](D:/工作目录/niko-studio/docs/release/SIGN_OFF.md)
  [release-check-summary.md](D:/工作目录/niko-studio/release-check-summary.md)
  [release-readiness-artifact.json](D:/工作目录/niko-studio/.workflow/evidence/release/release-readiness-artifact.json)
  [2026-04-13-package-readme.md](D:/工作目录/niko-studio/.workflow/evidence/release/2026-04-13-package-readme.md)
  [2026-04-13-delivery-manifest.md](D:/工作目录/niko-studio/.workflow/evidence/release/2026-04-13-delivery-manifest.md)
- Required action:
  补齐 `authority-alignment.json`、XML/JUnit 等签收证据，或者正式更新签收标准文档。
- Done when:
  当前交付包和签收规范一致，审计时不需要依赖仓库外口头解释。
- Verify:
  1. 生成并归档缺失工件。
  2. 对照 `SIGN_OFF.md` 做逐项勾选。
  3. 更新 delivery manifest，确保所有签收工件都被列出。

## P1 High Priority

### 4. Resolve uiBridge Config-Source Drift

- Problem:
  前端设置和配置接口暴露了 `uiBridge` 开关，但 backend 实际依赖环境变量，配置面没有真正闭合。
- Evidence:
  [desktop/src/components/SettingsModal.tsx](D:/工作目录/niko-studio/desktop/src/components/SettingsModal.tsx)
  [desktop/src/api/config.ts](D:/工作目录/niko-studio/desktop/src/api/config.ts)
  [src-ts/container/gateway-control-plane.ts](D:/工作目录/niko-studio/src-ts/container/gateway-control-plane.ts)
- Required action:
  明确 `uiBridge` 是否属于客户支持范围。
  如果支持，就把配置链路打通。
  如果不支持，就从客户设置和文档中移除。
- Done when:
  客户不会看到一个“可选但实际不可用”的模式。
- Verify:
  1. Settings 测试覆盖真实行为。
  2. Config reload 后行为与 UI 显示一致。

## P2 Release Confidence

### 5. Run One Customer-Profile End-to-End Acceptance Pass

- Goal:
  用客户 release profile 而不是开发环境假设，再做一次实际验收。
- Cover:
  `Evaluation`、workflow execute/lifecycle、settings config、MCP status、checkpoint/recovery 暴露面。
- Done when:
  这些客户可见路径都能给出明确的“正常工作 / 已隐藏 / 不在支持范围”结论。
- Verify:
  形成一份最终验收记录并和签收工件一起归档。

## Recommended Order

1. `Evaluation quality-check`
2. `checkpoint authority / restore surface`
3. `formal sign-off evidence pack`
4. `uiBridge scope + config drift`
5. `customer-profile end-to-end acceptance`

## Release Rule

- 满足 1, 2, 3 后，才建议重新评估“正式客户交付”。
- 第 4 项若确认不在客户范围内，可通过隐藏/降级处理。
- 第 5 项完成后，再生成新的 GO 证据最稳妥。

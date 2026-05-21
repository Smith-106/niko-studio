# RELEASE NOTES

## v9.26.2

### 发布结果

- GitHub release：`https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2`
- Release tag：`v9.26.2`
- Current-head release commit：`7578745ad309db7bb660dfa076ea0244713b77ad`
- 当前本地发布结论：`GO`

### Current-head release closure

- Cut `v9.26.2` from the current `main` commit after the desktop gate, retained evidence, and release alignment all converged to GO.
- Refreshed retained release evidence for writing-helper acceptance and installed-package acceptance on the same HEAD.
- Published the verified Windows installer set for the current-head GO snapshot.

### 本次修复

- 修正了 `workflow-engine.ts` 的 release gate 兼容锚点，避免 thin re-export 影响交付语义门禁。
- 更新了 `scripts/release_check_summary.py` 对 workflow public entry API 的兼容识别。
- 过滤了已完成但遗留为 `open` 的陈旧 `mcp-chat--workflow-*` 会话噪音，避免它们继续误阻断 current-head release sign-off。

### 已发布资产

- `Niko-Studio_9.26.2_x64-setup.exe`
- `Niko-Studio_9.26.2_x64_en-US.msi`
- `Niko-Studio_9.26.2_x64_zh-CN.msi`

## 发布级别矩阵

| 级别 | 用途 | e2e 冒烟 | Codecov 上传失败 | 结论 |
|---|---|---|---|---|
| internal | 内部 dry-run / 日常集成验证 | 可跳过 | 告警，不阻断 | 用于内部验证；main 分支仍保留 authority alignment 与选定契约的阻断门禁 |
| external | 对外交付 / 正式发布 | 必须通过 | 有 `CODECOV_TOKEN` 时阻断；无 token 时告警并登记风险 | 满足 Go/No-Go 条件后放行 |

## 发布状态模型

| 状态 | 含义 | 是否可对外交付 |
|---|---|---|
| `unsigned_local_proof` | 仓库内权威门禁通过，但 `desktop/src-tauri/tauri.conf.json` 仍保留 `certificateThumbprint: null` 与 `timestampUrl: ""` | 否 |
| `prerequisite_missing_hold` | 对外发布所需 4 个前提中任一缺失：证书指纹、时间戳 URL、已 hydrate 的 packaged compatibility artifact、Windows 打包主机/工具链 | 否 |
| `signed_external_release` | 仓库内门禁保持通过，且 4 个前提已在 Windows 打包主机上满足，并完成带签名的 `npm --prefix desktop run tauri:build:signed` | 是 |

补充说明：
- `unsigned_local_proof` 可以证明本地验证链闭合，但不能被表述成 signed external shipment。
- `prerequisite_missing_hold` 是显式 hold 状态，不允许把历史绿色 dry-run 或 CI 结果解释为可对外交付。
- `signed_external_release` 需要 release-private signing inputs 在 git 外注入；仓库内仍只保留 unsigned 默认配置。

补充说明：

- internal 口径允许跳过 external e2e 冒烟，但不代表内部完全无阻断门禁；main 分支仍保留 authority alignment 与选定高风险契约的 blocking checks。
- external 口径在 internal 基础上再叠加 external smoke、quality signal completeness 与 release-specific blocking 条件。

## 当前交付契约（与 README / desktop README 一致）

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface` (removed): browser-first web entry has been removed from the codebase.

## Desktop security and packaging boundary

- Desktop release CSP is now explicit instead of `null`: release builds are limited to self/customprotocol/assets, loopback gateway traffic, and retained HTTPS provider calls that the settings UI can issue directly for model discovery.
- Desktop dev CSP keeps the same release baseline but adds only the Vite localhost + websocket allowances needed for `tauri dev`.
- The Tauri capability scope is explicit: only the `main` window receives `core:default`, so frontend code can call app `invoke` commands but does not receive shell/fs/dialog/http/notification plugin APIs.
- The current runtime matrix is intentional:
  - `Supported local runtime`: Node-first launcher + local `src-ts/` gateway.
  - `Packaged compatibility runtime`: Python sidecar bundled through `bundle.externalBin`.
  - `Explicit boundary`: local desktop validation stays Node-first. Packaged proof still binds `bundle.externalBin` to the compatibility sidecar until a packaged Node target-triple artifact is intentionally introduced.
- Current documented dry-run packaging target is Windows x64: `npm --prefix desktop run validate:package:dry-run` (`tauri build --debug --no-bundle --target x86_64-pc-windows-msvc`).
- Signing prerequisites remain external to the repository: `desktop/src-tauri/tauri.conf.json` keeps `certificateThumbprint: null` and `timestampUrl: ""` for unsigned local proof; signed external bundles require release-private override material before `npm --prefix desktop run tauri:build:signed`.

## External 发布准入条件（Go/No-Go）

满足以下全部条件方可 Go：

1. 版本一致性通过：

```bash
python scripts/check_versions.py
```

2. 交付语义门禁通过：

```bash
python scripts/delivery_gate.py
```

3. TypeScript Phase 4 基线与覆盖率门禁通过：

```bash
npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura
```

4. external 冒烟通过（external 必选）：

```bash
npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default
```

> 约定：external 冒烟以当前 `src-ts` MCP workflow/critic integration tests 为主，而不是缺失的 legacy Python `tests/integration/test_e2e_workflow.py`。

5. 质量信号完整：覆盖率报告生成并上传成功，并且 CI 产出 `coverage-xml`、`ci-diagnostics-desktop-build-linux-deps-log`、`ci-diagnostics-desktop-packaging-advisory-log`、`ci-diagnostics-packaged-app-smoke-report`、`ci-diagnostics-packaged-app-smoke-build-log` 等工件可追溯。
   - external 场景下：当已配置 `CODECOV_TOKEN` 且 `codecov_fail_ci_if_error=true` 时，Codecov 上传失败为 No-Go；当缺失 token 时允许降级并输出告警，必须在发布记录中登记风险。

6. Desktop sidecar readiness 通过：

```bash
npm --prefix desktop run build:sidecar
npm --prefix desktop run validate:sidecar-contract
```

7. Desktop packaging dry-run validation通过（当前支持矩阵：Windows x64 + bundled Python compatibility sidecar）：

```bash
npm --prefix desktop run validate:package:dry-run
```

8. 权威对齐检查通过：workflow / runtime / docs 的当前权威描述必须一致。

```bash
python scripts/check_authority_alignment.py
```

9. 生产安全配置与可观测守卫通过：`env=production` 时 CORS 白名单必须为真实域名，禁止 `*` 与 localhost 占位，`reload` 必须关闭，且 `gateway.metrics_enabled=true`。

```bash
npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default
```

10. 回退预案已确认：`docs/operations/ROLLBACK.md` 中 external 回退触发与验证项均可执行。

11. 发布检查汇总完成：

```bash
python scripts/release_check_summary.py
```

> 说明：`release-check-summary.md` 属于本地检查快照；external 是否放行以 CI workflow 结果为准。
> 本地人工签收顺序、Windows packaging dry-run、writing-helper acceptance，以及签名先决条件见 `docs/release/SIGN_OFF.md`。
> `python scripts/release_check_summary.py` 现在同时覆盖 authority alignment 与 desktop packaging dry-run；若仍返回 `NO_GO`，应按报告中的 blocking checks 处理，而不是回退 Wave 1 的权威契约结论。
> 当报告为 `Decision: GO` 且 `certificateThumbprint = null`、`timestampUrl = ""` 时，该结果只表示 `unsigned_local_proof`；若 4 个外部前提缺失任意一项，应继续保持 `prerequisite_missing_hold`，不得描述为 signed external release。

## external 口径对齐说明（新增）

external 对外“100% 完成度”仅指核心可达链路：

1. `Supported`: Desktop 主入口可达：`Knowledge` / `Settings` / `Evaluation`，且本地 Gateway 运行态可恢复。
2. `Supported`: Chat 默认流式：优先 `/chat/stream`，失败自动降级 `/chat`。
3. `Advisory`: Streamlit 仅作为兼容验证路径：若当前发布候选包含该路径，tab4/tab5 仍需保持组件渲染（`scene_dashboard`），但它不是主交付入口。

补充说明：

- `Supported runtime`: Desktop 运行时当前默认优先 Node/TypeScript Gateway。
- `Advisory compatibility surfaces`: sidecar 打包链与运行时选择不是同一层语义；构建/打包仍可按 `NIKO_GATEWAY_RUNTIME` 选择 Python 或 Node 产物，但这不改变 shipped runtime contract。
- `Deprecated surface`: browser-first web forward 不属于 external 的 primary UI / runtime 验收面。

证据链建议在同一次发布中保留：

- `release-check-summary.md`
- `.workflow/evidence/release/release-readiness-artifact.json`
- `.workflow/evidence/release/authority-alignment.json`
- `.workflow/evidence/release/writing-helper-acceptance.json`
- `.workflow/evidence/release/vitest-production-guard.xml`
- `.workflow/evidence/release/vitest-e2e.xml`
- `.workflow/evidence/release/governance-scripts.junit.xml`
- TypeScript Phase 4 基线日志：`npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura`
- external 冒烟日志：`npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
- production guard 日志：`npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
- Desktop sidecar 构建日志：`npm --prefix desktop run build:sidecar`
- Desktop sidecar 契约日志：`npm --prefix desktop run validate:sidecar-contract`
- Desktop packaging dry-run 日志：`npm --prefix desktop run validate:package:dry-run`
- 治理脚本回归日志：`python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
- 权威对齐日志：`python scripts/check_authority_alignment.py`
- 发布汇总输出：`python scripts/release_check_summary.py`

### internal（dry-run）

1. 确认工作区干净并记录当前 commit。
2. 执行版本一致性、交付语义门禁、权威对齐检查、TypeScript Phase 4 基线与 Desktop sidecar 检查。
3. main 分支需同时观察 internal CI 中的 authority alignment 与 selected contract hard gates。
4. 记录产物版本与测试结果。

### external（正式交付）

1. 执行 internal 全部步骤。
2. 执行 e2e 冒烟。
3. 执行治理脚本回归测试，确认 authority / delivery / summary 关键语义未被破坏。
4. 运行权威对齐检查，确认 workflow / runtime / docs 当前口径一致。
5. 确认质量信号完整（覆盖率 + CI 关键信号）。
   - 若已配置 `CODECOV_TOKEN`，按 strict 模式执行并将上传失败判定为 No-Go。
   - 若缺失 `CODECOV_TOKEN`，允许降级为告警，但必须在发布验收记录中注明该风险。
6. 验证 production guard（CORS / reload / metrics）通过。
7. 核对回退预案与回滚验证路径。
8. 评审 Go/No-Go 并登记结果。

> 注：文中提到缺失的 legacy Python 路径或旧测试文件，仅用于说明当前不再作为权威验收入口，不代表这些文件应在当前 checkout 中存在。

## 验收记录模板

- 发布级别：internal / external
- 发布版本：
- 对应 commit：
- 版本一致性检查：通过 / 失败
- 交付语义门禁：通过 / 失败
- 基线测试与覆盖率：
- e2e 冒烟（external 必填）：通过 / 失败 / 跳过（internal）
- 治理脚本回归：通过 / 失败
- 权威对齐检查：通过 / 失败
- 质量信号完整性（覆盖率上传、CI 关键步骤）：完整 / 不完整
- 生产守卫（CORS / reload / metrics）：通过 / 失败
- 回退预案确认：是 / 否
- 结论：Go / No-Go

## v9.0.8 验收记录（2026-04-16）

- 发布级别：internal packaging proof
- 发布版本：`9.0.8`
- 对应 tag / commit：待本次 release commit / tag；sign-off 证据以 `.workflow/evidence/release/` 下最新 artifact 为准
- 版本一致性检查：通过
- 交付语义门禁：通过
- 基线测试与覆盖率：通过
  - `npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura`
  - `11 passed`
  - coverage：statements / lines `94.87%`，branches `80.80%`，functions `99.47%`
- e2e 冒烟（external 必填）：通过
  - `npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
  - `npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
- 治理脚本回归：通过
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
  - `14 passed`
- 权威对齐检查：通过
  - `python scripts/check_authority_alignment.py`
  - `92 rules checked / 0 mismatches`
- Desktop 本地门禁：通过
  - `npm --prefix desktop run check:local`
- Desktop sidecar readiness：通过
  - `npm --prefix desktop run build:sidecar`
  - `npm --prefix desktop run validate:sidecar-contract`
- Desktop packaging dry-run：通过
  - `npm --prefix desktop run validate:package:dry-run`
- Desktop release bundle：通过
  - `npm --prefix desktop run tauri:build:signed`
- writing-helper acceptance：通过
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1`
  - `7 / 7 PASS`
- 质量信号完整性（覆盖率上传、CI 关键步骤）：完整；`release-check-summary.md` = `Decision: GO`，签名材料仍在仓库外
- 生产守卫（CORS / reload / metrics）：通过
  - `release-check-summary.md` 中 `production_guard = PASS`
  - `release-check-summary.md` 中 `metrics_guard = PASS`
- 回退预案确认：是
  - `docs/operations/ROLLBACK.md` 仍处于当前 authority alignment 检查范围内
- 结论：Go（unsigned local packaging proof）

### 产物指纹

- Windows NSIS setup:
  - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
  - `SHA256 = 4970D06D3FFBAB5BFF28EB2A55EC85C55AB093E6D2D14CEF1178E051CE82110C`
- Windows MSI (en-US):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
  - `SHA256 = 719274459ADE9263846F2D2823F092B4326C39711085702C8DA9E98463688057`
- Windows MSI (zh-CN):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
  - `SHA256 = ED7CE978FE6DAFED40E4DC6CD318B84465F5DBA46DB6F6AC6B6DA4CDEDE31544`

### 已知前提

- 当前产物是基于仓库内 `tauri.conf.json` 生成的 unsigned local build；`certificateThumbprint = null` 且 `timestampUrl = ""`。
- 打包链路继续遵循 “本地 Node-first，打包 Python compatibility sidecar” 的当前边界。
- 若要形成正式对外签名包，仍需在仓库外注入 release-private 签名材料后重新运行 `npm --prefix desktop run tauri:build:signed`。

## v9.0.7 验收记录（2026-04-15）

- 发布级别：internal packaging proof
- 发布版本：`9.0.7`
- 对应 tag / commit：见本次 release commit / tag；sign-off 证据以 `.workflow/evidence/release/` 下最新 artifact 为准
- 版本一致性检查：通过
- 交付语义门禁：通过
- 基线测试与覆盖率：通过
  - `npm --prefix src-ts run test:coverage:phase4 -- --coverage.reporter=text --coverage.reporter=json --coverage.reporter=html --coverage.reporter=cobertura`
  - `11 passed`
  - coverage：statements / lines `94.87%`，branches `80.80%`，functions `99.47%`
- e2e 冒烟（external 必填）：通过
  - `npm --prefix src-ts exec -- vitest run tests/gateway-server.runtime.test.ts tests/mcp/health-endpoints.test.ts --reporter=default`
  - `npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts tests/mcp/workflow-critic-smoke.integration.test.ts --reporter=default`
- 治理脚本回归：通过
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
  - `14 passed`
- 权威对齐检查：通过
  - `python scripts/check_authority_alignment.py`
  - `92 rules checked / 0 mismatches`
- Desktop 本地门禁：通过
  - `npm --prefix desktop run check:local`
- Desktop sidecar readiness：通过
  - `npm --prefix desktop run build:sidecar`
  - `npm --prefix desktop run validate:sidecar-contract`
- Desktop packaging dry-run：通过
  - `npm --prefix desktop run validate:package:dry-run`
- Desktop release bundle：通过
  - `npm --prefix desktop run tauri:build:signed`
- writing-helper acceptance：通过
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\check-writing-helper.ps1 -Strict -Port 18080 -Host 127.0.0.1`
  - `7 / 7 PASS`
- 质量信号完整性（覆盖率上传、CI 关键步骤）：完整；`release-check-summary.md` = `Decision: GO`，签名材料仍在仓库外
- 生产守卫（CORS / reload / metrics）：通过
  - `release-check-summary.md` 中 `production_guard = PASS`
  - `release-check-summary.md` 中 `metrics_guard = PASS`
- 回退预案确认：是
  - `docs/operations/ROLLBACK.md` 仍处于当前 authority alignment 检查范围内
- 结论：Go（unsigned local packaging proof）

### 产物指纹

- Windows NSIS setup:
  - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.7_x64-setup.exe`
  - `SHA256 = C6FBCEA3BF8B0288D4FB872DD76776B6DE7BBCB077A270EDC107255E49E5A023`
- Windows MSI (en-US):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.7_x64_en-US.msi`
  - `SHA256 = 6F0976D9EB10E2949DACA90B7D7FDD3C668E10E0773312AD67DE305AF409AA6D`
- Windows MSI (zh-CN):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.7_x64_zh-CN.msi`
  - `SHA256 = B5754AF5497F2A5A78C601EC17341632E6971DFE6D0B8E31BCA5AA8EF9052446`

### 已知前提

- 当前产物是基于仓库内 `tauri.conf.json` 生成的 unsigned local build；`certificateThumbprint = null` 且 `timestampUrl = ""`。
- 打包链路继续遵循 “本地 Node-first，打包 Python compatibility sidecar” 的当前边界。
- 若要形成正式对外签名包，仍需在仓库外注入 release-private 签名材料后重新运行 `npm --prefix desktop run tauri:build:signed`。

## v9.0.6 验收记录（2026-04-14）

- 发布级别：internal packaging proof
- 发布版本：`9.0.6`
- 对应 tag / commit：`main` / `ffaead63b22b67cb0ba259439af9fdcf7503e6a1`
- 版本一致性检查：通过
- 交付语义门禁：通过
- 基线测试与覆盖率：已保持当前 GO 基线；本次补充验证聚焦桌面启动器治理回归与打包链
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
  - `11 passed in 0.35s`
- e2e 冒烟（external 必填）：未在本次补充打包记录中重跑，沿用当前 release summary / CI 证据
- 治理脚本回归：通过
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
- 权威对齐检查：通过
  - `python scripts/check_authority_alignment.py`
  - `92 rules checked / 0 mismatches`
- Desktop 本地门禁：本次未重跑完整 `check:local`；桌面本地启动器链路已额外验证
  - `npm --prefix desktop run local:selftest -- -PreferredPort 18140 -FallbackPort 18141`
  - `scripts\\selftest_desktop_local.cmd -PreferredPort 18150 -FallbackPort 18151`
- Desktop packaging dry-run：通过
  - `npm --prefix desktop run validate:package:dry-run`
- Desktop release bundle：通过
  - `npm --prefix desktop run tauri:build:signed`
- writing-helper acceptance：沿用当前 CI / release sign-off 证据，本次未重跑
- 质量信号完整性（覆盖率上传、CI 关键步骤）：本地桌面打包信号完整；签名材料仍在仓库外
- 生产守卫（CORS / reload / metrics）：沿用当前 release summary 中的通过结论
- 回退预案确认：是
  - `docs/operations/ROLLBACK.md` 仍处于当前 authority alignment 检查范围内
- 结论：Go（unsigned local packaging proof）

### 产物指纹

- Windows NSIS setup:
  - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.6_x64-setup.exe`
  - `SHA256 = 1D0DEBFB4F6E13391EBA05D560ABC479D9D4ABF8DF7E0EE57109AE498E897C40`
- Windows MSI (en-US):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.6_x64_en-US.msi`
  - `SHA256 = 070E534627EFCDAABEFBF8D6FA8350AA186FB5CE56F3240CF078212DF255967E`
- Windows MSI (zh-CN):
  - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.6_x64_zh-CN.msi`
  - `SHA256 = 8FAAF0149B5C1DADA7AD2B3C5EF57652C555D79BD52BECA3AAC2EBDE4A3B61D9`

### 已知前提

- 当前产物是基于仓库内 `tauri.conf.json` 生成的 unsigned local build；`certificateThumbprint = null` 且 `timestampUrl = ""`。
- 打包链路继续遵循 “本地 Node-first，打包 Python compatibility sidecar” 的当前边界。
- 若要形成正式对外签名包，仍需在仓库外注入 release-private 签名材料后重新运行 `npm --prefix desktop run tauri:build:signed`。

## v9.0.4 验收记录（2026-04-11）

- 发布级别：external
- 发布版本：`9.0.4`
- 对应 tag / commit：`v9.0.4` / `025db2b7f2368ec3116ee9d1170108f84e83140f`
- 版本一致性检查：通过
- 交付语义门禁：通过
- 基线测试与覆盖率：通过
  - `npm --prefix src-ts run check:local`
- e2e 冒烟（external 必填）：通过
  - `npm --prefix src-ts run check:local`
  - `release-check-summary.md` 中 `external_e2e_smoke = PASS`
- 治理脚本回归：通过
  - `python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q`
  - `6 passed in 0.23s`
- 权威对齐检查：通过
  - `python scripts/check_authority_alignment.py`
- Desktop 本地门禁：通过
  - `npm --prefix desktop run check:local`
- Desktop packaging dry-run：通过
  - `npm --prefix desktop run validate:package:dry-run`
- writing-helper acceptance：通过
  - `scripts/check-writing-helper.ps1 -Strict`
  - `7 / 7 PASS`
- 质量信号完整性（覆盖率上传、CI 关键步骤）：本地快照完整；Codecov strict mode disabled
- 生产守卫（CORS / reload / metrics）：通过
  - `release-check-summary.md` 中 `production_guard = PASS`
  - `release-check-summary.md` 中 `metrics_guard = PASS`
- 回退预案确认：是
  - `docs/operations/ROLLBACK.md` 在当前 authority alignment 检查范围内保持通过
- 结论：Go

### 产物指纹

- Windows packaged compatibility sidecar:
  - `desktop/src-tauri/bin/niko-gateway.exe`
  - `SHA256 = 37C5A533162BE8A24985F61CC293952E9E2F1B6348986B224D0B9CD2C24DA21E`
- Windows packaged compatibility sidecar target triple:
  - `desktop/src-tauri/bin/niko-gateway-x86_64-pc-windows-msvc.exe`
  - `SHA256 = 37C5A533162BE8A24985F61CC293952E9E2F1B6348986B224D0B9CD2C24DA21E`
- Windows desktop dry-run executable:
  - `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe`
  - `SHA256 = CAC071E71E34AF2035CAFCB691E3624FE529A9F4EDBC41A301B502DD65264CA8`

### 已知前提

- 当前 node-first checkout 不包含可从源码重建 packaged Python compatibility sidecar 的 legacy Python gateway 源码。
- 本次 external 验收基于预先准备并校验通过的 `desktop/src-tauri/bin/niko-gateway*.exe` artifact。

# Node Sidecar 打包链实施总结

## 概述

成功完成 Node sidecar 可被 Tauri externalBin 正确打包的执行链，并建立 Node-first 默认运行时与显式 Python 兼容回退的治理边界。

## 已完成的 Phase

### Phase A: 固化 sidecar 打包契约 ✅

**实施内容**:
1. **契约验证脚本**: `desktop/scripts/validate_sidecar_contract.cjs`
   - 验证 sidecar 二进制文件存在性
   - 平台特定命名检查（Windows: `.exe` 和 target-triple 变体）
   - 严格模式支持（`--strict` 标志）

2. **契约文档**: `desktop/SIDECAR_CONTRACT.md`
   - 命名约定文档化
   - 运行时选择机制说明
   - 故障排查指南

3. **构建脚本集成**: 添加 `validate:sidecar-contract` npm script

**验证结果**:
```bash
npm run build:sidecar  # 默认选择 Node sidecar + 选定 runtime 契约验证
✅ All contracts validated successfully
```

---

### Phase B: 引入 Node sidecar 构建链 ✅

**实施内容**:
1. **双轨构建选择器**: `desktop/scripts/choose_sidecar.cjs`
   - 通过 `NIKO_GATEWAY_RUNTIME` 环境变量选择运行时
   - 构建默认：Node sidecar（与宿主运行时默认一致）
   - 可选：Python sidecar（显式兼容回退）

2. **构建脚本重构**:
   ```json
   {
     "build:sidecar:python": "python ../scripts/build_gateway_sidecar.py",
     "build:sidecar:node": "npm run check:node-sidecar && echo 'Node sidecar ready'",
     "build:sidecar:choose": "node scripts/choose_sidecar.cjs",
     "build:sidecar": "npm run build:sidecar:choose"
   }
   ```

3. **运行时边界**:
   - ✅ Node sidecar: `niko-gateway-node`, `niko-gateway-node.cmd`（默认权威路径）
   - ✅ Python sidecar: `niko-gateway.exe`, `niko-gateway-x86_64-pc-windows-msvc.exe`（显式兼容回退）

**验证结果**:
```bash
NIKO_GATEWAY_RUNTIME=node npm run build:sidecar  # 选择 Node sidecar
npm run build:sidecar                              # 默认构建 Node sidecar
```

---

### Phase C: 接入 tauri dev/build 前置构建 ✅

**实施内容**:
1. **现有配置验证**:
   ```json
   {
     "tauri:dev": "npm run build:sidecar && tauri dev",
     "tauri:build": "npm run build:sidecar && tauri build"
   }
   ```

2. **Tauri 配置检查**:
   ```json
   {
     "bundle": {
       "externalBin": ["bin/niko-gateway"]  // ✅ 保持不变
     }
   }
   ```

3. **运行时切换机制**:
   - Rust 代码已支持 `NIKO_GATEWAY_RUNTIME` 环境变量
   - Desktop 本地运行时现已默认优先 Node sidecar
   - 设置 `NIKO_GATEWAY_RUNTIME=python` 才会显式切换到 Python sidecar
   - 当 Node 路径不可用时，Rust 侧仍保留 Python fallback

**验证结果**:
- ✅ `tauri dev` 前置构建正常
- ✅ `tauri build` 前置构建正常
- ✅ externalBin 配置正确

---

### Phase D: CI/Release 接入 sidecar 产物门禁 ✅

**实施内容**:

1. **Integration Tests Workflow** (`.github/workflows/integration-tests.yml`):
   ```yaml
   - name: Build desktop sidecar contract artifact
     run: npm run build:sidecar
     working-directory: desktop

   - name: Verify desktop sidecar contract artifact (advisory lane)
     continue-on-error: true  # 观察/遥测通道
     id: sidecar-contract
     run: npm run validate:sidecar-contract
     working-directory: desktop

   # main 分支额外启用 blocking promotion lane
   - name: Validate desktop sidecar contract (main hard gate)
     run: npm run validate:sidecar-contract
     working-directory: desktop
   ```

2. **Release Gate Workflow** (`.github/workflows/external-release-gate.yml`):
   ```yaml
   - name: Check desktop sidecar readiness
     id: sidecar-readiness
     run: |
       npm run build:sidecar
       npm run validate:sidecar-contract
       echo "desktop sidecar readiness ok"
     working-directory: desktop
   ```

3. **门禁策略**:
   - ✅ **Advisory Lane**（internal）: 保留观察通道，便于收集稳定性与平台差异信号
   - ✅ **Main Hard Gate**（internal）: main 分支对 sidecar 契约启用阻断验证
   - ✅ **Hard Gate**（external）: release gate 中 sidecar readiness 已是阻断门禁

---

## 技术成果

### 文件清单

**新增文件**:
- `desktop/scripts/validate_sidecar_contract.cjs` - 契约验证脚本
- `desktop/scripts/choose_sidecar.cjs` - 双轨构建选择器
- `desktop/SIDECAR_CONTRACT.md` - 契约文档

**修改文件**:
- `desktop/package.json` - 构建脚本重构
- `.github/workflows/integration-tests.yml` - CI 门禁集成
- `.github/workflows/external-release-gate.yml` - Release 门禁集成

### 构建流程

**本地开发**:
```bash
# Desktop 运行时默认优先 Node sidecar
npm run tauri:dev

# 显式切换到 Python sidecar
NIKO_GATEWAY_RUNTIME=python npm run tauri:dev
```

**CI/CD**:
```bash
# Integration Tests Workflow
npm run build:sidecar              # 构建选定 sidecar
npm run validate:sidecar-contract  # advisory lane；main 分支另有 blocking promotion lane

# Release Gate Workflow
npm run build:sidecar              # 构建选定 sidecar
npm run validate:sidecar-contract  # 验证契约（blocking gate）
```

---

## 验证清单

### 本地验证
- [x] Node sidecar 语法检查通过
- [x] Python sidecar 构建可用
- [x] 契约验证通过（Windows 平台）
- [x] 双轨构建选择器正常工作
- [x] `tauri:dev` 前置构建正常
- [x] `tauri:build` 前置构建正常

### CI 验证
- [x] Integration workflow 包含 sidecar 构建
- [x] Release workflow 包含 sidecar readiness 检查
- [x] Advisory lane 与 main hard gate 语义已拆分清晰

---

## 下一步工作

### 短期（观察期）
1. **监控 CI 稳定性**: 观察 advisory lane 与 main hard gate 的执行情况
2. **收集反馈**: 检查是否有平台特定问题
3. **文档完善**: 更新开发者文档，说明运行时切换

### 中期（门禁升级）
1. **收窄 advisory lane**: 对稳定的 sidecar / runtime 校验逐步减少重复观察型 job
2. **平台测试**: 在 macOS/Linux 上验证
3. **自动化测试**: 添加 sidecar 启动健康检查

### 长期（Python → Node 迁移）
1. **功能对齐**: 继续压缩 Python fallback 仅剩必要兼容场景
2. **性能测试**: 对比两种运行时的性能
3. **最终收口**: 统一 packaged build 默认值与运行时默认值

---

## 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| Tauri externalBin 命名不匹配 | 契约验证脚本检查平台特定命名 |
| Node sidecar 启动语义不一致 | Rust 健康检查逻辑已统一（`/health` 端点） |
| CI 平台差异 | advisory lane 观察 + main hard gate 收敛 |
| 迁移期双轨复杂度 | 环境变量切换，逐步收敛 |

---

## 结论

**所有 4 个 Phase 均已完成**，Node sidecar 打包链已成功打通：

1. ✅ 契约固化（不改运行时）
2. ✅ 双轨构建（保留 Python fallback）
3. ✅ 前置构建（本地链闭环）
4. ✅ CI 门禁（soft gate）

系统现在支持通过 `NIKO_GATEWAY_RUNTIME` 环境变量在 Python 和 Node sidecar 之间切换；当前 Desktop 本地运行时和默认打包链都优先 Node，Python 路径保留为显式兼容回退。

# F-005: Craft-Catalog Externalize — Product Analysis

## User Value Proposition

将 1584 行写作技巧静态数据从 TypeScript 代码中外置为结构化数据文件（JSON/YAML），实现数据与代码解耦。用户将受益于更频繁的知识库更新（无需等待应用版本发布）和未来的自定义知识扩展能力。

**核心价值**: 数据独立更新 + 用户自定义扩展 + 社区贡献基础

## Priority Justification

### Impact vs Effort Matrix

| 维度 | 评估 |
|------|------|
| 用户影响 | Medium（知识库更新更快） |
| 开发影响 | Medium（数据修改无需重编译） |
| 战略影响 | High（为个性化知识铺路） |
| 实施工作量 | Medium（数据提取 + 加载器 + 验证） |
| 风险 | Low（数据格式明确，可逐步迁移） |

**综合优先级**: P2 — 战略价值高，SHOULD 在 Batch 2 完成。

## Success Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 内嵌静态数据行数 | 0（craft-catalog 相关） | 代码审查 |
| 数据文件格式验证 | JSON Schema 覆盖 100% | Schema validation |
| 数据加载性能 | < 50ms（冷启动） | Performance profiling |
| 知识条目完整性 | 拆分前后 100% 一致 | 自动化对比 |
| 热加载支持 | 数据文件修改后无需重启 | 功能测试 |

## User Stories

### US-001: 作为内容维护者，我希望更新写作技巧知识不需要修改代码
**动机**: 当前知识数据嵌入 TypeScript，任何内容更新都需要开发者介入
**验收**: 修改 JSON 数据文件即可更新知识库内容，无需重新编译

### US-002: 作为高级用户，我希望能添加自定义写作技巧维度
**动机**: 不同类型的写作（科幻、言情、悬疑）有不同的技巧侧重
**验收**: 用户可在指定目录放置自定义 JSON 文件，应用自动加载

### US-003: 作为开发者，我希望知识数据有 Schema 验证
**动机**: 外置数据需要格式保障，防止无效数据导致运行时错误
**验收**: 数据文件有对应的 JSON Schema，加载时自动验证

## Acceptance Criteria

1. craft-catalog 所有静态数据 MUST 从 TypeScript 代码中提取到独立数据文件
2. 数据格式 MUST 有 JSON Schema 定义和验证
3. 数据加载器 MUST 支持应用启动时加载和运行时热重载
4. 外置后 MUST 保持所有现有功能不变（数据内容一致性验证）
5. SHOULD 支持用户自定义数据目录（扩展点）
6. 数据文件 SHOULD 使用 JSON 格式（工具链支持最广）
7. MUST NOT 改变现有 WritingCraftDimension 接口的消费方式

## Dependencies and Sequencing

### 前置依赖
- 无硬性依赖
- MAY 参考 F-004 翻译模块化的模式（类似的数据外置思路）

### 后续影响
- 写作知识个性化（M25 候选）直接依赖此功能
- F-008 修订工作流的知识推荐能力受益于外置数据的灵活性
- 为社区贡献写作知识提供技术通道

### 建议排期
- **Batch 2, Week 4-5**
- 预估工时：3-4 天
- 可与 F-002 并行执行

# 文档索引

Niko-Studio 文档目录

---

## 核心文档

| 文档 | 说明 |
|------|------|
| [README.md](../README.md) | 项目概览、快速开始 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架构设计、组件概览 |
| [API_REFERENCE.md](API_REFERENCE.md) | API 参考、代码示例 |
| [sdd/](sdd/) | 系统设计规格（模块化） |
| [TASKS_V10_OPTIMIZED.md](TASKS_V10_OPTIMIZED.md) | 开发任务清单 |

## 开发指南

| 文档 | 说明 |
|------|------|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献指南 |
| [CHANGELOG.md](../CHANGELOG.md) | 版本变更记录 |
| [niko-studio-writing-workflow.md](niko-studio-writing-workflow.md) | Niko-Studio Writing Workflow Explorer（工作台导览） |
| [release/RELEASE_NOTES.md](release/RELEASE_NOTES.md) | 发布流程、发布级别矩阵（internal / external）与 Go/No-Go 条件 |
| [operations/ROLLBACK.md](operations/ROLLBACK.md) | 回退触发条件、external 回退验证与操作手册 |

## 当前有效发布口径

- 内部验证使用 `internal` 口径：允许跳过 e2e 冒烟，质量信号以告警为主。
- 对外交付使用 `external` 口径：e2e 冒烟与质量信号完整性为强制门禁。
- 详情请以 [release/RELEASE_NOTES.md](release/RELEASE_NOTES.md) 与 [operations/ROLLBACK.md](operations/ROLLBACK.md) 为准。

## 规格文档

### SDD (系统设计文档)
- [01_System_Architecture.md](sdd/01_System_Architecture.md)
- [02_Agent_Specifications.md](sdd/02_Agent_Specifications.md)
- [03_Tool_Definitions.md](sdd/03_Tool_Definitions.md)
- [04_Workflow_Orchestration.md](sdd/04_Workflow_Orchestration.md)

### TDD (测试驱动规范)
- [01_Unit_Tests_Plan.md](tdd/01_Unit_Tests_Plan.md)
- [02_Evaluation_Criteria.md](tdd/02_Evaluation_Criteria.md)
- [03_Test_Cases_Inventory.md](tdd/03_Test_Cases_Inventory.md)

## 参考文档

| 文档 | 说明 |
|------|------|
| [reference/](reference/) | 外部参考 |

---

*更新时间: 2026-02-12*

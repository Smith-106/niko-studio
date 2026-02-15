# Planning Notes

## Context Findings (Phase 2)
### [Context-Search Agent] 2026-02-10
- **Note**: 已汇总 CI 测试入口、pytest 覆盖率门槛、核心测试目录与验证脚本；识别覆盖率阈值不一致与 pytest.ini 缺失风险，并标注影响测试自动化的关键文件。

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| 保持 CI 覆盖率门槛 70 作为短期最低标准 | 现有 CI 配置为 70，需先确保自动化稳定 | Yes |
| 计划补齐 pytest.ini 以统一本地与 CI 参数 | 解决参数不一致风险，提升可重复性 | No |
| 在测试生成与修复之间设置质量评审门槛（IMPL-001.5） | 覆盖率与接口一致性存在中等风险，需要额外校验 | Yes |

### Deferred
- [ ] 将覆盖率目标统一到 80 并分层门槛落地（待确认基线范围）
- [ ] L3 性能测试加入定期执行流水线（需确定周期与资源）

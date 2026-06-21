# Milestone: M26 — Competitive Differentiation & Reader Simulation Deepening

**Completed**: 2026-06-22
**Artifacts**: 12 (analyze: 2, plan: 2, execute: 2, review: 1, test: 1, debug: 1, improve: 1, roadmap: 1, audit: 1)

## Key Outcomes

1. **Reader Simulation 2.0**: DualEngine orchestrating ConsensusEngine + AIFlavorDetector, supporting 7 preset + custom personas with weighted consensus analysis
2. **Anti-AI-Flavor Detection**: Rule-based AI template pattern detector + de-AI revision pipeline (reuse RevisionConfig with intent injection)
3. **A/B Comparison**: Concurrent dual analysis with majority-voting winner determination
4. **Feedback Loop**: Threshold-gated weight adjustment (step=0.05, range [0,1]) with file-persisted custom persona store
5. **Gateway Hardening**: NSIS install file lock fix, EADDRINUSE hang fix, CORS cache invalidation, localhost-only guard, shutdown chain cleanup
6. **Security & Quality**: HTTPS enforcement for LLM fetch, 30s AbortSignal timeout, parseInt NaN guards, ConsensusEngine decision threshold unification (>=80 APPROVED, >=60 REVISE, <60 REWRITE)

## Integration Audit

**Verdict**: CONDITIONAL PASS
- 10 gaps identified (4 HIGH, 3 MEDIUM, 3 LOW)
- HIGH gaps: 3 missing frontend API wrappers + OverlayMarker type split
- All HIGH gaps created as issues for M27 must_haves
- Backend 100% complete and internally consistent
- Dependency chain: no circular dependencies, all cross-phase dependencies satisfied

## Learnings

- 空输入返回结构完整零值报告而非抛错
- ConsensusEngine 字段变更需全栈对齐（4 层传播）
- Preset 注册表扩展保持向后兼容
- A/B 对比并发执行 + 多数投票
- 反馈聚合阈值 + 步长控制权重渐进调整
- vi.doMock 在 ESM 中不可靠，替换为输入校验测试
- 文件持久化 I/O 错误降级为仅内存存储
- TODO 清理应转 logger 或 issue 而非静默删除
- Wiki orphan rescue 需要 body wikilinks
- 独立 detector 层优于 enum 扩展
- 复用 transformation service 通过 config 注入意图
- 结构验证 0-gap 不代表代码健康
- 执行期收窄 definition_of_done 必须记入 deferred 列表

## Issues Created

| Issue | Severity | Description |
|-------|----------|-------------|
| ISS-20260621-015 | HIGH | OverlayMarker frontend-backend type split (GAP-01) |
| ISS-2026060621-016 | HIGH | Missing 3 frontend API wrappers (GAP-04/05/06) |
| ISS-20260621-017 | MEDIUM | EditorialAnalysis + ReaderPersona type drift (GAP-02/03) |
| ISS-20260621-018 | MEDIUM | Cross-boundary imports bypass API layer (GAP-08) |
| ISS-20260621-010 | HIGH | AI template patterns duplication |
| ISS-20260621-011 | HIGH | ConsensusEngine division by zero |
| ISS-20260621-012 | HIGH | RevisionService LLM fetch HTTPS/timeout |

## Next Milestone

No next milestone in roadmap. Project status: idle.

Candidates for next milestone:
- M27: Frontend API layer completion (HIGH issues from audit)
- Odyssey release preparation

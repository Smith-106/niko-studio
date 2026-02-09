# Implementation Plan: LLM Analyzers Completion

**Session**: WFS-niko-analyzers-impl-20260209
**Created**: 2026-02-09

## 1. Overview

完成 niko-studio 项目的最后 3 个 TODO 项：为 narrative analyzers 实现 LLM 辅助分析功能。

### Goal
实现 `_analyze_with_llm` 方法，使分析器能够利用 LLM 进行深度语义分析。

### Scope
- `src/narrative/analyzers/conflict_analyzer.py` - 冲突分析 LLM 增强
- `src/narrative/analyzers/sensory_analyzer.py` - 感官细节 LLM 增强
- `src/narrative/analyzers/tension_curve_analyzer.py` - 张力曲线 LLM 增强

## 2. Technical Approach

### LLM Integration Pattern
```python
async def _analyze_with_llm(self, content: str, context: Optional[Dict] = None):
    prompt = self._build_analysis_prompt(content, context)
    result = await self.llm_client.generate_json(prompt, system_prompt=SYSTEM_PROMPT)
    return self._parse_llm_response(result)
```

### Key Constraints
1. 使用现有 `LLMServiceImpl.generate_json()` 接口
2. 保留 `quick_analyze` 作为 fallback
3. LLM 响应解析为现有数据结构 (Conflict, SensoryDetail, TensionCurve)

## 3. Task Breakdown

| Task ID | Title | Agent | Dependencies |
|---------|-------|-------|--------------|
| IMPL-1 | ConflictAnalyzer LLM Implementation | code-developer | - |
| IMPL-2 | SensoryAnalyzer LLM Implementation | code-developer | - |
| IMPL-3 | TensionCurveAnalyzer LLM Implementation | code-developer | - |

## 4. Implementation Strategy

**Execution Model**: Parallel (tasks are independent)

### Parallelization
- All 3 tasks can run in parallel (no dependencies)
- Each analyzer is self-contained

### Common Pattern
每个实现遵循相同模式：
1. 构建分析提示词 (中文，匹配现有关键词)
2. 调用 LLM generate_json
3. 解析响应为对应数据类
4. 合并规则分析与 LLM 洞察

## 5. Acceptance Criteria

- [ ] 所有 3 个 TODO 标记被移除
- [ ] LLM 分析增强规则分析结果
- [ ] 无 LLM 时优雅降级到 quick_analyze
- [ ] 现有测试继续通过

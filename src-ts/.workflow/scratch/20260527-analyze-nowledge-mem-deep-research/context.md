# Context: Nowledge Mem Deep Research

## Key Decisions

### D1: 3-Phase Upgrade Strategy
**Decision**: P0 (核心补全) → P1 (时序与空间) → P2 (高级集成), strict sequential
**Why**: Data model completeness is a prerequisite for all advanced features
**Trade-off**: Slower initial delivery vs. stable foundation

### D2: scope_verdict = large
**Decision**: Full lifecycle chain (analyze-macro → roadmap → analyze → plan → execute → verify)
**Why**: 10.5% coverage, 7 entities to add, 50+ methods to implement
**Impact**: This triggers roadmap creation before phase-specific analysis

### D3: SDK Migration Deferred to P2
**Decision**: Keep CLI adapter for P0/P1, evaluate @opticlm/nmem SDK in P2
**Why**: SDK maturity uncertain, CLI adapter is proven and stable
**Trade-off**: P2 migration risk vs. P0/P1 stability

### D4: importance Type Breaking Change in P0
**Decision**: Change importance from integer to 0.1-1.0 float in P0
**Why**: Nowledge Mem API expects float; integer values cause silent truncation
**Impact**: Breaking API change — requires migration guide

## Open Questions

1. **Space → projectId mapping**: Should Space.name = projectId, or use Space.description for context?
2. **BI license requirement**: Does Background Intelligence require a paid Nowledge Mem plan?
3. **Thread.save source detection**: How should niko studio detect which CLI tool is running (Claude/Codex/Gemini)?

## Dependencies

- P0 blocks P1 (data model is foundation)
- P1 blocks P2 (spaces required for FS isolation)
- ANL-96 conclusions are fully consumed by this analysis
- No external dependencies beyond Nowledge Mem CLI/API

## Verification Evidence

- `conclusions.json`: Full command inventory (57 commands), data model (7 entities), gap matrix (10 dimensions), roadmap (3 phases)
- `analysis.md`: Six-dimension scoring, risk matrix, Go/No-Go recommendation
- `discussion.md`: Research findings and open questions
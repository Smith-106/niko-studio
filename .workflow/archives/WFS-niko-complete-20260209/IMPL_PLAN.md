# Implementation Plan: 完成 Niko Studio 未完成部分

**Session**: WFS-niko-complete-20260209
**Updated**: 2026-02-09
**Status**: Ready for Execution

---

## 📊 Executive Summary

根据最新分析，项目当前完成度约 **75%**。以下是剩余工作：

### ✅ 已完成 (本轮)
- IMPL-011: backup_manager.py ✅
- IMPL-012: token_service.py ✅
- IMPL-013: obsidian_service.py ✅
- config.py 配置集成 ✅
- container.py 服务注册 ✅

### ⏳ 待完成
- **Phase 15**: 核心引擎层 (Analyzers 缺失)
- **Phase 17**: Agent 重构 (需验证)
- **Phase 18**: 高级技能包 (部分缺失)
- **Phase 19**: 清理与迁移

---

## 🎯 Task Groups (Updated)

### Group A: Analyzers Engine (P0) - 4 Tasks

| Task ID | Module | Description | Status |
|---------|--------|-------------|--------|
| IMPL-014 | analyzers/__init__.py | 分析器模块初始化 | Pending |
| IMPL-015 | sensory_analyzer.py | 感官细节提取器 | Pending |
| IMPL-016 | conflict_analyzer.py | 冲突元素分析器 | Pending |
| IMPL-017 | tension_curve_analyzer.py | 张力曲线分析器 | Pending |

**位置**: `src/narrative/analyzers/`

### Group B: Agent Integration (P0) - 2 Tasks

| Task ID | Module | Description | Status |
|---------|--------|-------------|--------|
| IMPL-018 | critic.py 验证 | 验证 CriticEngine 整合 | Pending |
| IMPL-019 | writer.py 验证 | 验证 SkillLoader 集成 | Pending |

### Group C: Advanced Skills (P1) - 3 Tasks

| Task ID | Module | Description | Status |
|---------|--------|-------------|--------|
| IMPL-020 | outline-generator/ | 大纲生成技能包 | Pending |
| IMPL-021 | revision-craft/ | 修订优化技能包 | Pending |
| IMPL-022 | skill subfolders | 完善技能包子目录 | Pending |

**位置**: `skills/`

### Group D: Cleanup & Migration (P2) - 3 Tasks

| Task ID | Module | Description | Status |
|---------|--------|-------------|--------|
| IMPL-023 | docs cleanup | 合并重复文档 | Pending |
| IMPL-024 | __init__.py audit | 更新所有导出 | Pending |
| IMPL-025 | narrative migration | 分离 fictional_dream 评估/技巧 | Pending |

### Group E: Testing (P1) - 6 Tasks

| Task ID | Test File | Status |
|---------|-----------|--------|
| TEST-001 | test_backup_manager.py | Pending |
| TEST-002 | test_token_service.py | Pending |
| TEST-003 | test_obsidian_service.py | Pending |
| TEST-004 | test_analyzers.py | Pending |
| TEST-005 | test_critic_integration.py | Pending |
| TEST-006 | test_skill_loader.py | Pending |

---

## 📈 Execution Order

```
Phase 1: Analyzers Foundation (IMPL-014 to IMPL-017) [P0]
    ↓
Phase 2: Agent Verification (IMPL-018, IMPL-019) [P0]
    ↓
Phase 3: Advanced Skills (IMPL-020 to IMPL-022) [P1]
    ↓
Phase 4: Cleanup (IMPL-023 to IMPL-025) [P2]
    ↓
Phase 5: Testing (TEST-001 to TEST-006) [P1]
```

---

## 🔗 Dependencies

```
IMPL-014 (analyzers/__init__)
    ├── IMPL-015 (sensory)
    ├── IMPL-016 (conflict)
    └── IMPL-017 (tension)
            ↓
        IMPL-018 (critic verification)
            ↓
        IMPL-019 (writer verification)
```

---

## 📁 File Locations

### To Create
```
src/narrative/analyzers/
├── __init__.py          # IMPL-014
├── sensory_analyzer.py  # IMPL-015
├── conflict_analyzer.py # IMPL-016
└── tension_curve_analyzer.py # IMPL-017

skills/
├── outline-generator/   # IMPL-020
│   └── SKILL.md
└── revision-craft/      # IMPL-021
    └── SKILL.md
```

### To Verify/Update
```
src/agents/critic.py     # IMPL-018
src/agents/writer.py     # IMPL-019
src/skills/skill_loader.py # IMPL-019
```

---

## ✅ Verification Criteria

### Analyzers
- [ ] All 4 analyzer files created with proper interfaces
- [ ] CriticEngine imports and uses all analyzers
- [ ] Unit tests pass

### Agent Integration
- [ ] Critic.evaluate() calls CriticEngine.full_evaluation()
- [ ] Writer dynamically loads skills based on recommendations
- [ ] SkillLoader.load() returns valid Skill objects

### Skills
- [ ] outline-generator SKILL.md follows standard format
- [ ] revision-craft SKILL.md follows standard format
- [ ] All skill folders have techniques/ subdirectory

---

## 📊 Progress Tracking

| Group | Total | Completed | Remaining |
|-------|-------|-----------|-----------|
| A: Analyzers | 4 | 0 | 4 |
| B: Agent Integration | 2 | 0 | 2 |
| C: Advanced Skills | 3 | 0 | 3 |
| D: Cleanup | 3 | 0 | 3 |
| E: Testing | 6 | 0 | 6 |
| **Total** | **18** | **0** | **18** |

---

## 🎯 Recommended Next Action

执行 `/workflow:execute --session WFS-niko-complete-20260209` 开始任务执行

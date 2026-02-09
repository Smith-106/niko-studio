# Niko-Studio V8 终极版 - 实施任务清单

**用途**: AI Agent 自动开发任务分配  
**日期**: 2025-01-27  
**定位**: 写作理论驱动 + AI工具层 + 记忆系统 三层融合架构  
**状态**: V8 Ultimate - 弗雷五大模块 + 七大AI工具 + 四大记忆系统  

---

## 📊 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    Niko-Studio V8 终极版                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 写作理论层 (弗雷五大模块)                          │
│  ├── 虚构梦境引擎 (同情→认同→移情→身临其境)                  │
│  ├── 悬念分析器 (故事问题/威胁情境/导火索)                   │
│  ├── 角色深度系统 (双重人格/主导情感/古怪特质)               │
│  ├── 预设验证器 (角色+冲突=结局)                            │
│  └── 叙事语气管理 (细节支配/作者在场)                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: AI工具层 (七大工具最佳实践)                        │
│  ├── 技能系统 [Superpowers] - 1%强制调用                    │
│  ├── 钩子系统 [Claude Code] - 生命周期拦截                  │
│  ├── 上下文提供器 [Continue] - @引用语法                    │
│  ├── Plan/Act双模式 [Cline]                                │
│  ├── 检查点系统 [Cline] - Git-based                        │
│  └── 多模式系统 [Roo Code] - 7种写作模式                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 记忆系统层 (四大记忆系统)                          │
│  ├── 四层记忆架构 [Mem0]                                   │
│  ├── 时序知识追踪 [Zep]                                    │
│  ├── 智能冲突解决 [Mem0]                                   │
│  └── 迭代检索引擎 [GAM]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 15: 写作理论层 - 弗雷五大模块 (Priority: P0) 🆕

> **来源**: 《让劲爆小说飞起来》核心技巧

### 15.1 虚构梦境引擎 (Fictional Dream Engine)
- [ ] `src/narrative/fictional_dream.py`
  - [ ] `ImmersionStage` 枚举 (SYMPATHY/IDENTIFICATION/EMPATHY/IMMERSION)
  - [ ] `ImmersionScore` 数据类 (stage, score, evidence, suggestions)
  - [ ] `FictionalDreamEngine` 类
    - [ ] `evaluate_sympathy()` - 同情评估 (角色困境展示)
    - [ ] `evaluate_identification()` - 认同评估 (目标支持建立)
    - [ ] `evaluate_empathy()` - 移情评估 (感官细节沉浸)
    - [ ] `evaluate_immersion()` - 身临其境评估 (内心冲突参与)
    - [ ] `get_overall_dream_score()` - 综合梦境分数
  - [ ] LLM Prompt: 四阶段沉浸评估

### 15.2 悬念分析器 (Suspense Analyzer)
- [ ] `src/narrative/suspense_analyzer.py`
  - [ ] `SuspensePillar` 枚举 (STORY_QUESTION/THREAT_SITUATION/LIT_FUSE)
  - [ ] `SuspenseScore` 数据类 (pillar, intensity, location, improvement)
  - [ ] `SuspenseAnalyzer` 类
    - [ ] `detect_story_questions()` - 检测故事问题
    - [ ] `analyze_threat_situations()` - 分析威胁情境
    - [ ] `find_lit_fuses()` - 查找导火索 (时限压力)
    - [ ] `calculate_suspense_curve()` - 计算悬念曲线
    - [ ] `suggest_suspense_enhancement()` - 悬念增强建议
  - [ ] LLM Prompt: 悬念三支柱分析

### 15.3 角色深度系统 (Character Depth System)
- [ ] `src/narrative/character_depth.py`
  - [ ] `CharacterTrait` 枚举 (INTERESTING/ECCENTRIC/COMPETENT/DUAL_PERSONALITY)
  - [ ] `DominantEmotion` 数据类 (static_emotion, dynamic_emotion, evolution)
  - [ ] `DualPersonality` 数据类 (primary_persona, shadow_persona, triggers)
  - [ ] `CharacterDepthSystem` 类
    - [ ] `assess_interest_level()` - 评估角色趣味性
    - [ ] `detect_eccentricity()` - 检测古怪特质
    - [ ] `analyze_competence()` - 分析能力展示
    - [ ] `map_dual_personality()` - 映射双重人格
    - [ ] `track_dominant_emotion()` - 追踪主导情感演变
    - [ ] `check_environment_contrast()` - 检查环境对比 (鱼离开水)
  - [ ] LLM Prompt: 角色深度六维评估

### 15.4 预设验证器 (Premise Validator)
- [ ] `src/narrative/premise_validator.py`
  - [ ] `PremiseType` 枚举 (CHAIN_REACTION/REVERSAL/SITUATIONAL)
  - [ ] `Premise` 数据类 (character_trait, conflict, conclusion, type)
  - [ ] `PremiseAlignment` 数据类 (scene_id, alignment_score, contribution)
  - [ ] `PremiseValidator` 类
    - [ ] `parse_premise()` - 解析预设 (角色+冲突=结局)
    - [ ] `validate_scene()` - 验证场景是否证明预设
    - [ ] `track_premise_progress()` - 追踪预设证明进度
    - [ ] `detect_premise_drift()` - 检测预设偏离
    - [ ] `suggest_realignment()` - 建议重新对齐
  - [ ] LLM Prompt: 预设一致性验证

### 15.5 叙事语气管理 (Narrative Voice Manager)
- [ ] `src/narrative/narrative_voice.py`
  - [ ] `VoiceStrength` 枚举 (WEAK/MODERATE/STRONG/AUTHORITATIVE)
  - [ ] `VoiceMetrics` 数据类 (detail_specificity, sensory_richness, confidence, author_presence)
  - [ ] `NarrativeVoiceManager` 类
    - [ ] `analyze_detail_specificity()` - 分析细节具体度
    - [ ] `measure_sensory_richness()` - 测量感官丰富度
    - [ ] `evaluate_voice_confidence()` - 评估语气自信度
    - [ ] `detect_author_presence()` - 检测作者在场感
    - [ ] `identify_weak_passages()` - 识别语气薄弱段落
    - [ ] `suggest_voice_strengthening()` - 建议语气强化
  - [ ] LLM Prompt: 叙事语气强度分析

### 15.6 理论驱动 Critic Agent 升级
- [ ] `src/agents/critic_v2.py` - 五维评估版 Critic
  - [ ] 集成 `FictionalDreamEngine`
  - [ ] 集成 `SuspenseAnalyzer`
  - [ ] 集成 `CharacterDepthSystem`
  - [ ] 集成 `PremiseValidator`
  - [ ] 集成 `NarrativeVoiceManager`
  - [ ] `TheoryDrivenCriticOutput` 数据类
  - [ ] 综合评分算法 (LOCK + 理论五维)

---

## Phase 16: AI工具层 - 七大工具集成 (Priority: P0) 🆕

> **来源**: Superpowers/Claude Code/Continue/Cline/Roo Code

### 16.1 技能强制调用系统 [Superpowers]
- [ ] `src/skills/skill_enforcer.py`
  - [ ] `SkillPriority` 枚举 (FORCED/HIGH/NORMAL)
  - [ ] `SkillEnforcer` 类
    - [ ] `get_forced_skills()` - 获取强制技能 (1%调用率)
    - [ ] `prioritize_skills()` - 三层优先级排序
    - [ ] `inject_skill_context()` - 注入技能上下文
  - [ ] 10个写作理论技能模板

### 16.2 写作钩子系统 [Claude Code]
- [ ] `src/hooks/writing_hooks.py`
  - [ ] `HookPhase` 枚举 (PRE_WRITE/POST_WRITE/PRE_REVIEW/POST_REVIEW/PRE_PUBLISH/POST_PUBLISH)
  - [ ] `WritingHook` 基类
  - [ ] 内置钩子:
    - [ ] `ForbiddenWordHook` - 禁用词检测
    - [ ] `ConsistencyCheckHook` - 一致性检查
    - [ ] `PremiseAlignmentHook` - 预设对齐检查
    - [ ] `SuspenseEnhancementHook` - 悬念增强建议
  - [ ] `HookRegistry` - 钩子注册中心

### 16.3 上下文提供器 [Continue]
- [ ] `src/context/providers.py`
  - [ ] `ContextProvider` 基类
  - [ ] 9个 @引用提供器:
    - [ ] `@character` - 角色档案
    - [ ] `@worldview` - 世界观设定
    - [ ] `@outline` - 大纲结构
    - [ ] `@chapter` - 章节内容
    - [ ] `@scene` - 场景卡片
    - [ ] `@style` - 风格指南
    - [ ] `@memory` - 相关记忆
    - [ ] `@premise` - 故事预设
    - [ ] `@history` - 修改历史
  - [ ] `ContextResolver` - @引用解析器

### 16.4 Plan/Act 双模式 [Cline]
- [ ] `src/workflow/modes/plan_act.py`
  - [ ] `WorkMode` 枚举 (PLAN/ACT)
  - [ ] `PlanActController` 类
    - [ ] `enter_plan_mode()` - 进入规划模式
    - [ ] `enter_act_mode()` - 进入执行模式
    - [ ] `toggle_mode()` - 切换模式
    - [ ] `get_mode_context()` - 获取模式上下文
  - [ ] Commander Agent 集成

### 16.5 检查点系统 [Cline]
- [ ] `src/workflow/checkpoint_manager.py`
  - [ ] `Checkpoint` 数据类 (id, timestamp, state, description)
  - [ ] `CheckpointManager` 类
    - [ ] `create_checkpoint()` - 创建检查点
    - [ ] `restore_checkpoint()` - 恢复检查点
    - [ ] `list_checkpoints()` - 列出检查点
    - [ ] `diff_checkpoints()` - 比较检查点
  - [ ] Git 集成 (可选)

### 16.6 多模式系统 [Roo Code]
- [ ] `src/modes/writing_modes.py`
  - [ ] `WritingMode` 枚举:
    - [ ] `DRAFT` - 初稿模式 (快速生成)
    - [ ] `POLISH` - 润色模式 (细节优化)
    - [ ] `EXPAND` - 扩写模式 (内容扩充)
    - [ ] `COMPRESS` - 压缩模式 (精简内容)
    - [ ] `DIALOGUE` - 对话模式 (对话专注)
    - [ ] `ACTION` - 动作模式 (动作场景)
    - [ ] `EMOTION` - 情感模式 (情感深化)
  - [ ] `ModeController` 类
  - [ ] 模式专用 Prompt 模板

---

## Phase 17: 记忆系统层 - 四大记忆系统 (Priority: P0) 🆕

> **来源**: Mem0/Zep/GAM/Cognee

### 17.1 四层记忆架构 [Mem0]
- [ ] `src/memory/memory_layers.py`
  - [ ] `MemoryLayer` 枚举 (EPHEMERAL/SESSION/USER/PROJECT/GLOBAL)
  - [ ] `LayeredMemory` 数据类 (layer, content, ttl, scope)
  - [ ] `LayeredMemoryStore` 类
    - [ ] `add_to_layer()` - 添加到指定层
    - [ ] `search_layer()` - 在指定层搜索
    - [ ] `promote_memory()` - 提升记忆层级
    - [ ] `demote_memory()` - 降级记忆层级
    - [ ] `cleanup_ephemeral()` - 清理临时记忆

### 17.2 时序知识追踪 [Zep]
- [ ] `src/memory/temporal_memory.py`
  - [ ] `TemporalMemory` 数据类 (valid_from, valid_until, superseded_by, confidence)
  - [ ] `TemporalMemoryStore` 类
    - [ ] `add_temporal()` - 添加时序记忆
    - [ ] `invalidate()` - 使记忆失效
    - [ ] `supersede()` - 替代旧记忆
    - [ ] `query_at_time()` - 时间点查询 (时间旅行)
    - [ ] `get_evolution()` - 获取知识演变历史
    - [ ] `decay_confidence()` - 置信度衰减

### 17.3 智能冲突解决 [Mem0]
- [ ] `src/memory/conflict_resolver.py`
  - [ ] `ConflictType` 枚举 (CONTRADICTION/DUPLICATE/OUTDATED/AMBIGUOUS)
  - [ ] `Resolution` 数据类 (action, obsolete_ids, merged_content)
  - [ ] `ConflictResolver` 类
    - [ ] `find_similar()` - 查找相似记忆
    - [ ] `detect_contradictions()` - 检测矛盾 (LLM驱动)
    - [ ] `resolve_conflict()` - 解决冲突
    - [ ] `merge_facts()` - 合并事实
    - [ ] `ask_user()` - 请求用户决策

### 17.4 迭代检索引擎 [GAM]
- [ ] `src/search/iterative_retriever.py`
  - [ ] `RetrievalMode` 枚举 (SINGLE/ITERATIVE/DEEP)
  - [ ] `IterativeRetriever` 类
    - [ ] `search_with_context()` - 带上下文搜索
    - [ ] `iterative_search()` - 迭代检索 (检索→反思→再检索)
    - [ ] `is_sufficient()` - 判断结果是否充分
    - [ ] `synthesize()` - 合成最终结果
    - [ ] `rrf_merge()` - RRF融合排序

### 17.5 六维写作记忆 [LobeHub]
- [ ] `src/memory/six_dimensional_memory.py`
  - [ ] `MemoryDimension` 枚举:
    - [ ] `PLOT` - 剧情记忆
    - [ ] `CHARACTER` - 角色记忆
    - [ ] `WORLDVIEW` - 世界观记忆
    - [ ] `STYLE` - 风格记忆
    - [ ] `READER` - 读者反馈记忆
    - [ ] `META` - 元记忆 (写作过程)
  - [ ] `SixDimensionalMemoryStore` 类
  - [ ] 维度专用索引和搜索

---

## Phase 18: 技能包开发 (Priority: P1) 🆕

### 18.1 理论驱动技能包
- [ ] `skills/sympathy-builder/SKILL.md` - 同情构建技能
- [ ] `skills/identification-enhancer/SKILL.md` - 认同增强技能
- [ ] `skills/empathy-deepener/SKILL.md` - 移情深化技能
- [ ] `skills/immersion-creator/SKILL.md` - 身临其境技能
- [ ] `skills/story-question-planter/SKILL.md` - 故事问题植入技能
- [ ] `skills/threat-escalator/SKILL.md` - 威胁升级技能
- [ ] `skills/fuse-lighter/SKILL.md` - 导火索点燃技能
- [ ] `skills/dual-personality-designer/SKILL.md` - 双重人格设计技能
- [ ] `skills/premise-tracker/SKILL.md` - 预设追踪技能
- [ ] `skills/voice-strengthener/SKILL.md` - 语气强化技能

### 18.2 场景类型技能包
- [ ] `skills/climax-scene/SKILL.md` - 高潮场景
- [ ] `skills/revelation-scene/SKILL.md` - 揭示场景
- [ ] `skills/confrontation-scene/SKILL.md` - 对峙场景
- [ ] `skills/emotional-scene/SKILL.md` - 情感场景
- [ ] `skills/action-scene/SKILL.md` - 动作场景

---

## Phase 1-14: 原有任务 (保持不变)

> 详见原 TASKS.md，此处仅列出状态摘要

| Phase | 名称 | 状态 | 完成度 |
|-------|------|------|--------|
| 1 | 核心 Agent 实现 | ✅ 大部分完成 | 80% |
| 2 | 分层工作流系统 | ✅ L1/L3 完成 | 60% |
| 3 | 记忆服务层 | ⚠️ 基础完成 | 40% |
| 4 | 引用与蒸馏系统 | ⚠️ 部分完成 | 30% |
| 5 | 会话与搜索服务 | ✅ 基础完成 | 50% |
| 6 | 统一知识层 | ⚠️ 基础完成 | 40% |
| 7 | 基础服务 | ⬜ 待开始 | 0% |
| 8 | CLI 编排层 | ⬜ 待开始 | 0% |
| 9 | 用户体验增强 | ⬜ 待开始 | 0% |
| 10 | 集成验证 | ⬜ 待开始 | 0% |
| 11 | Skills 系统 | ⚠️ 基础完成 | 30% |
| 12 | 存储层统一 | ⬜ 待开始 | 0% |
| 13 | 集成验证增强 | ⬜ 待开始 | 0% |
| 14 | 跨域工作流架构 | ✅ 完成 | 100% |

---

## 📋 实施路线图

```
Phase 15 (Month 1) - 写作理论层 [P0]
├── Week 1: 虚构梦境引擎 + 悬念分析器
├── Week 2: 角色深度系统 + 预设验证器
├── Week 3: 叙事语气管理
└── Week 4: 理论驱动 Critic Agent 升级

Phase 16 (Month 2) - AI工具层 [P0]
├── Week 1: 技能强制调用系统 + 钩子系统
├── Week 2: 上下文提供器
├── Week 3: Plan/Act 双模式 + 检查点系统
└── Week 4: 多模式系统

Phase 17 (Month 3) - 记忆系统层 [P0]
├── Week 1: 四层记忆架构
├── Week 2: 时序知识追踪
├── Week 3: 智能冲突解决
└── Week 4: 迭代检索引擎 + 六维写作记忆

Phase 18 (Month 4) - 技能包开发 [P1]
├── Week 1-2: 理论驱动技能包 (10个)
└── Week 3-4: 场景类型技能包 (5个)

Phase 19 (Month 5) - 集成与优化 [P1]
├── Week 1-2: 全系统集成测试
└── Week 3-4: 性能优化与文档
```

---

## 📈 预期收益

| 改进项 | 来源 | 预期收益 |
|--------|------|---------|
| 虚构梦境引擎 | 弗雷四阶段 | 读者沉浸度 **+50%** |
| 悬念分析器 | 悬念三支柱 | 故事吸引力 **+40%** |
| 角色深度系统 | 角色特质论 | 角色记忆度 **+45%** |
| 预设验证器 | 预设理论 | 情节一致性 **+35%** |
| 叙事语气管理 | 语气理论 | 叙述权威感 **+40%** |
| 四层记忆 | Mem0 | 减少记忆污染 **+60%** |
| 时序追踪 | Zep | 知识一致性 **+50%** |
| 冲突解决 | Mem0 | 数据质量 **+40%** |
| 迭代检索 | GAM | 检索准确率 **+35%** |
| 技能系统 | Superpowers | 写作质量 **+40%** |

---

*文档更新: 2025-01-27 - V8 Ultimate (弗雷五大模块 + 七大AI工具 + 四大记忆系统)*

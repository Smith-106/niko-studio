# Niko-Studio V9 完整版 - 实施任务清单

**用途**: AI Agent 自动开发任务分配  
**日期**: 2025-01-27  
**定位**: 写作理论驱动 + AI工具层 + 记忆系统 三层融合架构  
**状态**: V9 Complete - 弗雷五大模块深化 + 伪规则破除 + 预设魔杖系统  
**参考资料**: 《劲爆小说创作指南：高级戏剧性叙事技巧》

---

## 📊 V9 架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Niko-Studio V9 Complete                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: 写作理论层 (弗雷五大模块 - 深化版)                                  │
│  ├── 1.1 虚构梦境引擎 (四层情感递进: 同情→认同→移情→沉浸)                    │
│  ├── 1.2 悬念构建器 (三大技巧: 故事问题/威胁情境/导火索)                     │
│  ├── 1.3 人物塑造系统 (五维特质: 动态/能力/古怪/对比/双重人格)               │
│  ├── 1.4 预设魔杖系统 (三种类型 + 容器结构 + 魔杖变换)                       │
│  └── 1.5 叙事语气工坊 (伪装技巧 + 伪规则破除 + 细节支配)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: AI工具层 (七大工具最佳实践)                                        │
│  ├── 技能系统 [Superpowers] - 1%强制调用                                    │
│  ├── 钩子系统 [Claude Code] - 生命周期拦截                                  │
│  ├── 上下文提供器 [Continue] - @引用语法                                    │
│  ├── Plan/Act双模式 [Cline]                                                │
│  ├── 检查点系统 [Cline] - Git-based                                        │
│  └── 多模式系统 [Roo Code] - 7种写作模式                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: 记忆系统层 (四大记忆系统)                                          │
│  ├── 四层记忆架构 [Mem0]                                                   │
│  ├── 时序知识追踪 [Zep]                                                    │
│  ├── 智能冲突解决 [Mem0]                                                   │
│  └── 迭代检索引擎 [GAM]                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 15: 虚构梦境引擎 (Fictional Dream Engine) [P0]

> **核心目标**: 创造让读者完全沉浸的"虚构梦境"结界

### 15.1 四层情感递进系统

```
src/narrative/fictional_dream/
├── __init__.py
├── engine.py              # 虚构梦境引擎主类
├── sympathy.py            # 第一层：同情系统
├── identification.py      # 第二层：认同系统  
├── empathy.py             # 第三层：移情系统
├── immersion.py           # 第四层：沉浸系统
└── evaluator.py           # 梦境强度评估器
```

#### 15.1.1 同情触发器 (Sympathy Triggers)
- [ ] `src/narrative/fictional_dream/sympathy.py`
  - [ ] `SympathyTrigger` 枚举
    - [ ] `DANGER` - 危险困境 (大白鲨的警长)
    - [ ] `POVERTY_HUMILIATION` - 贫穷与羞辱 (拉斯柯尔尼科夫)
    - [ ] `LONELINESS_EXCLUSION` - 孤独与排挤 (魔女嘉莉)
    - [ ] `HELPLESSNESS` - 无助处境 (冉·阿让)
  - [ ] `SympathyAnalyzer` 类
    - [ ] `detect_universal_predicament()` - 检测普遍性困境
    - [ ] `evaluate_vulnerability_display()` - 评估脆弱性展示
    - [ ] `suggest_sympathy_enhancement()` - 同情增强建议
  - [ ] LLM Prompt: 同情触发分析

#### 15.1.2 认同构建器 (Identification Builder)
- [ ] `src/narrative/fictional_dream/identification.py`
  - [ ] `IdentificationElement` 枚举
    - [ ] `GOAL_SUPPORT` - 目标支持
    - [ ] `COURAGE_RECOGNITION` - 勇气认可
    - [ ] `NOBLE_VALUE_BINDING` - 崇高价值绑定
  - [ ] `IdentificationBuilder` 类
    - [ ] `analyze_goal_worthiness()` - 分析目标值得性
    - [ ] `detect_godfather_technique()` - 检测教父技巧 (道德瑕疵+崇高目标)
    - [ ] `measure_reader_support()` - 测量读者支持度
  - [ ] 案例模板: 教父开场设计

#### 15.1.3 移情深化器 (Empathy Deepener)
- [ ] `src/narrative/fictional_dream/empathy.py`
  - [ ] `SensoryDetail` 数据类
    - [ ] `sense_type` - 感官类型 (视觉/听觉/触觉/嗅觉/味觉)
    - [ ] `content` - 具体描写
    - [ ] `emotion_evoked` - 激发的情感
  - [ ] `EmpathyDeepener` 类
    - [ ] `extract_sensory_details()` - 提取感官细节
    - [ ] `evaluate_body_plant()` - 评估"身体植入"效果
    - [ ] `analyze_carrie_technique()` - 分析嘉莉技巧 (生理状态描写)
    - [ ] `suggest_sensory_enhancement()` - 感官增强建议
  - [ ] LLM Prompt: 激发情感的感官细节分析

#### 15.1.4 沉浸催化器 (Immersion Catalyst)
- [ ] `src/narrative/fictional_dream/immersion.py`
  - [ ] `InternalConflict` 数据类
    - [ ] `dilemma` - 两难困境
    - [ ] `stakes` - 利害关系
    - [ ] `honor_involved` - 是否涉及荣誉/自尊
  - [ ] `ImmersionCatalyst` 类
    - [ ] `detect_internal_conflict()` - 检测内心冲突
    - [ ] `evaluate_moral_dilemma()` - 评估道德困境强度
    - [ ] `measure_reader_participation()` - 测量读者参与度
    - [ ] `analyze_choice_urgency()` - 分析抉择紧迫感
  - [ ] 案例模板: 罪与罚的内心斗争

#### 15.1.5 梦境强度评估器
- [ ] `src/narrative/fictional_dream/evaluator.py`
  - [ ] `DreamStrength` 枚举 (HYPNOTIC/STRONG/MODERATE/WEAK/BROKEN)
  - [ ] `DreamEvaluator` 类
    - [ ] `evaluate_full_spectrum()` - 全谱评估
    - [ ] `identify_dream_breakers()` - 识别打破梦境的元素
    - [ ] `generate_enhancement_plan()` - 生成增强计划

---

## Phase 16: 悬念构建器 (Suspense Constructor) [P0]

> **核心目标**: 让读者"担心和好奇"，紧握书本不放

### 16.1 悬念三大支柱系统

```
src/narrative/suspense/
├── __init__.py
├── constructor.py         # 悬念构建器主类
├── story_questions.py     # 故事问题系统
├── threat_situations.py   # 威胁情境系统
├── lit_fuse.py           # 导火索系统
└── curve_analyzer.py      # 悬念曲线分析器
```

#### 16.1.1 故事问题系统 (Story Questions)
- [ ] `src/narrative/suspense/story_questions.py`
  - [ ] `StoryQuestion` 数据类
    - [ ] `question` - 问题内容
    - [ ] `implicitness` - 隐含程度 (直接问句 vs 情境暗示)
    - [ ] `chapter_planted` - 植入章节
    - [ ] `chapter_answered` - 回答章节 (可选)
  - [ ] `StoryQuestionManager` 类
    - [ ] `detect_opening_hook()` - 检测开篇钩子
    - [ ] `analyze_first_sentence()` - 分析第一句话效果
    - [ ] `track_question_lifecycle()` - 追踪问题生命周期
    - [ ] `evaluate_bait_quality()` - 评估"诱饵"质量
  - [ ] 大师开篇案例库
    - [ ] 《悲惨世界》开篇分析
    - [ ] 《大白鲨》开篇分析
    - [ ] 《审判》开篇分析

#### 16.1.2 威胁情境系统 (Threat Situations)
- [ ] `src/narrative/suspense/threat_situations.py`
  - [ ] `ThreatType` 枚举
    - [ ] `PHYSICAL` - 肉体威胁
    - [ ] `SOCIAL` - 社会地位威胁
    - [ ] `PSYCHOLOGICAL` - 心理健康威胁
    - [ ] `VALUE` - 个人价值威胁
  - [ ] `ThreatAnalyzer` 类
    - [ ] `detect_protagonist_trouble()` - 检测主角是否陷入麻烦
    - [ ] `evaluate_opening_trouble()` - 评估开篇麻烦强度 (99%错误检测)
    - [ ] `measure_reader_worry()` - 测量读者担忧度
    - [ ] `suggest_threat_escalation()` - 威胁升级建议

#### 16.1.3 导火索系统 (Lit Fuse)
- [ ] `src/narrative/suspense/lit_fuse.py`
  - [ ] `LitFuse` 数据类
    - [ ] `deadline` - 时间限制
    - [ ] `consequence` - 可怕后果
    - [ ] `prevention_goal` - 阻止目标
  - [ ] `LitFuseManager` 类
    - [ ] `detect_time_pressure()` - 检测时间压力
    - [ ] `evaluate_countdown_effect()` - 评估倒计时效果
    - [ ] `analyze_classic_fuses()` - 分析经典导火索
      - [ ] 《大白鲨》: 独立日周末前杀鲨
      - [ ] 《红色英勇勋章》: 被发现怯懦前归队
      - [ ] 《飘》: 亚特兰大焚毁前逃离
    - [ ] `suggest_fuse_implementation()` - 导火索实施建议

#### 16.1.4 悬念曲线分析器
- [ ] `src/narrative/suspense/curve_analyzer.py`
  - [ ] `SuspenseCurve` 数据类
  - [ ] `CurveAnalyzer` 类
    - [ ] `plot_suspense_curve()` - 绘制悬念曲线
    - [ ] `detect_flat_zones()` - 检测平淡区域
    - [ ] `suggest_peaks_placement()` - 建议高峰放置

---

## Phase 17: 人物塑造系统 (Character Sculpting System) [P0]

> **核心目标**: 塑造值得读者牵肠挂肚的动态人物

### 17.1 五维人物特质系统

```
src/narrative/character/
├── __init__.py
├── sculpting_system.py    # 人物塑造系统主类
├── dynamic_interest.py    # 动态与趣味性
├── competence.py          # 能力特质
├── eccentricity.py        # 古怪特质
├── contrast.py            # 对比与反差
├── dual_personality.py    # 双重人格
├── dominant_emotion.py    # 主导情感
└── biography_builder.py   # 角色传记构建器
```

#### 17.1.1 动态与趣味性模块
- [ ] `src/narrative/character/dynamic_interest.py`
  - [ ] `DynamicCharacterTraits` 数据类
    - [ ] `action_capacity` - 行动力
    - [ ] `inner_richness` - 内在丰富度
    - [ ] `unique_experience` - 独特经历
    - [ ] `spiritual_pursuit` - 精神追求
  - [ ] `DynamicInterestEvaluator` 类
    - [ ] `detect_passive_character()` - 检测被动角色 (懦弱/麻木不仁)
    - [ ] `evaluate_action_capacity()` - 评估行动能力
    - [ ] `suggest_research_areas()` - 建议调研领域

#### 17.1.2 能力特质模块
- [ ] `src/narrative/character/competence.py`
  - [ ] `CompetenceType` 枚举
    - [ ] `PROFESSIONAL` - 专业能力 (侦探/牛仔/捕鲸手)
    - [ ] `SOCIAL` - 社交能力
    - [ ] `SURVIVAL` - 生存能力
    - [ ] `INTELLECTUAL` - 智力能力
  - [ ] `CompetenceAnalyzer` 类
    - [ ] `detect_skill_display()` - 检测技能展示
    - [ ] `evaluate_expertise_appeal()` - 评估专业魅力
    - [ ] `suggest_competence_scenes()` - 建议能力展示场景

#### 17.1.3 古怪特质模块
- [ ] `src/narrative/character/eccentricity.py`
  - [ ] `EccentricityLibrary` 类 - 古怪特质库
    - [ ] 堂吉诃德: 与风车决斗
    - [ ] 亚哈船长: 狂热追逐白鲸
    - [ ] 福尔摩斯: 深夜拉小提琴
  - [ ] `EccentricityAnalyzer` 类
    - [ ] `detect_eccentricity()` - 检测古怪特质
    - [ ] `evaluate_memorability()` - 评估记忆点强度
    - [ ] `suggest_quirks()` - 建议古怪特质
    - [ ] `use_as_foil()` - 作为衬托使用

#### 17.1.4 对比与反差模块
- [ ] `src/narrative/character/contrast.py`
  - [ ] `ContrastType` 枚举
    - [ ] `CHARACTER_VS_CHARACTER` - 人物之间对比
    - [ ] `CHARACTER_VS_ENVIRONMENT` - 人物与环境对比 (鱼离开水)
  - [ ] `ContrastAnalyzer` 类
    - [ ] `detect_character_contrast()` - 检测人物对比 (维克汉 vs 达西)
    - [ ] `detect_fish_out_of_water()` - 检测"鱼离开水"设置 (布洛迪警长)
    - [ ] `evaluate_dramatic_tension()` - 评估戏剧张力
    - [ ] `suggest_contrast_pairing()` - 建议对比配对

#### 17.1.5 双重人格模块
- [ ] `src/narrative/character/dual_personality.py`
  - [ ] `DualPersonality` 数据类
    - [ ] `persona_a` - 人格A (外在展示)
    - [ ] `persona_b` - 人格B (内心真实)
    - [ ] `conflict_trigger` - 冲突触发器
    - [ ] `internal_war` - 内在战争
  - [ ] `DualPersonalityDesigner` 类
    - [ ] `design_dual_persona()` - 设计双重人格
    - [ ] `create_conflict_scenario()` - 创建冲突场景
    - [ ] 案例模板: 狂暴的罗斯顿少校
      - [ ] 人格A: 铁血军人
      - [ ] 人格B: 敏感画家
      - [ ] 冲突: 撞穿有壁画的教堂墙壁

#### 17.1.6 主导情感模块
- [ ] `src/narrative/character/dominant_emotion.py`
  - [ ] `DominantEmotion` 数据类
    - [ ] `static_emotion` - 静态主导情感 (人物本质)
    - [ ] `dynamic_emotion` - 动态主导情感 (情节驱动)
    - [ ] `evolution_arc` - 演变弧线
  - [ ] `DominantEmotionTracker` 类
    - [ ] `track_emotion_evolution()` - 追踪情感演变
    - [ ] `analyze_arc_interaction()` - 分析静态/动态互动
    - [ ] 案例分析
      - [ ] 拉斯柯尔尼科夫: 摆脱贫穷 → 寻求救赎
      - [ ] 斯嘉丽: 嫁给艾希礼 → 重建家园

#### 17.1.7 角色传记构建器
- [ ] `src/narrative/character/biography_builder.py`
  - [ ] `BiographyBuilder` 类
    - [ ] `generate_detailed_bio()` - 生成详细传记
    - [ ] `suggest_research_sources()` - 建议调研来源
    - [ ] `interview_guide()` - 原型人物访谈指南

---

## Phase 18: 预设魔杖系统 (Premise Magic Wand) [P0]

> **核心目标**: 掌握预设这把雕刻故事的"魔杖"

### 18.1 预设系统架构

```
src/narrative/premise/
├── __init__.py
├── magic_wand.py          # 预设魔杖主类
├── parser.py              # 预设解析器
├── types.py               # 预设类型
├── transformer.py         # 预设变换器
├── container.py           # 容器结构
└── validator.py           # 预设验证器
```

#### 18.1.1 概念辨析系统
- [ ] `src/narrative/premise/types.py`
  - [ ] `NarrativeConcept` 枚举
    - [ ] `MORAL` - 寓意 (教训/道理，说教性)
    - [ ] `THEME` - 主题 (抽象概念，可多个)
    - [ ] `PREMISE` - 预设 (角色+冲突=结局，可证明)
  - [ ] `ConceptDistinguisher` 类
    - [ ] `classify_statement()` - 分类陈述
    - [ ] `extract_premise_from_theme()` - 从主题提取预设
    - [ ] `avoid_moral_preaching()` - 避免说教化

#### 18.1.2 预设类型系统
- [ ] `src/narrative/premise/types.py` (续)
  - [ ] `PremiseType` 枚举
    - [ ] `CHAIN_REACTION` - 连锁反应式 (初始事件→因果链→结局)
    - [ ] `REVERSAL` - 反向式 (X vs Y = Z)
    - [ ] `SITUATIONAL` - 情景式 (容器+多子故事)
  - [ ] `PremiseTypeAnalyzer` 类
    - [ ] `detect_premise_type()` - 检测预设类型
    - [ ] `validate_premise_structure()` - 验证预设结构

#### 18.1.3 预设魔杖变换器
- [ ] `src/narrative/premise/transformer.py`
  - [ ] `PremiseMagicWand` 类
    - [ ] `transform_premise()` - 变换预设
    - [ ] `compare_stories()` - 对比不同预设产生的故事
    - [ ] 案例演示: 理想主义农民乔
      - [ ] 原始预设: "勇敢与理想主义最终战胜了邪恶"
      - [ ] 变换预设: "经济困难摧毁理想主义"
      - [ ] 分析: 讽刺、意外、人物成长的产生

#### 18.1.4 多预设容器结构
- [ ] `src/narrative/premise/container.py`
  - [ ] `NarrativeContainer` 数据类
    - [ ] `container_type` - 容器类型
    - [ ] `sub_premises` - 子预设列表
    - [ ] `linking_element` - 联结元素
  - [ ] `ContainerType` 枚举
    - [ ] `FAMILY` - 家族关系 (三姐妹)
    - [ ] `EXPERIENCE` - 共同经历 (战友)
    - [ ] `LOCATION` - 共同地点
    - [ ] `TIME_PERIOD` - 时代背景
  - [ ] `ContainerManager` 类
    - [ ] `design_multi_premise_novel()` - 设计多预设小说
    - [ ] `ensure_sub_premise_independence()` - 确保子预设独立性
    - [ ] `validate_container_coherence()` - 验证容器连贯性

#### 18.1.5 预设验证器
- [ ] `src/narrative/premise/validator.py`
  - [ ] `PremiseValidator` 类
    - [ ] `parse_premise()` - 解析预设 (角色+冲突=结局)
    - [ ] `validate_scene_contribution()` - 验证场景贡献
    - [ ] `detect_premise_drift()` - 检测预设偏离
    - [ ] `calculate_premise_progress()` - 计算预设证明进度
    - [ ] `suggest_realignment()` - 建议重新对齐

---

## Phase 19: 叙事语气工坊 (Narrative Voice Workshop) [P0]

> **核心目标**: 培养强大的、令人信服的叙述语气

### 19.1 叙事语气系统架构

```
src/narrative/voice/
├── __init__.py
├── workshop.py            # 叙事语气工坊主类
├── narrator_persona.py    # 叙述者伪装系统
├── pseudo_rule_breaker.py # 伪规则破除器
├── detail_mastery.py      # 细节支配系统
├── pov_advisor.py         # 视角顾问
└── voice_strengthener.py  # 语气强化器
```

#### 19.1.1 叙述者伪装系统
- [ ] `src/narrative/voice/narrator_persona.py`
  - [ ] `NarratorPersona` 数据类
    - [ ] `persona_traits` - 人格特质
    - [ ] `emotional_stance` - 情感立场
    - [ ] `voice_consistency` - 语气一致性
    - [ ] `ideal_projection` - 理想化投射 (非作者本人)
  - [ ] `PersonaDesigner` 类
    - [ ] `design_narrator_persona()` - 设计叙述者人格
    - [ ] `maintain_persona_consistency()` - 维持人格一致性
    - [ ] `separate_author_from_narrator()` - 区分作者与叙述者

#### 19.1.2 伪规则破除器
- [ ] `src/narrative/voice/pseudo_rule_breaker.py`
  - [ ] `PseudoRule` 枚举 - 需要破除的伪规则
    - [ ] `AUTHOR_INVISIBLE` - "作者必须隐身" ❌
    - [ ] `FIRST_PERSON_INTIMATE` - "第一人称必然更亲切" ❌
    - [ ] `THIRD_PERSON_DISTANT` - "第三人称必然疏离" ❌
    - [ ] `NO_AUTHOR_OPINION` - "叙述者不能有观点" ❌
  - [ ] `PseudoRuleBreaker` 类
    - [ ] `detect_pseudo_rule_adherence()` - 检测伪规则遵从
    - [ ] `show_master_counter_examples()` - 展示大师反例
      - [ ] 陀思妥耶夫斯基: 直接评价人物内心
      - [ ] 简·奥斯汀: 毫不掩饰地给出见解
      - [ ] 汤姆·沃尔夫: 充满讽刺的叙述
    - [ ] `encourage_voice_expression()` - 鼓励语气表达

#### 19.1.3 细节支配系统
- [ ] `src/narrative/voice/detail_mastery.py`
  - [ ] `DetailQuality` 枚举
    - [ ] `SPECIFIC` - 具体详实 (强有力)
    - [ ] `VAGUE` - 空泛笼统 (微弱)
  - [ ] `DetailMasteryAnalyzer` 类
    - [ ] `analyze_detail_specificity()` - 分析细节具体度
    - [ ] `detect_weak_descriptions()` - 检测薄弱描写
    - [ ] `transform_weak_to_strong()` - 转换薄弱为强有力
    - [ ] 案例对比: 哈罗德描写
      - [ ] 弱: "好工人"、"穿戴整洁"
      - [ ] 强: "弓着腰给订制的浴室装钻孔"、"鲨皮套装、鳄鱼皮鞋"

#### 19.1.4 视角顾问
- [ ] `src/narrative/voice/pov_advisor.py`
  - [ ] `POVAdvisor` 类
    - [ ] `debunk_pov_myths()` - 破除视角迷思
    - [ ] `show_intimate_third_person()` - 展示亲密第三人称
    - [ ] `show_distant_first_person()` - 展示疏离第一人称
    - [ ] `focus_on_narrator_personality()` - 聚焦叙述者人格而非人称

#### 19.1.5 语气强化器
- [ ] `src/narrative/voice/voice_strengthener.py`
  - [ ] `VoiceStrength` 枚举 (AUTHORITATIVE/STRONG/MODERATE/WEAK)
  - [ ] `VoiceStrengthener` 类
    - [ ] `measure_voice_strength()` - 测量语气强度
    - [ ] `identify_strengthening_opportunities()` - 识别强化机会
    - [ ] `apply_detail_transformation()` - 应用细节转换
    - [ ] `inject_narrator_personality()` - 注入叙述者个性

---

## Phase 20: AI工具层集成 [P0]

> **来源**: Superpowers/Claude Code/Continue/Cline/Roo Code

### 20.1 技能强制调用系统 [Superpowers]
- [ ] `src/skills/skill_enforcer.py`
  - [ ] 1%强制调用规则
  - [ ] 三层优先级排序
  - [ ] 热重载支持

### 20.2 写作钩子系统 [Claude Code]
- [ ] `src/hooks/writing_hooks.py`
  - [ ] `PRE_WRITE` - 写作前验证
  - [ ] `POST_WRITE` - 写作后更新知识图谱
  - [ ] `PRE_REVIEW` - 评审前准备
  - [ ] `POST_REVIEW` - 评审后触发修改

### 20.3 上下文提供器 [Continue]
- [ ] `src/context/providers.py`
  - [ ] `@character` - 角色档案
  - [ ] `@scene` - 场景卡片
  - [ ] `@premise` - 故事预设
  - [ ] `@memory` - 相关记忆
  - [ ] `@timeline` - 时间线
  - [ ] `@foreshadow` - 伏笔状态

### 20.4 Plan/Act 双模式 [Cline]
- [ ] `src/workflow/plan_act.py`
  - [ ] 计划模式: 收集信息、生成计划
  - [ ] 执行模式: 按计划执行、创建检查点

### 20.5 检查点系统 [Cline]
- [ ] `src/workflow/checkpoint_manager.py`
  - [ ] Git-based 状态快照
  - [ ] 回滚支持

### 20.6 多模式系统 [Roo Code]
- [ ] `src/modes/writing_modes.py`
  - [ ] DRAFT - 草稿模式
  - [ ] POLISH - 润色模式
  - [ ] EXPAND - 扩写模式
  - [ ] COMPRESS - 压缩模式
  - [ ] DIALOGUE - 对话模式
  - [ ] ACTION - 动作模式
  - [ ] EMOTION - 情感模式

---

## Phase 21: 记忆系统层 [P0]

### 21.1 四层记忆架构 [Mem0]
- [ ] `src/memory/memory_layers.py`
  - [ ] EPHEMERAL - 临时记忆
  - [ ] SESSION - 会话记忆
  - [ ] USER - 用户记忆
  - [ ] PROJECT - 项目记忆

### 21.2 时序知识追踪 [Zep]
- [ ] `src/memory/temporal_memory.py`
  - [ ] valid_from/valid_until 追踪
  - [ ] supersedes 替代链
  - [ ] 时间点查询

### 21.3 智能冲突解决 [Mem0]
- [ ] `src/memory/conflict_resolver.py`
  - [ ] 语义相似度检测
  - [ ] LLM 驱动矛盾检测
  - [ ] MERGE/UPDATE/REJECT 策略

### 21.4 迭代检索引擎 [GAM]
- [ ] `src/search/iterative_retriever.py`
  - [ ] 检索-反思-再检索循环
  - [ ] 信息充足性判断

---

## Phase 22: 理论驱动技能包 [P1]

### 22.1 虚构梦境技能包
- [ ] `skills/sympathy-builder/SKILL.md` - 同情构建
- [ ] `skills/identification-enhancer/SKILL.md` - 认同增强
- [ ] `skills/empathy-deepener/SKILL.md` - 移情深化
- [ ] `skills/immersion-catalyst/SKILL.md` - 沉浸催化

### 22.2 悬念构建技能包
- [ ] `skills/story-question-planter/SKILL.md` - 故事问题植入
- [ ] `skills/threat-escalator/SKILL.md` - 威胁升级
- [ ] `skills/fuse-lighter/SKILL.md` - 导火索点燃
- [ ] `skills/opening-hook/SKILL.md` - 开篇钩子

### 22.3 人物塑造技能包
- [ ] `skills/dual-personality-designer/SKILL.md` - 双重人格设计
- [ ] `skills/eccentricity-injector/SKILL.md` - 古怪特质注入
- [ ] `skills/fish-out-of-water/SKILL.md` - 鱼离开水设置
- [ ] `skills/dominant-emotion-tracker/SKILL.md` - 主导情感追踪

### 22.4 预设魔杖技能包
- [ ] `skills/premise-transformer/SKILL.md` - 预设变换
- [ ] `skills/container-designer/SKILL.md` - 容器设计
- [ ] `skills/premise-validator/SKILL.md` - 预设验证

### 22.5 叙事语气技能包
- [ ] `skills/pseudo-rule-breaker/SKILL.md` - 伪规则破除
- [ ] `skills/detail-mastery/SKILL.md` - 细节支配
- [ ] `skills/voice-strengthener/SKILL.md` - 语气强化

---

## Phase 23: 理论驱动 Critic Agent [P0]

### 23.1 五维理论评估 Critic
- [ ] `src/agents/critic_v2.py`
  - [ ] 集成虚构梦境引擎
  - [ ] 集成悬念构建器
  - [ ] 集成人物塑造系统
  - [ ] 集成预设验证器
  - [ ] 集成叙事语气工坊
  - [ ] `TheoryDrivenCriticOutput` 数据类
  - [ ] 综合评分算法

---

## 📋 实施路线图

```
Phase 15-17 (Month 1) - 核心理论层 [P0]
├── Week 1: 虚构梦境引擎 (四层情感递进)
├── Week 2: 悬念构建器 (三大支柱)
├── Week 3: 人物塑造系统 (五维特质)
└── Week 4: 预设魔杖 + 叙事语气工坊

Phase 18-19 (Month 2) - 理论深化 [P0]
├── Week 1-2: 预设魔杖系统完善
└── Week 3-4: 叙事语气工坊完善

Phase 20-21 (Month 3) - AI工具+记忆层 [P0]
├── Week 1: 技能系统 + 钩子系统
├── Week 2: 上下文提供器 + Plan/Act
├── Week 3: 检查点 + 多模式
└── Week 4: 四层记忆 + 时序追踪

Phase 22 (Month 4) - 技能包开发 [P1]
├── Week 1: 虚构梦境技能包 (4个)
├── Week 2: 悬念构建技能包 (4个)
├── Week 3: 人物塑造技能包 (4个)
└── Week 4: 预设+语气技能包 (6个)

Phase 23 (Month 5) - 集成与优化 [P0/P1]
├── Week 1-2: 理论驱动 Critic Agent
└── Week 3-4: 全系统集成测试
```

---

## 📈 预期收益

| 改进项 | 来源 | 预期收益 |
|--------|------|---------|
| 虚构梦境引擎 | 四层情感递进 | 读者沉浸度 **+60%** |
| 悬念构建器 | 三大支柱 | 故事吸引力 **+50%** |
| 人物塑造系统 | 五维特质 | 角色记忆度 **+55%** |
| 预设魔杖 | 预设变换+容器 | 情节深度 **+45%** |
| 叙事语气工坊 | 伪规则破除 | 叙述权威感 **+50%** |
| 理论驱动 Critic | 五维评估 | 评估精准度 **+40%** |

---

*文档更新: 2025-01-27 - V9 Complete (弗雷五大模块深化版)*

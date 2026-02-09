# Niko Studio V10 优化版任务清单

> 架构优化：核心引擎 + 技能包分离

## 🎯 架构优化原则

### 核心洞察

| 层级 | 职责 | 位置 |
|------|------|------|
| **核心引擎** | 评估、分析、检测 | `src/narrative/` |
| **技能包** | 具体写作技巧、模板、指南 | `skills/` |
| **Agent** | 调用引擎+技能包完成任务 | `src/agents/` |

### 重构前 vs 重构后

```
重构前 (混杂):
src/narrative/
├── fictional_dream/        # 混杂了评估+技巧
├── suspense_analyzer.py    # 混杂了分析+指导
└── character_depth.py      # 混杂了检测+创作

重构后 (分离):
src/narrative/              # 纯引擎层 - 评估与分析
├── evaluators/             # 评估器
└── analyzers/              # 分析器

skills/                     # 纯技能层 - 写作技巧与模板
├── fictional-dream/        # 虚构梦境技能包
├── suspense-craft/         # 悬念构建技能包
├── character-forge/        # 人物塑造技能包
├── premise-magic/          # 预设魔杖技能包
└── voice-workshop/         # 叙事语气技能包
```

---

## 📋 Phase 15: 核心引擎层重构

### Task 15.1: 评估器引擎 (Evaluators)

**位置**: `src/narrative/evaluators/`

**职责**: 纯粹的文本质量评估，返回分数和问题列表

```python
# 评估器只做评估，不做指导
class DreamEvaluator:
    """评估虚构梦境强度"""
    async def evaluate(self, content: str) -> DreamScore:
        return DreamScore(
            sympathy_score=85,
            identification_score=72,
            empathy_score=68,
            immersion_score=45,
            issues=["内心冲突不足", "感官细节缺乏"]
        )

class SuspenseEvaluator:
    """评估悬念强度"""
    async def evaluate(self, content: str) -> SuspenseScore

class CharacterEvaluator:
    """评估人物深度"""
    async def evaluate(self, content: str) -> CharacterScore

class PremiseEvaluator:
    """评估预设一致性"""
    async def evaluate(self, content: str, premise: str) -> PremiseScore

class VoiceEvaluator:
    """评估叙事语气强度"""
    async def evaluate(self, content: str) -> VoiceScore
```

**文件清单**:
- [ ] `src/narrative/evaluators/__init__.py`
- [ ] `src/narrative/evaluators/dream_evaluator.py`
- [ ] `src/narrative/evaluators/suspense_evaluator.py`
- [ ] `src/narrative/evaluators/character_evaluator.py`
- [ ] `src/narrative/evaluators/premise_evaluator.py`
- [ ] `src/narrative/evaluators/voice_evaluator.py`

### Task 15.2: 分析器引擎 (Analyzers)

**位置**: `src/narrative/analyzers/`

**职责**: 文本元素提取与分析

```python
class SensoryAnalyzer:
    """提取感官细节"""
    async def extract(self, content: str) -> List[SensoryDetail]

class ConflictAnalyzer:
    """提取冲突元素"""
    async def extract(self, content: str) -> List[Conflict]

class CharacterStateAnalyzer:
    """分析角色状态"""
    async def analyze(self, content: str) -> CharacterState

class TensionCurveAnalyzer:
    """分析张力曲线"""
    async def analyze(self, content: str) -> TensionCurve
```

**文件清单**:
- [ ] `src/narrative/analyzers/__init__.py`
- [ ] `src/narrative/analyzers/sensory_analyzer.py`
- [ ] `src/narrative/analyzers/conflict_analyzer.py`
- [ ] `src/narrative/analyzers/character_state_analyzer.py`
- [ ] `src/narrative/analyzers/tension_curve_analyzer.py`

### Task 15.3: 综合评估器

**位置**: `src/narrative/critic_engine.py`

**职责**: 整合所有评估器，供 Critic Agent 调用

```python
class CriticEngine:
    """综合评估引擎 - Critic Agent 的核心"""
    
    def __init__(self):
        self.dream = DreamEvaluator()
        self.suspense = SuspenseEvaluator()
        self.character = CharacterEvaluator()
        self.premise = PremiseEvaluator()
        self.voice = VoiceEvaluator()
    
    async def full_evaluation(self, content: str, context: dict) -> CriticReport:
        """五维度综合评估"""
        return CriticReport(
            dream_score=await self.dream.evaluate(content),
            suspense_score=await self.suspense.evaluate(content),
            character_score=await self.character.evaluate(content),
            premise_score=await self.premise.evaluate(content, context.get("premise")),
            voice_score=await self.voice.evaluate(content),
            overall_score=...,
            top_issues=[...],
            recommended_skills=[...]  # 推荐使用的技能包
        )
```

---

## 📋 Phase 16: 技能包体系构建

### 技能包设计原则

```yaml
技能包结构:
  SKILL.md:           # 技能定义文件
    - 触发条件        # 何时使用此技能
    - 输入要求        # 需要什么上下文
    - 执行步骤        # 具体操作流程
    - 输出格式        # 产出什么结果
    - 示例            # 大师级范例
  
  templates/:         # Prompt 模板
  examples/:          # 示例文件
```

### Task 16.1: 虚构梦境技能包

**位置**: `skills/fictional-dream/`

```
skills/fictional-dream/
├── SKILL.md                    # 主技能定义
├── techniques/
│   ├── sympathy-building.md    # 同情构建技巧
│   ├── identification.md       # 认同建立技巧
│   ├── empathy-immersion.md    # 移情沉浸技巧
│   └── internal-conflict.md    # 内心冲突技巧
├── templates/
│   ├── universal_dilemma.md    # 普遍性困境模板
│   ├── godfather_technique.md  # 教父技巧模板
│   ├── sensory_detail.md       # 感官细节模板
│   └── moral_war.md            # 道德战争模板
└── examples/
    ├── carrie_empathy.md       # 《嘉莉》移情范例
    ├── crime_punishment.md     # 《罪与罚》范例
    └── les_miserables.md       # 《悲惨世界》范例
```

**SKILL.md 核心内容**:

```markdown
---
name: fictional-dream
description: 虚构梦境构建技能 - 四层情感递进
version: "1.0"
author: frey-theory
tags: [writing, emotion, immersion]
triggers:
  - 评估报告显示 dream_score < 70
  - 用户请求增强情感投入
  - 新章节开头需要建立角色连接
requires:
  - character_info: 角色基本信息
  - scene_context: 场景上下文
---

# 虚构梦境构建技能

## 四层情感递进框架

### 第一层: 同情 (Sympathy)
触发读者对角色的怜悯之心...

### 第二层: 认同 (Identification)
让读者支持角色的目标...

### 第三层: 移情 (Empathy)
让读者感受角色的感受...

### 第四层: 沉浸 (Immersion)
让读者成为角色...
```

### Task 16.2: 悬念构建技能包

**位置**: `skills/suspense-craft/`

```
skills/suspense-craft/
├── SKILL.md
├── techniques/
│   ├── story-questions.md      # 故事问题植入
│   ├── threat-situations.md    # 威胁情境设置
│   ├── ticking-clock.md        # 导火索技巧
│   └── cliffhanger.md          # 章节悬念收尾
├── templates/
│   ├── opening_hook.md         # 开篇钩子模板
│   ├── chapter_end_suspense.md # 章尾悬念模板
│   └── foreshadowing.md        # 伏笔模板
└── examples/
    ├── jaws_opening.md         # 《大白鲨》开篇
    ├── trial_opening.md        # 《审判》开篇
    └── gone_with_wind.md       # 《飘》导火索
```

### Task 16.3: 人物塑造技能包

**位置**: `skills/character-forge/`

```
skills/character-forge/
├── SKILL.md
├── techniques/
│   ├── dynamic-character.md     # 动态人物构建
│   ├── competence-eccentricity.md # 能力与古怪
│   ├── contrast-juxtaposition.md  # 对比与反差
│   ├── dominant-emotion.md      # 主导情感设计
│   └── dual-personality.md      # 双重人格构建
├── templates/
│   ├── character_biography.md   # 人物传记模板
│   ├── dual_personality.md      # 双重人格模板
│   └── character_arc.md         # 人物弧光模板
└── examples/
    ├── don_corleone.md          # 唐·柯里昂
    ├── ahab.md                  # 亚哈船长
    └── raskolnikov.md           # 拉斯柯尔尼科夫
```

### Task 16.4: 预设魔杖技能包

**位置**: `skills/premise-magic/`

```
skills/premise-magic/
├── SKILL.md
├── techniques/
│   ├── premise-formulation.md   # 预设提炼
│   ├── premise-vs-theme.md      # 预设/主题/寓意辨析
│   ├── magic-wand.md            # 魔杖变换技巧
│   └── container-structure.md   # 容器结构
├── templates/
│   ├── chain_reaction.md        # 连锁反应式预设
│   ├── x_vs_y.md                # 反向式预设
│   └── situational.md           # 情景式预设
└── examples/
    ├── farmer_joe.md            # 农民乔故事变换
    ├── crime_punishment.md      # 罪与罚预设
    └── gone_with_wind.md        # 飘预设
```

### Task 16.5: 叙事语气技能包

**位置**: `skills/voice-workshop/`

```
skills/voice-workshop/
├── SKILL.md
├── techniques/
│   ├── narrator-persona.md      # 叙述者伪装
│   ├── pseudo-rules.md          # 伪规则破除
│   ├── concrete-details.md      # 具体细节强化
│   └── voice-consistency.md     # 语气一致性
├── templates/
│   ├── strong_narrator.md       # 强力叙述者模板
│   ├── detail_enhancement.md    # 细节强化模板
│   └── weak_to_strong.md        # 弱语气改强模板
└── examples/
    ├── dostoevsky.md            # 陀思妥耶夫斯基
    ├── austen.md                # 简·奥斯汀
    └── wolfe.md                 # 汤姆·沃尔夫
```

---

## 📋 Phase 17: Agent 重构

### Task 17.1: Critic Agent 重构

**职责变化**: 
- 旧: 直接包含评估逻辑
- 新: 调用 CriticEngine + 推荐技能包

```python
# src/agents/critic.py
class CriticAgent(BaseAgent):
    def __init__(self):
        self.engine = CriticEngine()
        self.skill_loader = SkillLoader()
    
    async def evaluate(self, content: str, context: dict) -> CriticResponse:
        # 1. 使用引擎评估
        report = await self.engine.full_evaluation(content, context)
        
        # 2. 根据问题推荐技能包
        recommended_skills = self._recommend_skills(report)
        
        # 3. 生成修改建议
        suggestions = await self._generate_suggestions(report, recommended_skills)
        
        return CriticResponse(
            scores=report,
            issues=report.top_issues,
            recommended_skills=recommended_skills,
            suggestions=suggestions
        )
    
    def _recommend_skills(self, report: CriticReport) -> List[str]:
        skills = []
        if report.dream_score.overall < 70:
            skills.append("fictional-dream")
        if report.suspense_score.overall < 70:
            skills.append("suspense-craft")
        if report.character_score.overall < 70:
            skills.append("character-forge")
        # ...
        return skills
```

### Task 17.2: Writer Agent 重构

**职责变化**:
- 旧: 固定写作逻辑
- 新: 根据推荐技能包动态加载技巧

```python
# src/agents/writer.py
class WriterAgent(BaseAgent):
    def __init__(self):
        self.skill_loader = SkillLoader()
    
    async def write(self, context: dict, skills: List[str] = None) -> str:
        # 1. 加载推荐的技能包
        loaded_skills = []
        for skill_name in skills or []:
            skill = await self.skill_loader.load(skill_name)
            loaded_skills.append(skill)
        
        # 2. 构建增强型 Prompt
        prompt = self._build_prompt(context, loaded_skills)
        
        # 3. 生成内容
        return await self.llm.generate(prompt)
```

### Task 17.3: SkillLoader 实现

```python
# src/skills/loader.py
class SkillLoader:
    """技能包加载器"""
    
    def __init__(self, skills_dir: str = "skills"):
        self.skills_dir = skills_dir
        self.cache = {}
    
    async def load(self, skill_name: str) -> Skill:
        """加载技能包"""
        if skill_name in self.cache:
            return self.cache[skill_name]
        
        skill_path = Path(self.skills_dir) / skill_name / "SKILL.md"
        skill = await self._parse_skill(skill_path)
        self.cache[skill_name] = skill
        return skill
    
    async def load_technique(self, skill_name: str, technique: str) -> str:
        """加载特定技巧"""
        tech_path = Path(self.skills_dir) / skill_name / "techniques" / f"{technique}.md"
        return tech_path.read_text()
    
    async def load_template(self, skill_name: str, template: str) -> str:
        """加载模板"""
        tmpl_path = Path(self.skills_dir) / skill_name / "templates" / f"{template}.md"
        return tmpl_path.read_text()
```

---

## 📋 Phase 18: 高级技能包

### Task 18.1: 章节创作技能包 (已有，需增强)

**位置**: `skills/novel-chapter/` (已存在)

**增强内容**:
- 集成五维评估
- 添加技能包推荐
- 优化工作流

### Task 18.2: 大纲生成技能包

**位置**: `skills/outline-generator/`

```
skills/outline-generator/
├── SKILL.md
├── techniques/
│   ├── three-act-structure.md
│   ├── scene-card.md
│   └── character-arc-planning.md
└── templates/
    ├── outline_template.md
    └── scene_card_template.md
```

### Task 18.3: 修订优化技能包

**位置**: `skills/revision-craft/`

```
skills/revision-craft/
├── SKILL.md
├── techniques/
│   ├── pacing-adjustment.md
│   ├── dialogue-polish.md
│   ├── description-balance.md
│   └── tension-enhancement.md
└── templates/
    └── revision_checklist.md
```

### Task 18.4: 世界观构建技能包

**位置**: `skills/worldbuilding/`

```
skills/worldbuilding/
├── SKILL.md
├── techniques/
│   ├── magic-system.md
│   ├── society-structure.md
│   └── history-building.md
└── templates/
    └── world_bible.md
```

---

## 📋 Phase 19: 清理与迁移

### Task 19.1: 迁移现有 narrative 模块

**操作**:
1. 将 `src/narrative/fictional_dream/` 中的评估逻辑提取到 `src/narrative/evaluators/`
2. 将技巧指导内容迁移到 `skills/fictional-dream/`
3. 删除冗余代码

### Task 19.2: 清理重复文档

**操作**:
1. 合并 `docs/TASKS_*.md` 为单一最新版本
2. 归档旧版 SDD 文档
3. 更新 `docs/INDEX.md`

### Task 19.3: 更新 __init__.py

确保所有模块正确导出

---

## 📊 优化后架构总览

```
niko-studio/
├── docs/
│   ├── TASKS_V10_OPTIMIZED.md   # 当前任务清单
│   ├── SDD_V10.md               # 最新设计文档
│   └── archive/                 # 归档旧文档
│
├── skills/                       # 🆕 技能包层 (写作技巧)
│   ├── fictional-dream/          # 虚构梦境技能包
│   ├── suspense-craft/           # 悬念构建技能包
│   ├── character-forge/          # 人物塑造技能包
│   ├── premise-magic/            # 预设魔杖技能包
│   ├── voice-workshop/           # 叙事语气技能包
│   ├── novel-chapter/            # 章节创作技能包 (已有)
│   ├── outline-generator/        # 大纲生成技能包
│   ├── revision-craft/           # 修订优化技能包
│   └── worldbuilding/            # 世界观构建技能包
│
├── src/
│   ├── agents/                   # Agent 层
│   │   ├── commander.py
│   │   ├── architect.py
│   │   ├── writer.py             # 调用技能包
│   │   └── critic.py             # 调用评估引擎
│   │
│   ├── narrative/                # 🔄 核心引擎层 (纯评估)
│   │   ├── evaluators/           # 评估器
│   │   │   ├── dream_evaluator.py
│   │   │   ├── suspense_evaluator.py
│   │   │   ├── character_evaluator.py
│   │   │   ├── premise_evaluator.py
│   │   │   └── voice_evaluator.py
│   │   ├── analyzers/            # 分析器
│   │   │   ├── sensory_analyzer.py
│   │   │   ├── conflict_analyzer.py
│   │   │   └── tension_curve_analyzer.py
│   │   └── critic_engine.py      # 综合评估引擎
│   │
│   ├── skills/                   # 技能加载器
│   │   └── loader.py
│   │
│   ├── memory/
│   ├── search/
│   └── services/
│
└── scripts/
```

---

## ✅ 执行检查清单

### Phase 15: 核心引擎层
- [ ] 15.1 评估器引擎
- [ ] 15.2 分析器引擎
- [ ] 15.3 综合评估器

### Phase 16: 技能包体系
- [ ] 16.1 虚构梦境技能包
- [ ] 16.2 悬念构建技能包
- [ ] 16.3 人物塑造技能包
- [ ] 16.4 预设魔杖技能包
- [ ] 16.5 叙事语气技能包

### Phase 17: Agent 重构
- [ ] 17.1 Critic Agent 重构
- [ ] 17.2 Writer Agent 重构
- [ ] 17.3 SkillLoader 实现

### Phase 18: 高级技能包
- [ ] 18.1 章节创作技能包增强
- [ ] 18.2 大纲生成技能包
- [ ] 18.3 修订优化技能包
- [ ] 18.4 世界观构建技能包

### Phase 19: 清理与迁移
- [ ] 19.1 迁移现有模块
- [ ] 19.2 清理重复文档
- [ ] 19.3 更新导出

---

## 🎯 关键收益

| 收益 | 说明 |
|------|------|
| **关注点分离** | 引擎只评估，技能包只指导 |
| **可扩展性** | 新增技能包无需修改核心代码 |
| **可复用性** | 技能包可独立使用和分享 |
| **可维护性** | 每个模块职责单一 |
| **可测试性** | 引擎和技能包可独立测试 |

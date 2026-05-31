# niko-studio 多 Agent 协作与质量约束设计

> 借鉴 maestro-flow 的多 agent 讨论头脑风暴 + 质量约束体系，结合 niko-studio 的叙事评分系统，打造强力的写作质量保障体系

---

## 1. 设计目标

将 maestro-flow 的三种多 agent 模式（brainstorm / collab / coordinate）适配到写作场景，与 niko-studio 的 20+ 评分器结合，形成：

- **写作前**：多角色头脑风暴，从不同叙事维度激发创意
- **写作中**：实时质量约束，即时反馈 + 自动修正
- **写作后**：多维度审查 + 对抗评分，确保质量达标

---

## 2. 多 Agent 协作模式

### 2.1 叙事头脑风暴（Narrative Brainstorm）

**对标 maestro-flow**: `maestro-brainstorm`（角色并行分析 + 交叉审查）

**适配写作场景**：多个叙事专家角色并行分析一个创作主题，然后交叉审查发现矛盾和协同。

**8 个叙事专家角色**（替代 maestro-flow 的 9 个工程角色）：

| 角色 | 关注维度 | 评分器组合 |
|------|---------|-----------|
| `plot-architect` (情节架构师) | 三幕结构、节奏、伏笔布局 | hook, cliffhanger, pacing, foreshadow |
| `character-psychologist` (角色心理学家) | 角色深度、成长弧线、动机一致性 | character, four-selves, voice-fingerprint |
| `suspense-engineer` (悬疑工程师) | 信息缺口、威胁递进、时间压力 | suspense, premise, deadly-sins |
| `emotion-craftsman` (情感匠人) | Show-don't-tell、感官层次、沉浸感 | emotion-craft, fictional-dream, show-tell |
| `world-builder` (世界观构建者) | 设定一致性、规则自洽、环境细节 | worldview-coherence, timeline-consistency |
| `reader-advocate` (读者代言人) | 爽点密度、钩子强度、留存节奏 | reader-satisfaction, retention-rhythm, satisfaction-density |
| `style-editor` (风格编辑) | 文风统一、修辞品质、叙述视角 | style-system, voice-evaluator, subtext |
| `continuity-guard` (连贯性守卫) | 时间线、角色状态、伏笔回收 | timeline-consistency, cross-chapter-character, foreshadowing |

**执行流程**：

```
Step 1: 框架生成
  输入: 创作主题 + 类型 + 已有大纲
  处理: 收集上下文 → 定义术语 → 选择角色 → 收集角色问题 → 解决冲突 → 分解功能
  输出: brainstorm-specification.md

Step 2: 并行角色分析
  每个角色 agent 独立分析，产出:
    {role}/analysis.md — 角色视角的完整分析
    {role}/analysis-F-{feature}.md — 按功能拆分的详细分析
    {role}/findings-{dim}.md — 按维度的发现

Step 3: 交叉角色审查
  cross-role-reviewer agent 比较所有角色的决策摘要:
    冲突: plot-architect 建议快节奏 vs emotion-craftsman 需要情感沉淀空间
    协同: suspense-engineer 的信息缺口 → reader-advocate 的钩子
    缺口: world-builder 未评估魔法体系对情节的影响

Step 4: 应用解决方案
  用户确认每个发现 → 自动 patch 角色文件和指导文件
```

### 2.2 多工具交叉验证（Narrative Collab）

**对标 maestro-flow**: `maestro-collab`（扇出多 CLI 工具 + 交叉验证）

**适配写作场景**：将同一段文本提交给多个 LLM（Claude/GPT/Gemini）进行叙事评估，交叉验证发现。

**流程**：
```
S_PARSE → S_DISCOVER → S_CONFIRM → S_FANOUT → S_COLLECT → S_CROSS_VERIFY → S_SYNTHESIZE → S_REGISTER
```

**交叉验证分类**：
- `CONSENSUS`: 2+ 个 LLM 对同一问题达成一致（高可信度）
- `CONFLICT`: LLM 之间分歧（需要人工裁决）
- `UNIQUE`: 仅一个 LLM 发现（低可信度，但可能是有价值的独特视角）

**共识度计算**：`consensus_level = consensus_count / total_findings * 100`

### 2.3 动态角色协调（Narrative Coordinate）

**对标 maestro-flow**: `team-coordinate`（动态生成角色 + team-worker）

**适配写作场景**：根据当前写作阶段动态生成需要的角色。例如：

- **开篇阶段** → 生成 `hook-specialist` + `world-introducer` + `character-anchor`
- **高潮阶段** → 生成 `tension-escalator` + `sacrifice-architect` + `reversal-planner`
- **收尾阶段** → 生成 `foreshadow-resolver` + `arc-completer` + `reader-satisfier`

**角色规范动态生成**：
```typescript
interface NarrativeRoleSpec {
  role: string;
  focus_dimensions: DimensionType[];
  scoring_weights: Record<string, number>;
  behavioral_traits: string[];
  quality_gates: QualityGate[];
}
```

---

## 3. 质量约束体系

### 3.1 三级质量门禁

**对标 maestro-flow**: phase gates (full/standard/quick)

**适配写作场景**：

| 级别 | 管道 | 适用场景 |
|------|------|---------|
| `strict` (严格) | 全部评分器 → review → revision loop → test | 正式发布章节 |
| `standard` (标准) | CriticEngine(5维度) → review → selective revision | 日常写作 |
| `quick` (快速) | hook + cliffhanger + show-tell 快扫 | 即时反馈 |

### 3.2 三层验证

**对标 maestro-flow**: verify 3层（existence → substance → connection）

**适配写作场景**：

| 层 | 验证内容 | 写作对应 |
|----|---------|---------|
| L1 存在性 | 所有声明的叙事元素是否实际存在 | 大纲中的角色/场景是否在正文中出现 |
| L2 实质性 | 内容是否有实质深度（非占位符） | 角色描写 > 3 行、场景 > 50 字、情感 > 1 层 |
| L3 连接性 | 声明的关联是否真正绑定 | 伏笔有回收、因果关系成立、时间线一致 |

**反模式扫描**：
- 存根/占位符: "（待补）", "XXX", "[TBD]"
- 空洞描写: 连续 > 3 段无具体细节
- 角色幽灵: 大纲中声明但 > 5000 字未出场
- 弃置伏笔: 已埋设但距回收上限 < 5 章且无提醒

### 3.3 评分与质量约束结合

**核心创新**：将 niko-studio 的 20+ 评分器与 maestro-flow 的 ACO 蚁群评分结合。

#### 3.3.1 双层评分体系

```
写作产出
  │
  ├── self_score (快速自评)
  │   hook_score, cliffhanger_score, show_tell_ratio, ...
  │   成本低（纯关键词匹配），0-100
  │
  └── verified_score (LLM 深度评估)
      CriticEngine 综合评分 + 角色专项评分
      成本高（LLM 调用），0-100 权威评分
```

**幻觉检测**：`|self_score - verified_score| > 20` 标记为 `hallucination_suspected`（评分器可能误判）。

#### 3.3.2 对抗收敛评分

**对标 maestro-flow**: adversarial-swarm (prosecutor/defender/judge)

**适配写作场景**：对每个章节执行对抗评分：

```
检察官 (Prosecutor): 试图找出该章节的所有叙事缺陷
  → 输出: 缺陷列表 + 严重度 + 修复建议

辩护人 (Defender): 试图为该章节的每个缺陷辩护
  → 输出: 每个缺陷是否合理 + 证据

法官 (Judge): 综合双方论点，做出最终裁决
  → 输出: 确认缺陷列表 + 优先级 + 行动建议
```

**5 种收敛标准**：

| 标准 | 默认值 | 说明 |
|------|-------|------|
| `max_iterations` | 3 | 最多 3 轮对抗 |
| `stagnation` | patience=2 | 分数连续 2 轮未改善 |
| `entropy_floor` | 0.5 | 缺陷发现的信息熵过低 |
| `budget_tokens` | 50K | LLM token 预算 |
| `target_score` | 90 | 目标分数 |

#### 3.3.3 评分维度权重映射

不同写作阶段使用不同权重：

| 阶段 | hook | cliffhanger | emotion | suspense | character | pacing | retention |
|------|------|-------------|---------|----------|-----------|--------|-----------|
| 开篇(1-3章) | 0.30 | 0.10 | 0.15 | 0.15 | 0.10 | 0.10 | 0.10 |
| 发展(4-60%) | 0.10 | 0.15 | 0.20 | 0.20 | 0.15 | 0.10 | 0.10 |
| 高潮(60-90%) | 0.05 | 0.20 | 0.15 | 0.25 | 0.10 | 0.15 | 0.10 |
| 收尾(90-100%) | 0.05 | 0.05 | 0.20 | 0.10 | 0.15 | 0.15 | 0.30 |

### 3.4 修订循环

**对标 maestro-flow**: quality-loop (verify → review → test → debug → fix → re-verify)

**适配写作场景**：

```
章节初稿
  │
  ▼ quick_scan (hook + cliffhanger + show-tell)
  │
  ├── PASS (> 60) → standard_eval
  └── FAIL → auto_fix_suggestions → 人工修改 → re-scan
      │
      ▼ standard_eval (CriticEngine 5维度)
      │
      ├── PASS (> 75) → strict_eval (if 发布)
      ├── WARN (60-75) → revision_loop
      └── FAIL (< 60) → full_diagnosis → 修订建议 → 人工修改 → re-eval
          │
          ▼ revision_loop (Writer-Critic 迭代)
          │
          │   max_revisions: 3
          │   pass_score: 85
          │   stagnation: 连续 2 次无改善 → HUMAN_REVIEW
          │
          ▼ strict_eval (all 20+ scorers, 发布前)
          │
          ├── PASS (> 90) → 发布就绪
          ├── WARN (80-90) → 标记待优化
          └── FAIL (< 80) → 阻止发布 + 修订计划
```

---

## 4. Agent 角色定义

### 4.1 核心 Agent

| Agent | 职责 | 对标 maestro-flow |
|-------|------|------------------|
| `narrative-coordinator` | 协调写作工作流，管理会话状态 | `team-coordinator` |
| `narrative-worker` | 执行角色规范中的具体任务 | `team-worker` |
| `narrative-supervisor` | 监控管道健康，跨检查点上下文累积 | `team-supervisor` |
| `role-design-author` | 生成多文件角色分析（叙事版本） | `role-design-author` |
| `cross-role-reviewer` | 比较角色摘要，发现冲突/缺口/协同 | `cross-role-reviewer` |

### 4.2 Worker 生命周期

```
1. parse_prompt — 提取角色、role_spec、会话
2. load_role_spec — 读取动态生成的角色规范
3. discover_tasks — 获取待处理任务
4. load_context — 加载上游上下文 + Nowledge Mem 知识
5. execute — 执行角色特定逻辑（评分/分析/建议）
6. publish — 写入产出 + 推送到知识层
7. report — 标记任务完成 + 发送消息
```

### 4.3 消息总线

```
team_msg(operation, session_id, from, type, data)

操作: log | get_state | list | broadcast | state_update
类型: analysis | finding | decision | conflict | suggestion | score | alert
```

Agent 之间不直接通信，仅通过 coordinator 中转。

---

## 5. 质量门禁与评分集成

### 5.1 门禁决策节点

```
decision:post-quick-scan
  IF score < 60 → insert auto_fix + re-scan
  IF score 60-80 → continue to standard_eval
  IF score > 80 → skip to strict_eval (if release)

decision:post-standard-eval
  IF score < 60 → insert full_diagnosis + revision_plan
  IF score 60-75 → insert revision_loop
  IF score > 75 → continue to strict_eval (if release) or PASS

decision:post-revision
  IF improvement > 5 → continue
  IF stagnant >= 2 → HUMAN_REVIEW
  IF max_revisions >= 3 → HUMAN_REVIEW

decision:post-strict-eval
  IF score > 90 → PASS
  IF score 80-90 → PASS_WITH_NOTES
  IF score < 80 → BLOCK + remediation plan
```

### 5.2 评分器与 Agent 的映射

| 评分器 | Agent 角色 | 触发时机 |
|--------|-----------|---------|
| hook_scorer | plot-architect | 每章开头 |
| cliffhanger_scorer | plot-architect | 每章结尾 |
| emotion_craft | emotion-craftsman | 每段情感描写 |
| emotional_arc | emotion-craftsman | 每 5 章聚合 |
| voice_fingerprint | style-editor | 每角色对话段 |
| suspense_evaluator | suspense-engineer | 每章 |
| deadly_sins_checker | continuity-guard | 每章 |
| CriticEngine | narrative-worker (auto) | 写作后/发布前 |
| novel_quality | narrative-worker (auto) | 每卷/全文 |
| revision_loop | narrative-coordinator | 评分不达标时 |
| quality_gate | narrative-supervisor | 修订循环后 |

---

## 6. 会话目录结构

```
.workflow/.team/{PREFIX}-{slug}-{date}/
  ├── team-session.json           # 会话状态 + 角色注册
  ├── .msg/
  │   ├── messages.jsonl          # 消息总线
  │   └── meta.json               # 会话元数据
  ├── wisdom/                     # 跨任务知识
  │   ├── decisions.md            # 决策记录
  │   ├── patterns.md             # 发现的叙事模式
  │   └── risks.md                # 风险标记
  ├── artifacts/                  # 产出物
  │   ├── chapter-revisions/      # 章节修订稿
  │   ├── analysis-reports/       # 分析报告
  │   └── scoring-sheets/         # 评分表
  ├── role-specs/                 # 动态角色规范
  └── discussions/                # 内联讨论记录
```

---

## 7. 与现有评分系统的集成路径

### 7.1 渐进集成

| 阶段 | 集成内容 | 预期效果 |
|------|---------|---------|
| P0 | CriticEngine → revision_loop → quality_gate | 写作后自动评分 + 修订 |
| P1 | narrative-brainstorm (8 角色) | 写作前多角色头脑风暴 |
| P2 | 对抗收敛评分 + 幻觉检测 | 发布前深度质量保障 |
| P3 | narrative-collab (多 LLM 交叉验证) | 多视角质量验证 |
| P4 | 动态角色协调 + ACO 蚁群 | 自适应质量优化 |

### 7.2 MCP 端点

```
POST /narrative/brainstorm/start       # 启动头脑风暴
POST /narrative/brainstorm/review       # 交叉审查
POST /narrative/brainstorm/apply        # 应用解决方案

POST /narrative/quality/scan            # 快速扫描
POST /narrative/quality/evaluate        # 标准评估
POST /narrative/quality/strict          # 严格评估
POST /narrative/quality/revise          # 启动修订循环
POST /narrative/quality/adversarial     # 对抗评分

POST /narrative/agent/dispatch          # 分发 agent 任务
POST /narrative/agent/message           # agent 消息
POST /narrative/agent/status            # agent 状态
```

---

## 8. 信息素与叙事优化

**对标 maestro-flow**: ACO 蚁群 (pheromone matrix + MMAS)

**适配写作场景**：将写作策略选择建模为信息素优化问题。

**信息素图**：
- 节点：叙事策略（快节奏推进、情感沉淀、悬疑铺设、伏笔埋设...）
- 边：策略转换（快节奏→情感沉淀、悬疑铺设→高潮爆发...）

**信息素更新**：
```
tau(strategy_i → strategy_j) = (1 - rho) * tau + sum(q * verified_score)
```

**选择概率**：
```
p(i→j) = (tau^alpha * eta^beta) / sum(tau^alpha * eta^beta)
```
其中 `eta` = 该策略在当前章节位置的预期收益（基于评分器历史数据）。

**应用场景**：
- 自动推荐下一章节的叙事策略
- 基于全局节奏优化策略选择
- 发现被忽略的有效叙事手法

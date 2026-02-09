# 质量保障层设计 (CRAG + Self-RAG)

**版本**: 1.0
**日期**: 2026-02-03
**状态**: 设计完成，待实现

---

## 1. 概述

### 1.1 设计目标

构建一个**双阶段质量保障系统**，确保检索和生成的质量：

- **CRAG 阶段**：评估检索结果相关性，执行纠正和补充
- **Self-RAG 阶段**：验证生成内容的事实一致性、上下文连贯性和有用性

### 1.2 架构决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 介入阶段 | 检索后 + 生成时 | 双重保障，精度优先 |
| 纠正策略 | 混合策略 | 高相关保留、中等补充、低相关丢弃 |
| 验证维度 | 事实 + 连贯 + 有用 | 小说创作需要全方位验证 |

### 1.3 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      质量保障层 (Quality Assurance)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  检索结果 ──► [CRAG 阶段] ──► 精炼结果 ──► [生成] ──► [Self-RAG] │
│                   │                              │              │
│                   ▼                              ▼              │
│            ┌──────────┐                   ┌──────────┐          │
│            │ 相关性   │                   │ 事实一致 │          │
│            │ 分级评估 │                   │ 性验证   │          │
│            ├──────────┤                   ├──────────┤          │
│            │ 知识精炼 │                   │ 上下文   │          │
│            │ /补充    │                   │ 连贯验证 │          │
│            ├──────────┤                   ├──────────┤          │
│            │ 查询重写 │                   │ 有用性   │          │
│            │ /回退    │                   │ 评估     │          │
│            └──────────┘                   └──────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CRAG 阶段：相关性分级评估

### 2.1 三级评估标准

```python
class RelevanceGrade(Enum):
    """相关性等级"""
    CORRECT = "correct"       # 高相关：直接回答查询
    AMBIGUOUS = "ambiguous"   # 中等：部分相关或需要补充
    INCORRECT = "incorrect"   # 低相关：与查询无关

@dataclass
class GradedDocument:
    document: Document
    grade: RelevanceGrade
    confidence: float         # 评估置信度 0-1
    reason: str               # 评估理由
```

### 2.2 分级评估器

```python
class RelevanceGrader:
    """相关性分级评估器"""

    GRADER_PROMPT = """评估文档与查询的相关性。

## 查询
{query}

## 文档内容
{content}

## 评估标准
- CORRECT: 文档直接包含回答查询所需的关键信息
- AMBIGUOUS: 文档部分相关，可能需要结合其他信息才能回答
- INCORRECT: 文档与查询无关或信息不足以回答

## 输出格式
```json
{{
  "grade": "CORRECT|AMBIGUOUS|INCORRECT",
  "confidence": 0.0-1.0,
  "reason": "一句话理由"
}}
```"""

    async def grade_documents(
        self,
        query: str,
        documents: list[Document]
    ) -> list[GradedDocument]:
        """批量评估文档相关性"""

        tasks = [
            self._grade_single(query, doc)
            for doc in documents
        ]

        return await asyncio.gather(*tasks)

    async def _grade_single(
        self,
        query: str,
        doc: Document
    ) -> GradedDocument:
        """评估单个文档"""

        prompt = self.GRADER_PROMPT.format(
            query=query,
            content=doc.content[:1500]
        )

        response = await llm.generate(prompt, model="fast")
        result = parse_json(response)

        return GradedDocument(
            document=doc,
            grade=RelevanceGrade(result["grade"]),
            confidence=result["confidence"],
            reason=result["reason"]
        )
```

### 2.3 分级处理策略

| 等级 | 处理策略 | 典型场景 |
|------|----------|----------|
| CORRECT | 直接保留 | 文档明确提到查询的实体和关系 |
| AMBIGUOUS | 保留 + 补充检索 | 提到实体但信息不完整 |
| INCORRECT | 丢弃 | 完全不相关或信息错误 |

---

## 3. CRAG 阶段：知识精炼与补充

### 3.1 精炼结果结构

```python
@dataclass
class RefinementResult:
    """精炼结果"""
    final_documents: list[Document]      # 最终使用的文档
    actions_taken: list[str]             # 执行的动作记录
    supplemented: bool                   # 是否进行了补充检索
    query_rewritten: bool                # 是否重写了查询
```

### 3.2 知识精炼器

```python
class KnowledgeRefiner:
    """知识精炼器"""

    async def refine(
        self,
        query: str,
        graded_docs: list[GradedDocument],
        analysis: QueryAnalysis
    ) -> RefinementResult:

        # 按等级分组
        correct = [g for g in graded_docs if g.grade == RelevanceGrade.CORRECT]
        ambiguous = [g for g in graded_docs if g.grade == RelevanceGrade.AMBIGUOUS]
        incorrect = [g for g in graded_docs if g.grade == RelevanceGrade.INCORRECT]

        actions = []
        final_docs = []
        supplemented = False
        query_rewritten = False

        # 策略1: 高相关文档全部保留
        final_docs.extend([g.document for g in correct])
        if correct:
            actions.append(f"保留 {len(correct)} 条高相关文档")

        # 策略2: 中等相关 - 保留 + 针对性补充
        if ambiguous:
            final_docs.extend([g.document for g in ambiguous])
            actions.append(f"保留 {len(ambiguous)} 条中等相关文档")

            missing_aspects = await self._identify_missing(query, ambiguous)
            if missing_aspects:
                supplement = await self._supplement_search(missing_aspects, analysis)
                final_docs.extend(supplement)
                supplemented = True
                actions.append(f"补充检索 {len(supplement)} 条文档")

        # 策略3: 低相关全部丢弃
        if incorrect:
            actions.append(f"丢弃 {len(incorrect)} 条低相关文档")

        # 策略4: 如果高相关不足，触发查询重写
        if len(correct) < 2 and len(final_docs) < 5:
            rewritten_query = await self._rewrite_query(query, analysis)
            if rewritten_query != query:
                extra_docs = await self._fallback_search(rewritten_query, analysis)
                final_docs.extend(extra_docs)
                query_rewritten = True
                actions.append(f"重写查询并补充 {len(extra_docs)} 条")

        final_docs = self._deduplicate_and_rank(final_docs)

        return RefinementResult(
            final_documents=final_docs,
            actions_taken=actions,
            supplemented=supplemented,
            query_rewritten=query_rewritten
        )

    async def _identify_missing(
        self,
        query: str,
        ambiguous_docs: list[GradedDocument]
    ) -> list[str]:
        """识别中等相关文档缺失的信息维度"""

        prompt = f"""查询: {query}

现有文档覆盖的信息:
{self._summarize_docs(ambiguous_docs)}

问题: 要完整回答查询，还缺少哪些关键信息？
输出: 用逗号分隔的缺失信息列表，如无则输出"无"
"""
        response = await llm.generate(prompt, model="fast")

        if "无" in response:
            return []
        return [x.strip() for x in response.split(",")]

    async def _rewrite_query(
        self,
        original_query: str,
        analysis: QueryAnalysis
    ) -> str:
        """重写查询以提高检索效果"""

        prompt = f"""原始查询: {original_query}
已识别实体: {analysis.entities}
查询意图: {analysis.intent}

请重写查询，使其更具体、更易于检索。保持原意，但：
- 补充可能的同义词或别名
- 明确时间或范围限定
- 拆解复杂问题为更聚焦的子问题

输出重写后的查询（仅一句话）:"""

        return await llm.generate(prompt, model="fast")
```

### 3.3 处理逻辑总结

| 等级分布 | 执行动作 |
|----------|----------|
| 多数 CORRECT | 直接使用，无需补充 |
| 多数 AMBIGUOUS | 保留 + 识别缺失 + 针对性补充 |
| 多数 INCORRECT | 丢弃 + 重写查询 + 重新检索 |
| 全部 INCORRECT | 重写查询 + 重新检索 + 可能触发外部回退 |

---

## 4. Self-RAG 阶段：反思标记系统

### 4.1 反思标记类型

```python
class ReflectionToken(Enum):
    """反思标记类型"""
    RETRIEVE = "[Retrieve]"       # 是否需要检索: Yes / No
    ISREL = "[IsRelevant]"        # 检索结果相关性: Relevant / Irrelevant
    ISSUP = "[IsSupported]"       # 事实一致性: Fully / Partially / No
    ISCON = "[IsCoherent]"        # 上下文连贯性: Coherent / Minor Conflict / Major Conflict
    ISUSE = "[IsUseful]"          # 有用性: Useful / Partially / Not Useful

@dataclass
class ReflectionResult:
    """反思结果"""
    token: ReflectionToken
    value: str
    confidence: float
    evidence: str

@dataclass
class GenerationWithReflection:
    """带反思的生成结果"""
    content: str
    reflections: dict[ReflectionToken, ReflectionResult]
    overall_quality: float
    needs_revision: bool
    revision_hints: list[str]
```

### 4.2 三维验证标准

| 维度 | 标记 | 通过标准 | 失败处理 |
|------|------|----------|----------|
| 事实一致性 | ISSUP | Fully 或 Partially | 标记冲突点，请求修订 |
| 上下文连贯性 | ISCON | Coherent 或 Minor | 标记冲突，提供设定参考 |
| 有用性 | ISUSE | Useful 或 Partially | 提示缺失内容 |

---

## 5. Self-RAG 阶段：验证器实现

```python
class SelfRAGValidator:
    """Self-RAG 验证器"""

    async def validate(
        self,
        generated_content: str,
        retrieved_docs: list[Document],
        novel_context: NovelContext,
        query: str
    ) -> GenerationWithReflection:

        # 并行执行三维验证
        fact_check, coherence_check, usefulness_check = await asyncio.gather(
            self._check_factual_support(generated_content, retrieved_docs),
            self._check_context_coherence(generated_content, novel_context),
            self._check_usefulness(generated_content, query)
        )

        reflections = {
            ReflectionToken.ISSUP: fact_check,
            ReflectionToken.ISCON: coherence_check,
            ReflectionToken.ISUSE: usefulness_check,
        }

        overall = self._calculate_overall_quality(reflections)

        needs_revision = (
            fact_check.value == "No" or
            coherence_check.value == "Major Conflict" or
            usefulness_check.value == "Not Useful"
        )

        hints = self._generate_revision_hints(reflections) if needs_revision else []

        return GenerationWithReflection(
            content=generated_content,
            reflections=reflections,
            overall_quality=overall,
            needs_revision=needs_revision,
            revision_hints=hints
        )

    async def _check_factual_support(
        self,
        content: str,
        docs: list[Document]
    ) -> ReflectionResult:
        """验证事实一致性"""

        prompt = f"""判断生成内容是否被参考文档支持。

## 生成内容
{content}

## 参考文档
{self._format_docs(docs)}

## 判断标准
- Fully: 所有关键事实都有文档支持
- Partially: 部分事实有支持，部分为合理推断
- No: 存在与文档明显矛盾的内容

## 输出格式
```json
{{
  "value": "Fully|Partially|No",
  "confidence": 0.0-1.0,
  "evidence": "列出支持或矛盾的具体内容"
}}
```"""

        response = await llm.generate(prompt, model="fast")
        result = parse_json(response)

        return ReflectionResult(
            token=ReflectionToken.ISSUP,
            value=result["value"],
            confidence=result["confidence"],
            evidence=result["evidence"]
        )

    async def _check_context_coherence(
        self,
        content: str,
        novel_context: NovelContext
    ) -> ReflectionResult:
        """验证上下文连贯性"""

        prompt = f"""判断生成内容是否与小说已有设定一致。

## 生成内容
{content}

## 小说设定
角色设定: {novel_context.character_summaries}
世界观: {novel_context.world_settings}
前文关键情节: {novel_context.recent_plot_points}

## 判断标准
- Coherent: 完全符合已有设定
- Minor Conflict: 有小的不一致但可接受
- Major Conflict: 存在重大矛盾

## 输出格式
```json
{{
  "value": "Coherent|Minor Conflict|Major Conflict",
  "confidence": 0.0-1.0,
  "evidence": "具体说明一致或冲突之处"
}}
```"""

        response = await llm.generate(prompt, model="fast")
        result = parse_json(response)

        return ReflectionResult(
            token=ReflectionToken.ISCON,
            value=result["value"],
            confidence=result["confidence"],
            evidence=result["evidence"]
        )

    async def _check_usefulness(
        self,
        content: str,
        query: str
    ) -> ReflectionResult:
        """验证有用性"""

        prompt = f"""判断生成内容是否有效回答了查询。

## 查询
{query}

## 生成内容
{content}

## 判断标准
- Useful: 完整、准确地回答了查询
- Partially: 回答了部分问题，或需要更多细节
- Not Useful: 没有回答问题，或答非所问

## 输出格式
```json
{{
  "value": "Useful|Partially|Not Useful",
  "confidence": 0.0-1.0,
  "evidence": "说明回答了哪些、缺失哪些"
}}
```"""

        response = await llm.generate(prompt, model="fast")
        result = parse_json(response)

        return ReflectionResult(
            token=ReflectionToken.ISUSE,
            value=result["value"],
            confidence=result["confidence"],
            evidence=result["evidence"]
        )

    def _calculate_overall_quality(
        self,
        reflections: dict[ReflectionToken, ReflectionResult]
    ) -> float:
        """计算综合质量分"""

        weights = {
            ReflectionToken.ISSUP: 0.4,
            ReflectionToken.ISCON: 0.35,
            ReflectionToken.ISUSE: 0.25,
        }

        value_scores = {
            "Fully": 1.0, "Useful": 1.0, "Coherent": 1.0,
            "Partially": 0.6, "Minor Conflict": 0.7,
            "No": 0.0, "Not Useful": 0.0, "Major Conflict": 0.0,
        }

        total = 0.0
        for token, weight in weights.items():
            result = reflections[token]
            score = value_scores.get(result.value, 0.5)
            total += weight * score * result.confidence

        return total
```

### 5.1 质量分计算

| 维度 | 权重 | 满分条件 |
|------|------|----------|
| 事实一致性 (ISSUP) | 40% | Fully |
| 上下文连贯性 (ISCON) | 35% | Coherent |
| 有用性 (ISUSE) | 25% | Useful |

---

## 6. Self-RAG 阶段：自动修订机制

```python
class SelfRAGReviser:
    """Self-RAG 自动修订器"""

    MAX_REVISION_ROUNDS = 2
    MIN_QUALITY_THRESHOLD = 0.7

    async def revise_if_needed(
        self,
        generation: GenerationWithReflection,
        retrieved_docs: list[Document],
        novel_context: NovelContext,
        query: str
    ) -> GenerationWithReflection:
        """条件性修订，直到质量达标或达到最大轮数"""

        current = generation

        for round_num in range(self.MAX_REVISION_ROUNDS):
            if not current.needs_revision:
                break

            if current.overall_quality >= self.MIN_QUALITY_THRESHOLD:
                break

            revised_content = await self._perform_revision(
                content=current.content,
                reflections=current.reflections,
                hints=current.revision_hints,
                docs=retrieved_docs,
                context=novel_context
            )

            current = await self.validator.validate(
                generated_content=revised_content,
                retrieved_docs=retrieved_docs,
                novel_context=novel_context,
                query=query
            )

            current.revision_round = round_num + 1

        return current

    async def _perform_revision(
        self,
        content: str,
        reflections: dict[ReflectionToken, ReflectionResult],
        hints: list[str],
        docs: list[Document],
        context: NovelContext
    ) -> str:
        """执行具体修订"""

        revision_instructions = self._build_revision_instructions(reflections)

        prompt = f"""请根据以下问题修订内容。

## 原内容
{content}

## 发现的问题
{revision_instructions}

## 修订建议
{chr(10).join(f"- {h}" for h in hints)}

## 参考资料
{self._format_docs(docs[:3])}

## 小说设定参考
{context.key_settings}

## 要求
1. 保持原内容的结构和风格
2. 仅修正指出的问题
3. 确保修订后与参考资料和设定一致

请输出修订后的完整内容:"""

        return await llm.generate(prompt, model="default")

    def _build_revision_instructions(
        self,
        reflections: dict[ReflectionToken, ReflectionResult]
    ) -> str:
        """根据反思结果构建修订指令"""

        instructions = []

        issup = reflections.get(ReflectionToken.ISSUP)
        if issup and issup.value in ["No", "Partially"]:
            instructions.append(f"【事实问题】{issup.evidence}")

        iscon = reflections.get(ReflectionToken.ISCON)
        if iscon and iscon.value in ["Major Conflict", "Minor Conflict"]:
            instructions.append(f"【设定冲突】{iscon.evidence}")

        isuse = reflections.get(ReflectionToken.ISUSE)
        if isuse and isuse.value in ["Not Useful", "Partially"]:
            instructions.append(f"【回答不完整】{isuse.evidence}")

        return "\n".join(instructions)
```

### 6.1 修订流程

```
生成内容
    │
    ▼
┌─────────┐    通过    ┌─────────┐
│  验证   │ ─────────► │  输出   │
└─────────┘            └─────────┘
    │ 不通过
    ▼
┌─────────┐
│  修订   │ ◄────┐
└─────────┘      │
    │            │ 仍不通过 (< 2轮)
    ▼            │
┌─────────┐      │
│ 重新验证 │ ─────┘
└─────────┘
    │ 通过 或 达到上限
    ▼
┌─────────┐
│  输出   │ (附带质量报告)
└─────────┘
```

### 6.2 修订控制参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| MAX_REVISION_ROUNDS | 2 | 避免无限循环 |
| MIN_QUALITY_THRESHOLD | 0.7 | 质量达标即停止 |

---

## 7. 完整流程集成

```python
@dataclass
class QualityAssuredResult:
    """质量保障后的最终结果"""
    content: str
    quality_score: float
    crag_actions: list[str]
    documents_used: list[Document]
    reflections: dict[ReflectionToken, ReflectionResult]
    revision_rounds: int
    quality_report: QualityReport

@dataclass
class QualityReport:
    """质量报告"""
    factual_accuracy: str
    context_coherence: str
    usefulness: str
    confidence: float
    issues_found: list[str]
    issues_resolved: list[str]

class QualityAssurancePipeline:
    """质量保障管道"""

    def __init__(self, config: QAConfig):
        self.grader = RelevanceGrader(config.grader_model)
        self.refiner = KnowledgeRefiner(config.refiner_model)
        self.validator = SelfRAGValidator(config.validator_model)
        self.reviser = SelfRAGReviser(self.validator, config.max_revisions)
        self.generator = ContentGenerator(config.generator_model)

    async def process(
        self,
        query: str,
        retrieved_docs: list[Document],
        novel_context: NovelContext
    ) -> QualityAssuredResult:
        """完整的质量保障流程"""

        # ===== 阶段一: CRAG =====
        graded_docs = await self.grader.grade_documents(query, retrieved_docs)

        refinement = await self.refiner.refine(
            query=query,
            graded_docs=graded_docs,
            analysis=QueryAnalysis.from_query(query)
        )

        # ===== 阶段二: 生成 + Self-RAG =====
        initial_content = await self.generator.generate(
            query=query,
            documents=refinement.final_documents,
            context=novel_context
        )

        generation = await self.validator.validate(
            generated_content=initial_content,
            retrieved_docs=refinement.final_documents,
            novel_context=novel_context,
            query=query
        )

        final_generation = await self.reviser.revise_if_needed(
            generation=generation,
            retrieved_docs=refinement.final_documents,
            novel_context=novel_context,
            query=query
        )

        return QualityAssuredResult(
            content=final_generation.content,
            quality_score=final_generation.overall_quality,
            crag_actions=refinement.actions_taken,
            documents_used=refinement.final_documents,
            reflections=final_generation.reflections,
            revision_rounds=getattr(final_generation, 'revision_round', 0),
            quality_report=self._build_report(refinement, final_generation)
        )
```

### 7.1 完整流程图

```
检索结果
    │
    ▼
┌──────────────────────────────────────────┐
│              CRAG 阶段                    │
│  ┌─────────┐    ┌─────────┐              │
│  │相关性分级│ ─► │知识精炼 │              │
│  └─────────┘    └─────────┘              │
│       评估每条文档    保留/补充/丢弃        │
└──────────────────────────────────────────┘
    │ 精炼后的文档
    ▼
┌──────────────────────────────────────────┐
│              生成阶段                     │
│         基于精炼文档 + 小说上下文          │
└──────────────────────────────────────────┘
    │ 初始生成内容
    ▼
┌──────────────────────────────────────────┐
│            Self-RAG 阶段                  │
│  ┌─────────┐    ┌─────────┐              │
│  │三维验证  │ ─► │条件修订 │ ─► 最终内容   │
│  └─────────┘    └─────────┘              │
│   事实/连贯/有用   最多2轮                 │
└──────────────────────────────────────────┘
    │
    ▼
最终结果 + 质量报告
```

---

## 8. 配置参数

```python
@dataclass
class QAConfig:
    """质量保障层配置"""

    # === CRAG 相关性分级 ===
    grader_model: str = "haiku"
    grader_batch_size: int = 5

    # === CRAG 知识精炼 ===
    refiner_model: str = "haiku"
    min_correct_docs: int = 2
    min_total_docs: int = 5
    max_supplement_docs: int = 5

    # === Self-RAG 验证 ===
    validator_model: str = "haiku"

    # === Self-RAG 修订 ===
    reviser_model: str = "sonnet"
    max_revision_rounds: int = 2
    min_quality_threshold: float = 0.7

    # === 质量评估权重 ===
    weight_factual: float = 0.4
    weight_coherence: float = 0.35
    weight_usefulness: float = 0.25

    # === 超时控制 ===
    grading_timeout: float = 10.0
    refinement_timeout: float = 30.0
    validation_timeout: float = 15.0
    revision_timeout: float = 45.0
```

### 配置文件 (`config/quality_assurance.yaml`)

```yaml
# CRAG 配置
grader_model: haiku
min_correct_docs: 2
min_total_docs: 5
max_supplement_docs: 5

# Self-RAG 配置
validator_model: haiku
reviser_model: sonnet
max_revision_rounds: 2
min_quality_threshold: 0.7

# 质量评估权重
weight_factual: 0.4
weight_coherence: 0.35
weight_usefulness: 0.25

# 超时控制 (秒)
grading_timeout: 10.0
validation_timeout: 15.0
revision_timeout: 45.0
```

---

## 9. 与检索策略层集成

```python
class FullRAGPipeline:
    """完整 RAG 管道：检索 + 质量保障"""

    def __init__(self, rag_config: RAGConfig, qa_config: QAConfig):
        self.retrieval = AdaptiveRAGPipeline(rag_config)
        self.quality = QualityAssurancePipeline(qa_config)

    async def query(
        self,
        query: str,
        novel_context: NovelContext
    ) -> FullRAGResult:

        retrieval_result = await self.retrieval.retrieve(query)

        qa_result = await self.quality.process(
            query=query,
            retrieved_docs=retrieval_result.documents,
            novel_context=novel_context
        )

        return FullRAGResult(
            content=qa_result.content,
            quality_score=qa_result.quality_score,
            retrieval_metadata=retrieval_result.metadata,
            quality_report=qa_result.quality_report
        )
```

---

## 10. 模块总结

| 模块 | 职责 | 阶段 |
|------|------|------|
| RelevanceGrader | 三级相关性评估 | CRAG |
| KnowledgeRefiner | 保留/补充/丢弃 + 查询重写 | CRAG |
| SelfRAGValidator | 事实 + 连贯 + 有用性验证 | Self-RAG |
| SelfRAGReviser | 条件性自动修订 | Self-RAG |
| QualityAssurancePipeline | 完整流程集成 | 全局 |
| QualityReport | 质量报告生成 | 输出 |

---

## 11. 实现优先级

| 阶段 | 模块 | 依赖 |
|------|------|------|
| P1 | RelevanceGrader | LLM 服务 |
| P2 | KnowledgeRefiner | P1 + 检索策略层 |
| P3 | SelfRAGValidator | LLM 服务 + NovelContext |
| P4 | SelfRAGReviser | P3 |
| P5 | QualityAssurancePipeline | P1-P4 |
| P6 | 与检索层集成 | 检索策略层 + P5 |

---

*文档版本: 1.0 | 创建时间: 2026-02-03*

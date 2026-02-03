# Adaptive RAG 检索策略层设计

**版本**: 1.0
**日期**: 2026-02-03
**状态**: 设计完成，待实现

---

## 1. 概述

### 1.1 设计目标

构建一个**精度优先、多策略级联**的自适应检索系统，能够：

- 智能判断查询复杂度，选择最优检索策略
- 当结果不理想时自动升级到更强策略
- 覆盖事实查询、关系查询、综合分析、创意探索四种场景

### 1.2 架构选择

采用**混合式路由**（方案 C）：
- **规则路由**处理 80% 特征明确的查询（低延迟）
- **LLM 判断**处理 20% 模糊情况（高灵活性）

### 1.3 查询复杂度维度

| 维度 | 说明 | 示例 |
|------|------|------|
| 实体数量 | 涉及多少角色/地点/事件 | 单一 vs 多实体 |
| 时间跨度 | 单一场景 vs 跨章节/卷 | "第3章" vs "全书" |
| 关系深度 | 直接属性 vs 推理关联 | "眼睛颜色" vs "冲突原因" |
| 查询意图 | 事实/关系/分析/创意 | "是什么" vs "如果...会" |

---

## 2. 模块设计

### 2.1 查询分析器 (Query Analyzer)

提取四维查询特征：

```python
@dataclass
class QueryAnalysis:
    # 维度1: 实体识别
    entities: list[str]           # 识别出的实体名称
    entity_count: int             # 实体数量
    entity_types: set[str]        # 类型：Character/Location/Item/Event

    # 维度2: 时间跨度
    temporal_scope: Literal["point", "range", "global"]
    chapter_refs: list[str]       # 提及的章节/卷

    # 维度3: 关系深度
    relation_depth: int           # 0=属性, 1=直接关系, 2+=推理链
    requires_inference: bool      # 是否需要推理

    # 维度4: 查询意图
    intent: Literal["factual", "relational", "analytical", "creative"]

    # 综合得分
    complexity_score: float       # 0.0-1.0
    confidence: float             # 分析置信度
```

**分析流程**：
1. **NER 识别** - 知识库实体名精确匹配 + 模糊匹配
2. **时间词检测** - "第X章"、"之前"、"后来"等
3. **关系词检测** - "之间"、"导致"、"影响"等
4. **意图分类** - 疑问词模式匹配

---

### 2.2 规则路由器 (Rule Router)

处理 80% 特征明确的查询：

```python
class RouteDecision(Enum):
    BASIC = "basic"           # 简单向量搜索
    LOCAL = "local"           # 实体邻域 + 向量
    GLOBAL = "global"         # 社区报告 Map-Reduce
    DRIFT = "drift"           # 两阶段迭代
    MULTI_AGENT = "multi"     # 多智能体协作
    UNCERTAIN = "uncertain"   # 交给 LLM 判断

def rule_route(q: QueryAnalysis) -> RouteDecision:
    # 规则1: 置信度不足 → LLM
    if q.confidence < 0.7:
        return RouteDecision.UNCERTAIN

    # 规则2: 创意探索 → 多智能体
    if q.intent == "creative":
        return RouteDecision.MULTI_AGENT

    # 规则3: 全局分析 → Global Search
    if q.intent == "analytical" and q.temporal_scope == "global":
        return RouteDecision.GLOBAL

    # 规则4: 多实体关系 → Local 或 DRIFT
    if q.entity_count >= 2 and q.relation_depth >= 1:
        return RouteDecision.DRIFT if q.requires_inference else RouteDecision.LOCAL

    # 规则5: 单实体事实 → Basic
    if q.entity_count <= 1 and q.intent == "factual":
        return RouteDecision.BASIC

    # 规则6: 复杂度评分兜底
    if q.complexity_score > 0.7:
        return RouteDecision.UNCERTAIN

    return RouteDecision.LOCAL  # 默认 Local
```

**规则优先级**：置信度 → 意图 → 实体/关系 → 复杂度

---

### 2.3 LLM 边界判断器 (LLM Arbiter)

处理 20% 模糊情况：

```python
LLM_ARBITER_PROMPT = """你是一个查询路由专家。根据查询和分析结果，选择最佳检索策略。

## 查询
{query}

## 已识别特征
- 实体: {entities}
- 时间范围: {temporal_scope}
- 关系深度: {relation_depth}
- 初步意图: {intent}

## 可选策略
1. BASIC - 简单向量搜索，适合单一事实查询
2. LOCAL - 实体邻域搜索，适合查找特定实体的关联信息
3. GLOBAL - 全局社区分析，适合宏观趋势和跨章节总结
4. DRIFT - 两阶段迭代，适合需要从粗到细逐步深入的复杂问题
5. MULTI_AGENT - 多智能体协作，适合开放式创意和多角度分析

## 输出格式
```json
{
  "strategy": "策略名",
  "reasoning": "一句话理由",
  "fallback": "如果首选失败的备选策略"
}
```"""

@dataclass
class ArbiterDecision:
    strategy: RouteDecision
    reasoning: str
    fallback: RouteDecision | None
```

**设计要点**：
- 使用**小/快模型**（Haiku 级别）降低延迟和成本
- 要求输出 **fallback**，为级联失败做准备
- Prompt 中提供**已识别特征**，减少 LLM 重复分析

---

### 2.4 策略级联执行器 (Cascade Executor)

精度优先的核心——结果不理想时自动升级：

```python
@dataclass
class SearchResult:
    documents: list[Document]
    scores: list[float]
    strategy_used: RouteDecision

@dataclass
class QualityMetrics:
    relevance_score: float      # 相关性均分 (0-1)
    coverage: float             # 查询实体覆盖率
    confidence: float           # 结果置信度

    def is_acceptable(self) -> bool:
        return (self.relevance_score >= 0.6
                and self.coverage >= 0.5
                and self.confidence >= 0.5)

# 策略升级路径
ESCALATION_PATH = {
    RouteDecision.BASIC: RouteDecision.LOCAL,
    RouteDecision.LOCAL: RouteDecision.DRIFT,
    RouteDecision.DRIFT: RouteDecision.GLOBAL,
    RouteDecision.GLOBAL: RouteDecision.MULTI_AGENT,
    RouteDecision.MULTI_AGENT: None  # 终点
}

async def cascade_search(
    query: str,
    analysis: QueryAnalysis,
    initial_route: RouteDecision,
    max_escalations: int = 2
) -> SearchResult:

    current_route = initial_route
    all_results: list[Document] = []

    for attempt in range(max_escalations + 1):
        # 执行当前策略
        result = await execute_strategy(current_route, query, analysis)
        all_results.extend(result.documents)

        # 评估质量
        metrics = evaluate_quality(result, analysis)

        if metrics.is_acceptable():
            return SearchResult(
                documents=deduplicate(all_results),
                scores=result.scores,
                strategy_used=current_route
            )

        # 尝试升级
        next_route = ESCALATION_PATH.get(current_route)
        if next_route is None:
            break

        current_route = next_route

    # 返回累积的最佳结果
    return SearchResult(
        documents=rank_and_select(all_results, top_k=10),
        scores=[...],
        strategy_used=current_route
    )
```

**关键机制**：
- **质量阈值**：relevance ≥ 0.6, coverage ≥ 0.5, confidence ≥ 0.5
- **最大升级次数**：默认 2 次，防止无限循环
- **结果累积**：每轮结果都保留，最终去重合并

---

## 3. 五大搜索策略

### 3.1 Basic Search

```python
async def basic_search(query: str, analysis: QueryAnalysis) -> list[Document]:
    """纯向量相似度搜索"""
    embedding = await embed(query)

    return await vector_store.search(
        embedding=embedding,
        top_k=10,
        filter={"entity_types": list(analysis.entity_types)} if analysis.entities else None
    )
```

### 3.2 Local Search (GraphRAG 风格)

```python
async def local_search(query: str, analysis: QueryAnalysis) -> list[Document]:
    """实体邻域扩展 + 向量混合"""
    # Step 1: 定位种子实体
    seed_entities = await graph.match_entities(analysis.entities)

    # Step 2: 1-2 跳邻域扩展
    neighborhood = await graph.expand_neighborhood(
        seeds=seed_entities,
        max_hops=2,
        relation_filter=["APPEARS_IN", "RELATED_TO", "MENTIONED_IN"]
    )

    # Step 3: 邻域内向量搜索
    embedding = await embed(query)
    candidates = await vector_store.search(
        embedding=embedding,
        top_k=20,
        filter={"chunk_ids": neighborhood.chunk_ids}
    )

    # Step 4: 图距离加权重排
    return rerank_by_graph_distance(candidates, seed_entities)
```

### 3.3 Global Search (社区报告)

```python
async def global_search(query: str, analysis: QueryAnalysis) -> list[Document]:
    """社区报告 Map-Reduce"""
    # Step 1: 获取相关社区
    communities = await graph.get_communities(
        level="mid",
        filter_entities=analysis.entities or None
    )

    # Step 2: Map - 并行查询各社区报告
    community_answers = await asyncio.gather(*[
        query_community_report(c, query) for c in communities[:5]
    ])

    # Step 3: Reduce - 合并答案
    return synthesize_answers(community_answers, query)
```

### 3.4 DRIFT Search (两阶段迭代)

```python
async def drift_search(query: str, analysis: QueryAnalysis) -> list[Document]:
    """Global primer → Local refinement 迭代"""
    # Phase 1: Global Primer - 获取宏观方向
    primer = await global_search(query, analysis)
    primer_context = extract_key_points(primer[:3])

    # Phase 2: 基于 primer 识别更多实体
    refined_entities = await extract_entities_from_context(primer_context)
    enriched_analysis = analysis.copy()
    enriched_analysis.entities.extend(refined_entities)

    # Phase 3: Local Refinement - 深入细节
    detailed = await local_search(query, enriched_analysis)

    # 合并两阶段结果
    return merge_and_rank(primer, detailed)
```

### 3.5 Multi-Agent Search

```python
async def multi_agent_search(query: str, analysis: QueryAnalysis) -> list[Document]:
    """多智能体协作探索"""
    # 并行派发给专业智能体
    tasks = [
        character_agent.explore(query),   # 角色视角
        plot_agent.explore(query),        # 情节视角
        world_agent.explore(query),       # 世界观视角
    ]

    perspectives = await asyncio.gather(*tasks)

    # Supervisor 综合评判
    return await supervisor.synthesize(
        query=query,
        perspectives=perspectives,
        strategy="consensus"
    )
```

---

## 4. 质量评估器

级联升级的核心判断依据：

```python
class QualityEvaluator:
    """评估检索结果是否满足查询需求"""

    async def evaluate(
        self,
        result: SearchResult,
        query: str,
        analysis: QueryAnalysis
    ) -> QualityMetrics:

        # 维度1: 相关性评分 (向量相似度 + 关键词命中)
        relevance = self._calc_relevance(result, query)

        # 维度2: 实体覆盖率
        coverage = self._calc_entity_coverage(result, analysis.entities)

        # 维度3: 结果置信度
        confidence = self._calc_confidence(result)

        return QualityMetrics(
            relevance_score=relevance,
            coverage=coverage,
            confidence=confidence
        )

    def _calc_relevance(self, result: SearchResult, query: str) -> float:
        """相关性 = 0.6 * 向量均分 + 0.4 * 关键词命中率"""
        if not result.documents:
            return 0.0

        vec_score = sum(result.scores[:5]) / min(5, len(result.scores))

        keywords = extract_keywords(query)
        hit_count = sum(
            1 for doc in result.documents[:5]
            for kw in keywords if kw in doc.content
        )
        kw_score = hit_count / (len(keywords) * 5) if keywords else 0.5

        return 0.6 * vec_score + 0.4 * kw_score

    def _calc_entity_coverage(
        self,
        result: SearchResult,
        query_entities: list[str]
    ) -> float:
        """查询实体在结果中的出现比例"""
        if not query_entities:
            return 1.0

        result_text = " ".join(doc.content for doc in result.documents)
        found = sum(1 for e in query_entities if e in result_text)

        return found / len(query_entities)

    def _calc_confidence(self, result: SearchResult) -> float:
        """结果置信度 = 分数分布 + 数量"""
        if not result.documents:
            return 0.0

        high_score_count = sum(1 for s in result.scores if s >= 0.7)
        quantity_factor = min(1.0, high_score_count / 3)

        if len(result.scores) >= 2:
            variance = statistics.variance(result.scores[:5])
            consistency_factor = 1.0 - min(1.0, variance * 5)
        else:
            consistency_factor = 0.5

        return 0.6 * quantity_factor + 0.4 * consistency_factor
```

**评估阈值**：

| 指标 | 阈值 | 含义 |
|------|------|------|
| `relevance_score` | ≥ 0.6 | 结果与查询相关 |
| `coverage` | ≥ 0.5 | 至少覆盖一半查询实体 |
| `confidence` | ≥ 0.5 | 有足够的高质量结果 |

---

## 5. 错误处理与降级

确保系统健壮性：

```python
class RAGErrorHandler:
    """统一错误处理与降级"""

    FALLBACK_CHAIN = [
        RouteDecision.MULTI_AGENT,
        RouteDecision.DRIFT,
        RouteDecision.GLOBAL,
        RouteDecision.LOCAL,
        RouteDecision.BASIC,
    ]

    async def safe_execute(
        self,
        strategy: RouteDecision,
        query: str,
        analysis: QueryAnalysis,
        strategies: dict
    ) -> SearchResult | None:
        """带降级的安全执行"""

        try:
            start_idx = self.FALLBACK_CHAIN.index(strategy)
        except ValueError:
            start_idx = len(self.FALLBACK_CHAIN) - 1

        for fallback in self.FALLBACK_CHAIN[start_idx:]:
            try:
                result = await asyncio.wait_for(
                    strategies[fallback].search(query, analysis),
                    timeout=30.0
                )

                if result and result.documents:
                    result.strategy_used = fallback
                    return result

            except asyncio.TimeoutError:
                logger.warning(f"策略 {fallback} 超时，尝试降级")
                continue

            except GraphConnectionError:
                logger.warning(f"图数据库连接失败，跳过图相关策略")
                if fallback in [RouteDecision.LOCAL, RouteDecision.GLOBAL, RouteDecision.DRIFT]:
                    continue

            except EmbeddingServiceError:
                logger.error("嵌入服务不可用，返回空结果")
                return self._empty_result(strategy)

            except Exception as e:
                logger.error(f"策略 {fallback} 异常: {e}")
                continue

        return self._empty_result(strategy)
```

**降级原则**：
- **复杂 → 简单**：Multi-Agent → DRIFT → Global → Local → Basic
- **超时控制**：单策略 30s，总超时 90s
- **依赖隔离**：图服务故障时跳过图相关策略

---

## 6. 完整流程集成

```python
class AdaptiveRAGPipeline:
    """自适应检索增强生成管道"""

    def __init__(self, config: RAGConfig):
        self.analyzer = QueryAnalyzer(config.entity_index)
        self.rule_router = RuleRouter(config.thresholds)
        self.llm_arbiter = LLMArbiter(config.arbiter_model)
        self.executor = CascadeExecutor(config.max_escalations)
        self.evaluator = QualityEvaluator()

        self.strategies = {
            RouteDecision.BASIC: BasicSearch(config.vector_store),
            RouteDecision.LOCAL: LocalSearch(config.graph, config.vector_store),
            RouteDecision.GLOBAL: GlobalSearch(config.graph, config.community_store),
            RouteDecision.DRIFT: DRIFTSearch(config.graph, config.vector_store),
            RouteDecision.MULTI_AGENT: MultiAgentSearch(config.agents),
        }

    async def retrieve(self, query: str) -> RetrievalResult:
        """主入口：查询 → 分析 → 路由 → 执行 → 评估"""

        # Step 1: 查询分析
        analysis = await self.analyzer.analyze(query)

        # Step 2: 路由决策
        route = self.rule_router.route(analysis)

        if route == RouteDecision.UNCERTAIN:
            arbiter_decision = await self.llm_arbiter.decide(query, analysis)
            route = arbiter_decision.strategy
            fallback = arbiter_decision.fallback
        else:
            fallback = ESCALATION_PATH.get(route)

        # Step 3: 级联执行
        result = await self.executor.execute(
            query=query,
            analysis=analysis,
            initial_route=route,
            strategies=self.strategies,
            evaluator=self.evaluator
        )

        # Step 4: 构建返回结果
        return RetrievalResult(
            documents=result.documents,
            metadata=RetrievalMetadata(
                query_analysis=analysis,
                route_decision=route,
                final_strategy=result.strategy_used,
                escalation_count=result.escalation_count,
                quality_metrics=result.metrics
            )
        )
```

**调用示例**：

```python
pipeline = AdaptiveRAGPipeline(config)

result = await pipeline.retrieve("张三和李四在王城的冲突是怎么发展的？")

print(f"使用策略: {result.metadata.final_strategy}")
print(f"升级次数: {result.metadata.escalation_count}")
print(f"找到 {len(result.documents)} 条相关内容")
```

---

## 7. 配置参数

```python
@dataclass
class RAGConfig:
    """检索策略层配置"""

    # === 查询分析 ===
    entity_match_threshold: float = 0.8
    min_analysis_confidence: float = 0.7

    # === 路由决策 ===
    complexity_threshold: float = 0.7
    multi_entity_threshold: int = 2
    relation_depth_threshold: int = 1

    # === 级联执行 ===
    max_escalations: int = 2
    strategy_timeout: float = 30.0
    total_timeout: float = 90.0

    # === 质量评估 ===
    relevance_weight_vector: float = 0.6
    relevance_weight_keyword: float = 0.4
    min_relevance: float = 0.6
    min_coverage: float = 0.5
    min_confidence: float = 0.5

    # === 搜索参数 ===
    basic_top_k: int = 10
    local_top_k: int = 20
    local_max_hops: int = 2
    global_max_communities: int = 5
    drift_primer_count: int = 3

    # === LLM 配置 ===
    arbiter_model: str = "haiku"
```

**配置文件** (`config/rag.yaml`):

```yaml
entity_match_threshold: 0.8
min_analysis_confidence: 0.7
complexity_threshold: 0.7
max_escalations: 2
min_relevance: 0.6
min_coverage: 0.5
min_confidence: 0.5
strategy_timeout: 30.0
total_timeout: 90.0
```

---

## 8. 模块总结

| 模块 | 职责 |
|------|------|
| Query Analyzer | 四维查询特征提取 |
| Rule Router | 80% 明确查询的规则路由 |
| LLM Arbiter | 20% 模糊查询的智能判断 |
| Cascade Executor | 精度优先的级联执行 |
| 5 Search Strategies | Basic/Local/Global/DRIFT/Multi-Agent |
| Quality Evaluator | 三维质量评估 |
| Error Handler | 降级与容错 |
| RAGConfig | 集中配置管理 |

---

## 9. 实现优先级

| 阶段 | 模块 | 依赖 |
|------|------|------|
| P1 | QueryAnalyzer + RuleRouter | 实体索引 |
| P2 | BasicSearch + LocalSearch | 向量存储、图数据库 |
| P3 | QualityEvaluator + CascadeExecutor | P2 |
| P4 | GlobalSearch + DRIFT | 社区检测 |
| P5 | LLMArbiter | LLM 服务 |
| P6 | MultiAgentSearch | Agent 框架 |
| P7 | ErrorHandler + 完整集成 | 全部 |

---

*文档版本: 1.0 | 创建时间: 2026-02-03*

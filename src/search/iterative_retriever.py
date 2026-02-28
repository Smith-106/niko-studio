"""
迭代检索引擎 - GAM (Generate-then-Aggregate-then-Mine) 模式

核心特性:
1. 混合搜索 (向量 + 关键词 + 图谱)
2. 迭代检索 (动态优化查询)
3. @引用上下文解析
4. 多源聚合
"""

import re
import time
import logging
from collections import Counter
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, List, Dict, Optional, Tuple, Set

logger = logging.getLogger("niko-search")


@dataclass
class SearchResult:
    """搜索结果"""

    id: str
    content: str
    source: str  # memory/graph/file
    score: float
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class RetrievalProfile:
    name: str = "default"
    source_weights: Dict[str, float] = field(
        default_factory=lambda: {"memory": 1.0, "graph": 1.0, "file": 1.0}
    )
    thresholds: Dict[str, Optional[float]] = field(
        default_factory=lambda: {"min_score": None}
    )
    budget: Dict[str, Optional[int]] = field(
        default_factory=lambda: {"budget_tokens": None}
    )
    rerank: Dict[str, Any] = field(
        default_factory=lambda: {"enabled": False, "top_k": 20}
    )
    source_quota: Dict[str, Optional[int]] = field(default_factory=dict)
    fusion: Dict[str, Any] = field(
        default_factory=lambda: {"enabled": False, "dense": 0.65, "sparse": 0.20, "graph": 0.15}
    )


class IterativeRetriever:
    """迭代检索引擎"""

    # @引用模式
    CONTEXT_PATTERNS = {
        "character": r"@character:(\w+)",
        "scene": r"@scene:(\w+)",
        "chapter": r"@chapter:(\d+)",
        "memory": r"@memory:(\w+)",
        "timeline": r"@timeline:(\w+)",
        "foreshadow": r"@foreshadow:(\w+)",
        "style": r"@style:(\w+)",
    }

    # 默认搜索文件扩展名
    DEFAULT_FILE_EXTENSIONS = {".md", ".txt"}

    DEFAULT_RETRIEVAL_PROFILES: Dict[str, RetrievalProfile] = {
        "default": RetrievalProfile(name="default"),
        "lite_low_cost": RetrievalProfile(
            name="lite_low_cost",
            source_weights={"memory": 1.0, "graph": 0.8, "file": 0.6},
            thresholds={"min_score": None},
            budget={"budget_tokens": 900},
            rerank={"enabled": False, "top_k": 10},
            source_quota={"memory": 8, "graph": 4, "file": 3},
            fusion={"enabled": True, "dense": 0.70, "sparse": 0.20, "graph": 0.10},
        ),
        "standard_balanced": RetrievalProfile(
            name="standard_balanced",
            source_weights={"memory": 1.0, "graph": 0.9, "file": 0.8},
            thresholds={"min_score": None},
            budget={"budget_tokens": 1400},
            rerank={"enabled": True, "top_k": 20},
            source_quota={"memory": 10, "graph": 6, "file": 5},
            fusion={"enabled": True, "dense": 0.65, "sparse": 0.20, "graph": 0.15},
        ),
        "brainstorm_quality": RetrievalProfile(
            name="brainstorm_quality",
            source_weights={"memory": 1.0, "graph": 1.0, "file": 0.9},
            thresholds={"min_score": None},
            budget={"budget_tokens": 2200},
            rerank={"enabled": True, "top_k": 30},
            source_quota={"memory": 12, "graph": 8, "file": 6},
            fusion={"enabled": True, "dense": 0.60, "sparse": 0.20, "graph": 0.20},
        ),
        "coordinator_quality": RetrievalProfile(
            name="coordinator_quality",
            source_weights={"memory": 1.0, "graph": 1.0, "file": 1.0},
            thresholds={"min_score": None},
            budget={"budget_tokens": 2600},
            rerank={"enabled": True, "top_k": 35},
            source_quota={"memory": 14, "graph": 10, "file": 8},
            fusion={"enabled": True, "dense": 0.58, "sparse": 0.20, "graph": 0.22},
        ),
    }

    def __init__(
        self,
        project_root: Optional[Path] = None,
        file_extensions: Optional[Set[str]] = None,
    ):
        self._memory_engine = None
        self._graph_engine = None
        self._project_root = project_root or Path.cwd()
        self._file_extensions = file_extensions or self.DEFAULT_FILE_EXTENSIONS
        self._last_trace: Dict[str, Any] = {}
        logger.info("Search engine initialized")

    @property
    def memory_engine(self):
        if self._memory_engine is None:
            from src.memory.unified_memory import UnifiedMemoryEngine

            self._memory_engine = UnifiedMemoryEngine()
        return self._memory_engine

    @property
    def graph_engine(self):
        if self._graph_engine is None:
            from src.graph.graph_engine import GraphEngine

            self._graph_engine = GraphEngine()
        return self._graph_engine

    @property
    def last_trace(self) -> Dict[str, Any]:
        return dict(self._last_trace)

    async def hybrid_search(
        self,
        query: str,
        scope: str = "all",
        limit: int = 10,
        profile: Optional[str] = None,
        min_score: Optional[float] = None,
        budget_tokens: Optional[int] = None,
        rerank: bool = False,
    ) -> list:
        """
        混合搜索 (向量 + 关键词 + 图谱)，内部四阶段:
        collect -> rerank -> trim -> return
        """
        started = time.perf_counter()
        active_profile = await self._resolve_profile(profile)
        trace: Dict[str, Any] = {
            "profile": active_profile.name,
            "cache_hit": False,
            "stages": {},
        }

        collect_started = time.perf_counter()
        candidates = await self._collect_candidates(query=query, scope=scope, limit=limit, profile=active_profile)
        trace["stages"]["collect"] = {
            "duration_ms": round((time.perf_counter() - collect_started) * 1000, 2),
            "candidates": len(candidates),
        }

        rerank_enabled = bool(rerank or active_profile.rerank.get("enabled", False))
        rerank_fallback = False
        rerank_started = time.perf_counter()
        reranked = candidates
        if rerank_enabled and candidates:
            try:
                reranked = await self._rerank_candidates(query=query, candidates=candidates, top_k=active_profile.rerank.get("top_k", 20))
            except Exception as exc:
                rerank_fallback = True
                logger.warning(f"Rerank failed, fallback to original order: {exc}")
                reranked = candidates

        trace["stages"]["rerank"] = {
            "duration_ms": round((time.perf_counter() - rerank_started) * 1000, 2),
            "enabled": rerank_enabled,
            "fallback": rerank_fallback,
            "candidates": len(reranked),
        }

        trim_started = time.perf_counter()
        effective_min_score = min_score
        if effective_min_score is None:
            effective_min_score = active_profile.thresholds.get("min_score")

        effective_budget = budget_tokens
        if effective_budget is None:
            effective_budget = active_profile.budget.get("budget_tokens")

        trimmed, dropped_by_threshold = self._trim_results(
            results=reranked,
            limit=limit,
            min_score=effective_min_score,
            budget_tokens=effective_budget,
            source_quota=active_profile.source_quota,
        )

        trace["stages"]["trim"] = {
            "duration_ms": round((time.perf_counter() - trim_started) * 1000, 2),
            "dropped_by_threshold": dropped_by_threshold,
            "final_results": len(trimmed),
            "budget_tokens": effective_budget,
        }

        self._last_trace = {
            **trace,
            "query": query,
            "scope": scope,
            "limit": limit,
            "total_duration_ms": round((time.perf_counter() - started) * 1000, 2),
        }

        logger.info(
            "retrieval_pipeline collect=%s rerank=%s trim=%s final=%s dropped=%s cache_hit=%s total_ms=%s",
            trace["stages"]["collect"]["candidates"],
            trace["stages"]["rerank"]["candidates"],
            len(reranked),
            len(trimmed),
            dropped_by_threshold,
            trace["cache_hit"],
            self._last_trace["total_duration_ms"],
        )

        return [
            {
                "id": r.id,
                "content": r.content,
                "source": r.source,
                "score": round(r.score, 4),
                "metadata": r.metadata,
            }
            for r in trimmed
        ]

    async def _collect_candidates(
        self,
        query: str,
        scope: str,
        limit: int,
        profile: RetrievalProfile,
    ) -> List[SearchResult]:
        results: List[SearchResult] = []
        query_terms = self._extract_query_terms(query)

        # 1. 记忆搜索
        if scope in ["all", "memory"]:
            memory_results = await self.memory_engine.search(query, limit=limit)
            for r in memory_results:
                base_score = float(r.get("score", 0.0))
                fused_score = self._fuse_score(
                    base_score=base_score,
                    source="memory",
                    content=r.get("content", ""),
                    query_terms=query_terms,
                    profile=profile,
                )
                results.append(
                    SearchResult(
                        id=r["id"],
                        content=r["content"],
                        source="memory",
                        score=fused_score,
                        metadata={"layer": r.get("layer"), "dimension": r.get("dimension")},
                    )
                )

        # 2. 图谱搜索
        if scope in ["all", "graph"]:
            entities = await self._search_graph(query, limit)
            for e in entities:
                base_score = float(e.get("score", 0.5))
                graph_content = f"{e['type']}: {e['name']} - {e.get('properties', {})}"
                fused_score = self._fuse_score(
                    base_score=base_score,
                    source="graph",
                    content=graph_content,
                    query_terms=query_terms,
                    profile=profile,
                )
                results.append(
                    SearchResult(
                        id=e["id"],
                        content=graph_content,
                        source="graph",
                        score=fused_score,
                        metadata={"type": e["type"], "name": e["name"]},
                    )
                )

        # 3. 文件搜索
        if scope in ["all", "files"]:
            file_results = await self._search_files(query, limit)
            for r in file_results:
                r.score = self._fuse_score(
                    base_score=float(r.score),
                    source="file",
                    content=r.content,
                    query_terms=query_terms,
                    profile=profile,
                )
            results.extend(file_results)

        return results

    def _extract_query_terms(self, query: str) -> Set[str]:
        terms = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z0-9_]{2,}", query.lower())
        return {t for t in terms if t}

    def _fuse_score(
        self,
        base_score: float,
        source: str,
        content: str,
        query_terms: Set[str],
        profile: RetrievalProfile,
    ) -> float:
        source_weight = profile.source_weights.get(source, 1.0)
        weighted_base = base_score * source_weight

        if not profile.fusion.get("enabled", False):
            return weighted_base

        sparse_hit = 0.0
        if query_terms and content:
            lower = content.lower()
            matched = sum(1 for term in query_terms if term in lower)
            sparse_hit = matched / max(len(query_terms), 1)

        dense_w = float(profile.fusion.get("dense", 0.65))
        sparse_w = float(profile.fusion.get("sparse", 0.20))
        graph_w = float(profile.fusion.get("graph", 0.15)) if source == "graph" else 0.0

        fused = dense_w * weighted_base + sparse_w * sparse_hit + graph_w
        return max(0.0, min(1.0, fused))

    async def _rerank_candidates(
        self,
        query: str,
        candidates: List[SearchResult],
        top_k: int,
    ) -> List[SearchResult]:
        from src.services.reranker.factory import RerankerFactory

        reranker = RerankerFactory.from_env()
        docs = [c.content for c in candidates]
        doc_ids = [c.id for c in candidates]
        metadata_list = [{"source": c.source, **(c.metadata or {})} for c in candidates]

        reranked = await reranker.rerank(
            query=query,
            documents=docs,
            top_k=min(top_k, len(candidates)),
            document_ids=doc_ids,
            metadata_list=metadata_list,
        )

        by_id = {c.id: c for c in candidates}
        results: List[SearchResult] = []
        for item in reranked:
            original = by_id.get(item.id)
            if not original:
                continue
            results.append(
                SearchResult(
                    id=original.id,
                    content=original.content,
                    source=original.source,
                    score=float(item.score),
                    metadata={**(original.metadata or {}), **(item.metadata or {}), "reranked": True},
                )
            )

        if results:
            return results
        return candidates

    def _trim_results(
        self,
        results: List[SearchResult],
        limit: int,
        min_score: Optional[float],
        budget_tokens: Optional[int],
        source_quota: Optional[Dict[str, Optional[int]]],
    ) -> Tuple[List[SearchResult], int]:
        deduped: List[SearchResult] = []
        seen_ids: Set[str] = set()
        for item in sorted(results, key=lambda x: x.score, reverse=True):
            if item.id in seen_ids:
                continue
            seen_ids.add(item.id)
            deduped.append(item)

        dropped_by_threshold = 0
        if min_score is not None:
            thresholded = []
            for item in deduped:
                if item.score >= min_score:
                    thresholded.append(item)
                else:
                    dropped_by_threshold += 1
            deduped = thresholded

        if source_quota:
            per_source: Dict[str, int] = {}
            quota_trimmed: List[SearchResult] = []
            for item in deduped:
                quota = source_quota.get(item.source)
                if quota is None:
                    quota_trimmed.append(item)
                    continue
                current = per_source.get(item.source, 0)
                if current >= int(quota):
                    continue
                per_source[item.source] = current + 1
                quota_trimmed.append(item)
            deduped = quota_trimmed

        if budget_tokens is not None and budget_tokens > 0:
            consumed = 0
            budget_trimmed: List[SearchResult] = []
            for item in deduped:
                estimated = self._estimate_tokens(item.content)
                if consumed + estimated > budget_tokens:
                    continue
                consumed += estimated
                budget_trimmed.append(item)
            deduped = budget_trimmed

        return deduped[:limit], dropped_by_threshold

    def _estimate_tokens(self, text: str) -> int:
        if not text:
            return 0
        return max(1, len(text) // 4)

    async def _resolve_profile(self, profile_name: Optional[str]) -> RetrievalProfile:
        if not profile_name:
            return self.DEFAULT_RETRIEVAL_PROFILES["default"]

        if profile_name in self.DEFAULT_RETRIEVAL_PROFILES:
            return self.DEFAULT_RETRIEVAL_PROFILES[profile_name]

        getter = getattr(self.memory_engine, "get_retrieval_profile", None)
        if callable(getter):
            data = getter(profile_name)
            if isinstance(data, dict) and data.get("enabled", True):
                return RetrievalProfile(
                    name=profile_name,
                    source_weights=data.get("source_weights_json", {}) or data.get("source_weights", {}) or {"memory": 1.0, "graph": 1.0, "file": 1.0},
                    thresholds=data.get("thresholds_json", {}) or data.get("thresholds", {}) or {"min_score": None},
                    budget=data.get("budget_json", {}) or data.get("budget", {}) or {"budget_tokens": None},
                    rerank=data.get("rerank", {"enabled": False, "top_k": 20}),
                    source_quota=data.get("source_quota", {}),
                    fusion=data.get("fusion", {"enabled": False, "dense": 0.65, "sparse": 0.20, "graph": 0.15}),
                )

        return self.DEFAULT_RETRIEVAL_PROFILES["default"]

    async def _search_graph(self, query: str, limit: int) -> list:
        """在图谱中搜索"""
        words = re.findall(r"[\w\u4e00-\u9fff]+", query)

        results = []
        for word in words[:5]:
            safe_word = word.replace("'", "''")
            cypher = f"MATCH (n:Character) WHERE n.name CONTAINS '{safe_word}' RETURN n"
            entities = await self.graph_engine.execute_cypher(cypher)

            for e in entities:
                if "error" not in e:
                    e["score"] = 0.7
                    results.append(e)

        return results[:limit]

    async def _search_files(self, query: str, limit: int) -> List[SearchResult]:
        """
        在项目文件中搜索

        Args:
            query: 搜索查询
            limit: 返回数量限制

        Returns:
            匹配的 SearchResult 列表
        """
        results: List[SearchResult] = []

        keywords = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}", query.lower())
        if not keywords:
            keywords = [query.lower().strip()]

        for ext in self._file_extensions:
            pattern = f"**/*{ext}"
            for file_path in self._project_root.glob(pattern):
                if not file_path.is_file():
                    continue

                try:
                    content = file_path.read_text(encoding="utf-8")
                except (IOError, UnicodeDecodeError) as e:
                    logger.debug(f"Failed to read file {file_path}: {e}")
                    continue

                content_lower = content.lower()
                match_count = sum(content_lower.count(kw) for kw in keywords)

                if match_count > 0:
                    score = min(0.9, 0.3 + match_count * 0.1)
                    snippet = self._extract_snippet(content, keywords, max_len=200)

                    results.append(
                        SearchResult(
                            id=str(file_path.relative_to(self._project_root)),
                            content=snippet,
                            source="file",
                            score=score,
                            metadata={
                                "path": str(file_path),
                                "extension": ext,
                                "match_count": match_count,
                            },
                        )
                    )

        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    def _extract_snippet(self, content: str, keywords: List[str], max_len: int = 200) -> str:
        """
        提取包含关键词的上下文片段

        Args:
            content: 文件内容
            keywords: 搜索关键词列表
            max_len: 片段最大长度

        Returns:
            包含关键词的上下文片段
        """
        content_lower = content.lower()

        first_pos = len(content)
        for kw in keywords:
            pos = content_lower.find(kw)
            if pos != -1 and pos < first_pos:
                first_pos = pos

        if first_pos == len(content):
            return content[:max_len].strip() + ("..." if len(content) > max_len else "")

        start = max(0, first_pos - 50)
        end = min(len(content), first_pos + max_len - 50)

        snippet = content[start:end].strip()

        if start > 0:
            snippet = "..." + snippet
        if end < len(content):
            snippet = snippet + "..."

        return snippet

    async def iterative_retrieve(
        self,
        query: str,
        max_iterations: int = 3,
        confidence_threshold: float = 0.8,
        profile: Optional[str] = None,
        min_score: Optional[float] = None,
        budget_tokens: Optional[int] = None,
        rerank: bool = False,
    ) -> dict:
        """
        迭代检索 (GAM 模式)

        流程:
        1. 初始查询
        2. 分析结果，提取新关键词
        3. 扩展查询，再次搜索
        4. 聚合结果，直到置信度达标或达到最大迭代次数
        """
        all_results = []
        used_queries = [query]
        iteration = 0

        current_query = query
        best_confidence = 0.0
        traces: List[Dict[str, Any]] = []

        while iteration < max_iterations and best_confidence < confidence_threshold:
            iteration += 1

            results = await self.hybrid_search(
                current_query,
                scope="all",
                limit=10,
                profile=profile,
                min_score=min_score,
                budget_tokens=budget_tokens,
                rerank=rerank,
            )

            traces.append(dict(self.last_trace))

            if not results:
                break

            existing_ids = {x["id"] for x in all_results}
            for r in results:
                if r["id"] not in existing_ids:
                    all_results.append(r)
                    existing_ids.add(r["id"])

            best_confidence = max((r["score"] for r in results), default=0.0)

            if best_confidence >= confidence_threshold:
                break

            new_keywords = self._extract_keywords(results)
            expansion = " ".join(new_keywords[:3])

            if expansion and expansion not in used_queries:
                current_query = f"{query} {expansion}"
                used_queries.append(expansion)
            else:
                break

        all_results.sort(key=lambda r: r["score"], reverse=True)

        return {
            "results": all_results[:10],
            "iterations": iteration,
            "confidence": best_confidence,
            "queries_used": used_queries,
            "retrieval_trace": traces,
        }

    def _extract_keywords(self, results: list) -> list:
        """从搜索结果中提取新关键词"""
        keywords = []

        for r in results[:5]:
            content = r.get("content", "")
            words = re.findall(r"[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}", content)
            keywords.extend(words)

        counter = Counter(keywords)
        return [word for word, _ in counter.most_common(5)]

    async def resolve_context(self, text: str) -> str:
        """
        解析 @引用 并返回上下文

        示例:
            输入: "根据@character:张三的性格..."
            输出: "[角色:张三] 性格:内向沉稳,年龄:28岁..."
        """
        resolved_text = text
        context_parts = []

        for context_type, pattern in self.CONTEXT_PATTERNS.items():
            matches = re.finditer(pattern, text)

            for match in matches:
                ref_value = match.group(1)
                full_match = match.group(0)

                context = await self._resolve_reference(context_type, ref_value)

                if context:
                    context_parts.append(f"[{context_type}:{ref_value}]\n{context}")
                    resolved_text = resolved_text.replace(full_match, f"[{context_type}:{ref_value}]")

        if context_parts:
            return f"=== 上下文 ===\n" + "\n\n".join(context_parts) + f"\n\n=== 原文 ===\n{resolved_text}"

        return text

    async def _resolve_reference(self, context_type: str, ref_value: str) -> Optional[str]:
        """解析单个引用"""
        try:
            if context_type == "character":
                char = await self.graph_engine.get_character(ref_value)
                if "error" not in char:
                    props = char.get("properties", {})
                    return f"名称: {char['name']}\n属性: {props}"

            elif context_type == "scene":
                results = await self.memory_engine.search(
                    f"场景 {ref_value}",
                    dimensions=["context"],
                    limit=1,
                )
                if results:
                    return results[0]["content"]

            elif context_type == "chapter":
                results = await self.memory_engine.search(
                    f"第{ref_value}章",
                    dimensions=["context"],
                    limit=3,
                )
                if results:
                    return "\n".join(r["content"] for r in results)

            elif context_type == "memory":
                results = await self.memory_engine.search(ref_value, limit=1)
                if results:
                    return results[0]["content"]

            elif context_type == "timeline":
                results = await self.memory_engine.search(
                    ref_value,
                    dimensions=["timeline"],
                    limit=5,
                )
                if results:
                    return "\n".join(f"- {r['content']}" for r in results)

            elif context_type == "foreshadow":
                foreshadows = await self.graph_engine.get_foreshadows()
                for f in foreshadows:
                    if ref_value.lower() in f["name"].lower():
                        props = f.get("properties", {})
                        return f"伏笔: {f['name']}\n状态: {props.get('status', 'pending')}\n描述: {props.get('description', '')}"

            elif context_type == "style":
                from src.skills.skill_engine import SkillEngine

                skill_engine = SkillEngine()
                try:
                    skill = await skill_engine.load(ref_value)
                    return f"技能包: {skill['name']}\n描述: {skill['description']}"
                except FileNotFoundError:
                    pass

        except Exception as e:
            logger.warning(f"Failed to resolve reference @{context_type}:{ref_value}: {e}")

        return None

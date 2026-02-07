"""
迭代检索引擎 - GAM (Generate-then-Aggregate-then-Mine) 模式

核心特性:
1. 混合搜索 (向量 + 关键词 + 图谱)
2. 迭代检索 (动态优化查询)
3. @引用上下文解析
4. 多源聚合
"""

import re
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set

logger = logging.getLogger("niko-search")


@dataclass
class SearchResult:
    """搜索结果"""
    id: str
    content: str
    source: str  # memory/graph/file
    score: float
    metadata: Dict = None


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

    def __init__(
        self,
        project_root: Optional[Path] = None,
        file_extensions: Optional[Set[str]] = None
    ):
        self._memory_engine = None
        self._graph_engine = None
        self._project_root = project_root or Path.cwd()
        self._file_extensions = file_extensions or self.DEFAULT_FILE_EXTENSIONS
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
    
    async def hybrid_search(
        self,
        query: str,
        scope: str = "all",
        limit: int = 10
    ) -> list:
        """
        混合搜索 (向量 + 关键词 + 图谱)
        
        Args:
            query: 搜索查询
            scope: 搜索范围 (all/memory/graph/files)
            limit: 返回数量
        
        Returns:
            合并排序的搜索结果
        """
        results = []
        
        # 1. 记忆搜索
        if scope in ["all", "memory"]:
            memory_results = await self.memory_engine.search(query, limit=limit)
            for r in memory_results:
                results.append(SearchResult(
                    id=r["id"],
                    content=r["content"],
                    source="memory",
                    score=r["score"],
                    metadata={"layer": r.get("layer"), "dimension": r.get("dimension")}
                ))
        
        # 2. 图谱搜索
        if scope in ["all", "graph"]:
            # 关键词提取并在图谱中搜索
            entities = await self._search_graph(query, limit)
            for e in entities:
                results.append(SearchResult(
                    id=e["id"],
                    content=f"{e['type']}: {e['name']} - {e.get('properties', {})}",
                    source="graph",
                    score=e.get("score", 0.5),
                    metadata={"type": e["type"], "name": e["name"]}
                ))
        
        # 3. 文件搜索 (如果需要)
        if scope in ["all", "files"]:
            file_results = await self._search_files(query, limit)
            results.extend(file_results)
        
        # 合并排序
        results.sort(key=lambda r: r.score, reverse=True)
        
        return [
            {
                "id": r.id,
                "content": r.content,
                "source": r.source,
                "score": round(r.score, 4),
                "metadata": r.metadata
            }
            for r in results[:limit]
        ]
    
    async def _search_graph(self, query: str, limit: int) -> list:
        """在图谱中搜索"""
        # 提取可能的实体名称
        words = re.findall(r'[\w\u4e00-\u9fff]+', query)
        
        results = []
        for word in words[:5]:  # 限制搜索词数量
            cypher = f"MATCH (n:Character) WHERE n.name CONTAINS '{word}' RETURN n"
            entities = await self.graph_engine.execute_cypher(cypher)
            
            for e in entities:
                if "error" not in e:
                    e["score"] = 0.7  # 图谱精确匹配权重
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

        # 提取搜索关键词 (中文词和英文词)
        keywords = re.findall(r'[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}', query.lower())
        if not keywords:
            keywords = [query.lower().strip()]

        # 遍历配置的文件扩展名
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

                # 计算匹配分数
                content_lower = content.lower()
                match_count = sum(
                    content_lower.count(kw) for kw in keywords
                )

                if match_count > 0:
                    # 分数基于匹配次数，最高 0.9
                    score = min(0.9, 0.3 + match_count * 0.1)

                    # 提取匹配上下文片段 (最多 200 字符)
                    snippet = self._extract_snippet(content, keywords, max_len=200)

                    results.append(SearchResult(
                        id=str(file_path.relative_to(self._project_root)),
                        content=snippet,
                        source="file",
                        score=score,
                        metadata={
                            "path": str(file_path),
                            "extension": ext,
                            "match_count": match_count
                        }
                    ))

        # 按分数排序并限制数量
        results.sort(key=lambda r: r.score, reverse=True)
        return results[:limit]

    def _extract_snippet(
        self,
        content: str,
        keywords: List[str],
        max_len: int = 200
    ) -> str:
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

        # 找到第一个关键词出现的位置
        first_pos = len(content)
        for kw in keywords:
            pos = content_lower.find(kw)
            if pos != -1 and pos < first_pos:
                first_pos = pos

        if first_pos == len(content):
            # 没找到关键词，返回开头内容
            return content[:max_len].strip() + ("..." if len(content) > max_len else "")

        # 计算片段起止位置
        start = max(0, first_pos - 50)
        end = min(len(content), first_pos + max_len - 50)

        snippet = content[start:end].strip()

        # 添加省略号
        if start > 0:
            snippet = "..." + snippet
        if end < len(content):
            snippet = snippet + "..."

        return snippet
    
    async def iterative_retrieve(
        self,
        query: str,
        max_iterations: int = 3,
        confidence_threshold: float = 0.8
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
        
        while iteration < max_iterations and best_confidence < confidence_threshold:
            iteration += 1
            
            # 搜索
            results = await self.hybrid_search(current_query, scope="all", limit=10)
            
            if not results:
                break
            
            # 去重并添加结果
            for r in results:
                if r["id"] not in [x["id"] for x in all_results]:
                    all_results.append(r)
            
            # 计算当前置信度 (基于最高分)
            best_confidence = max(r["score"] for r in results) if results else 0.0
            
            if best_confidence >= confidence_threshold:
                break
            
            # 提取新关键词，扩展查询
            new_keywords = self._extract_keywords(results)
            expansion = " ".join(new_keywords[:3])
            
            if expansion and expansion not in used_queries:
                current_query = f"{query} {expansion}"
                used_queries.append(expansion)
            else:
                break
        
        # 聚合结果
        all_results.sort(key=lambda r: r["score"], reverse=True)
        
        return {
            "results": all_results[:10],
            "iterations": iteration,
            "confidence": best_confidence,
            "queries_used": used_queries
        }
    
    def _extract_keywords(self, results: list) -> list:
        """从搜索结果中提取新关键词"""
        keywords = []
        
        for r in results[:5]:
            content = r.get("content", "")
            # 提取中文词和英文词
            words = re.findall(r'[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}', content)
            keywords.extend(words)
        
        # 去重并返回最常见的
        from collections import Counter
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
                
                # 解析引用
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
                # 从记忆中搜索场景
                results = await self.memory_engine.search(
                    f"场景 {ref_value}",
                    dimensions=["context"],
                    limit=1
                )
                if results:
                    return results[0]["content"]
            
            elif context_type == "chapter":
                # 章节搜索
                results = await self.memory_engine.search(
                    f"第{ref_value}章",
                    dimensions=["context"],
                    limit=3
                )
                if results:
                    return "\n".join(r["content"] for r in results)
            
            elif context_type == "memory":
                results = await self.memory_engine.search(ref_value, limit=1)
                if results:
                    return results[0]["content"]
            
            elif context_type == "timeline":
                # 时间线事件
                results = await self.memory_engine.search(
                    ref_value,
                    dimensions=["timeline"],
                    limit=5
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
                # 风格/技能引用
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

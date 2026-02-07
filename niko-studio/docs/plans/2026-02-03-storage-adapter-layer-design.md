# 存储适配层设计 (Storage Adapter Layer)

**版本**: 1.0
**日期**: 2026-02-03
**状态**: 设计完成，待实现

---

## 1. 概述

### 1.1 设计目标

构建一个**统一接口、多后端支持**的存储适配层：

- **向量存储**：支持 Chroma/pgvector/Pinecone 等后端
- **图存储**：支持 NetworkX/Neo4j/Neptune 等后端
- **社区存储**：支持社区检测、层级构建、报告生成

### 1.2 架构决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 接口设计 | Protocol 抽象 | Python 原生协议，类型安全 |
| 后端切换 | 配置驱动 | 开发/生产环境灵活切换 |
| 扩展性 | 可扩展设计 | 从小规模平滑扩容到大规模 |

### 1.3 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     存储适配层 (Storage Adapter)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ VectorStore  │  │  GraphStore  │  │CommunityStore│           │
│  │   Protocol   │  │   Protocol   │  │   Protocol   │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐           │
│  │ Chroma       │  │ NetworkX     │  │ JSON File    │           │
│  │ pgvector     │  │ Neo4j        │  │ SQLite       │           │
│  │ Pinecone     │  │ Neptune      │  │ Redis        │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              StorageManager (统一协调器)                    │ │
│  │  - 配置驱动的后端选择                                       │ │
│  │  - 跨存储事务协调                                           │ │
│  │  - 健康检查与故障切换                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 通用数据结构

```python
from dataclasses import dataclass, field
from typing import Protocol, Literal, runtime_checkable

@dataclass
class Document:
    """文档块"""
    id: str
    content: str
    embedding: list[float] | None = None
    metadata: dict = field(default_factory=dict)

@dataclass
class Entity:
    """知识图谱实体"""
    id: str
    name: str
    type: str  # Character, Location, Item, Event
    properties: dict = field(default_factory=dict)

@dataclass
class Relation:
    """实体关系"""
    source_id: str
    target_id: str
    type: str  # APPEARS_IN, RELATED_TO, MENTIONED_IN
    properties: dict = field(default_factory=dict)

@dataclass
class Community:
    """社区/聚类"""
    id: str
    level: int  # 层级：0=最细粒度
    entity_ids: list[str]
    summary: str
    report: str | None = None

@dataclass
class NeighborhoodResult:
    """邻域扩展结果"""
    entities: list[Entity]
    relations: list[Relation]
    chunk_ids: set[str]  # 关联的文档块 ID
    hop_distances: dict[str, int]  # 实体 ID -> 跳数

@dataclass
class CommunityReport:
    """社区报告（用于 Global Search）"""
    community_id: str
    level: int
    title: str
    summary: str
    key_entities: list[str]
    key_relations: list[str]
    themes: list[str]
    full_report: str
    embedding: list[float] | None = None
```

---

## 3. VectorStore 接口

### 3.1 Protocol 定义

```python
@runtime_checkable
class VectorStore(Protocol):
    """向量存储抽象接口"""

    async def add(
        self,
        documents: list[Document],
        *,
        namespace: str = "default"
    ) -> list[str]:
        """添加文档，返回 ID 列表"""
        ...

    async def search(
        self,
        embedding: list[float],
        *,
        top_k: int = 10,
        filter: dict | None = None,
        namespace: str = "default"
    ) -> list[tuple[Document, float]]:
        """向量相似搜索，返回 (文档, 分数) 列表"""
        ...

    async def search_by_text(
        self,
        query: str,
        *,
        top_k: int = 10,
        filter: dict | None = None,
        namespace: str = "default"
    ) -> list[tuple[Document, float]]:
        """文本搜索（内部自动 embed）"""
        ...

    async def delete(
        self,
        ids: list[str],
        *,
        namespace: str = "default"
    ) -> int:
        """删除文档，返回删除数量"""
        ...

    async def update_metadata(
        self,
        id: str,
        metadata: dict,
        *,
        namespace: str = "default"
    ) -> bool:
        """更新文档元数据"""
        ...

    async def count(self, namespace: str = "default") -> int:
        """返回文档总数"""
        ...
```

### 3.2 过滤器语法

```python
# 支持的过滤条件
filter = {
    "entity_types": ["Character", "Location"],  # IN 查询
    "chapter": {"$gte": 5, "$lte": 10},          # 范围查询
    "novel_id": "novel_001",                      # 精确匹配
    "tags": {"$contains": "important"}            # 数组包含
}
```

### 3.3 ChromaAdapter 实现

```python
import chromadb
from chromadb.config import Settings

class ChromaAdapter:
    """Chroma 向量存储适配器"""

    def __init__(self, config: ChromaConfig):
        self.client = chromadb.Client(Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=config.persist_dir,
            anonymized_telemetry=False
        ))
        self.embedder = config.embedder

    async def add(
        self,
        documents: list[Document],
        *,
        namespace: str = "default"
    ) -> list[str]:
        collection = self.client.get_or_create_collection(namespace)

        texts = [doc.content for doc in documents]
        embeddings = await self.embedder.embed_batch(texts)

        collection.add(
            ids=[doc.id for doc in documents],
            embeddings=embeddings,
            documents=texts,
            metadatas=[doc.metadata for doc in documents]
        )

        return [doc.id for doc in documents]

    async def search(
        self,
        embedding: list[float],
        *,
        top_k: int = 10,
        filter: dict | None = None,
        namespace: str = "default"
    ) -> list[tuple[Document, float]]:
        collection = self.client.get_collection(namespace)

        results = collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where=filter
        )

        return [
            (Document(
                id=results["ids"][0][i],
                content=results["documents"][0][i],
                metadata=results["metadatas"][0][i]
            ), 1 - results["distances"][0][i])
            for i in range(len(results["ids"][0]))
        ]

    async def search_by_text(
        self,
        query: str,
        *,
        top_k: int = 10,
        filter: dict | None = None,
        namespace: str = "default"
    ) -> list[tuple[Document, float]]:
        embedding = await self.embedder.embed(query)
        return await self.search(embedding, top_k=top_k, filter=filter, namespace=namespace)
```

### 3.4 PgVectorAdapter 实现

```python
import asyncpg
from pgvector.asyncpg import register_vector

class PgVectorAdapter:
    """PostgreSQL + pgvector 适配器"""

    def __init__(self, config: PgVectorConfig):
        self.pool: asyncpg.Pool | None = None
        self.config = config
        self.embedder = config.embedder

    async def connect(self):
        self.pool = await asyncpg.create_pool(
            self.config.connection_string,
            min_size=5,
            max_size=20
        )
        async with self.pool.acquire() as conn:
            await register_vector(conn)

    async def search(
        self,
        embedding: list[float],
        *,
        top_k: int = 10,
        filter: dict | None = None,
        namespace: str = "default"
    ) -> list[tuple[Document, float]]:

        where_clause = self._build_where(filter) if filter else ""

        query = f"""
            SELECT id, content, metadata,
                   1 - (embedding <=> $1) as similarity
            FROM documents
            WHERE namespace = $2 {where_clause}
            ORDER BY embedding <=> $1
            LIMIT $3
        """

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, embedding, namespace, top_k)

        return [
            (Document(
                id=row["id"],
                content=row["content"],
                metadata=row["metadata"]
            ), row["similarity"])
            for row in rows
        ]
```

---

## 4. GraphStore 接口

### 4.1 Protocol 定义

```python
@runtime_checkable
class GraphStore(Protocol):
    """图数据库抽象接口"""

    # === 实体操作 ===

    async def add_entity(self, entity: Entity) -> str:
        """添加实体，返回 ID"""
        ...

    async def get_entity(self, entity_id: str) -> Entity | None:
        """获取单个实体"""
        ...

    async def match_entities(
        self,
        names: list[str],
        *,
        threshold: float = 0.8,
        entity_types: list[str] | None = None
    ) -> list[Entity]:
        """模糊匹配实体名称"""
        ...

    async def update_entity(
        self,
        entity_id: str,
        properties: dict
    ) -> bool:
        """更新实体属性"""
        ...

    async def delete_entity(self, entity_id: str) -> bool:
        """删除实体及其关系"""
        ...

    # === 关系操作 ===

    async def add_relation(self, relation: Relation) -> str:
        """添加关系"""
        ...

    async def get_relations(
        self,
        entity_id: str,
        *,
        direction: Literal["in", "out", "both"] = "both",
        relation_types: list[str] | None = None
    ) -> list[Relation]:
        """获取实体的关系"""
        ...

    # === 邻域扩展 ===

    async def expand_neighborhood(
        self,
        seed_ids: list[str],
        *,
        max_hops: int = 2,
        relation_filter: list[str] | None = None,
        max_nodes: int = 100
    ) -> NeighborhoodResult:
        """从种子实体扩展邻域"""
        ...

    # === 路径查询 ===

    async def find_paths(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 4,
        relation_types: list[str] | None = None
    ) -> list[list[Entity | Relation]]:
        """查找两实体间的路径"""
        ...
```

### 4.2 NetworkXAdapter 实现

```python
import networkx as nx
from rapidfuzz import fuzz

class NetworkXAdapter:
    """NetworkX 图存储适配器（内存/本地）"""

    def __init__(self, config: NetworkXConfig):
        self.graph = nx.MultiDiGraph()
        self.persist_path = config.persist_path
        self._name_index: dict[str, str] = {}

    async def add_entity(self, entity: Entity) -> str:
        self.graph.add_node(
            entity.id,
            name=entity.name,
            type=entity.type,
            **entity.properties
        )
        self._name_index[entity.name.lower()] = entity.id
        return entity.id

    async def match_entities(
        self,
        names: list[str],
        *,
        threshold: float = 0.8,
        entity_types: list[str] | None = None
    ) -> list[Entity]:
        """模糊匹配实体"""
        matched = []

        for query_name in names:
            query_lower = query_name.lower()

            # 精确匹配优先
            if query_lower in self._name_index:
                entity_id = self._name_index[query_lower]
                matched.append(self._node_to_entity(entity_id))
                continue

            # 模糊匹配
            best_match = None
            best_score = 0

            for name, entity_id in self._name_index.items():
                score = fuzz.ratio(query_lower, name) / 100
                if score > best_score and score >= threshold:
                    node_data = self.graph.nodes[entity_id]
                    if entity_types is None or node_data["type"] in entity_types:
                        best_score = score
                        best_match = entity_id

            if best_match:
                matched.append(self._node_to_entity(best_match))

        return matched

    async def expand_neighborhood(
        self,
        seed_ids: list[str],
        *,
        max_hops: int = 2,
        relation_filter: list[str] | None = None,
        max_nodes: int = 100
    ) -> NeighborhoodResult:
        """BFS 邻域扩展"""
        visited = set(seed_ids)
        hop_distances = {sid: 0 for sid in seed_ids}
        current_frontier = set(seed_ids)
        entities = []
        relations = []
        chunk_ids = set()

        for hop in range(1, max_hops + 1):
            if len(visited) >= max_nodes:
                break

            next_frontier = set()

            for node_id in current_frontier:
                # 出边
                for _, neighbor, edge_data in self.graph.out_edges(node_id, data=True):
                    if relation_filter and edge_data.get("type") not in relation_filter:
                        continue
                    if neighbor not in visited:
                        next_frontier.add(neighbor)
                        hop_distances[neighbor] = hop

                # 入边
                for neighbor, _, edge_data in self.graph.in_edges(node_id, data=True):
                    if relation_filter and edge_data.get("type") not in relation_filter:
                        continue
                    if neighbor not in visited:
                        next_frontier.add(neighbor)
                        hop_distances[neighbor] = hop

            visited.update(next_frontier)
            current_frontier = next_frontier

        # 收集结果
        for node_id in visited:
            entity = self._node_to_entity(node_id)
            entities.append(entity)
            if "chunk_ids" in entity.properties:
                chunk_ids.update(entity.properties["chunk_ids"])

        # 收集关系
        for u, v, data in self.graph.edges(visited, data=True):
            if v in visited:
                relations.append(Relation(
                    source_id=u,
                    target_id=v,
                    type=data.get("type", "RELATED_TO"),
                    properties={k: val for k, val in data.items() if k != "type"}
                ))

        return NeighborhoodResult(
            entities=entities,
            relations=relations,
            chunk_ids=chunk_ids,
            hop_distances=hop_distances
        )

    def _node_to_entity(self, node_id: str) -> Entity:
        data = self.graph.nodes[node_id]
        return Entity(
            id=node_id,
            name=data["name"],
            type=data["type"],
            properties={k: v for k, v in data.items() if k not in ["name", "type"]}
        )
```

### 4.3 Neo4jAdapter 实现

```python
from neo4j import AsyncGraphDatabase

class Neo4jAdapter:
    """Neo4j 图数据库适配器"""

    def __init__(self, config: Neo4jConfig):
        self.driver = AsyncGraphDatabase.driver(
            config.uri,
            auth=(config.user, config.password)
        )

    async def expand_neighborhood(
        self,
        seed_ids: list[str],
        *,
        max_hops: int = 2,
        relation_filter: list[str] | None = None,
        max_nodes: int = 100
    ) -> NeighborhoodResult:

        rel_pattern = ""
        if relation_filter:
            rel_types = "|".join(relation_filter)
            rel_pattern = f":{rel_types}"

        query = f"""
            MATCH path = (seed)-[r{rel_pattern}*1..{max_hops}]-(neighbor)
            WHERE seed.id IN $seed_ids
            WITH DISTINCT neighbor, min(length(path)) as hop_distance
            LIMIT $max_nodes
            RETURN neighbor, hop_distance
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                seed_ids=seed_ids,
                max_nodes=max_nodes
            )
            records = await result.data()

        entities = []
        hop_distances = {}
        chunk_ids = set()

        for record in records:
            node = record["neighbor"]
            entity = Entity(
                id=node["id"],
                name=node["name"],
                type=node.labels[0],
                properties=dict(node)
            )
            entities.append(entity)
            hop_distances[entity.id] = record["hop_distance"]

            if "chunk_ids" in node:
                chunk_ids.update(node["chunk_ids"])

        relations = await self._get_relations_between(
            [e.id for e in entities],
            relation_filter
        )

        return NeighborhoodResult(
            entities=entities,
            relations=relations,
            chunk_ids=chunk_ids,
            hop_distances=hop_distances
        )

    async def find_paths(
        self,
        source_id: str,
        target_id: str,
        *,
        max_depth: int = 4,
        relation_types: list[str] | None = None
    ) -> list[list[Entity | Relation]]:

        query = """
            MATCH path = shortestPath(
                (source {id: $source_id})-[*1..$max_depth]-(target {id: $target_id})
            )
            RETURN path
            LIMIT 5
        """

        async with self.driver.session() as session:
            result = await session.run(
                query,
                source_id=source_id,
                target_id=target_id,
                max_depth=max_depth
            )
            return await self._parse_paths(result)
```

---

## 5. CommunityStore 接口

### 5.1 Protocol 定义

```python
@runtime_checkable
class CommunityStore(Protocol):
    """社区/聚类存储抽象接口"""

    # === 社区管理 ===

    async def add_community(self, community: Community) -> str:
        """添加社区"""
        ...

    async def get_community(self, community_id: str) -> Community | None:
        """获取单个社区"""
        ...

    async def get_communities(
        self,
        *,
        level: int | None = None,
        entity_ids: list[str] | None = None,
        limit: int = 10
    ) -> list[Community]:
        """获取社区列表，支持按层级和实体过滤"""
        ...

    async def update_report(
        self,
        community_id: str,
        report: str
    ) -> bool:
        """更新社区报告"""
        ...

    # === 社区检测 ===

    async def detect_communities(
        self,
        graph_store: GraphStore,
        *,
        algorithm: Literal["louvain", "leiden", "hierarchical"] = "leiden",
        resolution: float = 1.0,
        min_community_size: int = 3
    ) -> list[Community]:
        """从图中检测社区"""
        ...

    async def build_hierarchy(
        self,
        communities: list[Community],
        *,
        max_levels: int = 3
    ) -> dict[int, list[Community]]:
        """构建社区层级结构"""
        ...

    # === 社区查询 ===

    async def find_community_for_entities(
        self,
        entity_ids: list[str],
        *,
        level: int = 1
    ) -> Community | None:
        """查找包含指定实体的最小社区"""
        ...

    async def get_community_hierarchy(
        self,
        community_id: str
    ) -> list[Community]:
        """获取社区的层级链（从细到粗）"""
        ...
```

### 5.2 JSONCommunityStore 实现

```python
import json
from pathlib import Path
import leidenalg
import igraph as ig

class JSONCommunityStore:
    """JSON 文件社区存储（本地轻量级）"""

    def __init__(self, config: JSONCommunityConfig):
        self.store_path = Path(config.store_path)
        self.store_path.mkdir(parents=True, exist_ok=True)
        self._communities: dict[str, Community] = {}
        self._level_index: dict[int, list[str]] = {}
        self._entity_index: dict[str, set[str]] = {}
        self._load()

    async def get_communities(
        self,
        *,
        level: int | None = None,
        entity_ids: list[str] | None = None,
        limit: int = 10
    ) -> list[Community]:
        """获取社区，支持层级和实体过滤"""

        candidates = set(self._communities.keys())

        if level is not None:
            level_communities = set(self._level_index.get(level, []))
            candidates &= level_communities

        if entity_ids:
            entity_communities = set()
            for eid in entity_ids:
                entity_communities.update(self._entity_index.get(eid, set()))
            candidates &= entity_communities

        result = [self._communities[cid] for cid in list(candidates)[:limit]]
        return sorted(result, key=lambda c: len(c.entity_ids), reverse=True)

    async def detect_communities(
        self,
        graph_store: GraphStore,
        *,
        algorithm: str = "leiden",
        resolution: float = 1.0,
        min_community_size: int = 3
    ) -> list[Community]:
        """社区检测"""

        if isinstance(graph_store, NetworkXAdapter):
            nx_graph = graph_store.graph
        else:
            nx_graph = await self._export_to_networkx(graph_store)

        ig_graph = ig.Graph.from_networkx(nx_graph.to_undirected())

        if algorithm == "leiden":
            partition = leidenalg.find_partition(
                ig_graph,
                leidenalg.RBConfigurationVertexPartition,
                resolution_parameter=resolution
            )
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        communities = []
        node_names = list(nx_graph.nodes())

        for idx, members in enumerate(partition):
            if len(members) < min_community_size:
                continue

            entity_ids = [node_names[m] for m in members]

            community = Community(
                id=f"community_{idx}",
                level=0,
                entity_ids=entity_ids,
                summary=await self._generate_summary(entity_ids, graph_store)
            )
            communities.append(community)

        return communities

    async def build_hierarchy(
        self,
        communities: list[Community],
        *,
        max_levels: int = 3
    ) -> dict[int, list[Community]]:
        """构建社区层级"""

        hierarchy = {0: communities}

        for level in range(1, max_levels):
            prev_level = hierarchy[level - 1]

            if len(prev_level) <= 3:
                break

            merged = await self._merge_communities(prev_level, level)
            hierarchy[level] = merged

        return hierarchy
```

### 5.3 社区报告生成器

```python
class CommunityReportGenerator:
    """社区报告生成器（用于 Global Search）"""

    REPORT_PROMPT = """为以下社区生成结构化报告。

## 社区实体
{entities}

## 社区关系
{relations}

## 报告格式
1. **标题**: 一句话概括社区主题
2. **摘要**: 2-3 句话描述核心内容
3. **关键实体**: 列出最重要的 3-5 个实体
4. **主要关系**: 描述核心关系网络
5. **主题标签**: 3-5 个关键词标签

请输出 JSON 格式。"""

    async def generate_report(
        self,
        community: Community,
        graph_store: GraphStore
    ) -> CommunityReport:
        """为社区生成报告"""

        entities = []
        for eid in community.entity_ids:
            entity = await graph_store.get_entity(eid)
            if entity:
                entities.append(f"- {entity.name} ({entity.type}): {entity.properties}")

        relations = []
        for eid in community.entity_ids:
            rels = await graph_store.get_relations(eid, direction="out")
            for rel in rels:
                if rel.target_id in community.entity_ids:
                    relations.append(f"- {rel.source_id} --[{rel.type}]--> {rel.target_id}")

        prompt = self.REPORT_PROMPT.format(
            entities="\n".join(entities[:20]),
            relations="\n".join(relations[:20])
        )

        response = await llm.generate(prompt, model="fast")
        report_data = parse_json(response)

        return CommunityReport(
            community_id=community.id,
            level=community.level,
            title=report_data["title"],
            summary=report_data["summary"],
            key_entities=report_data["key_entities"],
            key_relations=report_data.get("main_relations", []),
            themes=report_data["themes"],
            full_report=response
        )
```

---

## 6. StorageManager 统一协调器

### 6.1 配置与初始化

```python
from enum import Enum

class StorageBackend(Enum):
    """存储后端类型"""
    CHROMA = "chroma"
    PGVECTOR = "pgvector"
    PINECONE = "pinecone"
    NETWORKX = "networkx"
    NEO4J = "neo4j"
    NEPTUNE = "neptune"
    JSON_FILE = "json_file"
    SQLITE = "sqlite"
    REDIS = "redis"

@dataclass
class StorageConfig:
    """存储层统一配置"""
    vector_backend: StorageBackend = StorageBackend.CHROMA
    graph_backend: StorageBackend = StorageBackend.NETWORKX
    community_backend: StorageBackend = StorageBackend.JSON_FILE

    vector_config: dict = field(default_factory=dict)
    graph_config: dict = field(default_factory=dict)
    community_config: dict = field(default_factory=dict)

    embedder_type: str = "openai"
    embedder_model: str = "text-embedding-3-small"
    embedder_dimension: int = 1536

    health_check_interval: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0
    persist_dir: str = "./data/storage"
```

### 6.2 StorageManager 实现

```python
class StorageManager:
    """存储层统一管理器"""

    def __init__(self, config: StorageConfig):
        self.config = config
        self._vector_store: VectorStore | None = None
        self._graph_store: GraphStore | None = None
        self._community_store: CommunityStore | None = None
        self._embedder: Embedder | None = None
        self._initialized = False
        self._health_status: dict[str, bool] = {}

    async def initialize(self) -> None:
        """初始化所有存储后端"""
        if self._initialized:
            return

        self._embedder = await self._create_embedder()

        await asyncio.gather(
            self._init_vector_store(),
            self._init_graph_store(),
            self._init_community_store()
        )

        asyncio.create_task(self._health_check_loop())
        self._initialized = True

    async def shutdown(self) -> None:
        """优雅关闭"""
        if hasattr(self._vector_store, 'close'):
            await self._vector_store.close()
        if hasattr(self._graph_store, 'close'):
            await self._graph_store.close()
        if hasattr(self._community_store, 'close'):
            await self._community_store.close()
        self._initialized = False

    @property
    def vector(self) -> VectorStore:
        if not self._vector_store:
            raise RuntimeError("Storage not initialized")
        return self._vector_store

    @property
    def graph(self) -> GraphStore:
        if not self._graph_store:
            raise RuntimeError("Storage not initialized")
        return self._graph_store

    @property
    def community(self) -> CommunityStore:
        if not self._community_store:
            raise RuntimeError("Storage not initialized")
        return self._community_store

    @property
    def embedder(self) -> Embedder:
        if not self._embedder:
            raise RuntimeError("Storage not initialized")
        return self._embedder

    async def check_health(self) -> dict[str, bool]:
        """检查所有存储健康状态"""
        checks = await asyncio.gather(
            self._check_vector_health(),
            self._check_graph_health(),
            self._check_community_health(),
            return_exceptions=True
        )

        self._health_status = {
            "vector": checks[0] is True,
            "graph": checks[1] is True,
            "community": checks[2] is True
        }

        return self._health_status

    def is_healthy(self) -> bool:
        return all(self._health_status.values())
```

### 6.3 跨存储操作

```python
class StorageManager:
    # ... 上面的代码 ...

    async def index_document(
        self,
        document: Document,
        entities: list[Entity],
        relations: list[Relation],
        *,
        namespace: str = "default"
    ) -> IndexResult:
        """索引文档到所有存储（事务性）"""

        try:
            doc_ids = await self.vector.add([document], namespace=namespace)

            for entity in entities:
                entity.properties["chunk_ids"] = entity.properties.get("chunk_ids", [])
                entity.properties["chunk_ids"].append(document.id)
                await self.graph.add_entity(entity)

            for relation in relations:
                await self.graph.add_relation(relation)

            return IndexResult(
                success=True,
                document_id=doc_ids[0],
                entity_count=len(entities),
                relation_count=len(relations)
            )

        except Exception as e:
            await self._rollback_index(document.id, entities, namespace)
            raise StorageError(f"Index failed: {e}") from e

    async def search_with_graph_expansion(
        self,
        query: str,
        *,
        top_k: int = 10,
        expand_hops: int = 1,
        namespace: str = "default"
    ) -> list[Document]:
        """向量搜索 + 图扩展"""

        vector_results = await self.vector.search_by_text(
            query, top_k=top_k, namespace=namespace
        )

        if not vector_results:
            return []

        entity_ids = set()
        for doc, _ in vector_results:
            if "entity_ids" in doc.metadata:
                entity_ids.update(doc.metadata["entity_ids"])

        if entity_ids and expand_hops > 0:
            neighborhood = await self.graph.expand_neighborhood(
                list(entity_ids),
                max_hops=expand_hops,
                max_nodes=50
            )

            if neighborhood.chunk_ids:
                expanded_docs = await self.vector.search(
                    embedding=vector_results[0][0].embedding,
                    top_k=top_k,
                    filter={"id": {"$in": list(neighborhood.chunk_ids)}},
                    namespace=namespace
                )

                seen_ids = {doc.id for doc, _ in vector_results}
                for doc, score in expanded_docs:
                    if doc.id not in seen_ids:
                        vector_results.append((doc, score * 0.9))

        vector_results.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in vector_results[:top_k]]

    async def rebuild_communities(
        self,
        *,
        algorithm: str = "leiden",
        generate_reports: bool = True
    ) -> int:
        """重建社区结构"""

        communities = await self.community.detect_communities(
            self.graph,
            algorithm=algorithm
        )

        hierarchy = await self.community.build_hierarchy(communities)

        count = 0
        for level, level_communities in hierarchy.items():
            for community in level_communities:
                community.level = level
                await self.community.add_community(community)
                count += 1

        if generate_reports:
            generator = CommunityReportGenerator()
            for community in communities:
                report = await generator.generate_report(community, self.graph)
                await self.community.update_report(community.id, report.full_report)

        return count

@dataclass
class IndexResult:
    success: bool
    document_id: str
    entity_count: int
    relation_count: int
```

---

## 7. 配置参数

```python
@dataclass
class StorageLayerConfig:
    """存储适配层完整配置"""

    # === 后端选择 ===
    vector_backend: str = "chroma"
    graph_backend: str = "networkx"
    community_backend: str = "json_file"

    # === 向量存储配置 ===
    vector_persist_dir: str = "./data/vector"
    vector_collection_name: str = "documents"

    # === 图存储配置 ===
    graph_persist_path: str = "./data/graph.json"

    # === 社区存储配置 ===
    community_store_path: str = "./data/communities"
    community_algorithm: str = "leiden"
    community_resolution: float = 1.0
    community_min_size: int = 3
    community_max_levels: int = 3

    # === 嵌入服务 ===
    embedder_type: str = "openai"
    embedder_model: str = "text-embedding-3-small"
    embedder_dimension: int = 1536
    embedder_batch_size: int = 100

    # === 健康检查 ===
    health_check_interval: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0

    # === 性能调优 ===
    vector_search_top_k: int = 20
    graph_expand_max_hops: int = 2
    graph_expand_max_nodes: int = 100
```

### 配置文件 (`config/storage.yaml`)

```yaml
# 开发环境
development:
  vector_backend: chroma
  graph_backend: networkx
  community_backend: json_file

  vector_config:
    persist_dir: ./data/dev/chroma

  graph_config:
    persist_path: ./data/dev/graph.json

  community_config:
    store_path: ./data/dev/communities

  embedder_type: openai
  embedder_model: text-embedding-3-small

# 生产环境
production:
  vector_backend: pgvector
  graph_backend: neo4j
  community_backend: sqlite

  vector_config:
    connection_string: ${PGVECTOR_URL}

  graph_config:
    uri: ${NEO4J_URI}
    user: ${NEO4J_USER}
    password: ${NEO4J_PASSWORD}

  community_config:
    db_path: ./data/prod/communities.db

  embedder_type: openai
  embedder_model: text-embedding-3-large

  health_check_interval: 60.0
```

---

## 8. 模块总结

| 模块 | 职责 | 接口数 |
|------|------|--------|
| **VectorStore** | 向量存储抽象 | 6 个方法 |
| **GraphStore** | 图数据库抽象 | 8 个方法 |
| **CommunityStore** | 社区/聚类存储 | 7 个方法 |
| **StorageManager** | 统一协调器 | 生命周期 + 跨存储操作 |

### 后端支持矩阵

| 后端 | 类型 | 适用场景 | 依赖 |
|------|------|----------|------|
| Chroma | 向量 | 本地开发、小规模 | chromadb |
| pgvector | 向量 | 生产、中大规模 | asyncpg, pgvector |
| Pinecone | 向量 | 云托管、大规模 | pinecone-client |
| NetworkX | 图 | 本地开发、原型 | networkx, rapidfuzz |
| Neo4j | 图 | 生产、复杂查询 | neo4j |
| JSON File | 社区 | 本地开发 | - |
| SQLite | 社区 | 生产、中等规模 | aiosqlite |

---

## 9. 实现优先级

| 阶段 | 模块 | 说明 |
|------|------|------|
| P1 | VectorStore Protocol + ChromaAdapter | 核心向量搜索能力 |
| P2 | GraphStore Protocol + NetworkXAdapter | 本地图存储能力 |
| P3 | CommunityStore + JSONCommunityStore | 社区检测与存储 |
| P4 | StorageManager | 统一管理与健康检查 |
| P5 | PgVectorAdapter + Neo4jAdapter | 生产级后端 |
| P6 | 跨存储操作 | index_document, search_with_graph_expansion |

---

*文档版本: 1.0 | 创建时间: 2026-02-03*

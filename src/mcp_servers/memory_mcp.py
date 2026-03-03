"""
Memory MCP - 知识图谱服务

实现基于 MCP 协议的知识图谱操作，支持:
- Entity CRUD (create_entities, open_nodes, delete_entities)
- Relation CRUD (create_relations, delete_relations)
- Search (search_nodes)
- Graph traversal

运行方式:
    python -m src.mcp_servers.memory_mcp

MCP 客户端连接:
    stdio 模式 (默认)
"""

import json
import logging
import uuid
import sqlite3
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any, Union
from enum import Enum

from mcp.server.fastmcp import FastMCP

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("memory-mcp")


# ============================================================
# 数据类型定义 (兼容 graph_contracts.py)
# ============================================================

class EntityType(str, Enum):
    """实体类型"""
    CHARACTER = "character"
    LOCATION = "location"
    EVENT = "event"
    OBJECT = "object"
    CONCEPT = "concept"
    RELATIONSHIP = "relationship"
    TIMELINE = "timeline"
    # 扩展类型
    FORESHADOW = "foreshadow"
    CHAPTER = "chapter"
    SCENE = "scene"


class RelationType(str, Enum):
    """关系类型"""
    KNOWS = "KNOWS"
    LOCATED_IN = "LOCATED_IN"
    PARTICIPATES = "PARTICIPATES"
    OWNS = "OWNS"
    CAUSES = "CAUSES"
    PRECEDES = "PRECEDES"
    FOLLOWS = "FOLLOWS"
    RELATED_TO = "RELATED_TO"
    # 扩展类型
    LOVES = "LOVES"
    HATES = "HATES"
    WORKS_WITH = "WORKS_WITH"
    FAMILY = "FAMILY"


@dataclass
class Entity:
    """实体结构"""
    name: str
    entityType: str
    observations: List[str] = field(default_factory=list)
    id: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid.uuid4())
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.now().isoformat()


@dataclass
class Relation:
    """关系结构"""
    from_entity: str  # Entity name
    to_entity: str    # Entity name
    relationType: str
    id: Optional[str] = None
    properties: Dict[str, Any] = field(default_factory=dict)
    weight: float = 1.0
    created_at: Optional[str] = None

    def __post_init__(self):
        if self.id is None:
            self.id = str(uuid.uuid4())
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


# ============================================================
# 知识图谱存储引擎
# ============================================================

class KnowledgeGraphStore:
    """知识图谱存储 - SQLite 实现"""

    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = Path.home() / ".niko" / "memory_graph.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._init_schema()

        logger.info(f"KnowledgeGraphStore initialized: {self.db_path}")

    def _init_schema(self):
        """初始化数据库 Schema"""
        self.db.executescript("""
            -- 实体表
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                entity_type TEXT NOT NULL,
                observations TEXT DEFAULT '[]',
                properties TEXT DEFAULT '{}',
                created_at TEXT,
                updated_at TEXT
            );

            -- 关系表
            CREATE TABLE IF NOT EXISTS relations (
                id TEXT PRIMARY KEY,
                from_entity TEXT NOT NULL,
                to_entity TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                properties TEXT DEFAULT '{}',
                weight REAL DEFAULT 1.0,
                created_at TEXT,
                FOREIGN KEY (from_entity) REFERENCES entities(name),
                FOREIGN KEY (to_entity) REFERENCES entities(name)
            );

            -- 索引
            CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
            CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
            CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity);
            CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity);
            CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);

            -- 全文搜索索引 (FTS5)
            CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
                name,
                observations,
                content='entities',
                content_rowid='rowid'
            );

            -- 触发器: 同步 FTS 索引
            CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
                INSERT INTO entities_fts(rowid, name, observations)
                VALUES (new.rowid, new.name, new.observations);
            END;

            CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
                INSERT INTO entities_fts(entities_fts, rowid, name, observations)
                VALUES ('delete', old.rowid, old.name, old.observations);
            END;

            CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
                INSERT INTO entities_fts(entities_fts, rowid, name, observations)
                VALUES ('delete', old.rowid, old.name, old.observations);
                INSERT INTO entities_fts(rowid, name, observations)
                VALUES (new.rowid, new.name, new.observations);
            END;
        """)
        self.db.commit()

    # ========== Entity CRUD ==========

    def create_entity(self, entity: Entity) -> Dict[str, Any]:
        """创建单个实体"""
        try:
            self.db.execute(
                """INSERT INTO entities (id, name, entity_type, observations, properties, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    entity.id,
                    entity.name,
                    entity.entityType,
                    json.dumps(entity.observations),
                    json.dumps(entity.properties),
                    entity.created_at,
                    entity.updated_at
                )
            )
            self.db.commit()
            logger.info(f"Created entity: {entity.name} ({entity.entityType})")
            return {"id": entity.id, "name": entity.name, "status": "created"}
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                return {"error": f"Entity '{entity.name}' already exists", "name": entity.name}
            raise

    def create_entities(self, entities: List[Entity]) -> List[Dict[str, Any]]:
        """批量创建实体"""
        results = []
        for entity in entities:
            result = self.create_entity(entity)
            results.append(result)
        return results

    def get_entity(self, name: str) -> Optional[Dict[str, Any]]:
        """获取单个实体"""
        cursor = self.db.execute(
            "SELECT * FROM entities WHERE name = ?",
            (name,)
        )
        row = cursor.fetchone()

        if not row:
            return None

        return {
            "id": row[0],
            "name": row[1],
            "entityType": row[2],
            "observations": json.loads(row[3]) if row[3] else [],
            "properties": json.loads(row[4]) if row[4] else {},
            "created_at": row[5],
            "updated_at": row[6]
        }

    def get_entities(self, names: List[str]) -> List[Dict[str, Any]]:
        """批量获取实体 (open_nodes)"""
        results = []
        for name in names:
            entity = self.get_entity(name)
            if entity:
                # 获取关联关系
                entity["relations"] = self.get_entity_relations(name)
                results.append(entity)
        return results

    def update_entity(self, name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新实体"""
        entity = self.get_entity(name)
        if not entity:
            return {"error": f"Entity '{name}' not found"}

        now = datetime.now().isoformat()

        # 更新 observations (追加模式)
        if "observations" in updates:
            existing_obs = entity.get("observations", [])
            new_obs = updates["observations"]
            if isinstance(new_obs, list):
                existing_obs.extend(new_obs)
            else:
                existing_obs.append(new_obs)
            updates["observations"] = existing_obs

        # 更新 properties (合并模式)
        if "properties" in updates:
            existing_props = entity.get("properties", {})
            existing_props.update(updates["properties"])
            updates["properties"] = existing_props

        set_clauses = []
        params = []

        if "observations" in updates:
            set_clauses.append("observations = ?")
            params.append(json.dumps(updates["observations"]))

        if "properties" in updates:
            set_clauses.append("properties = ?")
            params.append(json.dumps(updates["properties"]))

        if "entityType" in updates:
            set_clauses.append("entity_type = ?")
            params.append(updates["entityType"])

        set_clauses.append("updated_at = ?")
        params.append(now)
        params.append(name)

        self.db.execute(
            f"UPDATE entities SET {', '.join(set_clauses)} WHERE name = ?",
            params
        )
        self.db.commit()

        return {"name": name, "status": "updated"}

    def delete_entity(self, name: str) -> Dict[str, Any]:
        """删除实体及其关系"""
        entity = self.get_entity(name)
        if not entity:
            return {"error": f"Entity '{name}' not found"}

        # 删除关联关系
        self.db.execute(
            "DELETE FROM relations WHERE from_entity = ? OR to_entity = ?",
            (name, name)
        )

        # 删除实体
        self.db.execute("DELETE FROM entities WHERE name = ?", (name,))
        self.db.commit()

        logger.info(f"Deleted entity: {name}")
        return {"name": name, "status": "deleted"}

    def delete_entities(self, names: List[str]) -> List[Dict[str, Any]]:
        """批量删除实体"""
        results = []
        for name in names:
            result = self.delete_entity(name)
            results.append(result)
        return results

    # ========== Relation CRUD ==========

    def create_relation(self, relation: Relation) -> Dict[str, Any]:
        """创建单个关系"""
        # 验证实体存在
        from_entity = self.get_entity(relation.from_entity)
        to_entity = self.get_entity(relation.to_entity)

        if not from_entity:
            return {"error": f"Entity '{relation.from_entity}' not found"}
        if not to_entity:
            return {"error": f"Entity '{relation.to_entity}' not found"}

        try:
            self.db.execute(
                """INSERT INTO relations (id, from_entity, to_entity, relation_type, properties, weight, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    relation.id,
                    relation.from_entity,
                    relation.to_entity,
                    relation.relationType,
                    json.dumps(relation.properties),
                    relation.weight,
                    relation.created_at
                )
            )
            self.db.commit()
            logger.info(f"Created relation: {relation.from_entity} -[{relation.relationType}]-> {relation.to_entity}")
            return {
                "id": relation.id,
                "from": relation.from_entity,
                "to": relation.to_entity,
                "type": relation.relationType,
                "status": "created"
            }
        except Exception as e:
            return {"error": str(e)}

    def create_relations(self, relations: List[Relation]) -> List[Dict[str, Any]]:
        """批量创建关系"""
        results = []
        for relation in relations:
            result = self.create_relation(relation)
            results.append(result)
        return results

    def get_entity_relations(
        self,
        entity_name: str,
        direction: str = "both"
    ) -> List[Dict[str, Any]]:
        """获取实体的所有关系"""
        if direction == "out":
            sql = "SELECT * FROM relations WHERE from_entity = ?"
            params = (entity_name,)
        elif direction == "in":
            sql = "SELECT * FROM relations WHERE to_entity = ?"
            params = (entity_name,)
        else:  # both
            sql = "SELECT * FROM relations WHERE from_entity = ? OR to_entity = ?"
            params = (entity_name, entity_name)

        cursor = self.db.execute(sql, params)

        relations = []
        for row in cursor.fetchall():
            relations.append({
                "id": row[0],
                "from": row[1],
                "to": row[2],
                "relationType": row[3],
                "properties": json.loads(row[4]) if row[4] else {},
                "weight": row[5],
                "created_at": row[6]
            })

        return relations

    def delete_relation(self, relation_id: str) -> Dict[str, Any]:
        """删除关系"""
        cursor = self.db.execute("SELECT id FROM relations WHERE id = ?", (relation_id,))
        if not cursor.fetchone():
            return {"error": f"Relation '{relation_id}' not found"}

        self.db.execute("DELETE FROM relations WHERE id = ?", (relation_id,))
        self.db.commit()

        return {"id": relation_id, "status": "deleted"}

    # ========== Search ==========

    def search_nodes(
        self,
        query: str,
        entity_type: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """搜索节点 (使用 FTS5 全文搜索)"""
        results = []

        # 尝试 FTS 搜索
        try:
            if entity_type:
                cursor = self.db.execute("""
                    SELECT e.* FROM entities e
                    JOIN entities_fts fts ON e.rowid = fts.rowid
                    WHERE entities_fts MATCH ? AND e.entity_type = ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, entity_type, limit))
            else:
                cursor = self.db.execute("""
                    SELECT e.* FROM entities e
                    JOIN entities_fts fts ON e.rowid = fts.rowid
                    WHERE entities_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, limit))

            for row in cursor.fetchall():
                results.append({
                    "id": row[0],
                    "name": row[1],
                    "entityType": row[2],
                    "observations": json.loads(row[3]) if row[3] else [],
                    "properties": json.loads(row[4]) if row[4] else {},
                    "created_at": row[5],
                    "updated_at": row[6]
                })
        except sqlite3.OperationalError:
            # FTS 查询失败，回退到 LIKE 搜索
            pass

        # 如果 FTS 无结果，使用 LIKE 模糊搜索
        if not results:
            like_query = f"%{query}%"
            if entity_type:
                cursor = self.db.execute("""
                    SELECT * FROM entities
                    WHERE (name LIKE ? OR observations LIKE ?) AND entity_type = ?
                    LIMIT ?
                """, (like_query, like_query, entity_type, limit))
            else:
                cursor = self.db.execute("""
                    SELECT * FROM entities
                    WHERE name LIKE ? OR observations LIKE ?
                    LIMIT ?
                """, (like_query, like_query, limit))

            for row in cursor.fetchall():
                results.append({
                    "id": row[0],
                    "name": row[1],
                    "entityType": row[2],
                    "observations": json.loads(row[3]) if row[3] else [],
                    "properties": json.loads(row[4]) if row[4] else {},
                    "created_at": row[5],
                    "updated_at": row[6]
                })

        return results

    def get_all_entities(self, entity_type: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """获取所有实体"""
        if entity_type:
            cursor = self.db.execute(
                "SELECT * FROM entities WHERE entity_type = ? LIMIT ?",
                (entity_type, limit)
            )
        else:
            cursor = self.db.execute("SELECT * FROM entities LIMIT ?", (limit,))

        results = []
        rows = cursor.fetchall()
        for row in rows:
            results.append({
                "id": row[0],
                "name": row[1],
                "entityType": row[2],
                "observations": json.loads(row[3]) if row[3] else [],
                "properties": json.loads(row[4]) if row[4] else {},
                "created_at": row[5],
                "updated_at": row[6]
            })

        return results

    def get_graph_stats(self) -> Dict[str, Any]:
        """获取图谱统计信息"""
        entity_count = self.db.execute("SELECT COUNT(*) FROM entities").fetchone()[0]
        relation_count = self.db.execute("SELECT COUNT(*) FROM relations").fetchone()[0]

        # 按类型统计
        entity_by_type = {}
        cursor = self.db.execute("SELECT entity_type, COUNT(*) FROM entities GROUP BY entity_type")
        for row in cursor.fetchall():
            entity_by_type[row[0]] = row[1]

        relation_by_type = {}
        cursor = self.db.execute("SELECT relation_type, COUNT(*) FROM relations GROUP BY relation_type")
        for row in cursor.fetchall():
            relation_by_type[row[0]] = row[1]

        return {
            "total_entities": entity_count,
            "total_relations": relation_count,
            "entities_by_type": entity_by_type,
            "relations_by_type": relation_by_type,
            "avg_relations_per_entity": relation_count / entity_count if entity_count > 0 else 0
        }

    def close(self):
        """关闭数据库连接"""
        self.db.close()


# ============================================================
# MCP Server 定义
# ============================================================

# 创建 MCP 服务器
mcp = FastMCP("MemoryGraph")

# 全局存储实例
_store: Optional[KnowledgeGraphStore] = None


def get_store() -> KnowledgeGraphStore:
    """获取存储实例 (延迟初始化)"""
    global _store
    if _store is None:
        _store = KnowledgeGraphStore()
    return _store


# ========== Entity Tools ==========

@mcp.tool()
def create_entities(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    批量创建实体节点

    Args:
        entities: 实体列表，每个实体包含:
            - name: 实体名称 (必填，唯一)
            - entityType: 实体类型 (character/location/event/object/concept 等)
            - observations: 观察记录列表 (可选)
            - properties: 属性字典 (可选)

    Returns:
        创建结果列表

    Example:
        create_entities([
            {"name": "张三", "entityType": "character", "observations": ["主角", "年龄25岁"]},
            {"name": "北京", "entityType": "location", "observations": ["故事发生地"]}
        ])
    """
    store = get_store()
    entity_objects = []

    for e in entities:
        entity = Entity(
            name=e["name"],
            entityType=e.get("entityType", "concept"),
            observations=e.get("observations", []),
            properties=e.get("properties", {})
        )
        entity_objects.append(entity)

    return store.create_entities(entity_objects)


@mcp.tool()
def open_nodes(names: List[str]) -> List[Dict[str, Any]]:
    """
    打开/获取指定实体节点的详细信息

    Args:
        names: 实体名称列表

    Returns:
        实体详情列表，包含:
            - 基本信息 (id, name, entityType)
            - observations (观察记录)
            - properties (属性)
            - relations (关联关系)

    Example:
        open_nodes(["张三", "北京"])
    """
    store = get_store()
    return store.get_entities(names)


@mcp.tool()
def add_observations(
    name: str,
    observations: List[str]
) -> Dict[str, Any]:
    """
    为实体添加观察记录

    Args:
        name: 实体名称
        observations: 新增的观察记录列表

    Returns:
        更新结果

    Example:
        add_observations("张三", ["喜欢喝咖啡", "有一只猫"])
    """
    store = get_store()
    return store.update_entity(name, {"observations": observations})


@mcp.tool()
def delete_entities(names: List[str]) -> List[Dict[str, Any]]:
    """
    批量删除实体节点 (同时删除关联关系)

    Args:
        names: 要删除的实体名称列表

    Returns:
        删除结果列表

    Example:
        delete_entities(["临时角色", "废弃地点"])
    """
    store = get_store()
    return store.delete_entities(names)


# ========== Relation Tools ==========

@mcp.tool()
def create_relations(relations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    批量创建实体间的关系

    Args:
        relations: 关系列表，每个关系包含:
            - from: 起始实体名称 (必填)
            - to: 目标实体名称 (必填)
            - relationType: 关系类型 (KNOWS/LOCATED_IN/LOVES 等)
            - properties: 关系属性 (可选)
            - weight: 关系权重 0-1 (可选，默认 1.0)

    Returns:
        创建结果列表

    Example:
        create_relations([
            {"from": "张三", "to": "李四", "relationType": "KNOWS"},
            {"from": "张三", "to": "北京", "relationType": "LOCATED_IN", "properties": {"since": "2020"}}
        ])
    """
    store = get_store()
    relation_objects = []

    for r in relations:
        relation = Relation(
            from_entity=r["from"],
            to_entity=r["to"],
            relationType=r.get("relationType", "RELATED_TO"),
            properties=r.get("properties", {}),
            weight=r.get("weight", 1.0)
        )
        relation_objects.append(relation)

    return store.create_relations(relation_objects)


@mcp.tool()
def delete_relations(relation_ids: List[str]) -> List[Dict[str, Any]]:
    """
    批量删除关系

    Args:
        relation_ids: 关系ID列表

    Returns:
        删除结果列表
    """
    store = get_store()
    results = []
    for rid in relation_ids:
        result = store.delete_relation(rid)
        results.append(result)
    return results


# ========== Search Tools ==========

@mcp.tool()
def search_nodes(
    query: str,
    entity_type: Optional[str] = None,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    搜索知识图谱中的节点

    支持全文搜索，可按实体类型过滤。

    Args:
        query: 搜索关键词
        entity_type: 实体类型过滤 (可选)
        limit: 返回数量限制 (默认 20)

    Returns:
        匹配的实体列表

    Example:
        search_nodes("张三")
        search_nodes("北京", entity_type="location")
    """
    store = get_store()
    return store.search_nodes(query, entity_type, limit)


@mcp.tool()
def read_graph(
    entity_type: Optional[str] = None,
    limit: int = 100
) -> Dict[str, Any]:
    """
    读取整个知识图谱

    Args:
        entity_type: 实体类型过滤 (可选)
        limit: 返回数量限制

    Returns:
        图谱数据:
            - entities: 实体列表
            - stats: 统计信息
    """
    store = get_store()
    entities = store.get_all_entities(entity_type, limit)
    stats = store.get_graph_stats()

    return {
        "entities": entities,
        "stats": stats
    }


@mcp.tool()
def get_entity_graph(
    name: str,
    depth: int = 1
) -> Dict[str, Any]:
    """
    获取以指定实体为中心的子图

    Args:
        name: 中心实体名称
        depth: 遍历深度 (默认 1)

    Returns:
        子图数据:
            - center: 中心实体
            - nodes: 相关实体列表
            - edges: 关系列表
    """
    store = get_store()

    center = store.get_entity(name)
    if not center:
        return {"error": f"Entity '{name}' not found"}

    # 获取直接关联的实体
    relations = store.get_entity_relations(name)

    # 收集相关实体名称
    related_names = set()
    for r in relations:
        if r["from"] != name:
            related_names.add(r["from"])
        if r["to"] != name:
            related_names.add(r["to"])

    # 获取相关实体详情
    related_entities = []
    for rname in related_names:
        entity = store.get_entity(rname)
        if entity:
            related_entities.append(entity)

    # 如果 depth > 1，递归获取更多层
    if depth > 1:
        for rname in list(related_names):
            deeper_relations = store.get_entity_relations(rname)
            for r in deeper_relations:
                for target in [r["from"], r["to"]]:
                    if target != name and target not in related_names:
                        entity = store.get_entity(target)
                        if entity:
                            related_entities.append(entity)
                            related_names.add(target)
                        relations.append(r)

    return {
        "center": center,
        "nodes": related_entities,
        "edges": relations
    }


# ============================================================
# 主入口
# ============================================================

def main():
    """MCP Server 主入口"""
    logger.info("Starting Memory MCP Server...")
    mcp.run()


if __name__ == "__main__":
    main()

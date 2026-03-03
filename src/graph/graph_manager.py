"""
GraphManager - 知识图谱管理器

实现 IGraphService 接口，提供:
1. Cypher 查询执行
2. 实体/关系 CRUD 操作
3. 图算法（最短路径、子图提取）
4. 实体搜索和统计

基于 SQLite 后端，支持 Cypher 语法子集。
"""

import json
import logging
import re
import sqlite3
import uuid
import threading
from collections import deque
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from docs.contracts.graph_contracts import (
    Entity,
    EntityStats,
    EntityType,
    GraphPath,
    Relationship,
    RelationType,
    SubGraph,
)

logger = logging.getLogger("niko-graph-manager")


class CypherParser:
    """Cypher 查询解析器（支持常用语法子集）"""

    # 节点模式: (alias:Label {prop: value})
    NODE_PATTERN = re.compile(
        r'\((\w+)?(?::(\w+))?(?:\s*\{([^}]*)\})?\)'
    )

    # 关系模式: -[alias:TYPE]-> 或 <-[alias:TYPE]-
    REL_PATTERN = re.compile(
        r'(<)?-\[(\w+)?(?::(\w+))?\]->(>)?'
    )

    # WHERE 条件
    WHERE_PATTERN = re.compile(
        r'WHERE\s+(.+?)(?=\s+RETURN|\s+ORDER|\s+LIMIT|$)',
        re.IGNORECASE | re.DOTALL
    )

    # RETURN 子句
    RETURN_PATTERN = re.compile(
        r'RETURN\s+(.+?)(?=\s+ORDER|\s+LIMIT|$)',
        re.IGNORECASE | re.DOTALL
    )

    # LIMIT 子句
    LIMIT_PATTERN = re.compile(
        r'LIMIT\s+(\d+)',
        re.IGNORECASE
    )

    # ORDER BY 子句
    ORDER_PATTERN = re.compile(
        r'ORDER\s+BY\s+(.+?)(?=\s+LIMIT|$)',
        re.IGNORECASE | re.DOTALL
    )

    @classmethod
    def parse(cls, cypher: str) -> Dict[str, Any]:
        """解析 Cypher 查询"""
        cypher = cypher.strip()
        result = {
            "type": None,
            "nodes": [],
            "relationships": [],
            "where": None,
            "return": None,
            "limit": None,
            "order_by": None,
        }

        # 判断查询类型
        upper = cypher.upper()
        if upper.startswith("MATCH"):
            result["type"] = "MATCH"
        elif upper.startswith("CREATE"):
            result["type"] = "CREATE"
        elif upper.startswith("DELETE"):
            result["type"] = "DELETE"
        elif upper.startswith("SET"):
            result["type"] = "SET"
        else:
            result["type"] = "UNKNOWN"

        # 解析节点
        for match in cls.NODE_PATTERN.finditer(cypher):
            alias, label, props_str = match.groups()
            props = cls._parse_props(props_str) if props_str else {}
            result["nodes"].append({
                "alias": alias,
                "label": label,
                "properties": props,
            })

        # 解析关系
        for match in cls.REL_PATTERN.finditer(cypher):
            left_arrow, alias, rel_type, right_arrow = match.groups()
            direction = "left" if left_arrow else "right"
            result["relationships"].append({
                "alias": alias,
                "type": rel_type,
                "direction": direction,
            })

        # 解析 WHERE
        where_match = cls.WHERE_PATTERN.search(cypher)
        if where_match:
            result["where"] = where_match.group(1).strip()

        # 解析 RETURN
        return_match = cls.RETURN_PATTERN.search(cypher)
        if return_match:
            result["return"] = return_match.group(1).strip()

        # 解析 LIMIT
        limit_match = cls.LIMIT_PATTERN.search(cypher)
        if limit_match:
            result["limit"] = int(limit_match.group(1))

        # 解析 ORDER BY
        order_match = cls.ORDER_PATTERN.search(cypher)
        if order_match:
            result["order_by"] = order_match.group(1).strip()

        return result

    @classmethod
    def _parse_props(cls, props_str: str) -> Dict[str, Any]:
        """解析属性字符串 {key: value, ...}"""
        props = {}
        if not props_str:
            return props

        # 简单解析 key: value 对
        pairs = props_str.split(',')
        for pair in pairs:
            if ':' in pair:
                key, value = pair.split(':', 1)
                key = key.strip().strip("'\"")
                value = value.strip().strip("'\"")
                # 尝试转换类型
                if value.isdigit():
                    value = int(value)
                elif value.replace('.', '').isdigit():
                    value = float(value)
                elif value.lower() in ('true', 'false'):
                    value = value.lower() == 'true'
                props[key] = value

        return props


class GraphManager:
    """
    知识图谱管理器

    实现 IGraphService 接口，提供完整的图谱操作功能。
    使用 SQLite 作为后端存储。
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        初始化 GraphManager

        Args:
            db_path: 数据库路径，默认 ~/.niko/graph_manager.db
        """
        if db_path is None:
            db_path = Path.home() / ".niko" / "graph_manager.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._conn: Optional[sqlite3.Connection] = None
        self._lock = threading.RLock()
        self._init_db()

        logger.info(f"GraphManager initialized: {self.db_path}")

    def _init_db(self) -> None:
        """初始化数据库连接和 Schema"""
        self._conn = sqlite3.connect(
            str(self.db_path),
            check_same_thread=False
        )
        self._conn.row_factory = sqlite3.Row

        self._conn.executescript("""
            -- 实体表
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                properties TEXT DEFAULT '{}',
                created_at TEXT,
                updated_at TEXT
            );

            -- 关系表
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                properties TEXT DEFAULT '{}',
                weight REAL DEFAULT 1.0,
                created_at TEXT,
                FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
                FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
            );

            -- 索引
            CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
            CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
            CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
            CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
            CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

            -- 全文搜索（如果 SQLite 支持 FTS5）
            CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
                id, name, properties,
                content='entities',
                content_rowid='rowid'
            );

            -- 触发器：同步 FTS 索引
            CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
                INSERT INTO entities_fts(rowid, id, name, properties)
                VALUES (new.rowid, new.id, new.name, new.properties);
            END;

            CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
                INSERT INTO entities_fts(entities_fts, rowid, id, name, properties)
                VALUES('delete', old.rowid, old.id, old.name, old.properties);
            END;

            CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
                INSERT INTO entities_fts(entities_fts, rowid, id, name, properties)
                VALUES('delete', old.rowid, old.id, old.name, old.properties);
                INSERT INTO entities_fts(rowid, id, name, properties)
                VALUES (new.rowid, new.id, new.name, new.properties);
            END;
        """)
        self._conn.commit()

    def _row_to_entity(self, row: sqlite3.Row) -> Entity:
        """将数据库行转换为 Entity 对象"""
        props = json.loads(row["properties"]) if row["properties"] else {}
        created_at = None
        updated_at = None

        if row["created_at"]:
            try:
                created_at = datetime.fromisoformat(row["created_at"])
            except ValueError:
                pass

        if row["updated_at"]:
            try:
                updated_at = datetime.fromisoformat(row["updated_at"])
            except ValueError:
                pass

        return Entity(
            id=row["id"],
            name=row["name"],
            type=EntityType(row["type"]),
            properties=props,
            created_at=created_at,
            updated_at=updated_at,
        )

    def get_entities_batch(self, entity_ids: List[str]) -> Dict[str, Entity]:
        """
        Batch get multiple entities (avoids N+1 queries).

        Args:
            entity_ids: List of entity identifiers

        Returns:
            Dict mapping entity_id to Entity (missing entities excluded)
        """
        if not entity_ids:
            return {}

        # Use WHERE IN for batch query
        placeholders = ",".join("?" * len(entity_ids))
        cursor = self._conn.execute(
            f"SELECT * FROM entities WHERE id IN ({placeholders})",
            entity_ids,
        )

        result = {}
        rows = cursor.fetchall()
        for row in rows:
            entity = self._row_to_entity(row)
            result[entity.id] = entity

        return result

    def _row_to_relationship(self, row: sqlite3.Row) -> Relationship:
        """将数据库行转换为 Relationship 对象"""
        props = json.loads(row["properties"]) if row["properties"] else {}

        return Relationship(
            id=row["id"],
            source_id=row["source_id"],
            target_id=row["target_id"],
            type=RelationType(row["type"]),
            properties=props,
            weight=row["weight"] or 1.0,
        )

    # ============================================================
    # Cypher 查询
    # ============================================================

    def run_cypher(self, query: str) -> List[Dict[str, Any]]:
        """
        执行 Cypher 查询

        支持的语法子集:
        - MATCH (n:Type) RETURN n
        - MATCH (n:Type) WHERE n.name = 'xxx' RETURN n
        - MATCH (a)-[r:REL]->(b) RETURN a, r, b

        Args:
            query: Cypher 查询语句

        Returns:
            查询结果列表
        """
        parsed = CypherParser.parse(query)

        if parsed["type"] == "MATCH":
            return self._execute_match(parsed, query)
        elif parsed["type"] == "CREATE":
            return self._execute_create(parsed, query)
        else:
            # 尝试直接执行 SQL（fallback）
            try:
                cursor = self._conn.execute(query)
                if cursor.description:
                    columns = [desc[0] for desc in cursor.description]
                    return [dict(zip(columns, row)) for row in cursor.fetchall()]
                return [{"affected_rows": cursor.rowcount}]
            except Exception as e:
                logger.error(f"Cypher execution error: {e}")
                return [{"error": str(e)}]

    def _execute_match(
        self, parsed: Dict[str, Any], original: str
    ) -> List[Dict[str, Any]]:
        """执行 MATCH 查询"""
        results = []
        nodes = parsed["nodes"]
        relationships = parsed["relationships"]
        where = parsed["where"]
        limit = parsed["limit"]

        # 简单节点查询
        if len(nodes) == 1 and not relationships:
            node = nodes[0]
            sql = "SELECT * FROM entities WHERE 1=1"
            params = []

            if node["label"]:
                sql += " AND type = ?"
                params.append(node["label"].lower())

            # 解析 WHERE 条件
            if where:
                sql, params = self._parse_where(sql, params, where, node["alias"])

            if limit:
                sql += f" LIMIT {limit}"

            cursor = self._conn.execute(sql, params)
            rows = cursor.fetchall()
            for row in rows:
                entity = self._row_to_entity(row)
                results.append({
                    node["alias"] or "n": self._entity_to_dict(entity)
                })

        # 关系查询
        elif relationships:
            results = self._execute_relationship_match(
                nodes, relationships, where, limit
            )

        return results

    def _execute_relationship_match(
        self,
        nodes: List[Dict],
        relationships: List[Dict],
        where: Optional[str],
        limit: Optional[int],
    ) -> List[Dict[str, Any]]:
        """执行关系模式匹配"""
        results = []

        # 构建 SQL JOIN 查询
        sql = """
            SELECT
                e1.id as source_id, e1.name as source_name, e1.type as source_type,
                e1.properties as source_props,
                r.id as rel_id, r.type as rel_type, r.properties as rel_props,
                r.weight as rel_weight,
                e2.id as target_id, e2.name as target_name, e2.type as target_type,
                e2.properties as target_props
            FROM relationships r
            JOIN entities e1 ON r.source_id = e1.id
            JOIN entities e2 ON r.target_id = e2.id
            WHERE 1=1
        """
        params = []

        # 节点类型过滤
        if len(nodes) >= 1 and nodes[0].get("label"):
            sql += " AND e1.type = ?"
            params.append(nodes[0]["label"].lower())

        if len(nodes) >= 2 and nodes[1].get("label"):
            sql += " AND e2.type = ?"
            params.append(nodes[1]["label"].lower())

        # 关系类型过滤
        if relationships and relationships[0].get("type"):
            sql += " AND r.type = ?"
            params.append(relationships[0]["type"])

        if limit:
            sql += f" LIMIT {limit}"

        cursor = self._conn.execute(sql, params)
        rows = cursor.fetchall()
        for row in rows:
            results.append({
                "source": {
                    "id": row["source_id"],
                    "name": row["source_name"],
                    "type": row["source_type"],
                    "properties": json.loads(row["source_props"] or "{}"),
                },
                "relationship": {
                    "id": row["rel_id"],
                    "type": row["rel_type"],
                    "properties": json.loads(row["rel_props"] or "{}"),
                    "weight": row["rel_weight"],
                },
                "target": {
                    "id": row["target_id"],
                    "name": row["target_name"],
                    "type": row["target_type"],
                    "properties": json.loads(row["target_props"] or "{}"),
                },
            })

        return results

    def _parse_where(
        self,
        sql: str,
        params: List,
        where: str,
        alias: Optional[str],
    ) -> Tuple[str, List]:
        """解析 WHERE 子句"""
        # 解析简单条件: alias.field = 'value'
        pattern = re.compile(
            r"(\w+)\.(\w+)\s*(=|<>|<|>|<=|>=|CONTAINS)\s*['\"]?([^'\"]+)['\"]?",
            re.IGNORECASE
        )

        for match in pattern.finditer(where):
            var, field, op, value = match.groups()

            if field == "name":
                sql += f" AND name {op} ?"
                params.append(value)
            elif field == "id":
                sql += f" AND id {op} ?"
                params.append(value)
            elif field == "type":
                sql += f" AND type {op} ?"
                params.append(value.lower())
            else:
                # JSON 属性查询
                if op.upper() == "CONTAINS":
                    sql += f" AND json_extract(properties, '$.{field}') LIKE ?"
                    params.append(f"%{value}%")
                else:
                    sql += f" AND json_extract(properties, '$.{field}') {op} ?"
                    params.append(value)

        return sql, params

    def _execute_create(
        self, parsed: Dict[str, Any], original: str
    ) -> List[Dict[str, Any]]:
        """执行 CREATE 查询"""
        results = []
        nodes = parsed["nodes"]

        for node in nodes:
            if node["label"]:
                try:
                    entity_type = EntityType(node["label"].lower())
                except ValueError:
                    entity_type = EntityType.CONCEPT

                entity = Entity(
                    id=str(uuid.uuid4()),
                    name=node["properties"].get("name", f"Entity_{uuid.uuid4().hex[:8]}"),
                    type=entity_type,
                    properties=node["properties"],
                )
                entity_id = self.create_entity(entity)
                results.append({"created": entity_id})

        return results

    def _entity_to_dict(self, entity: Entity) -> Dict[str, Any]:
        """Entity 转字典"""
        return {
            "id": entity.id,
            "name": entity.name,
            "type": entity.type.value,
            "properties": entity.properties,
            "created_at": entity.created_at.isoformat() if entity.created_at else None,
            "updated_at": entity.updated_at.isoformat() if entity.updated_at else None,
        }

    # ============================================================
    # 统计
    # ============================================================

    def get_entity_stats(self) -> EntityStats:
        """
        获取实体统计信息

        Returns:
            EntityStats 对象
        """
        # 实体总数
        cursor = self._conn.execute("SELECT COUNT(*) FROM entities")
        total_entities = cursor.fetchone()[0]

        # 关系总数
        cursor = self._conn.execute("SELECT COUNT(*) FROM relationships")
        total_relationships = cursor.fetchone()[0]

        # 按类型统计实体
        cursor = self._conn.execute(
            "SELECT type, COUNT(*) as count FROM entities GROUP BY type"
        )
        entities_by_type = {row["type"]: row["count"] for row in cursor.fetchall()}

        # 按类型统计关系
        cursor = self._conn.execute(
            "SELECT type, COUNT(*) as count FROM relationships GROUP BY type"
        )
        relationships_by_type = {row["type"]: row["count"] for row in cursor.fetchall()}

        # 平均连接数
        avg_connections = 0.0
        if total_entities > 0:
            avg_connections = (total_relationships * 2) / total_entities

        return EntityStats(
            total_entities=total_entities,
            total_relationships=total_relationships,
            entities_by_type=entities_by_type,
            relationships_by_type=relationships_by_type,
            avg_connections_per_entity=round(avg_connections, 2),
        )

    # ============================================================
    # 图遍历
    # ============================================================

    def find_related_entities(
        self,
        entity_id: str,
        max_depth: int = 2,
        limit: int = 50,
    ) -> List[Entity]:
        """
        查找相关实体（BFS 遍历）

        Args:
            entity_id: 起始实体 ID
            max_depth: 最大遍历深度
            limit: 返回数量限制

        Returns:
            相关实体列表
        """
        if max_depth <= 0 or limit <= 0:
            return []

        visited = {entity_id}
        frontier = [entity_id]
        candidate_ids: List[str] = []

        for _depth in range(1, max_depth + 1):
            if not frontier or len(candidate_ids) >= limit:
                break

            placeholders = ",".join("?" for _ in frontier)
            sql = f"""
                SELECT target_id AS neighbor_id FROM relationships
                WHERE source_id IN ({placeholders})
                UNION
                SELECT source_id AS neighbor_id FROM relationships
                WHERE target_id IN ({placeholders})
            """
            params = tuple(frontier) + tuple(frontier)
            cursor = self._conn.execute(sql, params)

            next_frontier: List[str] = []
            rows = cursor.fetchall()
            for row in rows:
                neighbor_id = row["neighbor_id"] if isinstance(row, sqlite3.Row) else row[0]
                if neighbor_id in visited:
                    continue
                visited.add(neighbor_id)
                next_frontier.append(neighbor_id)
                candidate_ids.append(neighbor_id)
                if len(candidate_ids) >= limit:
                    break

            frontier = next_frontier

        if not candidate_ids:
            return []

        ids_for_query = candidate_ids[:limit]
        placeholders = ",".join("?" for _ in ids_for_query)
        cursor = self._conn.execute(
            f"SELECT * FROM entities WHERE id IN ({placeholders})",
            tuple(ids_for_query),
        )
        entity_map = {row["id"]: self._row_to_entity(row) for row in cursor.fetchall()}
        return [entity_map[eid] for eid in ids_for_query if eid in entity_map]


    # ============================================================
    # 实体 CRUD
    # ============================================================

    def create_entity(self, entity: Entity) -> str:
        """
        创建实体

        Args:
            entity: Entity 对象

        Returns:
            实体 ID
        """
        now = datetime.now().isoformat()

        # 确保 ID
        if not entity.id:
            entity.id = str(uuid.uuid4())

        with self._lock:
            self._conn.execute(
                """
                INSERT INTO entities (id, name, type, properties, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    entity.id,
                    entity.name,
                    entity.type.value,
                    json.dumps(entity.properties),
                    now,
                    now,
                ),
            )
            self._conn.commit()

        logger.info(f"Created entity: {entity.type.value}/{entity.name} ({entity.id})")
        return entity.id

    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """
        获取实体

        Args:
            entity_id: 实体 ID

        Returns:
            Entity 对象，不存在返回 None
        """
        cursor = self._conn.execute(
            "SELECT * FROM entities WHERE id = ?",
            (entity_id,),
        )
        row = cursor.fetchone()

        if row:
            return self._row_to_entity(row)
        return None

    def update_entity(self, entity: Entity) -> bool:
        """
        更新实体

        Args:
            entity: Entity 对象

        Returns:
            是否更新成功
        """
        now = datetime.now().isoformat()

        cursor = self._conn.execute(
            """
            UPDATE entities
            SET name = ?, type = ?, properties = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                entity.name,
                entity.type.value,
                json.dumps(entity.properties),
                now,
                entity.id,
            ),
        )
        self._conn.commit()

        success = cursor.rowcount > 0
        if success:
            logger.info(f"Updated entity: {entity.id}")
        return success

    def delete_entity(self, entity_id: str) -> bool:
        """
        删除实体（同时删除关联关系）

        Args:
            entity_id: 实体 ID

        Returns:
            是否删除成功
        """
        # 删除关联关系
        self._conn.execute(
            "DELETE FROM relationships WHERE source_id = ? OR target_id = ?",
            (entity_id, entity_id),
        )

        # 删除实体
        cursor = self._conn.execute(
            "DELETE FROM entities WHERE id = ?",
            (entity_id,),
        )
        self._conn.commit()

        success = cursor.rowcount > 0
        if success:
            logger.info(f"Deleted entity: {entity_id}")
        return success

    # ============================================================
    # 关系 CRUD
    # ============================================================

    def create_relationship(self, relationship: Relationship) -> str:
        """
        创建关系

        Args:
            relationship: Relationship 对象

        Returns:
            关系 ID
        """
        now = datetime.now().isoformat()

        # 确保 ID
        if not relationship.id:
            relationship.id = str(uuid.uuid4())

        self._conn.execute(
            """
            INSERT INTO relationships
            (id, source_id, target_id, type, properties, weight, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                relationship.id,
                relationship.source_id,
                relationship.target_id,
                relationship.type.value,
                json.dumps(relationship.properties),
                relationship.weight,
                now,
            ),
        )
        self._conn.commit()

        logger.info(
            f"Created relationship: {relationship.source_id} "
            f"-[{relationship.type.value}]-> {relationship.target_id}"
        )
        return relationship.id

    def get_relationships(
        self,
        entity_id: str,
        direction: str = "both",
    ) -> List[Relationship]:
        """
        获取实体的关系

        Args:
            entity_id: 实体 ID
            direction: 方向 ("in" | "out" | "both")

        Returns:
            关系列表
        """
        if direction == "out":
            sql = "SELECT * FROM relationships WHERE source_id = ?"
            params = (entity_id,)
        elif direction == "in":
            sql = "SELECT * FROM relationships WHERE target_id = ?"
            params = (entity_id,)
        else:  # both
            sql = "SELECT * FROM relationships WHERE source_id = ? OR target_id = ?"
            params = (entity_id, entity_id)

        cursor = self._conn.execute(sql, params)
        return [self._row_to_relationship(row) for row in cursor.fetchall()]

    def delete_relationship(self, relationship_id: str) -> bool:
        """
        删除关系

        Args:
            relationship_id: 关系 ID

        Returns:
            是否删除成功
        """
        cursor = self._conn.execute(
            "DELETE FROM relationships WHERE id = ?",
            (relationship_id,),
        )
        self._conn.commit()

        success = cursor.rowcount > 0
        if success:
            logger.info(f"Deleted relationship: {relationship_id}")
        return success

    # ============================================================
    # 图算法
    # ============================================================

    def find_shortest_path(
        self,
        source_id: str,
        target_id: str,
    ) -> Optional[GraphPath]:
        """
        查找最短路径（BFS）

        Args:
            source_id: 起点实体 ID
            target_id: 终点实体 ID

        Returns:
            GraphPath 对象，无路径返回 None
        """
        if source_id == target_id:
            entity = self.get_entity(source_id)
            if entity:
                return GraphPath(nodes=[entity], edges=[], total_weight=0)
            return None

        # BFS - 先收集路径中的实体 ID，最后批量获取
        visited = {source_id}
        queue = deque([(source_id, [], [])])  # (current_id, path_node_ids, path_edges)

        while queue:
            current_id, path_node_ids, path_edges = queue.popleft()

            # 获取邻居
            cursor = self._conn.execute(
                """
                SELECT r.*, e.id as neighbor_id
                FROM relationships r
                JOIN entities e ON (
                    CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END
                ) = e.id
                WHERE r.source_id = ? OR r.target_id = ?
                """,
                (current_id, current_id, current_id),
            )

            rows = cursor.fetchall()
            for row in rows:
                neighbor_id = row["neighbor_id"]

                if neighbor_id in visited:
                    continue

                rel = self._row_to_relationship(row)
                new_path_edges = path_edges + [rel]
                new_path_node_ids = path_node_ids + [neighbor_id]

                if neighbor_id == target_id:
                    # 找到路径 - 批量获取所有实体
                    all_entity_ids = [source_id] + new_path_node_ids
                    entity_map = self.get_entities_batch(all_entity_ids)
                    all_nodes = [entity_map.get(eid) for eid in all_entity_ids if eid in entity_map]
                    total_weight = sum(e.weight for e in new_path_edges)

                    return GraphPath(
                        nodes=all_nodes,
                        edges=new_path_edges,
                        total_weight=total_weight,
                    )

                visited.add(neighbor_id)
                queue.append((neighbor_id, new_path_node_ids, new_path_edges))

        return None

    def get_subgraph(
        self,
        center_id: str,
        radius: int = 2,
    ) -> SubGraph:
        """
        获取子图（以指定实体为中心）

        Args:
            center_id: 中心实体 ID
            radius: 半径（跳数）

        Returns:
            SubGraph 对象
        """
        entity_ids = set()
        relationship_ids = set()

        # BFS 遍历
        queue = deque([(center_id, 0)])
        visited = set()

        while queue:
            current_id, depth = queue.popleft()

            if current_id in visited:
                continue
            visited.add(current_id)
            entity_ids.add(current_id)

            if depth < radius:
                # 获取关系和邻居
                cursor = self._conn.execute(
                    """
                    SELECT * FROM relationships
                    WHERE source_id = ? OR target_id = ?
                    """,
                    (current_id, current_id),
                )

                rows = cursor.fetchall()
                for row in rows:
                    relationship_ids.add(row["id"])
                    neighbor_id = (
                        row["target_id"]
                        if row["source_id"] == current_id
                        else row["source_id"]
                    )
                    if neighbor_id not in visited:
                        queue.append((neighbor_id, depth + 1))

        # 获取实体 - 使用批量查询避免 N+1
        entity_map = self.get_entities_batch(list(entity_ids))
        entities = list(entity_map.values())

        # 获取关系 - 使用批量查询避免 N+1
        relationships = []
        if relationship_ids:
            placeholders = ",".join("?" * len(relationship_ids))
            cursor = self._conn.execute(
                f"SELECT * FROM relationships WHERE id IN ({placeholders})",
                list(relationship_ids),
            )
            rows = cursor.fetchall()
            for row in rows:
                relationships.append(self._row_to_relationship(row))

        return SubGraph(
            entities=entities,
            relationships=relationships,
            center_entity_id=center_id,
        )

    # ============================================================
    # 搜索
    # ============================================================

    def search_entities(
        self,
        query: str,
        entity_type: Optional[EntityType] = None,
        limit: int = 20,
    ) -> List[Entity]:
        """
        搜索实体

        Args:
            query: 搜索关键词
            entity_type: 可选类型过滤
            limit: 返回数量限制

        Returns:
            实体列表
        """
        # 尝试 FTS 搜索
        try:
            sql = """
                SELECT e.* FROM entities e
                JOIN entities_fts fts ON e.id = fts.id
                WHERE entities_fts MATCH ?
            """
            params = [query]

            if entity_type:
                sql += " AND e.type = ?"
                params.append(entity_type.value)

            sql += f" LIMIT {limit}"

            cursor = self._conn.execute(sql, params)
            return [self._row_to_entity(row) for row in cursor.fetchall()]

        except sqlite3.OperationalError:
            # FTS 不可用，回退到 LIKE 搜索
            sql = "SELECT * FROM entities WHERE (name LIKE ? OR properties LIKE ?)"
            params = [f"%{query}%", f"%{query}%"]

            if entity_type:
                sql += " AND type = ?"
                params.append(entity_type.value)

            sql += f" LIMIT {limit}"

            cursor = self._conn.execute(sql, params)
            return [self._row_to_entity(row) for row in cursor.fetchall()]

    # ============================================================
    # 便捷方法（兼容旧 API）
    # ============================================================

    def add_entity(self, entity: Entity) -> str:
        """创建实体（别名）"""
        return self.create_entity(entity)

    def add_relation(self, relation: Relationship) -> str:
        """创建关系（别名）"""
        return self.create_relationship(relation)

    # ============================================================
    # 生命周期
    # ============================================================

    def close(self) -> None:
        """关闭数据库连接"""
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.info("GraphManager closed")

    def __enter__(self) -> "GraphManager":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

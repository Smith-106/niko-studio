"""
知识图谱引擎 - 基于 Kùzu DB / SQLite 回退

核心特性:
1. 实体管理 (Character/Location/Event/Item/Foreshadow)
2. 关系网络
3. 伏笔追踪
4. 时间线查询
5. Cypher 查询支持
"""

import json
import logging
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any, Iterable, Protocol

from src.config import get_config_value

logger = logging.getLogger("niko-graph")


@dataclass
class Entity:
    """实体基类"""
    id: str
    type: str
    name: str
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Relation:
    """关系"""
    id: str
    from_id: str
    to_id: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class EnginePlugin(Protocol):
    """主系统引擎插件协议"""

    name: str

    async def load(self, engine: "GraphEngine") -> None:
        """加载插件"""

    async def health_check(self) -> Dict[str, Any]:
        """插件健康检查"""


class GraphEngine:
    """知识图谱引擎 (主系统)"""

    ENTITY_TYPES = ["Character", "Location", "Event", "Item", "Foreshadow", "Chapter", "Scene"]

    def __init__(self, db_path: str = None, plugins: Optional[Iterable[EnginePlugin]] = None):
        self.is_primary_engine = True
        self.plugins: List[EnginePlugin] = []
        self._plugin_health: Dict[str, Dict[str, Any]] = {}
        if db_path is None:
            db_path = get_config_value("graph.db_path", None)
        if db_path is None:
            data_dir = get_config_value("data_dir", None)
            if data_dir:
                db_path = Path(data_dir) / "graph.db"
        if db_path is None:
            db_path = Path.home() / ".niko" / "graph.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._init_schema()

        logger.info(f"Graph engine initialized: {self.db_path}")

        if plugins:
            self._register_plugins(plugins)

    def _register_plugins(self, plugins: Iterable[EnginePlugin]) -> None:
        for plugin in plugins:
            if plugin in self.plugins:
                continue
            self.plugins.append(plugin)

    async def initialize(self) -> None:
        for plugin in self.plugins:
            try:
                await plugin.load(self)
            except Exception as exc:
                logger.error(f"Graph plugin load failed: {getattr(plugin, 'name', 'unknown')}: {exc}")
                self._plugin_health[getattr(plugin, "name", "unknown")] = {
                    "status": "error",
                    "error": str(exc)
                }

    async def health_check(self) -> Dict[str, Any]:
        plugin_status = {}
        for plugin in self.plugins:
            name = getattr(plugin, "name", "unknown")
            try:
                plugin_status[name] = await plugin.health_check()
            except Exception as exc:
                plugin_status[name] = {"status": "error", "error": str(exc)}
        self._plugin_health = plugin_status
        db_ok = True
        error = None
        try:
            self.db.execute("SELECT 1")
        except Exception as exc:
            db_ok = False
            error = str(exc)
        return {
            "engine": "primary",
            "db_path": str(self.db_path),
            "db_ok": db_ok,
            "error": error,
            "plugins": plugin_status
        }

    @classmethod
    def from_config(cls, plugins: Optional[Iterable[EnginePlugin]] = None) -> "GraphEngine":
        db_path = get_config_value("graph.db_path", None)
        if db_path is None:
            data_dir = get_config_value("data_dir", None)
            if data_dir:
                db_path = Path(data_dir) / "graph.db"
        return cls(db_path=db_path, plugins=plugins)

    def _init_schema(self):
        """初始化数据库 Schema"""
        self.db.executescript("""
            -- 实体表
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                properties TEXT DEFAULT '{}',
                created_at TEXT,
                updated_at TEXT
            );

            -- 关系表
            CREATE TABLE IF NOT EXISTS relations (
                id TEXT PRIMARY KEY,
                from_id TEXT NOT NULL,
                to_id TEXT NOT NULL,
                type TEXT NOT NULL,
                properties TEXT DEFAULT '{}',
                created_at TEXT,
                FOREIGN KEY (from_id) REFERENCES entities(id),
                FOREIGN KEY (to_id) REFERENCES entities(id)
            );

            -- 索引
            CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
            CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
            CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
            CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
            CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
        """)
        self.db.commit()

    async def execute_cypher(self, cypher: str) -> list:
        """
        执行 Cypher 查询 (简化版 SQL 转换)

        支持的基本模式:
        - MATCH (n:Type) WHERE n.name = 'xxx' RETURN n
        - MATCH (a)-[r:REL]->(b) RETURN a, r, b
        """
        cypher = cypher.strip()

        # 简单的 MATCH 查询转换
        if cypher.upper().startswith("MATCH"):
            return await self._execute_match(cypher)

        # 直接 SQL (fallback)
        try:
            cursor = self.db.execute(cypher)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Query error: {e}")
            return [{"error": str(e)}]
    
    async def _execute_match(self, cypher: str) -> list:
        """解析并执行 MATCH 查询"""
        import re
        
        # 解析 (n:Type)
        node_match = re.search(r'\((\w+):(\w+)\)', cypher)
        if node_match:
            alias, entity_type = node_match.groups()
            
            # 解析 WHERE 条件
            where_match = re.search(r'WHERE\s+\w+\.(\w+)\s*=\s*[\'"](.+?)[\'"]', cypher, re.IGNORECASE)
            
            if where_match:
                field, value = where_match.groups()
                if field == "name":
                    cursor = self.db.execute(
                        "SELECT * FROM entities WHERE type = ? AND name = ?",
                        (entity_type, value)
                    )
                else:
                    # 在 properties JSON 中搜索
                    cursor = self.db.execute(
                        "SELECT * FROM entities WHERE type = ? AND json_extract(properties, ?) = ?",
                        (entity_type, f"$.{field}", value)
                    )
            else:
                cursor = self.db.execute(
                    "SELECT * FROM entities WHERE type = ?",
                    (entity_type,)
                )
            
            results = []
            rows = cursor.fetchall()
            for row in rows:
                results.append({
                    "id": row[0],
                    "type": row[1],
                    "name": row[2],
                    "properties": json.loads(row[3]) if row[3] else {}
                })
            return results
        
        return []
    
    async def get_character(
        self,
        name: str,
        include_relations: bool = True,
        include_timeline: bool = False
    ) -> dict:
        """获取角色信息"""
        cursor = self.db.execute(
            "SELECT * FROM entities WHERE type = 'Character' AND name = ?",
            (name,)
        )
        row = cursor.fetchone()
        
        if not row:
            return {"error": f"Character '{name}' not found"}
        
        character = {
            "id": row[0],
            "type": row[1],
            "name": row[2],
            "properties": json.loads(row[3]) if row[3] else {},
            "created_at": row[4],
            "updated_at": row[5]
        }
        
        if include_relations:
            character["relations"] = await self.get_relationships(name)
        
        if include_timeline:
            character["timeline"] = await self._get_character_timeline(row[0])
        
        return character
    
    async def get_relationships(
        self,
        character: str,
        relationship_type: str = None,
        depth: int = 1
    ) -> list:
        """获取角色关系网络"""
        # 先获取角色 ID
        cursor = self.db.execute(
            "SELECT id FROM entities WHERE name = ?",
            (character,)
        )
        row = cursor.fetchone()
        if not row:
            return []
        
        entity_id = row[0]
        
        # 查询关系
        sql = """
            SELECT r.id, r.type, r.properties,
                   e1.name as from_name, e2.name as to_name
            FROM relations r
            JOIN entities e1 ON r.from_id = e1.id
            JOIN entities e2 ON r.to_id = e2.id
            WHERE r.from_id = ? OR r.to_id = ?
        """
        params = [entity_id, entity_id]
        
        if relationship_type:
            sql += " AND r.type = ?"
            params.append(relationship_type)
        
        cursor = self.db.execute(sql, params)
        
        relations = []
        for row in cursor.fetchall():
            relations.append({
                "id": row[0],
                "type": row[1],
                "properties": json.loads(row[2]) if row[2] else {},
                "from": row[3],
                "to": row[4]
            })
        
        return relations
    
    async def _get_character_timeline(self, character_id: str) -> list:
        """获取角色时间线"""
        cursor = self.db.execute("""
            SELECT e.name, e.properties, r.type as relation
            FROM relations r
            JOIN entities e ON r.to_id = e.id
            WHERE r.from_id = ? AND e.type = 'Event'
            ORDER BY json_extract(e.properties, '$.time')
        """, (character_id,))
        
        return [
            {
                "event": row[0],
                "properties": json.loads(row[1]) if row[1] else {},
                "relation": row[2]
            }
            for row in cursor.fetchall()
        ]
    
    async def get_foreshadows(
        self,
        status: str = "pending",
        chapter: int = None
    ) -> list:
        """获取伏笔状态"""
        sql = "SELECT * FROM entities WHERE type = 'Foreshadow'"
        params = []
        
        if status:
            sql += " AND json_extract(properties, '$.status') = ?"
            params.append(status)
        
        if chapter:
            sql += " AND json_extract(properties, '$.planted_chapter') <= ?"
            params.append(chapter)
        
        cursor = self.db.execute(sql, params)
        
        return [
            {
                "id": row[0],
                "name": row[2],
                "properties": json.loads(row[3]) if row[3] else {},
                "created_at": row[4]
            }
            for row in cursor.fetchall()
        ]
    
    async def create_entity(
        self,
        entity_type: str,
        name: str,
        properties: dict = None
    ) -> dict:
        """创建实体"""
        if entity_type not in self.ENTITY_TYPES:
            return {"error": f"Invalid entity type: {entity_type}"}
        
        entity_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        self.db.execute(
            """INSERT INTO entities (id, type, name, properties, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entity_id, entity_type, name, json.dumps(properties or {}), now, now)
        )
        self.db.commit()
        
        logger.info(f"Created entity: {entity_type}/{name}")
        return {"id": entity_id, "status": "created"}
    
    async def create_relation(
        self,
        from_name: str,
        to_name: str,
        relation_type: str,
        properties: dict = None
    ) -> dict:
        """创建关系"""
        # 获取实体 ID
        cursor = self.db.execute(
            "SELECT id FROM entities WHERE name = ?",
            (from_name,)
        )
        from_row = cursor.fetchone()
        
        cursor = self.db.execute(
            "SELECT id FROM entities WHERE name = ?",
            (to_name,)
        )
        to_row = cursor.fetchone()
        
        if not from_row:
            return {"error": f"Entity '{from_name}' not found"}
        if not to_row:
            return {"error": f"Entity '{to_name}' not found"}
        
        relation_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        self.db.execute(
            """INSERT INTO relations (id, from_id, to_id, type, properties, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (relation_id, from_row[0], to_row[0], relation_type, json.dumps(properties or {}), now)
        )
        self.db.commit()
        
        logger.info(f"Created relation: {from_name} -[{relation_type}]-> {to_name}")
        return {"id": relation_id, "status": "created"}
    
    async def update_entity(
        self,
        name: str,
        properties: dict
    ) -> dict:
        """更新实体属性"""
        now = datetime.now().isoformat()
        
        # 获取现有属性
        cursor = self.db.execute(
            "SELECT properties FROM entities WHERE name = ?",
            (name,)
        )
        row = cursor.fetchone()
        
        if not row:
            return {"error": f"Entity '{name}' not found"}
        
        existing = json.loads(row[0]) if row[0] else {}
        existing.update(properties)
        
        self.db.execute(
            "UPDATE entities SET properties = ?, updated_at = ? WHERE name = ?",
            (json.dumps(existing), now, name)
        )
        self.db.commit()
        
        return {"status": "updated", "properties": existing}
    
    async def delete_entity(self, name: str) -> dict:
        """删除实体及其关系"""
        cursor = self.db.execute(
            "SELECT id FROM entities WHERE name = ?",
            (name,)
        )
        row = cursor.fetchone()
        
        if not row:
            return {"error": f"Entity '{name}' not found"}
        
        entity_id = row[0]
        
        # 删除关系
        self.db.execute(
            "DELETE FROM relations WHERE from_id = ? OR to_id = ?",
            (entity_id, entity_id)
        )
        
        # 删除实体
        self.db.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
        self.db.commit()
        
        logger.info(f"Deleted entity: {name}")
        return {"status": "deleted"}
    
    def close(self):
        """关闭数据库连接"""
        self.db.close()

"""
Graph 模块接口契约

定义知识图谱服务的接口规范。
"""

from typing import Protocol, List, Dict, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


# ============================================================
# 数据类型定义
# ============================================================

class EntityType(Enum):
    """实体类型"""
    CHARACTER = "character"      # 角色
    LOCATION = "location"        # 地点
    EVENT = "event"              # 事件
    OBJECT = "object"            # 物品
    ITEM = "object"              # 物品（兼容别名）
    CONCEPT = "concept"          # 概念
    RELATIONSHIP = "relationship" # 关系
    TIMELINE = "timeline"        # 时间线


class RelationType(Enum):
    """关系类型"""
    KNOWS = "KNOWS"              # 认识
    LOCATED_IN = "LOCATED_IN"    # 位于
    PARTICIPATES = "PARTICIPATES" # 参与
    OWNS = "OWNS"                # 拥有
    CAUSES = "CAUSES"            # 导致
    PRECEDES = "PRECEDES"        # 先于
    FOLLOWS = "FOLLOWS"          # 后于
    RELATED_TO = "RELATED_TO"    # 相关


@dataclass
class Entity:
    """实体结构"""
    id: str
    name: str
    type: EntityType
    properties: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Relationship:
    """关系结构"""
    id: str
    source_id: str
    target_id: str
    type: RelationType
    properties: Dict[str, Any] = field(default_factory=dict)
    weight: float = 1.0


@dataclass
class EntityStats:
    """实体统计"""
    total_entities: int
    total_relationships: int
    entities_by_type: Dict[str, int]
    relationships_by_type: Dict[str, int]
    avg_connections_per_entity: float


@dataclass
class GraphPath:
    """图路径"""
    nodes: List[Entity]
    edges: List[Relationship]
    total_weight: float


@dataclass
class SubGraph:
    """子图结构"""
    entities: List[Entity]
    relationships: List[Relationship]
    center_entity_id: Optional[str] = None


# ============================================================
# 接口定义
# ============================================================

class IGraphService(Protocol):
    """
    知识图谱服务接口
    
    负责图谱的 CRUD 操作和图查询。
    底层使用 Cypher 查询语言。
    
    Usage:
        results = graph_service.run_cypher("MATCH (n:Character) RETURN n LIMIT 10")
        stats = graph_service.get_entity_stats()
        related = graph_service.find_related_entities("entity-001")
    """
    
    def run_cypher(self, query: str) -> List[Dict[str, Any]]:
        """
        执行 Cypher 查询
        
        Args:
            query: Cypher 查询语句
            
        Returns:
            查询结果列表
        """
        ...
    
    def get_entity_stats(self) -> EntityStats:
        """
        获取实体统计信息
        
        Returns:
            实体统计对象
        """
        ...
    
    def find_related_entities(
        self, 
        entity_id: str,
        max_depth: int = 2,
        limit: int = 50
    ) -> List[Entity]:
        """
        查找相关实体
        
        Args:
            entity_id: 实体 ID
            max_depth: 最大查询深度
            limit: 返回数量限制
            
        Returns:
            相关实体列表
        """
        ...
    
    # CRUD 操作
    
    def create_entity(self, entity: Entity) -> str:
        """
        创建实体
        
        Args:
            entity: 实体对象
            
        Returns:
            实体 ID
        """
        ...
    
    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """
        获取实体
        
        Args:
            entity_id: 实体 ID
            
        Returns:
            实体对象，不存在返回 None
        """
        ...
    
    def update_entity(self, entity: Entity) -> bool:
        """
        更新实体
        
        Args:
            entity: 实体对象
            
        Returns:
            是否更新成功
        """
        ...
    
    def delete_entity(self, entity_id: str) -> bool:
        """
        删除实体
        
        同时删除关联的关系。
        
        Args:
            entity_id: 实体 ID
            
        Returns:
            是否删除成功
        """
        ...
    
    # 关系操作
    
    def create_relationship(self, relationship: Relationship) -> str:
        """
        创建关系
        
        Args:
            relationship: 关系对象
            
        Returns:
            关系 ID
        """
        ...
    
    def get_relationships(
        self, 
        entity_id: str,
        direction: str = "both"  # "in" | "out" | "both"
    ) -> List[Relationship]:
        """
        获取实体的关系
        
        Args:
            entity_id: 实体 ID
            direction: 方向过滤
            
        Returns:
            关系列表
        """
        ...
    
    def delete_relationship(self, relationship_id: str) -> bool:
        """
        删除关系
        
        Args:
            relationship_id: 关系 ID
            
        Returns:
            是否删除成功
        """
        ...
    
    # 图算法
    
    def find_shortest_path(
        self, 
        source_id: str, 
        target_id: str
    ) -> Optional[GraphPath]:
        """
        查找最短路径
        
        Args:
            source_id: 起点实体 ID
            target_id: 终点实体 ID
            
        Returns:
            路径对象，无路径返回 None
        """
        ...
    
    def get_subgraph(
        self, 
        center_id: str, 
        radius: int = 2
    ) -> SubGraph:
        """
        获取子图
        
        以指定实体为中心，获取指定半径内的子图。
        
        Args:
            center_id: 中心实体 ID
            radius: 半径（跳数）
            
        Returns:
            子图对象
        """
        ...
    
    def search_entities(
        self,
        query: str,
        entity_type: Optional[EntityType] = None,
        limit: int = 20
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
        ...

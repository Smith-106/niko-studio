"""
SessionCluster - 会话聚类管理

实现会话聚类功能:
1. SessionCluster: 聚类容器，管理相关会话的分组
2. ClusterMember: 聚类成员，记录会话在聚类中的角色
3. ClusterRelation: 聚类关系，描述聚类间的关联

与 CoreMemoryStore 集成，支持基于语义相似度的自动聚类。
"""

import json
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Union

logger = logging.getLogger("niko-session-cluster")


class MemberRole(Enum):
    """聚类成员角色"""
    PRIMARY = "primary"      # 主要会话，聚类核心
    SECONDARY = "secondary"  # 次要会话，辅助内容
    REFERENCE = "reference"  # 参考会话，仅供参照


class RelationType(Enum):
    """聚类关系类型"""
    PARENT_CHILD = "parent_child"    # 父子关系
    SIBLING = "sibling"              # 兄弟关系
    RELATED = "related"              # 相关关系
    CONTINUES = "continues"          # 延续关系
    CONFLICTS = "conflicts"          # 冲突关系


@dataclass
class ClusterMember:
    """
    聚类成员

    Attributes:
        session_id: 会话标识符
        role: 成员角色
        joined_at: 加入时间
        contribution_score: 贡献度评分 (0.0-1.0)
        metadata: 附加元数据
    """
    session_id: str
    role: MemberRole = MemberRole.SECONDARY
    joined_at: float = field(default_factory=time.time)
    contribution_score: float = 0.5
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "session_id": self.session_id,
            "role": self.role.value,
            "joined_at": self.joined_at,
            "contribution_score": self.contribution_score,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ClusterMember':
        """Create from dictionary."""
        role_value = data.get("role", "secondary")
        if isinstance(role_value, str):
            role = MemberRole(role_value)
        else:
            role = role_value

        return cls(
            session_id=data["session_id"],
            role=role,
            joined_at=data.get("joined_at", time.time()),
            contribution_score=data.get("contribution_score", 0.5),
            metadata=data.get("metadata", {})
        )


@dataclass
class ClusterRelation:
    """
    聚类关系

    Attributes:
        from_cluster: 源聚类 ID
        to_cluster: 目标聚类 ID
        relation_type: 关系类型
        strength: 关系强度 (0.0-1.0)
        created_at: 创建时间
        metadata: 附加元数据
    """
    from_cluster: str
    to_cluster: str
    relation_type: RelationType = RelationType.RELATED
    strength: float = 0.5
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "from_cluster": self.from_cluster,
            "to_cluster": self.to_cluster,
            "relation_type": self.relation_type.value,
            "strength": self.strength,
            "created_at": self.created_at,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ClusterRelation':
        """Create from dictionary."""
        relation_value = data.get("relation_type", "related")
        if isinstance(relation_value, str):
            relation_type = RelationType(relation_value)
        else:
            relation_type = relation_value

        return cls(
            from_cluster=data["from_cluster"],
            to_cluster=data["to_cluster"],
            relation_type=relation_type,
            strength=data.get("strength", 0.5),
            created_at=data.get("created_at", time.time()),
            metadata=data.get("metadata", {})
        )


@dataclass
class SessionCluster:
    """
    会话聚类

    Attributes:
        cluster_id: 聚类唯一标识
        name: 聚类名称
        description: 聚类描述
        members: 成员列表
        relations: 与其他聚类的关系
        created_at: 创建时间
        updated_at: 更新时间
        metadata: 附加元数据
        importance: 重要性评分 (0.0-1.0)
        archived: 是否归档
    """
    cluster_id: str
    name: str
    description: str = ""
    members: List[ClusterMember] = field(default_factory=list)
    relations: List[ClusterRelation] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    importance: float = 0.5
    archived: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "cluster_id": self.cluster_id,
            "name": self.name,
            "description": self.description,
            "members": [m.to_dict() for m in self.members],
            "relations": [r.to_dict() for r in self.relations],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
            "importance": self.importance,
            "archived": self.archived
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionCluster':
        """Create from dictionary."""
        members = [
            ClusterMember.from_dict(m) if isinstance(m, dict) else m
            for m in data.get("members", [])
        ]
        relations = [
            ClusterRelation.from_dict(r) if isinstance(r, dict) else r
            for r in data.get("relations", [])
        ]

        return cls(
            cluster_id=data["cluster_id"],
            name=data["name"],
            description=data.get("description", ""),
            members=members,
            relations=relations,
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            metadata=data.get("metadata", {}),
            importance=data.get("importance", 0.5),
            archived=data.get("archived", False)
        )

    def get_member(self, session_id: str) -> Optional[ClusterMember]:
        """Get member by session ID."""
        for member in self.members:
            if member.session_id == session_id:
                return member
        return None

    def get_primary_members(self) -> List[ClusterMember]:
        """Get all primary members."""
        return [m for m in self.members if m.role == MemberRole.PRIMARY]

    def get_session_ids(self) -> List[str]:
        """Get all session IDs in cluster."""
        return [m.session_id for m in self.members]


class SessionClusterManager:
    """
    会话聚类管理器

    Features:
    - CRUD operations for clusters
    - Member management (add/remove/update role)
    - Relation management between clusters
    - Cluster merging
    - Integration with CoreMemoryStore for semantic clustering
    """

    def __init__(
        self,
        storage_path: Union[str, Path] = ".writing/clusters",
        core_memory_store=None
    ):
        """
        Initialize SessionClusterManager.

        Args:
            storage_path: Directory for cluster storage
            core_memory_store: Optional CoreMemoryStore for semantic operations
        """
        self.storage_path = Path(storage_path)
        self.core_memory_store = core_memory_store
        self._clusters: Dict[str, SessionCluster] = {}
        self._session_to_clusters: Dict[str, Set[str]] = {}

        self._ensure_storage()
        self._load_clusters()

    def _ensure_storage(self):
        """Create storage directory if needed."""
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _load_clusters(self):
        """Load clusters from storage."""
        index_path = self.storage_path / "index.json"
        if not index_path.exists():
            return

        try:
            index = json.loads(index_path.read_text(encoding="utf-8"))
            for cluster_id in index.get("clusters", []):
                cluster_file = self.storage_path / f"{cluster_id}.json"
                if cluster_file.exists():
                    data = json.loads(cluster_file.read_text(encoding="utf-8"))
                    cluster = SessionCluster.from_dict(data)
                    self._clusters[cluster_id] = cluster

                    # Build session index
                    for member in cluster.members:
                        if member.session_id not in self._session_to_clusters:
                            self._session_to_clusters[member.session_id] = set()
                        self._session_to_clusters[member.session_id].add(cluster_id)

            logger.info(f"Loaded {len(self._clusters)} clusters")
        except Exception as e:
            logger.error(f"Failed to load clusters: {e}")

    def _save_cluster(self, cluster: SessionCluster):
        """Save cluster to storage."""
        cluster_file = self.storage_path / f"{cluster.cluster_id}.json"
        cluster_file.write_text(
            json.dumps(cluster.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        self._save_index()

    def _save_index(self):
        """Save cluster index."""
        index = {
            "clusters": list(self._clusters.keys()),
            "updated_at": time.time()
        }
        index_path = self.storage_path / "index.json"
        index_path.write_text(
            json.dumps(index, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def _generate_id(self) -> str:
        """Generate unique cluster ID."""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique = uuid.uuid4().hex[:8]
        return f"cluster-{timestamp}-{unique}"

    # ========== Cluster CRUD ==========

    def create_cluster(
        self,
        name: str,
        description: str = "",
        initial_members: List[str] = None,
        importance: float = 0.5,
        metadata: Dict[str, Any] = None
    ) -> SessionCluster:
        """
        Create a new cluster.

        Args:
            name: Cluster name
            description: Cluster description
            initial_members: Initial session IDs to add
            importance: Importance score
            metadata: Additional metadata

        Returns:
            Created SessionCluster
        """
        cluster_id = self._generate_id()
        now = time.time()

        cluster = SessionCluster(
            cluster_id=cluster_id,
            name=name,
            description=description,
            members=[],
            relations=[],
            created_at=now,
            updated_at=now,
            metadata=metadata or {},
            importance=importance
        )

        # Add initial members
        if initial_members:
            for i, session_id in enumerate(initial_members):
                role = MemberRole.PRIMARY if i == 0 else MemberRole.SECONDARY
                member = ClusterMember(
                    session_id=session_id,
                    role=role,
                    joined_at=now
                )
                cluster.members.append(member)

                if session_id not in self._session_to_clusters:
                    self._session_to_clusters[session_id] = set()
                self._session_to_clusters[session_id].add(cluster_id)

        self._clusters[cluster_id] = cluster
        self._save_cluster(cluster)

        logger.info(f"Created cluster: {cluster_id} ({name})")
        return cluster

    def get_cluster(self, cluster_id: str) -> Optional[SessionCluster]:
        """
        Get cluster by ID.

        Args:
            cluster_id: Cluster identifier

        Returns:
            SessionCluster or None
        """
        return self._clusters.get(cluster_id)

    def update_cluster(
        self,
        cluster_id: str,
        name: str = None,
        description: str = None,
        importance: float = None,
        metadata: Dict[str, Any] = None
    ) -> Optional[SessionCluster]:
        """
        Update cluster properties.

        Args:
            cluster_id: Cluster identifier
            name: New name (optional)
            description: New description (optional)
            importance: New importance (optional)
            metadata: Metadata to merge (optional)

        Returns:
            Updated SessionCluster or None
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return None

        if name is not None:
            cluster.name = name
        if description is not None:
            cluster.description = description
        if importance is not None:
            cluster.importance = importance
        if metadata:
            cluster.metadata.update(metadata)

        cluster.updated_at = time.time()
        self._save_cluster(cluster)

        logger.info(f"Updated cluster: {cluster_id}")
        return cluster

    def delete_cluster(self, cluster_id: str) -> bool:
        """
        Delete a cluster.

        Args:
            cluster_id: Cluster identifier

        Returns:
            True if deleted
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False

        # Remove from session index
        for member in cluster.members:
            if member.session_id in self._session_to_clusters:
                self._session_to_clusters[member.session_id].discard(cluster_id)

        # Remove relations referencing this cluster
        for other_cluster in self._clusters.values():
            other_cluster.relations = [
                r for r in other_cluster.relations
                if isinstance(r, ClusterRelation)
                and r.from_cluster != cluster_id
                and r.to_cluster != cluster_id
            ]

        # Delete from storage
        cluster_file = self.storage_path / f"{cluster_id}.json"
        if cluster_file.exists():
            cluster_file.unlink()

        del self._clusters[cluster_id]
        self._save_index()

        logger.info(f"Deleted cluster: {cluster_id}")
        return True

    def archive_cluster(self, cluster_id: str) -> bool:
        """
        Archive a cluster (soft delete).

        Args:
            cluster_id: Cluster identifier

        Returns:
            True if archived
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False

        cluster.archived = True
        cluster.updated_at = time.time()
        self._save_cluster(cluster)

        logger.info(f"Archived cluster: {cluster_id}")
        return True

    # ========== Member Management ==========

    def add_member(
        self,
        cluster_id: str,
        session_id: str,
        role: MemberRole = MemberRole.SECONDARY,
        contribution_score: float = 0.5,
        metadata: Dict[str, Any] = None
    ) -> Optional[ClusterMember]:
        """
        Add a member to cluster.

        Args:
            cluster_id: Cluster identifier
            session_id: Session to add
            role: Member role
            contribution_score: Contribution score
            metadata: Additional metadata

        Returns:
            Created ClusterMember or None
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return None

        # Check if already member
        if cluster.get_member(session_id):
            logger.warning(f"Session {session_id} already in cluster {cluster_id}")
            return cluster.get_member(session_id)

        member = ClusterMember(
            session_id=session_id,
            role=role,
            joined_at=time.time(),
            contribution_score=contribution_score,
            metadata=metadata or {}
        )

        cluster.members.append(member)
        cluster.updated_at = time.time()

        # Update session index
        if session_id not in self._session_to_clusters:
            self._session_to_clusters[session_id] = set()
        self._session_to_clusters[session_id].add(cluster_id)

        self._save_cluster(cluster)

        logger.info(f"Added member {session_id} to cluster {cluster_id}")
        return member

    def remove_member(self, cluster_id: str, session_id: str) -> bool:
        """
        Remove a member from cluster.

        Args:
            cluster_id: Cluster identifier
            session_id: Session to remove

        Returns:
            True if removed
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False

        original_count = len(cluster.members)
        cluster.members = [m for m in cluster.members if m.session_id != session_id]

        if len(cluster.members) == original_count:
            return False

        cluster.updated_at = time.time()

        # Update session index
        if session_id in self._session_to_clusters:
            self._session_to_clusters[session_id].discard(cluster_id)

        self._save_cluster(cluster)

        logger.info(f"Removed member {session_id} from cluster {cluster_id}")
        return True

    def update_member_role(
        self,
        cluster_id: str,
        session_id: str,
        role: MemberRole
    ) -> bool:
        """
        Update member role.

        Args:
            cluster_id: Cluster identifier
            session_id: Session identifier
            role: New role

        Returns:
            True if updated
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return False

        member = cluster.get_member(session_id)
        if not member:
            return False

        member.role = role
        cluster.updated_at = time.time()
        self._save_cluster(cluster)

        logger.info(f"Updated role for {session_id} in {cluster_id} to {role.value}")
        return True

    # ========== Relation Management ==========

    def add_relation(
        self,
        from_cluster: str,
        to_cluster: str,
        relation_type: RelationType = RelationType.RELATED,
        strength: float = 0.5,
        metadata: Dict[str, Any] = None
    ) -> Optional[ClusterRelation]:
        """
        Add relation between clusters.

        Args:
            from_cluster: Source cluster ID
            to_cluster: Target cluster ID
            relation_type: Type of relation
            strength: Relation strength
            metadata: Additional metadata

        Returns:
            Created ClusterRelation or None
        """
        source = self._clusters.get(from_cluster)
        target = self._clusters.get(to_cluster)

        if not source or not target:
            return None

        # Check for existing relation
        for rel in source.relations:
            if rel.to_cluster == to_cluster:
                logger.warning(f"Relation already exists: {from_cluster} -> {to_cluster}")
                return rel

        relation = ClusterRelation(
            from_cluster=from_cluster,
            to_cluster=to_cluster,
            relation_type=relation_type,
            strength=strength,
            created_at=time.time(),
            metadata=metadata or {}
        )

        source.relations.append(relation)
        source.updated_at = time.time()
        self._save_cluster(source)

        logger.info(f"Added relation: {from_cluster} -> {to_cluster} ({relation_type.value})")
        return relation

    def remove_relation(self, from_cluster: str, to_cluster: str) -> bool:
        """
        Remove relation between clusters.

        Args:
            from_cluster: Source cluster ID
            to_cluster: Target cluster ID

        Returns:
            True if removed
        """
        source = self._clusters.get(from_cluster)
        if not source:
            return False

        original_count = len(source.relations)
        source.relations = [r for r in source.relations if r.to_cluster != to_cluster]

        if len(source.relations) == original_count:
            return False

        source.updated_at = time.time()
        self._save_cluster(source)

        logger.info(f"Removed relation: {from_cluster} -> {to_cluster}")
        return True

    def get_related_clusters(
        self,
        cluster_id: str,
        relation_type: RelationType = None
    ) -> List[SessionCluster]:
        """
        Get clusters related to given cluster.

        Args:
            cluster_id: Cluster identifier
            relation_type: Filter by relation type (optional)

        Returns:
            List of related clusters
        """
        cluster = self._clusters.get(cluster_id)
        if not cluster:
            return []

        related = []
        for relation in cluster.relations:
            if relation_type and relation.relation_type != relation_type:
                continue
            target = self._clusters.get(relation.to_cluster)
            if target:
                related.append(target)

        return related

    # ========== Cluster Operations ==========

    def merge_clusters(
        self,
        cluster_ids: List[str],
        new_name: str,
        new_description: str = ""
    ) -> Optional[SessionCluster]:
        """
        Merge multiple clusters into one.

        Args:
            cluster_ids: List of cluster IDs to merge
            new_name: Name for merged cluster
            new_description: Description for merged cluster

        Returns:
            New merged SessionCluster or None
        """
        if len(cluster_ids) < 2:
            logger.warning("Need at least 2 clusters to merge")
            return None

        # Collect all clusters
        clusters = []
        for cid in cluster_ids:
            cluster = self._clusters.get(cid)
            if cluster:
                clusters.append(cluster)

        if len(clusters) < 2:
            logger.warning("Not enough valid clusters to merge")
            return None

        # Collect all members (deduplicated)
        all_members: Dict[str, ClusterMember] = {}
        for cluster in clusters:
            for member in cluster.members:
                if member.session_id not in all_members:
                    all_members[member.session_id] = member
                else:
                    # Keep higher role
                    existing = all_members[member.session_id]
                    if member.role == MemberRole.PRIMARY:
                        all_members[member.session_id] = member
                    elif member.contribution_score > existing.contribution_score:
                        all_members[member.session_id] = member

        # Collect all external relations
        all_relations: List[ClusterRelation] = []
        merged_ids = set(cluster_ids)
        for cluster in clusters:
            for relation in cluster.relations:
                if relation.to_cluster not in merged_ids:
                    all_relations.append(relation)

        # Calculate importance (max of merged)
        importance = max(c.importance for c in clusters)

        # Merge metadata
        merged_metadata = {}
        for cluster in clusters:
            merged_metadata.update(cluster.metadata)
        merged_metadata["merged_from"] = cluster_ids

        # Create new cluster
        merged_name = new_name.strip() if isinstance(new_name, str) else ""
        if not merged_name:
            cluster_names = [c.name for c in clusters if c.name]
            merged_name = f"Merged: {' + '.join(cluster_names)}" if cluster_names else "Merged"

        new_cluster = self.create_cluster(
            name=merged_name,
            description=new_description,
            importance=importance,
            metadata=merged_metadata
        )

        # Add all members
        for member in all_members.values():
            self.add_member(
                new_cluster.cluster_id,
                member.session_id,
                member.role,
                member.contribution_score,
                member.metadata
            )

        # Add all external relations (update from_cluster)
        for relation in all_relations:
            self.add_relation(
                new_cluster.cluster_id,
                relation.to_cluster,
                relation.relation_type,
                relation.strength,
                relation.metadata
            )

        # Delete old clusters
        for cid in cluster_ids:
            self.delete_cluster(cid)

        logger.info(f"Merged {len(clusters)} clusters into {new_cluster.cluster_id}")
        return new_cluster

    def get_clusters_for_session(self, session_id: str) -> List[SessionCluster]:
        """
        Get all clusters containing a session.

        Args:
            session_id: Session identifier

        Returns:
            List of SessionCluster objects
        """
        cluster_ids = self._session_to_clusters.get(session_id, set())
        return [self._clusters[cid] for cid in cluster_ids if cid in self._clusters]

    def list_clusters(
        self,
        include_archived: bool = False,
        limit: int = 100
    ) -> List[SessionCluster]:
        """
        List all clusters.

        Args:
            include_archived: Whether to include archived clusters
            limit: Maximum number to return

        Returns:
            List of SessionCluster objects
        """
        clusters = []
        for cluster in self._clusters.values():
            if not include_archived and cluster.archived:
                continue
            clusters.append(cluster)
            if len(clusters) >= limit:
                break

        # Sort by updated_at descending
        clusters.sort(key=lambda c: c.updated_at, reverse=True)
        return clusters

    def search_clusters(
        self,
        query: str,
        top_k: int = 5
    ) -> List[SessionCluster]:
        """
        Search clusters by name/description.

        Args:
            query: Search query
            top_k: Maximum results

        Returns:
            Matching clusters
        """
        query_lower = query.lower()
        matches = []

        for cluster in self._clusters.values():
            if cluster.archived:
                continue

            score = 0
            if query_lower in cluster.name.lower():
                score += 2
            if query_lower in cluster.description.lower():
                score += 1

            if score > 0:
                matches.append((cluster, score))

        # Sort by score descending
        matches.sort(key=lambda x: x[1], reverse=True)
        return [m[0] for m in matches[:top_k]]

    def stats(self) -> Dict[str, Any]:
        """Get cluster statistics."""
        active_clusters = [c for c in self._clusters.values() if not c.archived]
        total_members = sum(len(c.members) for c in active_clusters)
        total_relations = sum(len(c.relations) for c in active_clusters)

        return {
            "total_clusters": len(self._clusters),
            "active_clusters": len(active_clusters),
            "archived_clusters": len(self._clusters) - len(active_clusters),
            "total_members": total_members,
            "total_relations": total_relations,
            "unique_sessions": len(self._session_to_clusters)
        }

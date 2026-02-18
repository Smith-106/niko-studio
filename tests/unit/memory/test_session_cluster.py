"""
Session Cluster Tests

Tests for MemberRole, RelationType, ClusterMember, ClusterRelation,
SessionCluster, and SessionClusterManager (CRUD, member management,
relation management, merge, search, stats).
"""

import json
import pytest
import time
from pathlib import Path
from src.memory.session_cluster import (
    MemberRole,
    RelationType,
    ClusterMember,
    ClusterRelation,
    SessionCluster,
    SessionClusterManager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestEnums:

    def test_member_roles(self):
        assert MemberRole.PRIMARY.value == "primary"
        assert MemberRole.SECONDARY.value == "secondary"
        assert MemberRole.REFERENCE.value == "reference"

    def test_relation_types(self):
        assert RelationType.PARENT_CHILD.value == "parent_child"
        assert RelationType.SIBLING.value == "sibling"
        assert RelationType.RELATED.value == "related"
        assert RelationType.CONTINUES.value == "continues"
        assert RelationType.CONFLICTS.value == "conflicts"


# ============================================================
# ClusterMember Tests
# ============================================================

class TestClusterMember:

    def test_defaults(self):
        m = ClusterMember(session_id="s1")
        assert m.role == MemberRole.SECONDARY
        assert m.contribution_score == 0.5
        assert m.metadata == {}

    def test_to_dict(self):
        m = ClusterMember(
            session_id="s1",
            role=MemberRole.PRIMARY,
            contribution_score=0.9,
        )
        d = m.to_dict()
        assert d["session_id"] == "s1"
        assert d["role"] == "primary"
        assert d["contribution_score"] == 0.9

    def test_from_dict(self):
        data = {
            "session_id": "s1",
            "role": "primary",
            "contribution_score": 0.8,
        }
        m = ClusterMember.from_dict(data)
        assert m.session_id == "s1"
        assert m.role == MemberRole.PRIMARY
        assert m.contribution_score == 0.8

    def test_from_dict_defaults(self):
        data = {"session_id": "s1"}
        m = ClusterMember.from_dict(data)
        assert m.role == MemberRole.SECONDARY
        assert m.contribution_score == 0.5

    def test_roundtrip(self):
        original = ClusterMember(
            session_id="s1",
            role=MemberRole.REFERENCE,
            contribution_score=0.3,
            metadata={"key": "val"},
        )
        d = original.to_dict()
        restored = ClusterMember.from_dict(d)
        assert restored.session_id == original.session_id
        assert restored.role == original.role
        assert restored.contribution_score == original.contribution_score


# ============================================================
# ClusterRelation Tests
# ============================================================

class TestClusterRelation:

    def test_defaults(self):
        r = ClusterRelation(from_cluster="c1", to_cluster="c2")
        assert r.relation_type == RelationType.RELATED
        assert r.strength == 0.5

    def test_to_dict(self):
        r = ClusterRelation(
            from_cluster="c1",
            to_cluster="c2",
            relation_type=RelationType.PARENT_CHILD,
            strength=0.9,
        )
        d = r.to_dict()
        assert d["from_cluster"] == "c1"
        assert d["relation_type"] == "parent_child"

    def test_from_dict(self):
        data = {
            "from_cluster": "c1",
            "to_cluster": "c2",
            "relation_type": "continues",
            "strength": 0.7,
        }
        r = ClusterRelation.from_dict(data)
        assert r.relation_type == RelationType.CONTINUES
        assert r.strength == 0.7

    def test_roundtrip(self):
        original = ClusterRelation(
            from_cluster="c1",
            to_cluster="c2",
            relation_type=RelationType.CONFLICTS,
            strength=0.4,
            metadata={"reason": "test"},
        )
        d = original.to_dict()
        restored = ClusterRelation.from_dict(d)
        assert restored.from_cluster == original.from_cluster
        assert restored.relation_type == original.relation_type


# ============================================================
# SessionCluster Tests
# ============================================================

class TestSessionCluster:

    def test_defaults(self):
        sc = SessionCluster(cluster_id="c1", name="Test")
        assert sc.description == ""
        assert sc.members == []
        assert sc.relations == []
        assert sc.importance == 0.5
        assert sc.archived is False

    def test_to_dict(self):
        m = ClusterMember(session_id="s1", role=MemberRole.PRIMARY)
        sc = SessionCluster(
            cluster_id="c1",
            name="Test",
            members=[m],
        )
        d = sc.to_dict()
        assert d["cluster_id"] == "c1"
        assert len(d["members"]) == 1
        assert d["members"][0]["session_id"] == "s1"

    def test_from_dict(self):
        data = {
            "cluster_id": "c1",
            "name": "Test",
            "members": [
                {"session_id": "s1", "role": "primary"},
            ],
            "relations": [],
        }
        sc = SessionCluster.from_dict(data)
        assert sc.cluster_id == "c1"
        assert len(sc.members) == 1
        assert sc.members[0].role == MemberRole.PRIMARY

    def test_get_member(self):
        m1 = ClusterMember(session_id="s1")
        m2 = ClusterMember(session_id="s2")
        sc = SessionCluster(cluster_id="c1", name="Test", members=[m1, m2])
        assert sc.get_member("s1") is m1
        assert sc.get_member("s3") is None

    def test_get_primary_members(self):
        m1 = ClusterMember(session_id="s1", role=MemberRole.PRIMARY)
        m2 = ClusterMember(session_id="s2", role=MemberRole.SECONDARY)
        m3 = ClusterMember(session_id="s3", role=MemberRole.PRIMARY)
        sc = SessionCluster(cluster_id="c1", name="Test", members=[m1, m2, m3])
        primaries = sc.get_primary_members()
        assert len(primaries) == 2

    def test_get_session_ids(self):
        m1 = ClusterMember(session_id="s1")
        m2 = ClusterMember(session_id="s2")
        sc = SessionCluster(cluster_id="c1", name="Test", members=[m1, m2])
        ids = sc.get_session_ids()
        assert ids == ["s1", "s2"]


# ============================================================
# SessionClusterManager Tests
# ============================================================

class TestSessionClusterManager:

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        self.mgr = SessionClusterManager(storage_path=tmp_path / "clusters")

    def test_create_cluster(self):
        cluster = self.mgr.create_cluster("Test Cluster")
        assert cluster.name == "Test Cluster"
        assert cluster.cluster_id.startswith("cluster-")

    def test_create_cluster_with_members(self):
        cluster = self.mgr.create_cluster(
            "Test",
            initial_members=["s1", "s2"],
        )
        assert len(cluster.members) == 2
        assert cluster.members[0].role == MemberRole.PRIMARY
        assert cluster.members[1].role == MemberRole.SECONDARY

    def test_get_cluster(self):
        cluster = self.mgr.create_cluster("Test")
        fetched = self.mgr.get_cluster(cluster.cluster_id)
        assert fetched is not None
        assert fetched.name == "Test"

    def test_get_cluster_not_found(self):
        assert self.mgr.get_cluster("nonexistent") is None

    def test_update_cluster(self):
        cluster = self.mgr.create_cluster("Old Name")
        updated = self.mgr.update_cluster(
            cluster.cluster_id,
            name="New Name",
            importance=0.9,
        )
        assert updated.name == "New Name"
        assert updated.importance == 0.9

    def test_update_cluster_not_found(self):
        assert self.mgr.update_cluster("nonexistent", name="X") is None

    def test_delete_cluster(self):
        cluster = self.mgr.create_cluster("Test", initial_members=["s1"])
        deleted = self.mgr.delete_cluster(cluster.cluster_id)
        assert deleted is True
        assert self.mgr.get_cluster(cluster.cluster_id) is None

    def test_delete_cluster_not_found(self):
        assert self.mgr.delete_cluster("nonexistent") is False

    def test_archive_cluster(self):
        cluster = self.mgr.create_cluster("Test")
        archived = self.mgr.archive_cluster(cluster.cluster_id)
        assert archived is True
        fetched = self.mgr.get_cluster(cluster.cluster_id)
        assert fetched.archived is True

    def test_archive_cluster_not_found(self):
        assert self.mgr.archive_cluster("nonexistent") is False

    def test_add_member(self):
        cluster = self.mgr.create_cluster("Test")
        member = self.mgr.add_member(
            cluster.cluster_id,
            "s1",
            role=MemberRole.PRIMARY,
        )
        assert member is not None
        assert member.role == MemberRole.PRIMARY

    def test_add_member_duplicate(self):
        cluster = self.mgr.create_cluster("Test")
        self.mgr.add_member(cluster.cluster_id, "s1")
        # Adding again returns existing
        member = self.mgr.add_member(cluster.cluster_id, "s1")
        assert member is not None
        fetched = self.mgr.get_cluster(cluster.cluster_id)
        assert len(fetched.members) == 1

    def test_add_member_invalid_cluster(self):
        assert self.mgr.add_member("nonexistent", "s1") is None

    def test_remove_member(self):
        cluster = self.mgr.create_cluster("Test", initial_members=["s1", "s2"])
        removed = self.mgr.remove_member(cluster.cluster_id, "s1")
        assert removed is True
        fetched = self.mgr.get_cluster(cluster.cluster_id)
        assert len(fetched.members) == 1

    def test_remove_member_not_found(self):
        cluster = self.mgr.create_cluster("Test")
        assert self.mgr.remove_member(cluster.cluster_id, "nonexistent") is False

    def test_update_member_role(self):
        cluster = self.mgr.create_cluster("Test", initial_members=["s1"])
        updated = self.mgr.update_member_role(
            cluster.cluster_id,
            "s1",
            MemberRole.REFERENCE,
        )
        assert updated is True

    def test_update_member_role_not_found(self):
        cluster = self.mgr.create_cluster("Test")
        assert self.mgr.update_member_role(
            cluster.cluster_id, "nonexistent", MemberRole.PRIMARY
        ) is False

    def test_add_relation(self):
        c1 = self.mgr.create_cluster("C1")
        c2 = self.mgr.create_cluster("C2")
        rel = self.mgr.add_relation(
            c1.cluster_id,
            c2.cluster_id,
            RelationType.PARENT_CHILD,
        )
        assert rel is not None
        assert rel.relation_type == RelationType.PARENT_CHILD

    def test_add_relation_duplicate(self):
        c1 = self.mgr.create_cluster("C1")
        c2 = self.mgr.create_cluster("C2")
        self.mgr.add_relation(c1.cluster_id, c2.cluster_id)
        # Adding again returns existing
        rel = self.mgr.add_relation(c1.cluster_id, c2.cluster_id)
        assert rel is not None

    def test_add_relation_invalid_cluster(self):
        c1 = self.mgr.create_cluster("C1")
        assert self.mgr.add_relation(c1.cluster_id, "nonexistent") is None

    def test_remove_relation(self):
        c1 = self.mgr.create_cluster("C1")
        c2 = self.mgr.create_cluster("C2")
        self.mgr.add_relation(c1.cluster_id, c2.cluster_id)
        removed = self.mgr.remove_relation(c1.cluster_id, c2.cluster_id)
        assert removed is True

    def test_remove_relation_not_found(self):
        c1 = self.mgr.create_cluster("C1")
        assert self.mgr.remove_relation(c1.cluster_id, "nonexistent") is False

    def test_get_related_clusters(self):
        c1 = self.mgr.create_cluster("C1")
        c2 = self.mgr.create_cluster("C2")
        c3 = self.mgr.create_cluster("C3")
        self.mgr.add_relation(c1.cluster_id, c2.cluster_id, RelationType.SIBLING)
        self.mgr.add_relation(c1.cluster_id, c3.cluster_id, RelationType.PARENT_CHILD)
        related = self.mgr.get_related_clusters(c1.cluster_id)
        assert len(related) == 2

    def test_get_related_clusters_filtered(self):
        c1 = self.mgr.create_cluster("C1")
        c2 = self.mgr.create_cluster("C2")
        c3 = self.mgr.create_cluster("C3")
        self.mgr.add_relation(c1.cluster_id, c2.cluster_id, RelationType.SIBLING)
        self.mgr.add_relation(c1.cluster_id, c3.cluster_id, RelationType.PARENT_CHILD)
        related = self.mgr.get_related_clusters(
            c1.cluster_id, relation_type=RelationType.SIBLING
        )
        assert len(related) == 1

    def test_merge_clusters(self):
        c1 = self.mgr.create_cluster("C1", initial_members=["s1"])
        c2 = self.mgr.create_cluster("C2", initial_members=["s2"])
        merged = self.mgr.merge_clusters(
            [c1.cluster_id, c2.cluster_id],
            new_name="Merged",
        )
        assert merged is not None
        assert merged.name == "Merged"
        assert len(merged.members) == 2
        # Old clusters should be deleted
        assert self.mgr.get_cluster(c1.cluster_id) is None
        assert self.mgr.get_cluster(c2.cluster_id) is None

    def test_merge_clusters_too_few(self):
        c1 = self.mgr.create_cluster("C1")
        assert self.mgr.merge_clusters([c1.cluster_id], "Merged") is None

    def test_merge_clusters_dedup_members(self):
        c1 = self.mgr.create_cluster("C1", initial_members=["s1"])
        c2 = self.mgr.create_cluster("C2", initial_members=["s1"])
        merged = self.mgr.merge_clusters(
            [c1.cluster_id, c2.cluster_id],
            new_name="Merged",
        )
        # s1 appears in both, should be deduplicated
        assert len(merged.members) == 1

    def test_get_clusters_for_session(self):
        c1 = self.mgr.create_cluster("C1", initial_members=["s1"])
        c2 = self.mgr.create_cluster("C2", initial_members=["s1", "s2"])
        clusters = self.mgr.get_clusters_for_session("s1")
        assert len(clusters) == 2

    def test_get_clusters_for_session_none(self):
        clusters = self.mgr.get_clusters_for_session("nonexistent")
        assert clusters == []

    def test_list_clusters(self):
        self.mgr.create_cluster("C1")
        self.mgr.create_cluster("C2")
        clusters = self.mgr.list_clusters()
        assert len(clusters) == 2

    def test_list_clusters_exclude_archived(self):
        c1 = self.mgr.create_cluster("C1")
        self.mgr.create_cluster("C2")
        self.mgr.archive_cluster(c1.cluster_id)
        clusters = self.mgr.list_clusters(include_archived=False)
        assert len(clusters) == 1

    def test_list_clusters_include_archived(self):
        c1 = self.mgr.create_cluster("C1")
        self.mgr.create_cluster("C2")
        self.mgr.archive_cluster(c1.cluster_id)
        clusters = self.mgr.list_clusters(include_archived=True)
        assert len(clusters) == 2

    def test_list_clusters_limit(self):
        for i in range(5):
            self.mgr.create_cluster(f"C{i}")
        clusters = self.mgr.list_clusters(limit=2)
        assert len(clusters) == 2

    def test_search_clusters_by_name(self):
        self.mgr.create_cluster("Alpha Project")
        self.mgr.create_cluster("Beta Project")
        self.mgr.create_cluster("Gamma System")
        results = self.mgr.search_clusters("project")
        assert len(results) == 2

    def test_search_clusters_by_description(self):
        self.mgr.create_cluster("C1", description="Contains alpha keywords")
        self.mgr.create_cluster("C2", description="Contains beta keywords")
        results = self.mgr.search_clusters("alpha")
        assert len(results) == 1

    def test_search_clusters_no_match(self):
        self.mgr.create_cluster("C1")
        results = self.mgr.search_clusters("nonexistent")
        assert len(results) == 0

    def test_stats(self):
        self.mgr.create_cluster("C1", initial_members=["s1", "s2"])
        c2 = self.mgr.create_cluster("C2", initial_members=["s3"])
        self.mgr.archive_cluster(c2.cluster_id)

        stats = self.mgr.stats()
        assert stats["total_clusters"] == 2
        assert stats["active_clusters"] == 1
        assert stats["archived_clusters"] == 1
        assert stats["total_members"] == 2  # Only active cluster members
        assert stats["unique_sessions"] == 3





class TestSessionClusterCoverageClosure:
    def test_load_clusters_session_index_and_corrupt_index_path(self, tmp_path):
        storage = tmp_path / "clusters"
        storage.mkdir(parents=True, exist_ok=True)

        cluster = SessionCluster(
            cluster_id="cluster-load-1",
            name="Loaded",
            members=[ClusterMember(session_id="s-load")],
        )
        (storage / "cluster-load-1.json").write_text(
            json.dumps(cluster.to_dict(), ensure_ascii=False),
            encoding="utf-8",
        )
        (storage / "index.json").write_text('{"clusters":["cluster-load-1"]}', encoding="utf-8")

        mgr = SessionClusterManager(storage_path=storage)
        assert "cluster-load-1" in mgr._clusters
        assert "cluster-load-1" in mgr._session_to_clusters["s-load"]

        (storage / "index.json").write_text("{bad", encoding="utf-8")
        mgr._load_clusters()  # should hit error branch and not raise

    def test_update_cluster_description_and_metadata_branches(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c = mgr.create_cluster("C")
        updated = mgr.update_cluster(c.cluster_id, description="desc", metadata={"k": "v"})
        assert updated.description == "desc"
        assert updated.metadata["k"] == "v"

    def test_remove_and_update_member_role_missing_cluster(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        assert mgr.remove_member("missing", "s") is False
        assert mgr.update_member_role("missing", "s", MemberRole.PRIMARY) is False

    def test_remove_relation_missing_source_cluster(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        assert mgr.remove_relation("missing", "to") is False

    def test_merge_prefers_higher_contribution_for_same_role(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c1 = mgr.create_cluster("C1")
        c2 = mgr.create_cluster("C2")

        mgr.add_member(c1.cluster_id, "same", role=MemberRole.SECONDARY, contribution_score=0.2)
        mgr.add_member(c2.cluster_id, "same", role=MemberRole.SECONDARY, contribution_score=0.9)

        merged = mgr.merge_clusters([c1.cluster_id, c2.cluster_id], new_name="Merged")
        assert merged is not None
        member = merged.get_member("same")
        assert member is not None
        assert member.contribution_score == 0.9

    def test_merge_excludes_internal_relations_but_keeps_external(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c1 = mgr.create_cluster("C1")
        c2 = mgr.create_cluster("C2")
        c3 = mgr.create_cluster("C3")

        mgr.add_relation(c1.cluster_id, c2.cluster_id, RelationType.RELATED)
        mgr.add_relation(c1.cluster_id, c3.cluster_id, RelationType.RELATED)

        merged = mgr.merge_clusters([c1.cluster_id, c2.cluster_id], new_name="Merged")
        assert merged is not None
        assert all(r.to_cluster != c2.cluster_id for r in merged.relations)
        assert any(r.to_cluster == c3.cluster_id for r in merged.relations)

    def test_merge_relations_no_external_targets_and_search_archived_skip(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c1 = mgr.create_cluster("Alpha")
        c2 = mgr.create_cluster("Beta")

        mgr.add_relation(c1.cluster_id, c2.cluster_id, RelationType.RELATED)
        merged = mgr.merge_clusters([c1.cluster_id, c2.cluster_id], new_name="Merged")
        assert merged is not None
        assert merged.relations == []

        archive_target = mgr.create_cluster("Query Name", description="q")
        mgr.archive_cluster(archive_target.cluster_id)
        assert mgr.search_clusters("query") == []


class TestSessionClusterUncoveredBranches:
    def test_member_and_relation_from_dict_non_string_enum_passthrough(self):
        m = ClusterMember.from_dict({"session_id": "s", "role": MemberRole.PRIMARY})
        assert m.role == MemberRole.PRIMARY

        r = ClusterRelation.from_dict(
            {"from_cluster": "a", "to_cluster": "b", "relation_type": RelationType.SIBLING}
        )
        assert r.relation_type == RelationType.SIBLING

    def test_create_cluster_with_empty_initial_members(self):
        mgr = SessionClusterManager()
        c = mgr.create_cluster("C", initial_members=[])
        assert c.members == []

    def test_get_related_clusters_missing_and_stats_with_invalid_role(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        assert mgr.get_related_clusters("missing") == []

        c = mgr.create_cluster("BadRole")
        c.members.append(ClusterMember(session_id="x", role="not-a-role"))
        mgr._clusters[c.cluster_id] = c
        stats = mgr.stats()
        assert stats["total_clusters"] >= 1

    def test_merge_clusters_skips_missing_and_name_fallback(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c1 = mgr.create_cluster("C1", initial_members=["s1"])
        merged = mgr.merge_clusters([c1.cluster_id, "missing"], new_name="Ignored")
        assert merged is None

        c2 = mgr.create_cluster("C2", initial_members=["s2"])
        merged2 = mgr.merge_clusters([c1.cluster_id, c2.cluster_id], new_name="")
        assert merged2 is not None
        assert merged2.name.startswith("Merged: ")

    def test_delete_cluster_with_invalid_stored_relation_item(self, tmp_path):
        mgr = SessionClusterManager(storage_path=tmp_path / "clusters")
        c1 = mgr.create_cluster("C1")
        c2 = mgr.create_cluster("C2")

        c2.relations.append("bad")
        mgr._clusters[c2.cluster_id] = c2

        assert mgr.delete_cluster(c1.cluster_id) is True


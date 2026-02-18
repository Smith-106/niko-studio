"""
SequentialThinking Engine Tests

Tests for the dynamic reasoning engine: think, branch, revise, backtrack,
conclude, prune, serialization, and callbacks.
"""

import pytest
from src.agents.sequential_thinking import (
    SequentialThinking,
    ThoughtData,
    ThoughtType,
    ThoughtStatus,
    Branch,
)


class TestThoughtData:
    """ThoughtData dataclass tests"""

    def test_to_dict_roundtrip(self):
        thought = ThoughtData(
            id="t1",
            content="test thought",
            thought_type=ThoughtType.ANALYSIS,
            confidence=0.8,
            metadata={"key": "value"},
        )
        d = thought.to_dict()
        restored = ThoughtData.from_dict(d)
        assert restored.id == "t1"
        assert restored.content == "test thought"
        assert restored.thought_type == ThoughtType.ANALYSIS
        assert restored.confidence == 0.8
        assert restored.metadata == {"key": "value"}

    def test_from_dict_defaults(self):
        data = {
            "id": "t2",
            "content": "minimal",
            "thought_type": "hypothesis",
        }
        t = ThoughtData.from_dict(data)
        assert t.status == ThoughtStatus.ACTIVE
        assert t.depth == 0
        assert t.confidence == 1.0
        assert t.parent_id is None
        assert t.branch_id is None

    def test_to_dict_contains_all_fields(self):
        t = ThoughtData(
            id="t3",
            content="full",
            thought_type=ThoughtType.CONCLUSION,
            status=ThoughtStatus.COMPLETED,
            parent_id="t2",
            branch_id="main",
            depth=3,
            confidence=0.5,
            revised_by="t4",
        )
        d = t.to_dict()
        assert d["id"] == "t3"
        assert d["status"] == "completed"
        assert d["parent_id"] == "t2"
        assert d["branch_id"] == "main"
        assert d["depth"] == 3
        assert d["revised_by"] == "t4"
        assert "created_at" in d


class TestSequentialThinkingInit:
    """Initialization and reset tests"""

    def test_default_init(self):
        st = SequentialThinking()
        assert st.max_depth == 10
        assert st.max_branches == 5
        assert st.auto_prune is True
        assert "main" in st._branches
        assert st._current_branch_id == "main"
        assert st._current_thought_id is None

    def test_custom_init(self):
        st = SequentialThinking(max_depth=3, max_branches=2, auto_prune=False)
        assert st.max_depth == 3
        assert st.max_branches == 2
        assert st.auto_prune is False

    def test_reset(self):
        st = SequentialThinking()
        st.think("thought 1")
        st.think("thought 2")
        assert len(st._thoughts) == 2
        st.reset()
        assert len(st._thoughts) == 0
        assert st._current_thought_id is None
        assert st._thought_counter == 0
        assert "main" in st._branches
        assert len(st._branches) == 1


class TestThink:
    """Tests for the think() method"""

    def test_basic_think(self):
        st = SequentialThinking()
        t = st.think("first thought", ThoughtType.INITIAL)
        assert t.content == "first thought"
        assert t.thought_type == ThoughtType.INITIAL
        assert t.depth == 0
        assert t.branch_id == "main"
        assert t.parent_id is None
        assert st._current_thought_id == t.id

    def test_chained_think_increments_depth(self):
        st = SequentialThinking()
        t1 = st.think("level 0")
        t2 = st.think("level 1")
        t3 = st.think("level 2")
        assert t1.depth == 0
        assert t2.depth == 1
        assert t3.depth == 2
        assert t2.parent_id == t1.id
        assert t3.parent_id == t2.id

    def test_max_depth_raises(self):
        st = SequentialThinking(max_depth=2)
        st.think("depth 0")
        st.think("depth 1")
        with pytest.raises(ValueError, match="Maximum thought depth"):
            st.think("depth 2 should fail")

    def test_think_with_metadata(self):
        st = SequentialThinking()
        t = st.think("meta thought", metadata={"source": "test"})
        assert t.metadata == {"source": "test"}

    def test_think_with_confidence(self):
        st = SequentialThinking()
        t = st.think("uncertain", confidence=0.3)
        assert t.confidence == 0.3

    def test_think_adds_to_branch(self):
        st = SequentialThinking()
        t = st.think("thought in main")
        assert t.id in st._branches["main"].thoughts


class TestBranch:
    """Tests for branch(), switch_branch()"""

    def test_create_branch(self):
        st = SequentialThinking()
        st.think("root thought")
        b = st.branch("Exploration", "Try alternative")
        assert b.name == "Exploration"
        assert b.description == "Try alternative"
        assert b.parent_branch_id == "main"
        assert b.fork_point_id == st._thoughts[list(st._thoughts.keys())[0]].id
        assert b.id in st._branches

    def test_switch_branch(self):
        st = SequentialThinking()
        root = st.think("root")
        b = st.branch("alt", "alternative")
        st.switch_branch(b.id)
        assert st._current_branch_id == b.id
        # fork_point_id should be used since no thoughts in new branch
        assert st._current_thought_id == root.id

    def test_switch_branch_with_thoughts(self):
        st = SequentialThinking()
        st.think("root")
        b = st.branch("alt", "alternative")
        st.switch_branch(b.id)
        t_alt = st.think("alt thought")
        st.switch_branch("main")
        st.switch_branch(b.id)
        assert st._current_thought_id == t_alt.id

    def test_switch_nonexistent_branch_raises(self):
        st = SequentialThinking()
        with pytest.raises(ValueError, match="not found"):
            st.switch_branch("nonexistent")

    def test_switch_abandoned_branch_raises(self):
        st = SequentialThinking()
        st.think("root")
        b = st.branch("doomed", "will be abandoned")
        st._branches[b.id].status = ThoughtStatus.ABANDONED
        with pytest.raises(ValueError, match="abandoned"):
            st.switch_branch(b.id)

    def test_max_branches_auto_prune(self):
        st = SequentialThinking(max_branches=3, auto_prune=True)
        st.think("root")
        b1 = st.branch("b1", "branch 1", priority=1)
        b2 = st.branch("b2", "branch 2", priority=10)
        # Creating a 3rd branch (main + b1 + b2 = 3, at max) should prune lowest
        b3 = st.branch("b3", "branch 3", priority=5)
        # b1 had lowest priority, should be abandoned
        assert st._branches[b1.id].status == ThoughtStatus.ABANDONED

    def test_max_branches_no_auto_prune_raises(self):
        st = SequentialThinking(max_branches=2, auto_prune=False)
        st.think("root")
        st.branch("b1", "branch 1")
        with pytest.raises(ValueError, match="Maximum branches"):
            st.branch("b2", "branch 2")


class TestRevise:
    """Tests for revise()"""

    def test_revise_marks_original(self):
        st = SequentialThinking()
        t1 = st.think("original thought")
        t2 = st.revise(t1.id, "revised content", "was wrong")
        assert t1.status == ThoughtStatus.REVISED
        assert t1.revised_by == t2.id
        assert t2.thought_type == ThoughtType.REVISION
        assert t2.metadata["revises"] == t1.id
        assert t2.metadata["reason"] == "was wrong"
        assert t2.metadata["original_content"] == "original thought"

    def test_revise_nonexistent_raises(self):
        st = SequentialThinking()
        with pytest.raises(ValueError, match="not found"):
            st.revise("ghost", "new content", "reason")


class TestBacktrack:
    """Tests for backtrack()"""

    def test_backtrack_abandons_later_thoughts(self):
        st = SequentialThinking()
        t1 = st.think("step 1")
        t2 = st.think("step 2")
        t3 = st.think("step 3")
        st.backtrack(t1.id)
        assert t2.status == ThoughtStatus.ABANDONED
        assert t3.status == ThoughtStatus.ABANDONED
        # backtrack adds a BACKTRACK thought
        backtrack_thoughts = [
            t for t in st._thoughts.values()
            if t.thought_type == ThoughtType.BACKTRACK
        ]
        assert len(backtrack_thoughts) == 1

    def test_backtrack_nonexistent_raises(self):
        st = SequentialThinking()
        with pytest.raises(ValueError, match="not found"):
            st.backtrack("ghost")

    def test_backtrack_switches_branch(self):
        st = SequentialThinking()
        t1 = st.think("root")
        b = st.branch("alt", "alternative")
        st.switch_branch(b.id)
        t2 = st.think("alt thought")
        # backtrack to root in main branch
        st.backtrack(t1.id)
        assert st._current_branch_id == "main"


class TestConclude:
    """Tests for conclude()"""

    def test_conclude_creates_conclusion_thought(self):
        st = SequentialThinking()
        st.think("analysis")
        c = st.conclude("final answer", confidence=0.9)
        assert c.thought_type == ThoughtType.CONCLUSION
        assert c.confidence == 0.9
        assert c.content == "final answer"


class TestQueries:
    """Tests for get_thought_chain, get_active_thoughts, get_conclusions, get_best_branch"""

    def test_get_thought_chain(self):
        st = SequentialThinking()
        t1 = st.think("a")
        t2 = st.think("b")
        chain = st.get_thought_chain()
        assert len(chain) == 2
        assert chain[0].id == t1.id
        assert chain[1].id == t2.id

    def test_get_thought_chain_specific_branch(self):
        st = SequentialThinking()
        st.think("main thought")
        b = st.branch("alt", "alternative")
        st.switch_branch(b.id)
        st.think("alt thought")
        main_chain = st.get_thought_chain("main")
        alt_chain = st.get_thought_chain(b.id)
        assert len(main_chain) == 1
        assert len(alt_chain) == 1

    def test_get_thought_chain_nonexistent_branch(self):
        st = SequentialThinking()
        chain = st.get_thought_chain("nonexistent")
        assert chain == []

    def test_get_active_thoughts(self):
        st = SequentialThinking()
        t1 = st.think("active")
        t2 = st.think("also active")
        t1.status = ThoughtStatus.ABANDONED
        active = st.get_active_thoughts()
        assert len(active) == 1
        assert active[0].id == t2.id

    def test_get_conclusions(self):
        st = SequentialThinking()
        st.think("analysis")
        st.conclude("conclusion 1")
        st.conclude("conclusion 2")
        conclusions = st.get_conclusions()
        assert len(conclusions) == 2

    def test_get_conclusions_excludes_abandoned(self):
        st = SequentialThinking()
        c = st.conclude("will be abandoned")
        c.status = ThoughtStatus.ABANDONED
        conclusions = st.get_conclusions()
        assert len(conclusions) == 0

    def test_get_best_branch_no_active(self):
        st = SequentialThinking()
        # Only main is active
        best = st.get_best_branch()
        assert best.id == "main"

    def test_get_best_branch_when_all_abandoned_returns_main(self):
        st = SequentialThinking()
        st._branches["main"].status = ThoughtStatus.ABANDONED
        best = st.get_best_branch()
        assert best.id == "main"

    def test_get_best_branch_by_priority_and_confidence(self):
        st = SequentialThinking(max_branches=10)
        st.think("root", confidence=0.5)
        b1 = st.branch("b1", "low priority", priority=1)
        st.switch_branch(b1.id)
        st.think("b1 thought", confidence=0.9)
        b2 = st.branch("b2", "high priority", priority=10)
        st.switch_branch(b2.id)
        st.think("b2 thought", confidence=0.5)
        best = st.get_best_branch()
        assert best.id == b2.id  # Higher priority wins


class TestPrune:
    """Tests for _prune_lowest_priority_branch"""

    def test_prune_abandons_lowest_priority(self):
        st = SequentialThinking(max_branches=10)
        st.think("root")
        b_low = st.branch("low", "low priority", priority=1)
        st.switch_branch(b_low.id)
        t_in_low = st.think("thought in low")
        b_high = st.branch("high", "high priority", priority=10)
        st.switch_branch("main")
        st._prune_lowest_priority_branch()
        assert st._branches[b_low.id].status == ThoughtStatus.ABANDONED
        assert t_in_low.status == ThoughtStatus.ABANDONED
        assert st._branches[b_high.id].status == ThoughtStatus.ACTIVE

    def test_prune_no_active_branches_noop(self):
        st = SequentialThinking()
        # Only main branch, no non-main active branches
        st._prune_lowest_priority_branch()  # Should not raise


class TestSerialization:
    """Tests for to_dict() and to_markdown()"""

    def test_to_dict(self):
        st = SequentialThinking()
        st.think("thought 1")
        st.think("thought 2")
        d = st.to_dict()
        assert "thoughts" in d
        assert "branches" in d
        assert "current_branch_id" in d
        assert "current_thought_id" in d
        assert len(d["thoughts"]) == 2
        assert "main" in d["branches"]

    def test_to_markdown(self):
        st = SequentialThinking()
        st.think("analysis step", ThoughtType.ANALYSIS)
        st.conclude("final conclusion")
        md = st.to_markdown()
        assert "# Sequential Thinking Chain" in md
        assert "Branch: Main" in md
        assert "analysis step" in md
        assert "final conclusion" in md
        assert "[Analysis]" in md
        assert "[Conclusion]" in md

    def test_to_markdown_skips_abandoned_branches(self):
        st = SequentialThinking(max_branches=10)
        st.think("root")
        b = st.branch("doomed", "will be abandoned")
        st.switch_branch(b.id)
        st.think("doomed thought")
        st._branches[b.id].status = ThoughtStatus.ABANDONED
        md = st.to_markdown()
        assert "doomed" not in md

    def test_to_markdown_skips_missing_thought_reference(self):
        st = SequentialThinking()
        st._branches["main"].thoughts.append("missing-thought-id")
        md = st.to_markdown()
        assert "missing-thought-id" not in md

    def test_to_markdown_confidence_display(self):
        st = SequentialThinking()
        st.think("uncertain", confidence=0.7)
        md = st.to_markdown()
        assert "70%" in md

    def test_to_markdown_full_confidence_no_percent(self):
        st = SequentialThinking()
        st.think("certain", confidence=1.0)
        md = st.to_markdown()
        assert "100%" not in md


class TestCallbacks:
    """Tests for callback registration"""

    def test_on_thought_added_callback(self):
        received = []
        st = SequentialThinking()
        st.on_thought_added(lambda t: received.append(t))
        st.think("triggers callback")
        assert len(received) == 1
        assert received[0].content == "triggers callback"

    def test_on_branch_created_callback(self):
        received = []
        st = SequentialThinking()
        st.on_branch_created(lambda b: received.append(b))
        st.think("root")
        st.branch("new branch", "desc")
        assert len(received) == 1
        assert received[0].name == "new branch"

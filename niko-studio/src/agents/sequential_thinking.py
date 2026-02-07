"""
SequentialThinking - 动态推理引擎

基于 Cherry Studio 的 SequentialThinking MCP 实现，支持：
- 动态思维链 (Chain of Thought)
- 思维分支 (Branch)
- 思维修正 (Revise)
- 思维回溯 (Backtrack)

用于复杂的规划和推理任务。
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar
import logging
import json
import hashlib

logger = logging.getLogger(__name__)

T = TypeVar('T')


class ThoughtType(Enum):
    """思维类型"""
    INITIAL = "initial"           # 初始思考
    ANALYSIS = "analysis"         # 分析
    HYPOTHESIS = "hypothesis"     # 假设
    VERIFICATION = "verification" # 验证
    CONCLUSION = "conclusion"     # 结论
    BRANCH = "branch"             # 分支探索
    REVISION = "revision"         # 修正
    BACKTRACK = "backtrack"       # 回溯


class ThoughtStatus(Enum):
    """思维状态"""
    ACTIVE = "active"       # 活跃的（当前分支）
    COMPLETED = "completed" # 已完成
    ABANDONED = "abandoned" # 已放弃
    REVISED = "revised"     # 已被修正


@dataclass
class ThoughtData:
    """思维数据结构"""
    id: str
    content: str
    thought_type: ThoughtType
    status: ThoughtStatus = ThoughtStatus.ACTIVE
    parent_id: Optional[str] = None
    branch_id: Optional[str] = None
    depth: int = 0
    confidence: float = 1.0  # 0.0 - 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    revised_by: Optional[str] = None  # 被哪个思维修正

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "thought_type": self.thought_type.value,
            "status": self.status.value,
            "parent_id": self.parent_id,
            "branch_id": self.branch_id,
            "depth": self.depth,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "revised_by": self.revised_by
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ThoughtData':
        return cls(
            id=data["id"],
            content=data["content"],
            thought_type=ThoughtType(data["thought_type"]),
            status=ThoughtStatus(data.get("status", "active")),
            parent_id=data.get("parent_id"),
            branch_id=data.get("branch_id"),
            depth=data.get("depth", 0),
            confidence=data.get("confidence", 1.0),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            revised_by=data.get("revised_by")
        )


@dataclass
class Branch:
    """思维分支"""
    id: str
    name: str
    description: str
    parent_branch_id: Optional[str] = None
    fork_point_id: Optional[str] = None  # 从哪个思维节点分叉
    status: ThoughtStatus = ThoughtStatus.ACTIVE
    priority: int = 0  # 优先级，用于选择最佳分支
    thoughts: List[str] = field(default_factory=list)  # 思维 ID 列表


class SequentialThinking:
    """
    动态推理引擎

    支持动态的思维链构建，包括：
    - 线性推理：逐步深入的思考
    - 分支探索：并行探索多种可能性
    - 思维修正：发现问题时修正之前的思考
    - 思维回溯：返回到之前的节点重新思考
    """

    def __init__(
        self,
        max_depth: int = 10,
        max_branches: int = 5,
        auto_prune: bool = True
    ):
        """
        Args:
            max_depth: 最大思维深度
            max_branches: 最大并行分支数
            auto_prune: 是否自动剪枝低置信度分支
        """
        self.max_depth = max_depth
        self.max_branches = max_branches
        self.auto_prune = auto_prune

        self._thoughts: Dict[str, ThoughtData] = {}
        self._branches: Dict[str, Branch] = {}
        self._current_branch_id: str = "main"
        self._current_thought_id: Optional[str] = None
        self._thought_counter: int = 0

        # 初始化主分支
        self._branches["main"] = Branch(
            id="main",
            name="Main",
            description="主思维链"
        )

        # 回调函数
        self._on_thought_added: Optional[Callable[[ThoughtData], None]] = None
        self._on_branch_created: Optional[Callable[[Branch], None]] = None

    def _generate_thought_id(self) -> str:
        """生成思维 ID"""
        self._thought_counter += 1
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"thought_{timestamp}_{self._thought_counter:04d}"

    def _generate_branch_id(self, name: str) -> str:
        """生成分支 ID"""
        hash_suffix = hashlib.md5(f"{name}{datetime.now().isoformat()}".encode()).hexdigest()[:6]
        return f"branch_{name.lower().replace(' ', '_')}_{hash_suffix}"

    def think(
        self,
        content: str,
        thought_type: ThoughtType = ThoughtType.ANALYSIS,
        confidence: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ThoughtData:
        """
        添加一个思维节点

        Args:
            content: 思维内容
            thought_type: 思维类型
            confidence: 置信度
            metadata: 元数据

        Returns:
            ThoughtData: 创建的思维节点
        """
        thought_id = self._generate_thought_id()
        current_branch = self._branches[self._current_branch_id]

        # 计算深度
        depth = 0
        if self._current_thought_id:
            parent_thought = self._thoughts.get(self._current_thought_id)
            if parent_thought:
                depth = parent_thought.depth + 1

        # 检查深度限制
        if depth >= self.max_depth:
            logger.warning(f"Reached max depth {self.max_depth}, cannot add more thoughts")
            raise ValueError(f"Maximum thought depth ({self.max_depth}) reached")

        thought = ThoughtData(
            id=thought_id,
            content=content,
            thought_type=thought_type,
            parent_id=self._current_thought_id,
            branch_id=self._current_branch_id,
            depth=depth,
            confidence=confidence,
            metadata=metadata or {}
        )

        self._thoughts[thought_id] = thought
        current_branch.thoughts.append(thought_id)
        self._current_thought_id = thought_id

        logger.debug(f"Added thought: {thought_id} (type={thought_type.value}, depth={depth})")

        if self._on_thought_added:
            self._on_thought_added(thought)

        return thought

    def branch(
        self,
        name: str,
        description: str,
        priority: int = 0
    ) -> Branch:
        """
        创建新的思维分支

        Args:
            name: 分支名称
            description: 分支描述
            priority: 优先级

        Returns:
            Branch: 创建的分支
        """
        if len(self._branches) >= self.max_branches:
            if self.auto_prune:
                self._prune_lowest_priority_branch()
            else:
                raise ValueError(f"Maximum branches ({self.max_branches}) reached")

        branch_id = self._generate_branch_id(name)

        branch = Branch(
            id=branch_id,
            name=name,
            description=description,
            parent_branch_id=self._current_branch_id,
            fork_point_id=self._current_thought_id,
            priority=priority
        )

        self._branches[branch_id] = branch

        logger.info(f"Created branch: {branch_id} from thought {self._current_thought_id}")

        if self._on_branch_created:
            self._on_branch_created(branch)

        return branch

    def switch_branch(self, branch_id: str) -> None:
        """
        切换到指定分支

        Args:
            branch_id: 分支 ID
        """
        if branch_id not in self._branches:
            raise ValueError(f"Branch {branch_id} not found")

        branch = self._branches[branch_id]
        if branch.status == ThoughtStatus.ABANDONED:
            raise ValueError(f"Cannot switch to abandoned branch {branch_id}")

        self._current_branch_id = branch_id

        # 切换到分支的最后一个思维
        if branch.thoughts:
            self._current_thought_id = branch.thoughts[-1]
        else:
            self._current_thought_id = branch.fork_point_id

        logger.info(f"Switched to branch: {branch_id}")

    def revise(
        self,
        target_thought_id: str,
        new_content: str,
        reason: str
    ) -> ThoughtData:
        """
        修正之前的思维

        Args:
            target_thought_id: 要修正的思维 ID
            new_content: 新的思维内容
            reason: 修正原因

        Returns:
            ThoughtData: 新的修正思维
        """
        if target_thought_id not in self._thoughts:
            raise ValueError(f"Thought {target_thought_id} not found")

        target_thought = self._thoughts[target_thought_id]

        # 标记原思维为已修正
        target_thought.status = ThoughtStatus.REVISED

        # 创建修正思维
        revision_thought = self.think(
            content=new_content,
            thought_type=ThoughtType.REVISION,
            metadata={
                "revises": target_thought_id,
                "reason": reason,
                "original_content": target_thought.content
            }
        )

        target_thought.revised_by = revision_thought.id

        logger.info(f"Revised thought {target_thought_id} with {revision_thought.id}")

        return revision_thought

    def backtrack(self, to_thought_id: str) -> None:
        """
        回溯到之前的思维节点

        Args:
            to_thought_id: 目标思维 ID
        """
        if to_thought_id not in self._thoughts:
            raise ValueError(f"Thought {to_thought_id} not found")

        target_thought = self._thoughts[to_thought_id]

        # 标记回溯点之后的思维为放弃状态
        branch = self._branches[target_thought.branch_id]
        found_target = False
        for thought_id in branch.thoughts:
            if thought_id == to_thought_id:
                found_target = True
                continue
            if found_target:
                self._thoughts[thought_id].status = ThoughtStatus.ABANDONED

        # 切换到目标分支和思维
        self._current_branch_id = target_thought.branch_id
        self._current_thought_id = to_thought_id

        # 添加回溯标记思维
        self.think(
            content=f"Backtracked to thought: {to_thought_id}",
            thought_type=ThoughtType.BACKTRACK,
            metadata={"backtrack_target": to_thought_id}
        )

        logger.info(f"Backtracked to thought {to_thought_id}")

    def conclude(self, conclusion: str, confidence: float = 1.0) -> ThoughtData:
        """
        添加结论思维

        Args:
            conclusion: 结论内容
            confidence: 置信度

        Returns:
            ThoughtData: 结论思维
        """
        return self.think(
            content=conclusion,
            thought_type=ThoughtType.CONCLUSION,
            confidence=confidence
        )

    def _prune_lowest_priority_branch(self) -> None:
        """剪枝最低优先级的分支"""
        active_branches = [
            b for b in self._branches.values()
            if b.status == ThoughtStatus.ACTIVE and b.id != "main"
        ]

        if not active_branches:
            return

        # 找到最低优先级的分支
        lowest = min(active_branches, key=lambda b: b.priority)
        lowest.status = ThoughtStatus.ABANDONED

        # 标记该分支的所有思维为放弃状态
        for thought_id in lowest.thoughts:
            if thought_id in self._thoughts:
                self._thoughts[thought_id].status = ThoughtStatus.ABANDONED

        logger.info(f"Pruned branch: {lowest.id}")

    def get_thought_chain(self, branch_id: Optional[str] = None) -> List[ThoughtData]:
        """
        获取思维链

        Args:
            branch_id: 分支 ID，默认为当前分支

        Returns:
            List[ThoughtData]: 思维链
        """
        branch_id = branch_id or self._current_branch_id
        branch = self._branches.get(branch_id)

        if not branch:
            return []

        return [
            self._thoughts[tid]
            for tid in branch.thoughts
            if tid in self._thoughts
        ]

    def get_active_thoughts(self) -> List[ThoughtData]:
        """获取所有活跃的思维"""
        return [
            t for t in self._thoughts.values()
            if t.status == ThoughtStatus.ACTIVE
        ]

    def get_conclusions(self) -> List[ThoughtData]:
        """获取所有结论"""
        return [
            t for t in self._thoughts.values()
            if t.thought_type == ThoughtType.CONCLUSION
            and t.status in (ThoughtStatus.ACTIVE, ThoughtStatus.COMPLETED)
        ]

    def get_best_branch(self) -> Branch:
        """
        获取最佳分支（基于优先级和置信度）

        Returns:
            Branch: 最佳分支
        """
        active_branches = [
            b for b in self._branches.values()
            if b.status == ThoughtStatus.ACTIVE
        ]

        if not active_branches:
            return self._branches["main"]

        def branch_score(branch: Branch) -> float:
            thoughts = [
                self._thoughts[tid]
                for tid in branch.thoughts
                if tid in self._thoughts
            ]
            avg_confidence = (
                sum(t.confidence for t in thoughts) / len(thoughts)
                if thoughts else 0
            )
            return branch.priority + avg_confidence

        return max(active_branches, key=branch_score)

    def to_dict(self) -> Dict[str, Any]:
        """导出为字典"""
        return {
            "thoughts": {tid: t.to_dict() for tid, t in self._thoughts.items()},
            "branches": {
                bid: {
                    "id": b.id,
                    "name": b.name,
                    "description": b.description,
                    "parent_branch_id": b.parent_branch_id,
                    "fork_point_id": b.fork_point_id,
                    "status": b.status.value,
                    "priority": b.priority,
                    "thoughts": b.thoughts
                }
                for bid, b in self._branches.items()
            },
            "current_branch_id": self._current_branch_id,
            "current_thought_id": self._current_thought_id
        }

    def to_markdown(self) -> str:
        """导出为 Markdown 格式的思维链"""
        lines = ["# Sequential Thinking Chain\n"]

        for branch_id, branch in self._branches.items():
            if branch.status == ThoughtStatus.ABANDONED:
                continue

            lines.append(f"\n## Branch: {branch.name}")
            lines.append(f"*{branch.description}*\n")

            for thought_id in branch.thoughts:
                thought = self._thoughts.get(thought_id)
                if not thought:
                    continue

                indent = "  " * thought.depth
                status_icon = {
                    ThoughtStatus.ACTIVE: "🔵",
                    ThoughtStatus.COMPLETED: "✅",
                    ThoughtStatus.ABANDONED: "❌",
                    ThoughtStatus.REVISED: "🔄"
                }.get(thought.status, "⚪")

                type_label = {
                    ThoughtType.INITIAL: "[Initial]",
                    ThoughtType.ANALYSIS: "[Analysis]",
                    ThoughtType.HYPOTHESIS: "[Hypothesis]",
                    ThoughtType.VERIFICATION: "[Verify]",
                    ThoughtType.CONCLUSION: "[Conclusion]",
                    ThoughtType.BRANCH: "[Branch]",
                    ThoughtType.REVISION: "[Revision]",
                    ThoughtType.BACKTRACK: "[Backtrack]"
                }.get(thought.thought_type, "")

                confidence_str = f"({thought.confidence:.0%})" if thought.confidence < 1.0 else ""

                lines.append(
                    f"{indent}{status_icon} {type_label} {thought.content} {confidence_str}"
                )

        return "\n".join(lines)

    def reset(self) -> None:
        """重置思维引擎"""
        self._thoughts.clear()
        self._branches.clear()
        self._current_branch_id = "main"
        self._current_thought_id = None
        self._thought_counter = 0

        self._branches["main"] = Branch(
            id="main",
            name="Main",
            description="主思维链"
        )

        logger.info("Sequential thinking engine reset")

    # ========== 回调设置 ==========

    def on_thought_added(self, callback: Callable[[ThoughtData], None]) -> None:
        """设置思维添加回调"""
        self._on_thought_added = callback

    def on_branch_created(self, callback: Callable[[Branch], None]) -> None:
        """设置分支创建回调"""
        self._on_branch_created = callback

"""
伏笔生命周期追踪 (Foreshadowing Lifecycle Tracker)

实现伏笔状态机：PLANTED -> HINTED -> HARVESTED

伏笔是叙事中的重要技巧，用于:
1. 埋设悬念，为后续情节做铺垫
2. 通过暗示加强读者期待
3. 在恰当时机回收，形成叙事闭环

主要功能:
- 伏笔状态机管理 (PLANTED -> HINTED -> HARVESTED)
- 回收提醒触发规则 (基于场景数、时间、重要程度)
- GraphManager 集成追踪伏笔关系
"""

import json
import logging
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from src.graph.graph_manager import GraphManager

logger = logging.getLogger("niko-foreshadowing")


class ForeshadowState(Enum):
    """伏笔状态枚举"""
    PLANTED = "planted"      # 已埋设 - 伏笔被引入故事
    HINTED = "hinted"        # 已暗示 - 伏笔被再次提及/强化
    HARVESTED = "harvested"  # 已回收 - 伏笔完成使命


@dataclass
class ForeshadowHint:
    """伏笔暗示记录"""
    scene_id: str           # 暗示所在场景
    description: str        # 暗示内容描述
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Foreshadow:
    """伏笔数据类"""
    id: str                                    # 唯一标识
    description: str                           # 伏笔描述
    state: ForeshadowState                     # 当前状态
    planted_at: str                            # 埋设场景 ID
    planted_time: datetime                     # 埋设时间
    hints: List[ForeshadowHint] = field(default_factory=list)  # 暗示记录
    harvested_at: Optional[str] = None         # 回收场景 ID
    harvested_time: Optional[datetime] = None  # 回收时间
    importance: int = 5                        # 重要程度 1-10
    tags: List[str] = field(default_factory=list)  # 标签分类
    metadata: Dict[str, Any] = field(default_factory=dict)  # 扩展元数据

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "description": self.description,
            "state": self.state.value,
            "planted_at": self.planted_at,
            "planted_time": self.planted_time.isoformat(),
            "hints": [
                {
                    "scene_id": h.scene_id,
                    "description": h.description,
                    "timestamp": h.timestamp.isoformat(),
                }
                for h in self.hints
            ],
            "harvested_at": self.harvested_at,
            "harvested_time": self.harvested_time.isoformat() if self.harvested_time else None,
            "importance": self.importance,
            "tags": self.tags,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Foreshadow":
        """从字典创建"""
        hints = [
            ForeshadowHint(
                scene_id=h["scene_id"],
                description=h["description"],
                timestamp=datetime.fromisoformat(h["timestamp"]),
            )
            for h in data.get("hints", [])
        ]

        harvested_time = None
        if data.get("harvested_time"):
            harvested_time = datetime.fromisoformat(data["harvested_time"])

        return cls(
            id=data["id"],
            description=data["description"],
            state=ForeshadowState(data["state"]),
            planted_at=data["planted_at"],
            planted_time=datetime.fromisoformat(data["planted_time"]),
            hints=hints,
            harvested_at=data.get("harvested_at"),
            harvested_time=harvested_time,
            importance=data.get("importance", 5),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )


@dataclass
class HarvestReminder:
    """回收提醒"""
    foreshadow: Foreshadow
    reason: str              # 提醒原因
    urgency: str             # 紧急程度: low/medium/high/critical
    scenes_since_plant: int  # 距离埋设已过场景数
    suggestion: str          # 建议操作


class ForeshadowingManager:
    """
    伏笔管理器

    管理伏笔的完整生命周期：
    1. plant() - 埋设伏笔
    2. hint() - 添加暗示
    3. harvest() - 回收伏笔
    4. get_pending() - 获取待回收伏笔
    5. get_overdue() - 获取过期伏笔
    """

    # 默认回收阈值（场景数）
    DEFAULT_THRESHOLD = 10

    # 重要性对应的最大等待场景数
    IMPORTANCE_THRESHOLDS = {
        10: 5,   # 极重要：5个场景内必须回收
        9: 7,
        8: 10,
        7: 12,
        6: 15,
        5: 20,   # 中等重要：20个场景
        4: 25,
        3: 30,
        2: 40,
        1: 50,   # 次要：可以等待较长时间
    }

    def __init__(self, db_path: Optional[str] = None):
        """
        初始化 ForeshadowingManager

        Args:
            db_path: 数据库路径，默认 ~/.niko/foreshadowing.db
        """
        if db_path is None:
            db_path = Path.home() / ".niko" / "foreshadowing.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._conn: Optional[sqlite3.Connection] = None
        self._init_db()

        # 场景计数器（用于追踪相对位置）
        self._scene_counter: Dict[str, int] = {}

        logger.info(f"ForeshadowingManager initialized: {self.db_path}")

    def _init_db(self) -> None:
        """初始化数据库"""
        self._conn = sqlite3.connect(
            str(self.db_path),
            check_same_thread=False
        )
        self._conn.row_factory = sqlite3.Row

        self._conn.executescript("""
            -- 伏笔表
            CREATE TABLE IF NOT EXISTS foreshadows (
                id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'planted',
                planted_at TEXT NOT NULL,
                planted_time TEXT NOT NULL,
                harvested_at TEXT,
                harvested_time TEXT,
                importance INTEGER DEFAULT 5,
                tags TEXT DEFAULT '[]',
                metadata TEXT DEFAULT '{}'
            );

            -- 暗示表
            CREATE TABLE IF NOT EXISTS hints (
                id TEXT PRIMARY KEY,
                foreshadow_id TEXT NOT NULL,
                scene_id TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (foreshadow_id) REFERENCES foreshadows(id) ON DELETE CASCADE
            );

            -- 场景顺序表（用于计算相对位置）
            CREATE TABLE IF NOT EXISTS scene_order (
                story_id TEXT NOT NULL,
                scene_id TEXT NOT NULL,
                sequence INTEGER NOT NULL,
                PRIMARY KEY (story_id, scene_id)
            );

            -- 索引
            CREATE INDEX IF NOT EXISTS idx_foreshadows_state ON foreshadows(state);
            CREATE INDEX IF NOT EXISTS idx_foreshadows_planted_at ON foreshadows(planted_at);
            CREATE INDEX IF NOT EXISTS idx_hints_foreshadow ON hints(foreshadow_id);
            CREATE INDEX IF NOT EXISTS idx_scene_order_story ON scene_order(story_id);
        """)
        self._conn.commit()

    def _row_to_foreshadow(self, row: sqlite3.Row) -> Foreshadow:
        """将数据库行转换为 Foreshadow 对象"""
        # 获取暗示
        cursor = self._conn.execute(
            "SELECT * FROM hints WHERE foreshadow_id = ? ORDER BY timestamp",
            (row["id"],)
        )
        hints = [
            ForeshadowHint(
                scene_id=h["scene_id"],
                description=h["description"],
                timestamp=datetime.fromisoformat(h["timestamp"]),
            )
            for h in cursor.fetchall()
        ]

        harvested_time = None
        if row["harvested_time"]:
            harvested_time = datetime.fromisoformat(row["harvested_time"])

        return Foreshadow(
            id=row["id"],
            description=row["description"],
            state=ForeshadowState(row["state"]),
            planted_at=row["planted_at"],
            planted_time=datetime.fromisoformat(row["planted_time"]),
            hints=hints,
            harvested_at=row["harvested_at"],
            harvested_time=harvested_time,
            importance=row["importance"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
        )

    # ============================================================
    # 核心操作
    # ============================================================

    def plant(
        self,
        description: str,
        scene_id: str,
        importance: int = 5,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Foreshadow:
        """
        埋设伏笔

        Args:
            description: 伏笔描述
            scene_id: 埋设场景 ID
            importance: 重要程度 1-10
            tags: 标签列表
            metadata: 扩展元数据

        Returns:
            创建的 Foreshadow 对象
        """
        foreshadow_id = str(uuid.uuid4())
        now = datetime.now()

        # 验证重要程度范围
        importance = max(1, min(10, importance))

        self._conn.execute(
            """
            INSERT INTO foreshadows
            (id, description, state, planted_at, planted_time, importance, tags, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                foreshadow_id,
                description,
                ForeshadowState.PLANTED.value,
                scene_id,
                now.isoformat(),
                importance,
                json.dumps(tags or []),
                json.dumps(metadata or {}),
            ),
        )
        self._conn.commit()

        foreshadow = Foreshadow(
            id=foreshadow_id,
            description=description,
            state=ForeshadowState.PLANTED,
            planted_at=scene_id,
            planted_time=now,
            hints=[],
            importance=importance,
            tags=tags or [],
            metadata=metadata or {},
        )

        logger.info(f"Planted foreshadow: {foreshadow_id} at scene {scene_id}")
        return foreshadow

    def hint(
        self,
        foreshadow_id: str,
        scene_id: str,
        hint_description: Optional[str] = None,
    ) -> Optional[Foreshadow]:
        """
        添加伏笔暗示

        暗示会强化伏笔，让读者更加期待回收。
        状态从 PLANTED 转变为 HINTED。

        Args:
            foreshadow_id: 伏笔 ID
            scene_id: 暗示场景 ID
            hint_description: 暗示描述（可选）

        Returns:
            更新后的 Foreshadow 对象，不存在返回 None
        """
        # 获取伏笔
        foreshadow = self.get(foreshadow_id)
        if not foreshadow:
            logger.warning(f"Foreshadow not found: {foreshadow_id}")
            return None

        # 检查状态
        if foreshadow.state == ForeshadowState.HARVESTED:
            logger.warning(f"Cannot hint harvested foreshadow: {foreshadow_id}")
            return None

        now = datetime.now()
        hint_id = str(uuid.uuid4())
        description = hint_description or f"Hint at scene {scene_id}"

        # 插入暗示
        self._conn.execute(
            """
            INSERT INTO hints (id, foreshadow_id, scene_id, description, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (hint_id, foreshadow_id, scene_id, description, now.isoformat()),
        )

        # 更新状态为 HINTED
        self._conn.execute(
            "UPDATE foreshadows SET state = ? WHERE id = ?",
            (ForeshadowState.HINTED.value, foreshadow_id),
        )
        self._conn.commit()

        logger.info(f"Added hint to foreshadow {foreshadow_id} at scene {scene_id}")
        return self.get(foreshadow_id)

    def harvest(
        self,
        foreshadow_id: str,
        scene_id: str,
    ) -> Optional[Foreshadow]:
        """
        回收伏笔

        完成伏笔的叙事使命，状态转变为 HARVESTED。

        Args:
            foreshadow_id: 伏笔 ID
            scene_id: 回收场景 ID

        Returns:
            更新后的 Foreshadow 对象，不存在返回 None
        """
        # 获取伏笔
        foreshadow = self.get(foreshadow_id)
        if not foreshadow:
            logger.warning(f"Foreshadow not found: {foreshadow_id}")
            return None

        # 检查状态
        if foreshadow.state == ForeshadowState.HARVESTED:
            logger.warning(f"Foreshadow already harvested: {foreshadow_id}")
            return foreshadow

        now = datetime.now()

        # 更新状态
        self._conn.execute(
            """
            UPDATE foreshadows
            SET state = ?, harvested_at = ?, harvested_time = ?
            WHERE id = ?
            """,
            (
                ForeshadowState.HARVESTED.value,
                scene_id,
                now.isoformat(),
                foreshadow_id,
            ),
        )
        self._conn.commit()

        logger.info(f"Harvested foreshadow {foreshadow_id} at scene {scene_id}")
        return self.get(foreshadow_id)

    # ============================================================
    # 查询操作
    # ============================================================

    def get(self, foreshadow_id: str) -> Optional[Foreshadow]:
        """
        获取伏笔

        Args:
            foreshadow_id: 伏笔 ID

        Returns:
            Foreshadow 对象，不存在返回 None
        """
        cursor = self._conn.execute(
            "SELECT * FROM foreshadows WHERE id = ?",
            (foreshadow_id,),
        )
        row = cursor.fetchone()

        if row:
            return self._row_to_foreshadow(row)
        return None

    def get_all(self, state: Optional[ForeshadowState] = None) -> List[Foreshadow]:
        """
        获取所有伏笔

        Args:
            state: 可选状态过滤

        Returns:
            伏笔列表
        """
        if state:
            cursor = self._conn.execute(
                "SELECT * FROM foreshadows WHERE state = ? ORDER BY planted_time",
                (state.value,),
            )
        else:
            cursor = self._conn.execute(
                "SELECT * FROM foreshadows ORDER BY planted_time"
            )

        return [self._row_to_foreshadow(row) for row in cursor.fetchall()]

    def get_pending(self) -> List[Foreshadow]:
        """
        获取待回收的伏笔

        返回所有未回收（PLANTED 或 HINTED）的伏笔。

        Returns:
            待回收伏笔列表
        """
        cursor = self._conn.execute(
            """
            SELECT * FROM foreshadows
            WHERE state IN (?, ?)
            ORDER BY importance DESC, planted_time ASC
            """,
            (ForeshadowState.PLANTED.value, ForeshadowState.HINTED.value),
        )

        return [self._row_to_foreshadow(row) for row in cursor.fetchall()]

    def get_overdue(
        self,
        threshold: Optional[int] = None,
        current_scene_id: Optional[str] = None,
        story_id: str = "default",
    ) -> List[HarvestReminder]:
        """
        获取过期未回收的伏笔

        基于场景数量或时间判断伏笔是否需要尽快回收。

        Args:
            threshold: 场景数阈值，超过则视为过期。
                      默认根据伏笔重要程度动态计算。
            current_scene_id: 当前场景 ID（用于计算距离）
            story_id: 故事 ID

        Returns:
            HarvestReminder 列表，按紧急程度排序
        """
        reminders = []
        pending = self.get_pending()

        # 获取当前场景序号
        current_seq = self._get_scene_sequence(story_id, current_scene_id)

        for foreshadow in pending:
            # 获取埋设场景序号
            planted_seq = self._get_scene_sequence(story_id, foreshadow.planted_at)

            # 计算距离
            if current_seq is not None and planted_seq is not None:
                scenes_since = current_seq - planted_seq
            else:
                # 回退到时间计算
                days_since = (datetime.now() - foreshadow.planted_time).days
                scenes_since = days_since * 2  # 假设每天2个场景

            # 确定阈值
            if threshold is not None:
                max_scenes = threshold
            else:
                max_scenes = self.IMPORTANCE_THRESHOLDS.get(
                    foreshadow.importance, self.DEFAULT_THRESHOLD
                )

            # 判断是否过期
            if scenes_since >= max_scenes:
                urgency = self._calculate_urgency(scenes_since, max_scenes)
                reminder = HarvestReminder(
                    foreshadow=foreshadow,
                    reason=self._get_overdue_reason(scenes_since, max_scenes, foreshadow),
                    urgency=urgency,
                    scenes_since_plant=scenes_since,
                    suggestion=self._get_harvest_suggestion(foreshadow, urgency),
                )
                reminders.append(reminder)

        # 按紧急程度排序
        urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        reminders.sort(key=lambda r: (urgency_order.get(r.urgency, 4), -r.foreshadow.importance))

        return reminders

    def _get_scene_sequence(self, story_id: str, scene_id: Optional[str]) -> Optional[int]:
        """获取场景序号"""
        if not scene_id:
            return None

        cursor = self._conn.execute(
            "SELECT sequence FROM scene_order WHERE story_id = ? AND scene_id = ?",
            (story_id, scene_id),
        )
        row = cursor.fetchone()
        return row["sequence"] if row else None

    def _calculate_urgency(self, scenes_since: int, max_scenes: int) -> str:
        """计算紧急程度"""
        ratio = scenes_since / max_scenes if max_scenes > 0 else 1.0

        if ratio >= 2.0:
            return "critical"
        elif ratio >= 1.5:
            return "high"
        elif ratio >= 1.0:
            return "medium"
        else:
            return "low"

    def _get_overdue_reason(
        self, scenes_since: int, max_scenes: int, foreshadow: Foreshadow
    ) -> str:
        """生成过期原因说明"""
        hint_count = len(foreshadow.hints)

        if scenes_since >= max_scenes * 2:
            return f"严重超期: 已过 {scenes_since} 个场景，建议阈值为 {max_scenes}"
        elif hint_count == 0:
            return f"未曾暗示: 埋设后 {scenes_since} 个场景内无任何暗示"
        else:
            return f"等待过长: {scenes_since} 个场景，已有 {hint_count} 次暗示"

    def _get_harvest_suggestion(self, foreshadow: Foreshadow, urgency: str) -> str:
        """生成回收建议"""
        if urgency == "critical":
            return "立即回收此伏笔，否则读者可能已遗忘"
        elif urgency == "high":
            return "尽快安排回收场景，可在当前章节内完成"
        elif foreshadow.state == ForeshadowState.PLANTED:
            return "考虑先添加暗示强化读者记忆，再适时回收"
        else:
            return "可在接下来的剧情高潮处回收"

    # ============================================================
    # 场景管理
    # ============================================================

    def register_scene(self, story_id: str, scene_id: str, sequence: int) -> None:
        """
        注册场景顺序

        用于追踪场景的相对位置。

        Args:
            story_id: 故事 ID
            scene_id: 场景 ID
            sequence: 场景序号
        """
        self._conn.execute(
            """
            INSERT OR REPLACE INTO scene_order (story_id, scene_id, sequence)
            VALUES (?, ?, ?)
            """,
            (story_id, scene_id, sequence),
        )
        self._conn.commit()

    def get_foreshadows_at_scene(self, scene_id: str) -> Dict[str, List[Foreshadow]]:
        """
        获取场景相关的伏笔

        Args:
            scene_id: 场景 ID

        Returns:
            字典: {"planted": [...], "hinted": [...], "harvested": [...]}
        """
        result = {
            "planted": [],
            "hinted": [],
            "harvested": [],
        }

        # 在此场景埋设的
        cursor = self._conn.execute(
            "SELECT * FROM foreshadows WHERE planted_at = ?",
            (scene_id,),
        )
        result["planted"] = [self._row_to_foreshadow(row) for row in cursor.fetchall()]

        # 在此场景暗示的
        cursor = self._conn.execute(
            """
            SELECT DISTINCT f.* FROM foreshadows f
            JOIN hints h ON f.id = h.foreshadow_id
            WHERE h.scene_id = ?
            """,
            (scene_id,),
        )
        result["hinted"] = [self._row_to_foreshadow(row) for row in cursor.fetchall()]

        # 在此场景回收的
        cursor = self._conn.execute(
            "SELECT * FROM foreshadows WHERE harvested_at = ?",
            (scene_id,),
        )
        result["harvested"] = [self._row_to_foreshadow(row) for row in cursor.fetchall()]

        return result

    # ============================================================
    # 统计与分析
    # ============================================================

    def get_stats(self) -> Dict[str, Any]:
        """
        获取伏笔统计信息

        Returns:
            统计字典
        """
        cursor = self._conn.execute(
            """
            SELECT state, COUNT(*) as count FROM foreshadows GROUP BY state
            """
        )
        by_state = {row["state"]: row["count"] for row in cursor.fetchall()}

        cursor = self._conn.execute("SELECT COUNT(*) as total FROM foreshadows")
        total = cursor.fetchone()["total"]

        cursor = self._conn.execute("SELECT COUNT(*) as total FROM hints")
        total_hints = cursor.fetchone()["total"]

        # 平均暗示次数
        avg_hints = 0.0
        if total > 0:
            avg_hints = total_hints / total

        # 回收率
        harvested = by_state.get(ForeshadowState.HARVESTED.value, 0)
        harvest_rate = (harvested / total * 100) if total > 0 else 0.0

        return {
            "total": total,
            "by_state": {
                "planted": by_state.get(ForeshadowState.PLANTED.value, 0),
                "hinted": by_state.get(ForeshadowState.HINTED.value, 0),
                "harvested": by_state.get(ForeshadowState.HARVESTED.value, 0),
            },
            "total_hints": total_hints,
            "avg_hints_per_foreshadow": round(avg_hints, 2),
            "harvest_rate": round(harvest_rate, 1),
        }

    def get_lifecycle_summary(self, foreshadow_id: str) -> Optional[Dict[str, Any]]:
        """
        获取伏笔生命周期摘要

        Args:
            foreshadow_id: 伏笔 ID

        Returns:
            生命周期摘要
        """
        foreshadow = self.get(foreshadow_id)
        if not foreshadow:
            return None

        summary = {
            "id": foreshadow.id,
            "description": foreshadow.description,
            "current_state": foreshadow.state.value,
            "lifecycle": [
                {
                    "event": "planted",
                    "scene_id": foreshadow.planted_at,
                    "timestamp": foreshadow.planted_time.isoformat(),
                }
            ],
        }

        # 添加暗示事件
        for hint in foreshadow.hints:
            summary["lifecycle"].append({
                "event": "hinted",
                "scene_id": hint.scene_id,
                "timestamp": hint.timestamp.isoformat(),
                "description": hint.description,
            })

        # 添加回收事件
        if foreshadow.harvested_at:
            summary["lifecycle"].append({
                "event": "harvested",
                "scene_id": foreshadow.harvested_at,
                "timestamp": foreshadow.harvested_time.isoformat() if foreshadow.harvested_time else None,
            })

        # 按时间排序
        summary["lifecycle"].sort(key=lambda x: x["timestamp"])

        return summary

    # ============================================================
    # 批量操作
    # ============================================================

    def delete(self, foreshadow_id: str) -> bool:
        """
        删除伏笔

        Args:
            foreshadow_id: 伏笔 ID

        Returns:
            是否删除成功
        """
        # 删除暗示
        self._conn.execute(
            "DELETE FROM hints WHERE foreshadow_id = ?",
            (foreshadow_id,),
        )

        # 删除伏笔
        cursor = self._conn.execute(
            "DELETE FROM foreshadows WHERE id = ?",
            (foreshadow_id,),
        )
        self._conn.commit()

        success = cursor.rowcount > 0
        if success:
            logger.info(f"Deleted foreshadow: {foreshadow_id}")
        return success

    def search(
        self,
        query: str,
        state: Optional[ForeshadowState] = None,
        tags: Optional[List[str]] = None,
        limit: int = 20,
    ) -> List[Foreshadow]:
        """
        搜索伏笔

        Args:
            query: 搜索关键词
            state: 状态过滤
            tags: 标签过滤
            limit: 返回数量限制

        Returns:
            匹配的伏笔列表
        """
        sql = "SELECT * FROM foreshadows WHERE description LIKE ?"
        params = [f"%{query}%"]

        if state:
            sql += " AND state = ?"
            params.append(state.value)

        if tags:
            # 简单的 JSON 包含检查
            for tag in tags:
                sql += " AND tags LIKE ?"
                params.append(f'%"{tag}"%')

        sql += f" ORDER BY importance DESC, planted_time DESC LIMIT {limit}"

        cursor = self._conn.execute(sql, params)
        return [self._row_to_foreshadow(row) for row in cursor.fetchall()]

    # ============================================================
    # 生命周期
    # ============================================================

    def close(self) -> None:
        """关闭数据库连接"""
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.info("ForeshadowingManager closed")

    def __enter__(self) -> "ForeshadowingManager":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()


# ============================================================
# 回收提醒触发规则
# ============================================================

@dataclass
class ReminderTriggerRule:
    """回收提醒触发规则"""
    name: str                    # 规则名称
    description: str             # 规则描述
    priority: int                # 优先级 (1-10, 10最高)
    enabled: bool = True         # 是否启用

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> Optional[HarvestReminder]:
        """
        评估规则

        Args:
            foreshadow: 伏笔对象
            current_scene_seq: 当前场景序号
            planted_scene_seq: 埋设场景序号

        Returns:
            HarvestReminder 如果触发，否则 None
        """
        raise NotImplementedError


class SceneCountRule(ReminderTriggerRule):
    """基于场景数量的触发规则"""

    def __init__(
        self,
        threshold_multiplier: float = 1.0,
        name: str = "scene_count",
    ):
        super().__init__(
            name=name,
            description="基于场景数量判断是否需要回收",
            priority=5,
        )
        self.threshold_multiplier = threshold_multiplier

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> Optional[HarvestReminder]:
        scenes_since = current_scene_seq - planted_scene_seq

        # 根据重要程度计算阈值
        base_threshold = ForeshadowingManager.IMPORTANCE_THRESHOLDS.get(
            foreshadow.importance,
            ForeshadowingManager.DEFAULT_THRESHOLD,
        )
        threshold = int(base_threshold * self.threshold_multiplier)

        if scenes_since >= threshold:
            ratio = scenes_since / threshold
            if ratio >= 2.0:
                urgency = "critical"
            elif ratio >= 1.5:
                urgency = "high"
            elif ratio >= 1.0:
                urgency = "medium"
            else:
                urgency = "low"

            return HarvestReminder(
                foreshadow=foreshadow,
                reason=f"已过 {scenes_since} 个场景，阈值为 {threshold}",
                urgency=urgency,
                scenes_since_plant=scenes_since,
                suggestion=self._get_suggestion(foreshadow, urgency),
            )

        return None

    def _get_suggestion(self, foreshadow: Foreshadow, urgency: str) -> str:
        if urgency == "critical":
            return "立即回收此伏笔，否则读者可能已遗忘"
        elif urgency == "high":
            return "尽快安排回收场景，可在当前章节内完成"
        elif foreshadow.state == ForeshadowState.PLANTED:
            return "考虑先添加暗示强化读者记忆，再适时回收"
        else:
            return "可在接下来的剧情高潮处回收"


class NoHintRule(ReminderTriggerRule):
    """无暗示规则 - 埋设后长时间无暗示"""

    def __init__(
        self,
        min_scenes_without_hint: int = 5,
        name: str = "no_hint",
    ):
        super().__init__(
            name=name,
            description="检测埋设后长时间无暗示的伏笔",
            priority=7,
        )
        self.min_scenes_without_hint = min_scenes_without_hint

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> Optional[HarvestReminder]:
        # 只对 PLANTED 状态的伏笔生效
        if foreshadow.state != ForeshadowState.PLANTED:
            return None

        scenes_since = current_scene_seq - planted_scene_seq

        # 根据重要程度调整阈值
        adjusted_threshold = max(
            3,
            self.min_scenes_without_hint - (foreshadow.importance - 5),
        )

        if scenes_since >= adjusted_threshold:
            urgency = "medium" if scenes_since < adjusted_threshold * 2 else "high"

            return HarvestReminder(
                foreshadow=foreshadow,
                reason=f"埋设后 {scenes_since} 个场景内无任何暗示",
                urgency=urgency,
                scenes_since_plant=scenes_since,
                suggestion="建议添加暗示强化读者印象，避免伏笔被遗忘",
            )

        return None


class HighImportanceRule(ReminderTriggerRule):
    """高重要性规则 - 重要伏笔优先提醒"""

    def __init__(
        self,
        importance_threshold: int = 8,
        scene_threshold: int = 3,
        name: str = "high_importance",
    ):
        super().__init__(
            name=name,
            description="高重要性伏笔的早期提醒",
            priority=9,
        )
        self.importance_threshold = importance_threshold
        self.scene_threshold = scene_threshold

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> Optional[HarvestReminder]:
        if foreshadow.importance < self.importance_threshold:
            return None

        scenes_since = current_scene_seq - planted_scene_seq

        if scenes_since >= self.scene_threshold:
            return HarvestReminder(
                foreshadow=foreshadow,
                reason=f"高重要性伏笔 (重要度: {foreshadow.importance}) 已等待 {scenes_since} 个场景",
                urgency="high" if scenes_since >= self.scene_threshold * 2 else "medium",
                scenes_since_plant=scenes_since,
                suggestion="高重要性伏笔应尽早回收以保持读者兴趣",
            )

        return None


class ChapterBoundaryRule(ReminderTriggerRule):
    """章节边界规则 - 章节结束时检查"""

    def __init__(
        self,
        max_chapters_pending: int = 2,
        name: str = "chapter_boundary",
    ):
        super().__init__(
            name=name,
            description="章节边界时检查待回收伏笔",
            priority=6,
        )
        self.max_chapters_pending = max_chapters_pending

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> Optional[HarvestReminder]:
        # 检查元数据中的章节信息
        planted_chapter = foreshadow.metadata.get("planted_chapter", 0)
        current_chapter = foreshadow.metadata.get("current_chapter", 0)

        if current_chapter - planted_chapter >= self.max_chapters_pending:
            return HarvestReminder(
                foreshadow=foreshadow,
                reason=f"伏笔跨越 {current_chapter - planted_chapter} 个章节未回收",
                urgency="high",
                scenes_since_plant=current_scene_seq - planted_scene_seq,
                suggestion=f"建议在当前章节或下一章节回收",
            )

        return None


# ============================================================
# 规则引擎
# ============================================================

class ReminderRuleEngine:
    """回收提醒规则引擎"""

    def __init__(self):
        self.rules: List[ReminderTriggerRule] = []
        self._init_default_rules()

    def _init_default_rules(self) -> None:
        """初始化默认规则"""
        self.rules = [
            SceneCountRule(threshold_multiplier=1.0),
            NoHintRule(min_scenes_without_hint=5),
            HighImportanceRule(importance_threshold=8, scene_threshold=3),
            ChapterBoundaryRule(max_chapters_pending=2),
        ]

    def add_rule(self, rule: ReminderTriggerRule) -> None:
        """添加规则"""
        self.rules.append(rule)
        # 按优先级排序
        self.rules.sort(key=lambda r: r.priority, reverse=True)

    def remove_rule(self, name: str) -> bool:
        """移除规则"""
        for i, rule in enumerate(self.rules):
            if rule.name == name:
                self.rules.pop(i)
                return True
        return False

    def evaluate(
        self,
        foreshadow: Foreshadow,
        current_scene_seq: int,
        planted_scene_seq: int,
    ) -> List[HarvestReminder]:
        """
        评估所有规则

        Returns:
            触发的提醒列表
        """
        reminders = []

        for rule in self.rules:
            if not rule.enabled:
                continue

            reminder = rule.evaluate(
                foreshadow,
                current_scene_seq,
                planted_scene_seq,
            )

            if reminder:
                reminders.append(reminder)

        return reminders


# ============================================================
# GraphManager 集成
# ============================================================

class ForeshadowGraphIntegration:
    """
    伏笔与知识图谱集成

    将伏笔作为实体存储在 GraphManager 中，
    追踪伏笔与角色、场景、事件之间的关系。
    """

    # 伏笔相关的关系类型
    REL_PLANTED_IN = "PLANTED_IN"      # 伏笔埋设于场景
    REL_HINTED_IN = "HINTED_IN"        # 伏笔暗示于场景
    REL_HARVESTED_IN = "HARVESTED_IN"  # 伏笔回收于场景
    REL_INVOLVES = "INVOLVES"          # 伏笔涉及角色/物品
    REL_FORESHADOWS = "FORESHADOWS"    # 伏笔预示事件
    REL_RELATED_TO = "RELATED_TO"      # 伏笔相关

    def __init__(
        self,
        foreshadow_manager: ForeshadowingManager,
        graph_manager: Optional["GraphManager"] = None,
    ):
        """
        初始化集成

        Args:
            foreshadow_manager: ForeshadowingManager 实例
            graph_manager: GraphManager 实例（可选）
        """
        self.fm = foreshadow_manager
        self.gm = graph_manager

    def set_graph_manager(self, graph_manager: "GraphManager") -> None:
        """设置 GraphManager"""
        self.gm = graph_manager

    def sync_foreshadow_to_graph(self, foreshadow: Foreshadow) -> Optional[str]:
        """
        同步伏笔到知识图谱

        Args:
            foreshadow: 伏笔对象

        Returns:
            图谱中的实体 ID
        """
        if not self.gm:
            logger.warning("GraphManager not set, skipping sync")
            return None

        try:
            # 导入必要的类型（避免循环导入）
            from docs.contracts.graph_contracts import Entity, EntityType, Relationship, RelationType

            # 创建伏笔实体
            entity = Entity(
                id=f"foreshadow_{foreshadow.id}",
                name=foreshadow.description[:50],
                type=EntityType.CONCEPT,
                properties={
                    "foreshadow_id": foreshadow.id,
                    "state": foreshadow.state.value,
                    "importance": foreshadow.importance,
                    "planted_at": foreshadow.planted_at,
                    "planted_time": foreshadow.planted_time.isoformat(),
                    "tags": foreshadow.tags,
                    "hint_count": len(foreshadow.hints),
                },
            )

            # 检查是否已存在
            existing = self.gm.get_entity(entity.id)
            if existing:
                entity.created_at = existing.created_at
                self.gm.update_entity(entity)
            else:
                self.gm.create_entity(entity)

            # 创建与场景的关系
            self._create_scene_relationships(foreshadow, entity.id)

            logger.info(f"Synced foreshadow to graph: {foreshadow.id}")
            return entity.id

        except ImportError as e:
            logger.warning(f"Cannot import graph contracts: {e}")
            return None
        except Exception as e:
            logger.error(f"Error syncing foreshadow to graph: {e}")
            return None

    def _create_scene_relationships(
        self,
        foreshadow: Foreshadow,
        entity_id: str,
    ) -> None:
        """创建伏笔与场景的关系"""
        if not self.gm:
            return

        try:
            from docs.contracts.graph_contracts import Relationship, RelationType

            # 埋设场景关系
            planted_rel = Relationship(
                id=f"rel_{foreshadow.id}_planted",
                source_id=entity_id,
                target_id=f"scene_{foreshadow.planted_at}",
                type=RelationType.RELATED_TO,
                properties={
                    "relation_type": self.REL_PLANTED_IN,
                    "timestamp": foreshadow.planted_time.isoformat(),
                },
            )

            try:
                self.gm.create_relationship(planted_rel)
            except Exception:
                pass  # 关系可能已存在

            # 暗示场景关系
            for i, hint in enumerate(foreshadow.hints):
                hint_rel = Relationship(
                    id=f"rel_{foreshadow.id}_hint_{i}",
                    source_id=entity_id,
                    target_id=f"scene_{hint.scene_id}",
                    type=RelationType.RELATED_TO,
                    properties={
                        "relation_type": self.REL_HINTED_IN,
                        "timestamp": hint.timestamp.isoformat(),
                        "description": hint.description,
                    },
                )
                try:
                    self.gm.create_relationship(hint_rel)
                except Exception:
                    pass

            # 回收场景关系
            if foreshadow.harvested_at:
                harvested_rel = Relationship(
                    id=f"rel_{foreshadow.id}_harvested",
                    source_id=entity_id,
                    target_id=f"scene_{foreshadow.harvested_at}",
                    type=RelationType.RELATED_TO,
                    properties={
                        "relation_type": self.REL_HARVESTED_IN,
                        "timestamp": foreshadow.harvested_time.isoformat() if foreshadow.harvested_time else None,
                    },
                )
                try:
                    self.gm.create_relationship(harvested_rel)
                except Exception:
                    pass

        except ImportError:
            pass

    def link_foreshadow_to_entity(
        self,
        foreshadow_id: str,
        entity_id: str,
        relation_type: str = "INVOLVES",
    ) -> bool:
        """
        关联伏笔到其他实体

        Args:
            foreshadow_id: 伏笔 ID
            entity_id: 目标实体 ID
            relation_type: 关系类型

        Returns:
            是否成功
        """
        if not self.gm:
            logger.warning("GraphManager not set")
            return False

        try:
            from docs.contracts.graph_contracts import Relationship, RelationType

            rel = Relationship(
                id=f"rel_{foreshadow_id}_{entity_id}_{relation_type}",
                source_id=f"foreshadow_{foreshadow_id}",
                target_id=entity_id,
                type=RelationType.RELATED_TO,
                properties={
                    "relation_type": relation_type,
                    "created_at": datetime.now().isoformat(),
                },
            )

            self.gm.create_relationship(rel)
            return True

        except Exception as e:
            logger.error(f"Error linking foreshadow: {e}")
            return False

    def find_related_foreshadows(
        self,
        entity_id: str,
        max_depth: int = 2,
    ) -> List[Foreshadow]:
        """
        查找与实体相关的伏笔

        Args:
            entity_id: 实体 ID
            max_depth: 最大搜索深度

        Returns:
            相关伏笔列表
        """
        if not self.gm:
            return []

        try:
            related_entities = self.gm.find_related_entities(
                entity_id,
                max_depth=max_depth,
            )

            foreshadows = []
            for entity in related_entities:
                if entity.id.startswith("foreshadow_"):
                    foreshadow_id = entity.properties.get("foreshadow_id")
                    if foreshadow_id:
                        f = self.fm.get(foreshadow_id)
                        if f:
                            foreshadows.append(f)

            return foreshadows

        except Exception as e:
            logger.error(f"Error finding related foreshadows: {e}")
            return []

    def get_foreshadow_network(
        self,
        foreshadow_id: str,
        radius: int = 2,
    ) -> Dict[str, Any]:
        """
        获取伏笔的关系网络

        Args:
            foreshadow_id: 伏笔 ID
            radius: 网络半径

        Returns:
            网络结构字典
        """
        if not self.gm:
            return {"error": "GraphManager not set"}

        try:
            entity_id = f"foreshadow_{foreshadow_id}"
            subgraph = self.gm.get_subgraph(entity_id, radius=radius)

            return {
                "center": foreshadow_id,
                "entities": [
                    {
                        "id": e.id,
                        "name": e.name,
                        "type": e.type.value,
                    }
                    for e in subgraph.entities
                ],
                "relationships": [
                    {
                        "source": r.source_id,
                        "target": r.target_id,
                        "type": r.type.value,
                        "properties": r.properties,
                    }
                    for r in subgraph.relationships
                ],
            }

        except Exception as e:
            logger.error(f"Error getting foreshadow network: {e}")
            return {"error": str(e)}


# ============================================================
# 增强型 ForeshadowingManager
# ============================================================

class EnhancedForeshadowingManager(ForeshadowingManager):
    """
    增强型伏笔管理器

    在基础管理器上增加:
    1. 规则引擎支持
    2. GraphManager 集成
    3. 高级分析功能
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        graph_manager: Optional["GraphManager"] = None,
    ):
        super().__init__(db_path)

        self.rule_engine = ReminderRuleEngine()
        self.graph_integration = ForeshadowGraphIntegration(self, graph_manager)

    def set_graph_manager(self, graph_manager: "GraphManager") -> None:
        """设置 GraphManager"""
        self.graph_integration.set_graph_manager(graph_manager)

    def plant(
        self,
        description: str,
        scene_id: str,
        importance: int = 5,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        sync_to_graph: bool = True,
    ) -> Foreshadow:
        """
        埋设伏笔（增强版）

        Args:
            description: 伏笔描述
            scene_id: 埋设场景 ID
            importance: 重要程度 1-10
            tags: 标签列表
            metadata: 扩展元数据
            sync_to_graph: 是否同步到知识图谱

        Returns:
            创建的 Foreshadow 对象
        """
        foreshadow = super().plant(
            description=description,
            scene_id=scene_id,
            importance=importance,
            tags=tags,
            metadata=metadata,
        )

        if sync_to_graph:
            self.graph_integration.sync_foreshadow_to_graph(foreshadow)

        return foreshadow

    def hint(
        self,
        foreshadow_id: str,
        scene_id: str,
        hint_description: Optional[str] = None,
        sync_to_graph: bool = True,
    ) -> Optional[Foreshadow]:
        """添加暗示（增强版）"""
        foreshadow = super().hint(foreshadow_id, scene_id, hint_description)

        if foreshadow and sync_to_graph:
            self.graph_integration.sync_foreshadow_to_graph(foreshadow)

        return foreshadow

    def harvest(
        self,
        foreshadow_id: str,
        scene_id: str,
        sync_to_graph: bool = True,
    ) -> Optional[Foreshadow]:
        """回收伏笔（增强版）"""
        foreshadow = super().harvest(foreshadow_id, scene_id)

        if foreshadow and sync_to_graph:
            self.graph_integration.sync_foreshadow_to_graph(foreshadow)

        return foreshadow

    def get_reminders_with_rules(
        self,
        current_scene_id: Optional[str] = None,
        story_id: str = "default",
    ) -> List[HarvestReminder]:
        """
        使用规则引擎获取回收提醒

        Args:
            current_scene_id: 当前场景 ID
            story_id: 故事 ID

        Returns:
            HarvestReminder 列表
        """
        reminders = []
        pending = self.get_pending()

        current_seq = self._get_scene_sequence(story_id, current_scene_id) or 0

        for foreshadow in pending:
            planted_seq = self._get_scene_sequence(story_id, foreshadow.planted_at) or 0

            # 使用规则引擎评估
            rule_reminders = self.rule_engine.evaluate(
                foreshadow,
                current_seq,
                planted_seq,
            )

            # 合并提醒（去重，保留最高优先级）
            if rule_reminders:
                # 选择紧急程度最高的
                urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
                rule_reminders.sort(key=lambda r: urgency_order.get(r.urgency, 4))
                reminders.append(rule_reminders[0])

        # 按紧急程度排序
        urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        reminders.sort(key=lambda r: (
            urgency_order.get(r.urgency, 4),
            -r.foreshadow.importance,
        ))

        return reminders

    def analyze_foreshadow_health(self) -> Dict[str, Any]:
        """
        分析伏笔健康状态

        Returns:
            健康分析报告
        """
        stats = self.get_stats()
        pending = self.get_pending()

        # 计算健康指标
        total = stats["total"]
        harvested = stats["by_state"]["harvested"]
        planted = stats["by_state"]["planted"]
        hinted = stats["by_state"]["hinted"]

        # 回收率
        harvest_rate = (harvested / total * 100) if total > 0 else 100.0

        # 暗示率 (有暗示的伏笔比例)
        hint_rate = (hinted / (planted + hinted) * 100) if (planted + hinted) > 0 else 100.0

        # 平均暗示次数
        avg_hints = stats["avg_hints_per_foreshadow"]

        # 重要性分布
        importance_distribution = {}
        for f in pending:
            importance_distribution[f.importance] = importance_distribution.get(f.importance, 0) + 1

        # 健康评分 (0-100)
        health_score = min(100, (
            harvest_rate * 0.4 +
            hint_rate * 0.3 +
            min(avg_hints * 10, 30)
        ))

        return {
            "health_score": round(health_score, 1),
            "stats": stats,
            "metrics": {
                "harvest_rate": round(harvest_rate, 1),
                "hint_rate": round(hint_rate, 1),
                "avg_hints": avg_hints,
            },
            "importance_distribution": importance_distribution,
            "pending_count": len(pending),
            "recommendations": self._generate_recommendations(
                harvest_rate, hint_rate, avg_hints, pending
            ),
        }

    def _generate_recommendations(
        self,
        harvest_rate: float,
        hint_rate: float,
        avg_hints: float,
        pending: List[Foreshadow],
    ) -> List[str]:
        """生成改进建议"""
        recommendations = []

        if harvest_rate < 50:
            recommendations.append("回收率较低，建议加快伏笔回收节奏")

        if hint_rate < 30:
            recommendations.append("暗示率较低，建议为埋设的伏笔添加更多暗示")

        if avg_hints < 1:
            recommendations.append("平均暗示次数不足，考虑强化伏笔的读者印象")

        # 检查高重要性但长时间未处理的伏笔
        high_importance_pending = [f for f in pending if f.importance >= 8]
        if high_importance_pending:
            recommendations.append(
                f"有 {len(high_importance_pending)} 个高重要性伏笔待处理"
            )

        if not recommendations:
            recommendations.append("伏笔管理状态良好")

        return recommendations

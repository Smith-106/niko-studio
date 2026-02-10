"""
TokenService - Token 估算与成本控制服务

支持：
- 本地 Token 估算 (无需 API)
- 多模型支持 (GPT/Claude/Gemini)
- 预算控制与成本分析
- tiktoken 集成
"""

import json
import logging
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# 模型定价表 ($/1M tokens, 2024-2025 价格)
# ============================================================

MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # OpenAI Models
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "o1-preview": {"input": 15.00, "output": 60.00},
    "o1-mini": {"input": 3.00, "output": 12.00},

    # Anthropic Models
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-5-haiku": {"input": 0.80, "output": 4.00},
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-3-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},

    # Google Models
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},

    # 默认（未知模型）
    "default": {"input": 1.00, "output": 3.00},
}

# 模型到 tiktoken 编码的映射
MODEL_ENCODINGS: Dict[str, str] = {
    "gpt-4o": "o200k_base",
    "gpt-4o-mini": "o200k_base",
    "gpt-4-turbo": "cl100k_base",
    "gpt-4": "cl100k_base",
    "gpt-3.5-turbo": "cl100k_base",
    "o1-preview": "o200k_base",
    "o1-mini": "o200k_base",
    # Claude 和 Gemini 使用近似值
    "claude-3-5-sonnet": "cl100k_base",
    "claude-3-5-haiku": "cl100k_base",
    "claude-3-opus": "cl100k_base",
    "claude-3-sonnet": "cl100k_base",
    "claude-3-haiku": "cl100k_base",
    "gemini-2.0-flash": "cl100k_base",
    "gemini-1.5-pro": "cl100k_base",
    "gemini-1.5-flash": "cl100k_base",
    "default": "cl100k_base",
}


@dataclass
class TokenUsage:
    """Token 使用记录"""
    session_id: str
    model: str
    input_tokens: int
    output_tokens: int
    cost: float
    timestamp: datetime


@dataclass
class BudgetStatus:
    """预算状态"""
    session_id: str
    total_cost: float
    total_input_tokens: int
    total_output_tokens: int
    budget: float
    remaining: float
    usage_percent: float
    request_count: int


class TokenService:
    """
    Token 估算与成本控制服务

    提供本地 Token 估算、成本计算和预算控制功能。

    Usage:
        service = TokenService()
        tokens = service.estimate_tokens("Hello, world!")
        cost = service.estimate_cost(input_tokens=1000, output_tokens=500, model="gpt-4o")
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        config: Optional[Any] = None
    ):
        """
        初始化 TokenService

        Args:
            db_path: 数据库路径
            config: 可选的配置对象
        """
        self._config = config
        if db_path is None:
            db_path = ".writing/token_usage.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # 数据库
        self._db: Optional[sqlite3.Connection] = None
        self._db_lock = threading.Lock()
        self._init_db()

        # tiktoken 编码器缓存
        self._encoders: Dict[str, Any] = {}

        # 默认预算
        self._default_budget = 10.0  # $10 per session
        if config:
            self._default_budget = getattr(
                config.agent, 'max_cost_per_session', 10.0
            )

        logger.info(f"TokenService initialized: {self.db_path}")

    def _get_db(self) -> sqlite3.Connection:
        """获取数据库连接"""
        if self._db is None:
            self._db = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._db.row_factory = sqlite3.Row
        return self._db

    def _init_db(self):
        """初始化数据库"""
        db = self._get_db()
        db.executescript("""
            CREATE TABLE IF NOT EXISTS token_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                cost REAL DEFAULT 0.0,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS budgets (
                session_id TEXT PRIMARY KEY,
                budget REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_usage_session ON token_usage(session_id);
            CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON token_usage(timestamp);
        """)
        db.commit()

    def _get_encoder(self, model: str):
        """获取 tiktoken 编码器"""
        encoding_name = MODEL_ENCODINGS.get(model, MODEL_ENCODINGS["default"])

        if encoding_name not in self._encoders:
            try:
                import tiktoken
                self._encoders[encoding_name] = tiktoken.get_encoding(encoding_name)
            except ImportError:
                logger.warning("tiktoken not installed, using approximate counting")
                return None
            except Exception as e:
                logger.warning(f"Failed to load encoding {encoding_name}: {e}")
                return None

        return self._encoders[encoding_name]

    # ============================================================
    # Token 估算
    # ============================================================

    def estimate_tokens(self, text: str, model: str = "gpt-4o") -> int:
        """
        估算文本的 Token 数量

        Args:
            text: 输入文本
            model: 模型名称

        Returns:
            Token 数量
        """
        if not text:
            return 0

        encoder = self._get_encoder(model)
        if encoder:
            try:
                return len(encoder.encode(text))
            except Exception as e:
                logger.warning(f"Encoding failed: {e}, using approximation")

        # 回退：近似估算（中文约 2 字符/token，英文约 4 字符/token）
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        return int(chinese_chars / 1.5 + other_chars / 4)

    def estimate_messages(
        self,
        messages: List[Dict[str, Any]],
        model: str = "gpt-4o"
    ) -> int:
        """
        估算消息列表的 Token 数量

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            model: 模型名称

        Returns:
            Token 数量
        """
        total_tokens = 0

        # 消息格式开销
        tokens_per_message = 3  # role + content wrapper
        tokens_per_name = 1

        for message in messages:
            total_tokens += tokens_per_message
            content = message.get("content", "")
            if isinstance(content, str):
                total_tokens += self.estimate_tokens(content, model)
            elif isinstance(content, list):
                # 多模态消息
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        total_tokens += self.estimate_tokens(part["text"], model)
                    elif isinstance(part, dict) and "image_url" in part:
                        # 图像 token 估算（取决于分辨率）
                        total_tokens += 85  # 低分辨率基础值

            if "name" in message:
                total_tokens += tokens_per_name
                total_tokens += self.estimate_tokens(message["name"], model)

        # 对话结束 token
        total_tokens += 3

        return total_tokens

    # ============================================================
    # 成本分析
    # ============================================================

    def estimate_cost(
        self,
        input_tokens: int,
        output_tokens: int,
        model: str
    ) -> float:
        """
        估算成本

        Args:
            input_tokens: 输入 Token 数量
            output_tokens: 输出 Token 数量
            model: 模型名称

        Returns:
            成本 (USD)
        """
        pricing = self.get_model_pricing(model)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]
        return round(input_cost + output_cost, 6)

    def get_model_pricing(self, model: str) -> Dict[str, float]:
        """
        获取模型定价

        Args:
            model: 模型名称

        Returns:
            {"input": float, "output": float} ($/1M tokens)
        """
        # 尝试精确匹配
        if model in MODEL_PRICING:
            return MODEL_PRICING[model]

        # 尝试前缀匹配
        for key in MODEL_PRICING:
            if model.startswith(key):
                return MODEL_PRICING[key]

        # 返回默认值
        return MODEL_PRICING["default"]

    def list_models(self) -> List[Dict[str, Any]]:
        """
        列出支持的模型及其定价

        Returns:
            模型列表
        """
        models = []
        for model, pricing in MODEL_PRICING.items():
            if model == "default":
                continue
            models.append({
                "model": model,
                "input_price": pricing["input"],
                "output_price": pricing["output"],
                "encoding": MODEL_ENCODINGS.get(model, MODEL_ENCODINGS["default"])
            })
        return models

    # ============================================================
    # 预算控制
    # ============================================================

    def set_budget(self, session_id: str, budget: float) -> None:
        """
        设置会话预算

        Args:
            session_id: 会话 ID
            budget: 预算金额 (USD)
        """
        db = self._get_db()
        now = datetime.now().isoformat()

        db.execute("""
            INSERT OR REPLACE INTO budgets (session_id, budget, created_at, updated_at)
            VALUES (?, ?, COALESCE(
                (SELECT created_at FROM budgets WHERE session_id = ?),
                ?
            ), ?)
        """, (session_id, budget, session_id, now, now))
        db.commit()

        logger.info(f"Budget set: {session_id} = ${budget}")

    def get_budget(self, session_id: str) -> float:
        """
        获取会话预算

        Args:
            session_id: 会话 ID

        Returns:
            预算金额 (USD)
        """
        db = self._get_db()
        cursor = db.execute(
            "SELECT budget FROM budgets WHERE session_id = ?",
            (session_id,)
        )
        row = cursor.fetchone()
        return row['budget'] if row else self._default_budget

    def check_budget(
        self,
        estimated_cost: float,
        budget: Optional[float] = None,
        session_id: Optional[str] = None
    ) -> bool:
        """
        检查预算是否充足

        Args:
            estimated_cost: 预估成本
            budget: 预算金额（可选）
            session_id: 会话 ID（用于获取已使用金额）

        Returns:
            是否在预算内
        """
        if budget is None:
            budget = self._default_budget

        if session_id:
            status = self.get_budget_status(session_id)
            remaining = status.remaining
        else:
            remaining = budget

        return estimated_cost <= remaining

    def get_budget_status(self, session_id: Optional[str] = None) -> BudgetStatus:
        """
        获取预算状态

        Args:
            session_id: 会话 ID（可选）

        Returns:
            预算状态
        """
        if session_id is None:
            session_id = "default"

        db = self._get_db()

        # 获取预算
        budget = self.get_budget(session_id)

        # 统计使用情况
        cursor = db.execute("""
            SELECT
                COALESCE(SUM(input_tokens), 0) as total_input,
                COALESCE(SUM(output_tokens), 0) as total_output,
                COALESCE(SUM(cost), 0) as total_cost,
                COUNT(*) as request_count
            FROM token_usage
            WHERE session_id = ?
        """, (session_id,))

        row = cursor.fetchone()

        total_cost = row['total_cost']
        remaining = max(0, budget - total_cost)
        usage_percent = (total_cost / budget * 100) if budget > 0 else 0

        return BudgetStatus(
            session_id=session_id,
            total_cost=round(total_cost, 6),
            total_input_tokens=row['total_input'],
            total_output_tokens=row['total_output'],
            budget=budget,
            remaining=round(remaining, 6),
            usage_percent=round(usage_percent, 2),
            request_count=row['request_count']
        )

    def record_usage(
        self,
        tokens: int,
        cost: float,
        model: str,
        session_id: Optional[str] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None
    ) -> None:
        """
        记录 Token 使用

        Args:
            tokens: 总 Token 数（如果未提供 input/output）
            cost: 成本
            model: 模型名称
            session_id: 会话 ID
            input_tokens: 输入 Token 数
            output_tokens: 输出 Token 数
        """
        if session_id is None:
            session_id = "default"

        if input_tokens is None and output_tokens is None:
            # 假设 70% 输入，30% 输出
            input_tokens = int(tokens * 0.7)
            output_tokens = tokens - input_tokens

        db = self._get_db()
        with self._db_lock:
            db.execute("""
                INSERT INTO token_usage (session_id, model, input_tokens, output_tokens, cost, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                session_id, model, input_tokens or 0, output_tokens or 0,
                cost, datetime.now().isoformat()
            ))
            db.commit()

        logger.debug(f"Usage recorded: {model} {input_tokens}+{output_tokens} tokens, ${cost}")

    def get_usage_history(
        self,
        session_id: Optional[str] = None,
        limit: int = 100
    ) -> List[TokenUsage]:
        """
        获取使用历史

        Args:
            session_id: 会话 ID（可选，None 返回所有）
            limit: 返回数量限制

        Returns:
            使用记录列表
        """
        db = self._get_db()

        if session_id:
            cursor = db.execute("""
                SELECT * FROM token_usage
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (session_id, limit))
        else:
            cursor = db.execute("""
                SELECT * FROM token_usage
                ORDER BY timestamp DESC
                LIMIT ?
            """, (limit,))

        records = []
        for row in cursor.fetchall():
            records.append(TokenUsage(
                session_id=row['session_id'],
                model=row['model'],
                input_tokens=row['input_tokens'],
                output_tokens=row['output_tokens'],
                cost=row['cost'],
                timestamp=datetime.fromisoformat(row['timestamp'])
            ))
        return records

    def get_usage_summary(
        self,
        session_id: Optional[str] = None,
        group_by: str = "model"
    ) -> List[Dict[str, Any]]:
        """
        获取使用汇总

        Args:
            session_id: 会话 ID（可选）
            group_by: 分组方式 ("model" | "day" | "session")

        Returns:
            汇总列表
        """
        db = self._get_db()

        if group_by == "model":
            group_col = "model"
        elif group_by == "day":
            group_col = "DATE(timestamp)"
        else:
            group_col = "session_id"

        sql = f"""
            SELECT
                {group_col} as group_key,
                SUM(input_tokens) as total_input,
                SUM(output_tokens) as total_output,
                SUM(cost) as total_cost,
                COUNT(*) as request_count
            FROM token_usage
        """

        params: List[Any] = []
        if session_id:
            sql += " WHERE session_id = ?"
            params.append(session_id)

        sql += f" GROUP BY {group_col} ORDER BY total_cost DESC"

        cursor = db.execute(sql, params)

        results = []
        for row in cursor.fetchall():
            results.append({
                group_by: row['group_key'],
                "input_tokens": row['total_input'],
                "output_tokens": row['total_output'],
                "total_cost": round(row['total_cost'], 6),
                "request_count": row['request_count']
            })
        return results

    def clear_session_usage(self, session_id: str) -> int:
        """
        清除会话使用记录

        Args:
            session_id: 会话 ID

        Returns:
            删除的记录数
        """
        db = self._get_db()
        cursor = db.execute(
            "DELETE FROM token_usage WHERE session_id = ?",
            (session_id,)
        )
        db.commit()

        deleted = cursor.rowcount
        logger.info(f"Cleared {deleted} usage records for session {session_id}")
        return deleted

    def close(self):
        """关闭服务"""
        if self._db:
            self._db.close()
            self._db = None
        logger.info("TokenService closed")


# ============================================================
# 工厂函数
# ============================================================

_token_service: Optional[TokenService] = None


def get_token_service(
    db_path: Optional[str] = None,
    config: Optional[Any] = None
) -> TokenService:
    """
    获取 TokenService 单例

    Args:
        db_path: 数据库路径
        config: 配置对象

    Returns:
        TokenService 实例
    """
    global _token_service
    if _token_service is None:
        _token_service = TokenService(db_path=db_path, config=config)
    return _token_service


def reset_token_service():
    """重置 TokenService 单例（仅用于测试）"""
    global _token_service
    if _token_service:
        _token_service.close()
    _token_service = None

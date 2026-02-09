from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import logging
import tiktoken
from datetime import datetime


class ModelProvider(Enum):
    """支持的模型提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    LOCAL = "local"


@dataclass
class ModelPricing:
    """模型定价信息 (per 1M tokens)"""
    input_cost: float  # 输入 token 成本 ($/1M tokens)
    output_cost: float  # 输出 token 成本 ($/1M tokens)
    provider: ModelProvider
    context_window: int = 128000  # 默认上下文窗口


@dataclass
class TokenUsage:
    """Token 使用统计"""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "estimated_cost": self.estimated_cost,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class BudgetConfig:
    """预算配置"""
    max_cost_per_request: float = 1.0  # 单次请求最大成本 ($)
    max_cost_per_session: float = 10.0  # 会话最大成本 ($)
    max_tokens_per_request: int = 100000  # 单次请求最大 token
    warn_threshold: float = 0.8  # 警告阈值 (80%)


class BudgetExceededError(Exception):
    """预算超限异常"""
    def __init__(self, message: str, current_cost: float, limit: float):
        super().__init__(message)
        self.current_cost = current_cost
        self.limit = limit


# 预定义模型定价表
MODEL_PRICING: Dict[str, ModelPricing] = {
    # OpenAI 模型
    "gpt-4o": ModelPricing(2.5, 10.0, ModelProvider.OPENAI, 128000),
    "gpt-4o-mini": ModelPricing(0.15, 0.6, ModelProvider.OPENAI, 128000),
    "gpt-4-turbo": ModelPricing(10.0, 30.0, ModelProvider.OPENAI, 128000),
    "gpt-3.5-turbo": ModelPricing(0.5, 1.5, ModelProvider.OPENAI, 16385),
    # Anthropic 模型
    "claude-3-opus": ModelPricing(15.0, 75.0, ModelProvider.ANTHROPIC, 200000),
    "claude-3-sonnet": ModelPricing(3.0, 15.0, ModelProvider.ANTHROPIC, 200000),
    "claude-3-haiku": ModelPricing(0.25, 1.25, ModelProvider.ANTHROPIC, 200000),
    "claude-3.5-sonnet": ModelPricing(3.0, 15.0, ModelProvider.ANTHROPIC, 200000),
    # Google 模型
    "gemini-1.5-pro": ModelPricing(1.25, 5.0, ModelProvider.GOOGLE, 1000000),
    "gemini-1.5-flash": ModelPricing(0.075, 0.3, ModelProvider.GOOGLE, 1000000),
    # 本地模型 (无成本)
    "local": ModelPricing(0.0, 0.0, ModelProvider.LOCAL, 32000),
}


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the system.
    Implements the Claude Code Workflow (CCW) 6-Field Prompt Protocol.
    Includes Token cost estimation and budget control.
    """

    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        self.name = name
        self.config = config or {}
        self.logger = logging.getLogger(f"agent.{name}")

        # Token 成本估算相关
        self._model_name: str = self.config.get("model", "gpt-4o")
        self._tokenizer = self._get_tokenizer()
        self._usage_history: List[TokenUsage] = []
        self._session_cost: float = 0.0
        self._budget_config = BudgetConfig(
            max_cost_per_request=self.config.get("max_cost_per_request", 1.0),
            max_cost_per_session=self.config.get("max_cost_per_session", 10.0),
            max_tokens_per_request=self.config.get("max_tokens_per_request", 100000),
            warn_threshold=self.config.get("budget_warn_threshold", 0.8)
        )

    def _get_tokenizer(self):
        """获取 tokenizer，默认使用 cl100k_base (GPT-4/Claude 兼容)"""
        try:
            return tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.logger.warning("Failed to load tiktoken, using approximate counting")
            return None

    def count_tokens(self, text: str) -> int:
        """
        计算文本的 token 数量

        Args:
            text: 输入文本

        Returns:
            int: token 数量
        """
        if self._tokenizer:
            return len(self._tokenizer.encode(text))
        # 降级方案：近似估算 (1 token ≈ 4 字符英文，2 字符中文)
        return len(text) // 3

    def estimate_cost(
        self,
        input_text: str,
        estimated_output_tokens: Optional[int] = None,
        model: Optional[str] = None
    ) -> TokenUsage:
        """
        估算请求成本

        Args:
            input_text: 输入文本
            estimated_output_tokens: 预估输出 token 数，默认为输入的 50%
            model: 模型名称，默认使用 agent 配置的模型

        Returns:
            TokenUsage: Token 使用统计
        """
        model_name = model or self._model_name
        pricing = MODEL_PRICING.get(model_name, MODEL_PRICING["gpt-4o"])

        input_tokens = self.count_tokens(input_text)
        output_tokens = estimated_output_tokens or max(input_tokens // 2, 500)
        total_tokens = input_tokens + output_tokens

        # 计算成本 (pricing 是 per 1M tokens)
        input_cost = (input_tokens / 1_000_000) * pricing.input_cost
        output_cost = (output_tokens / 1_000_000) * pricing.output_cost
        total_cost = input_cost + output_cost

        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            estimated_cost=total_cost
        )

    def check_budget(
        self,
        estimated_usage: TokenUsage,
        raise_on_exceed: bool = True
    ) -> Tuple[bool, Optional[str]]:
        """
        检查预算是否超限

        Args:
            estimated_usage: 预估的 Token 使用量
            raise_on_exceed: 超限时是否抛出异常

        Returns:
            Tuple[bool, Optional[str]]: (是否通过, 警告消息)
        """
        warnings = []

        # 检查单次请求成本
        if estimated_usage.estimated_cost > self._budget_config.max_cost_per_request:
            msg = f"Request cost ${estimated_usage.estimated_cost:.4f} exceeds limit ${self._budget_config.max_cost_per_request}"
            if raise_on_exceed:
                raise BudgetExceededError(
                    msg,
                    estimated_usage.estimated_cost,
                    self._budget_config.max_cost_per_request
                )
            return False, msg

        # 检查会话总成本
        projected_session_cost = self._session_cost + estimated_usage.estimated_cost
        if projected_session_cost > self._budget_config.max_cost_per_session:
            msg = f"Session cost ${projected_session_cost:.4f} would exceed limit ${self._budget_config.max_cost_per_session}"
            if raise_on_exceed:
                raise BudgetExceededError(
                    msg,
                    projected_session_cost,
                    self._budget_config.max_cost_per_session
                )
            return False, msg

        # 检查 token 数量
        if estimated_usage.total_tokens > self._budget_config.max_tokens_per_request:
            msg = f"Token count {estimated_usage.total_tokens} exceeds limit {self._budget_config.max_tokens_per_request}"
            if raise_on_exceed:
                raise BudgetExceededError(
                    msg,
                    estimated_usage.total_tokens,
                    self._budget_config.max_tokens_per_request
                )
            return False, msg

        # 警告阈值检查
        warn_threshold = self._budget_config.warn_threshold
        if estimated_usage.estimated_cost > self._budget_config.max_cost_per_request * warn_threshold:
            warnings.append(f"Request approaching cost limit ({estimated_usage.estimated_cost:.4f}/{self._budget_config.max_cost_per_request})")

        if projected_session_cost > self._budget_config.max_cost_per_session * warn_threshold:
            warnings.append(f"Session approaching cost limit ({projected_session_cost:.4f}/{self._budget_config.max_cost_per_session})")

        warning_msg = "; ".join(warnings) if warnings else None
        if warning_msg:
            self.logger.warning(warning_msg)

        return True, warning_msg

    def record_usage(self, usage: TokenUsage) -> None:
        """
        记录实际 Token 使用量

        Args:
            usage: Token 使用统计
        """
        self._usage_history.append(usage)
        self._session_cost += usage.estimated_cost
        self.logger.info(
            f"Token usage recorded: {usage.total_tokens} tokens, "
            f"${usage.estimated_cost:.4f}, session total: ${self._session_cost:.4f}"
        )

    def get_usage_summary(self) -> Dict[str, Any]:
        """
        获取使用量汇总

        Returns:
            Dict: 使用量汇总信息
        """
        total_input = sum(u.input_tokens for u in self._usage_history)
        total_output = sum(u.output_tokens for u in self._usage_history)

        return {
            "agent_name": self.name,
            "model": self._model_name,
            "request_count": len(self._usage_history),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_tokens": total_input + total_output,
            "total_cost": self._session_cost,
            "budget_remaining": self._budget_config.max_cost_per_session - self._session_cost,
            "history": [u.to_dict() for u in self._usage_history[-10:]]  # 最近 10 条
        }

    def reset_session(self) -> None:
        """重置会话统计"""
        self._usage_history.clear()
        self._session_cost = 0.0
        self.logger.info("Session usage reset")

    def construct_prompt(
        self,
        purpose: str,
        task: str,
        mode: str,
        context: str,
        expected: str,
        rules: str
    ) -> str:
        """
        Constructs a structured prompt following the CCW 6-Field Protocol.
        
        Args:
            purpose (str): High-level goal of the request.
            task (str): Specific action or implementation task.
            mode (str): The operational mode (e.g., 'analysis', 'execution', 'planning').
            context (str): Summary of relevant evidence, memory, or file contents.
            expected (str): Definition of the expected output format and deliverables.
            rules (str): Constraints, patterns, and style guidelines to follow.

        Returns:
            str: The fully formatted prompt string.
        """
        return f"""
PURPOSE: {purpose}
TASK: {task}
MODE: {mode}
CONTEXT: {context}
EXPECTED: {expected}
RULES: {rules}
"""

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        """
        Main execution method for the agent.
        Must be implemented by subclasses.
        """
        pass

    def log_activity(self, message: str, level: str = "INFO"):
        """Logs agent activity."""
        if level == "INFO":
            self.logger.info(message)
        elif level == "WARNING":
            self.logger.warning(message)
        elif level == "ERROR":
            self.logger.error(message)
        elif level == "DEBUG":
            self.logger.debug(message)

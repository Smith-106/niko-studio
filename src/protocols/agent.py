"""
Agent Protocol

Defines the protocol for agent implementations.
Supports structural subtyping with runtime checking.
"""

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class AgentProtocol(Protocol):
    """Agent 抽象接口

    定义 Agent 的核心能力，包括任务执行、验证和输出格式化。
    所有 Agent 必须实现此接口以支持结构性子类型。
    """

    @property
    def name(self) -> str:
        """Agent 名称"""
        ...

    async def execute(
        self,
        input_data: Any,
        **kwargs,
    ) -> Any:
        """执行 Agent 任务

        Args:
            input_data: 输入数据
            **kwargs: 额外参数

        Returns:
            执行结果
        """
        ...

    def validate(
        self,
        input_data: Any,
    ) -> tuple[bool, list[str]]:
        """验证输入数据

        Args:
            input_data: 待验证的输入数据

        Returns:
            (是否通过验证, 错误消息列表)
        """
        ...

    def format_output(
        self,
        result: Any,
        **kwargs,
    ) -> dict[str, Any]:
        """格式化输出结果

        Args:
            result: 原始结果
            **kwargs: 额外参数

        Returns:
            格式化后的输出字典
        """
        ...

    async def health_check(self) -> bool:
        """检查 Agent 健康状态

        Returns:
            True 表示健康，False 表示不可用
        """
        ...
